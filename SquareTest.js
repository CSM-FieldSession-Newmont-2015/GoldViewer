// Visual Studio Code uses these to hush warnings about
//   variable names it can't find declared.
/* global Stats */
/* global THREE */
var container = document.createElement('div');
document.body.appendChild(container);

var raycaster = new THREE.Raycaster();
raycaster.linePrecision = 0;

var mouse = new THREE.Vector2();
var INTERSECTED;
document.addEventListener('mousemove', onDocumentMouseMove, false);
function onDocumentMouseMove(event) {

	event.preventDefault();
	sprite.position.x= event.clientX-(window.innerWidth/2);
	sprite.position.y= -event.clientY+(window.innerHeight/2)+20;
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

}

var colors = {
	axes: 0x5d5d5d,
	background: 0xeeeeee,
	black: 0x000000,
	pink: 0xff00ff,
	soft_white: 0x404040,
	terrain_frame: 0x009900,
	white: 0xffffff,
};

var scene = new THREE.Scene();

var camera = new THREE.PerspectiveCamera(
	45, // FOV
	window.innerWidth / window.innerHeight, // Aspect
	0.1, // Near
	1000); // Far
camera.position.set(20, 20, 20);
camera.lookAt(new THREE.Vector3(5, 5, 5));

var width = window.innerWidth;
var height = window.innerHeight;
//orthographic camera for displaying tooltips
cameraOrtho = new THREE.OrthographicCamera( - width / 2, width / 2, height / 2, - height / 2, 1, 1000 );
		cameraOrtho.position.z = 1;
		cameraOrtho.position.x = 0;
		cameraOrtho.position.y = 0;
sceneOrtho = new THREE.Scene();

var sprite = makeTextSprite("Hello, I'm a Tooltip", {
	fontsize: 18,
	size: 250});
sprite.position.set(0,100,0);
sprite.scale.set(250,250,1);
sceneOrtho.add(sprite);

