// Visual Studio Code uses these to hush warnings about
//   variable names it can't find declared.
/* global dat */
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
	//this will update the mouse position as well as make the tooltipSprite follow the mouse
	tooltipSprite.position.x= event.clientX-(window.innerWidth/2);
	tooltipSprite.position.y= -event.clientY+(window.innerHeight/2)+20;
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
camera.up.set(0, 0, 1);
camera.position.set(20, 20, 20);
camera.lookAt(new THREE.Vector3(5, 5, 5));

var width = window.innerWidth;
var height = window.innerHeight;
//orthographic camera for displaying tooltips
var cameraOrtho = new THREE.OrthographicCamera( - width / 2, width / 2, height / 2, - height / 2, 1, 1000 );
//The z position of the orthgraphic camera seems to need to be "above" where the sprites are drawn
//setting it to one here
cameraOrtho.position.z = 1;
cameraOrtho.position.x = 0;
cameraOrtho.position.y = 0;
var sceneOrtho = new THREE.Scene();

var tooltipSprite = makeTextSprite("Hello, I'm a Tooltip", {fontsize: 18, size: 250}); //Create a basic tooltip display sprite TODO: Make tooltip display info about current drillhole
tooltipSprite.scale.set(250,250,1);
sceneOrtho.add(tooltipSprite);

// Resize the camera when the window is resized.
window.addEventListener('resize', function (event) {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	cameraOrtho.left= - window.innerWidth / 2;
	cameraOrtho.right=  window.innerWidth / 2;
	cameraOrtho.top= window.innerHeight / 2;
	cameraOrtho.bottom=- window.innerHeight / 2;


	cameraOrtho.updateProjectionMatrix();

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
var cylinder_geometry = new THREE.CylinderGeometry(0.01, 0.01, 0.3, 10);
var cylinder_material = new THREE.MeshLambertMaterial({ color: colors.pink });

var cylinder = new THREE.Mesh(cylinder_geometry, cylinder_material);

// Always draw a cylinder at the center of the box, to make it
//   easy to look at a sample cylinder.
// This one is not counted in the cylinder_count.
cylinder.position.x = 5; // TODO: Hard coded to box's size.
cylinder.position.y = 5; // TODO: Hard coded to box's size.
cylinder.position.z = 5; // TODO: Hard coded to box's size.

cylinder.rotation.x = Math.PI / 2 * Math.random();
cylinder.rotation.y = Math.PI / 2 * Math.random();
cylinder.rotation.z = Math.PI / 2 * Math.random();

var cylinders = [];

scene.add(cylinder);

// This number is totally arbitrary.
var cylinder_count = 100;
var cylinder_max = 10000;

// Generate more than we'll ever use, but only ever add the first
//   cylinder_count to the scene.
for (var i = 0; i < cylinder_max; i += 1) {
	// We create an individual material for each cylinder so that
	//   modifications to one - when the raytracer hits it - doesn't change
	//   the others.
	var cylinder_material = new THREE.MeshPhongMaterial({
		color: colors.pink,
		shading: THREE.NoShading,
	});
	var cylinder = new THREE.Mesh(cylinder_geometry, cylinder_material);

	// Rotate it to align with the z axis.
	cylinder.rotation.x = Math.PI / 2 * Math.random();
	cylinder.rotation.y = Math.PI / 2 * Math.random();
	cylinder.rotation.z = Math.PI / 2 * Math.random();


	// We multiply by 7 for z because we draw the terrain at 7.
	// Otherwise, we multiply by 10 because the property box has length 10.
	cylinder.position.x = 10 * Math.random(); // TODO: Hard coded to box's size.
	cylinder.position.y = 10 * Math.random(); // TODO: Hard coded to box's size.
	cylinder.position.z = 7 * Math.random(); // TODO: Hard coded to box's size.

	// Only so man should be rendered at a time.
	if (i >= cylinder_count) {
		cylinder.visible = false;
	}

	cylinders.push(cylinder);
	scene.add(cylinder);
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
spotlight.position.set(-35, -35, 80);
scene.add(spotlight);

// And ambiant light ensures every face is lit, even if it's just a little.
scene.add(new THREE.AmbientLight(colors.soft_white));

// Add a terrain wireframe.
var gridSize = 31;
var elevation = new THREE.Geometry();

// Create points for a grid, with a random y offset.
for (var i = 0; i < gridSize; ++i) {
	for (var j = 0; j < gridSize; ++j) {
		elevation.vertices.push(new THREE.Vector3(i / 3, j / 3, Math.random() / 3));
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
surface.position.set(0, 0, 7);
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

// dat.gui.js lets us modify variables live, on the page.
var gui = new dat.GUI();
gui.add(this, 'cylinder_count')
	.name("Cylinders")
	.min(1)
	.max(cylinder_max)
	.step(100)
	.onFinishChange(function () {
		if (cylinder_count < 1) {
			cylinder_count = 1;
		}
		for (var i = 0; i < cylinders.length; i += 1) {
			if (i < cylinder_count) {
				cylinders[i].visible = true;
			} else {
				cylinders[i].visible = false;
			}
		}
});

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
			//set sprite to be in front of the orthographic camera so it is visible
			tooltipSprite.position.z=0;
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
		//set sprite to be behind the ortographic camer so it is not visible
		tooltipSprite.position.z=5;
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