// Resize the camera when the window is resized.
window.addEventListener('resize', function (event) {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

// Bring in basic controls for our view, like rotating, panning, and zooming.
var controls = new THREE.OrbitControls(camera);
controls.zoomSpeed = 3.0;
controls.minDistance = 1;
controls.maxDistance = 100;
controls.target = new THREE.Vector3(5, 5, 5);
controls.autoRotate = true;

var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(colors.background, 1);
renderer.sortObjects = false;
renderer.autoClear=false;
container.appendChild(renderer.domElement);

renderer.domElement.addEventListener('mousedown', function (event) {
	controls.autoRotate = false;
});

var stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.right = '0px';
stats.domElement.style.bottom = '0px';
container.appendChild(stats.domElement);

// Generate a bunch of cylinders in random locations, within the box.
var cylinder_geometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10);
var cylinder_material = new THREE.MeshLambertMaterial({ color: colors.pink });

var cylinder = new THREE.Mesh(cylinder_geometry, cylinder_material);

// Always draw a cylinder at the center of the box, to make it
//   easy to look at a sample cylinder.
cylinder.position.x = 5; // TODO: Hard coded to box's size.
cylinder.position.y = 5; // TODO: Hard coded to box's size.
cylinder.position.z = 5; // TODO: Hard coded to box's size.

var cylinders = [];

cylinders.push(cylinder);

// This number is totally arbitrary.
var cylinder_count = 1000;

// Subtract 1 from count because we make the first cylinder manually, with a
//   hard coded location.
for (var i = 0; i < cylinder_count - 1; i += 1) {
	// We create an individual material for each cylinder so that
	//   modifications to one - when the raytracer hits it - doesn't change
	//   the others.
	var cylinder_material = new THREE.MeshPhongMaterial({
		color: colors.pink,
		shading: THREE.NoShading,
	});
	var cylinder = new THREE.Mesh(cylinder_geometry, cylinder_material);

	// We multiply by 7 for y because we draw the terrain at 7.
	// Otherwise, we multiply by 10 because the property box has length 10.
	cylinder.position.x = 10 * Math.random(); // TODO: Hard coded to box's size.
	cylinder.position.y = 7 * Math.random(); // TODO: Hard coded to box's size.
	cylinder.position.z = 10 * Math.random(); // TODO: Hard coded to box's size.

	cylinders.push(cylinder);
}

for (var i = 0; i < cylinders.length; i += 1) {
	scene.add(cylinders[i]);
}


var reticle = new THREE.Mesh(
	new THREE.SphereGeometry(0.05),
	new THREE.MeshLambertMaterial({ color: colors.black }));
reticle.position.x = controls.target.x;
reticle.position.y = controls.target.y;
reticle.position.z = controls.target.z;
scene.add(reticle);

// This creates a wireframe box to encompass the property, but without the diagonals.
var property_boundary = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
var box = new THREE.EdgesHelper(property_boundary, colors.axes);
box.applyMatrix(new THREE.Matrix4().makeTranslation(5, 5, 5));
scene.add(box);

// A spotlight gives us basic shading.
var spotlight = new THREE.SpotLight(colors.white);
// This position is pretty arbitrary. It looks nice here, so I put it here.
spotlight.position.set(-35, 80, -35);
scene.add(spotlight);

// And ambiant light ensures every face is lit, even if it's just a little.
scene.add(new THREE.AmbientLight(colors.soft_white));

// Add a terrain wireframe.
var gridSize = 31;
var elevation = new THREE.Geometry();

// Create points for a grid, with a random y offset.
for (var i = 0; i < gridSize; ++i) {
	for (var j = 0; j < gridSize; ++j) {
		elevation.vertices.push(new THREE.Vector3(i / 3, Math.random() / 3, j / 3));
	}
}

// Use those points to create faces for the terrain.
for (var i = 0; i < gridSize - 1; ++i) {
	for (var j = 0; j < gridSize - 1; ++j) {
		elevation.faces.push(
			new THREE.Face3(j + i * gridSize, j + 1 + i * gridSize, j + (i + 1) * gridSize),
			new THREE.Face3(j + (i + 1) * gridSize, j + 1 + i * gridSize, j + 1 + (i + 1) * gridSize)
			);
	}
}

var surface = new THREE.Mesh(elevation, new THREE.MeshBasicMaterial({
	color: colors.terrain_frame,
	wireframe: true,
}));
surface.position.set(0, 7, 0);
scene.add(surface);

// Add labels for each axis.
var axis_format = {
	fontsize: 18,
	size: 250
};

var spriteX = makeTextSprite("X", axis_format);
spriteX.position.set(11, 0, 0); // TODO: Hard coded to box's size.
scene.add(spriteX);

var spriteY = makeTextSprite("Y", axis_format);
spriteY.position.set(0, 11, 0); // TODO: Hard coded to box's size.
scene.add(spriteY);

var spriteZ = makeTextSprite("Z", axis_format);
spriteZ.position.set(0, 0, 11); // TODO: Hard coded to box's size.
scene.add(spriteZ);


function makeTextSprite(message, parameters) {
	if (parameters === undefined) parameters = {};
	var fontface = parameters.hasOwnProperty("fontface") ? parameters["fontface"] : "Arial";
	var fontsize = parameters.hasOwnProperty("fontsize") ? parameters["fontsize"] : 18;
	var size = parameters.hasOwnProperty("size") ? parameters["size"] : 100;
	var textColor = parameters.hasOwnProperty("textColor") ? parameters["textColor"] : { r: 0, g: 0, b: 0, a: 1.0 };

	var canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	var context = canvas.getContext('2d');
	context.font = "Bold " + fontsize + "px " + fontface;
	// These are unused.
	//		var metrics = context.measureText( message );
	//		var textWidth = metrics.width;

	context.textAlign = 'center';
	context.fillStyle = "rgba(" + textColor.r + ", " + textColor.g + ", " + textColor.b + ", 1.0)";
	context.fillText(message, size / 2, size / 2);

	var texture = new THREE.Texture(canvas);
	texture.needsUpdate = true;

	var spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, useScreenCoordinates: false });
	var sprite = new THREE.Sprite(spriteMaterial);
	sprite.scale.set(0.5 * fontsize, 0.25 * fontsize, 0.75 * fontsize);

	return sprite;
}

function checkMouseIntercept(){
	raycaster.setFromCamera(mouse, camera);

	var intersects = raycaster.intersectObjects(cylinders);

	if (intersects.length > 0) {
		if (INTERSECTED != intersects[0].object) {
			if (INTERSECTED) {
				var material = INTERSECTED.material;
				if (material.emissive) {
					material.emissive.setHex(INTERSECTED.currentHex);
				} else {
					material.color.setHex(INTERSECTED.currentHex);
				}
			}
			INTERSECTED = intersects[0].object;
			sprite.position.z=0;
			material = INTERSECTED.material;
			if (material.emissive) {
				INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
				material.emissive.setHex(0xff0000);
			}
			else {
				INTERSECTED.currentHex = material.color.getHex();
				material.color.setHex(0xff0000);
			}

		}

	} else {
		if (INTERSECTED) {
			material = INTERSECTED.material;

			if (material.emissive) {
				material.emissive.setHex(INTERSECTED.currentHex);
			} else {
				material.color.setHex(INTERSECTED.currentHex);
			}
		}
		sprite.position.z=5;
		INTERSECTED = null;
	}
}

function render() {
	requestAnimationFrame(render);
	controls.update();
	stats.update();

	camera.updateMatrixWorld();

	checkMouseIntercept();

	reticle.position.x = controls.target.x;
	reticle.position.y = controls.target.y;
	reticle.position.z = controls.target.z;


	renderer.clear();
	renderer.render( scene, camera );
	renderer.clearDepth();
	renderer.render( sceneOrtho, cameraOrtho );
}
render();
