
var colors = {
	background:        0xeeeeee,
	cylinder:          0xff00ff,
	property_boundary: 0x5d5d5d,
	black:             0x000000,
	white:             0xffffff,
	soft_white:        0x404040,
	terrain_frame:     0x009900,
};

var cylinder_count = 500;

var scene = new THREE.Scene();

var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(20, 20, 20);
camera.lookAt(new THREE.Vector3(5,5,5));

// Resize the camera when the window is resized
window.addEventListener('resize', function(event){
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
		render();
	});

// This brings in basic controls for our view, like rotating, panning, and zooming.
controls = new THREE.OrbitControls(camera);
controls.addEventListener('change', render);
controls.zoomSpeed = 3.0;
controls.minDistance = 1;
controls.maxDistance = 100;
controls.target = new THREE.Vector3(5, 5, 5);

var renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(colors.background, 1);

document.body.appendChild(renderer.domElement);

// Generate a bunch of cylinders in random locations, within the box.
var cylinder_geometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10);
var cylinder_material = new THREE.MeshLambertMaterial({color: colors.cylinder});

var cylinder = new THREE.Mesh(cylinder_geometry, cylinder_material);

// Always draw a cylinder at the center of the box, to make it
//   easy to look at a sample cylinder.
cylinder.position.x = 5;
cylinder.position.y = 5;
cylinder.position.z = 5;
scene.add(cylinder);

for (var i = 0; i < cylinder_count-1; i += 1) {
	var cylinder = new THREE.Mesh(cylinder_geometry, cylinder_material);
	// We multiply by 7 for y because we draw the terrain at 7.
	// Otherwise, we multiply by 10 because the property box has length 10.
	cylinder.position.x = 10*Math.random();
	cylinder.position.y = 7*Math.random();
	cylinder.position.z = 10*Math.random();
	scene.add(cylinder);
}

var reticle = new THREE.Mesh(new THREE.SphereGeometry(0.05),
							 new THREE.MeshLambertMaterial({color: colors.black}));
reticle.position.x = controls.target.x;
reticle.position.y = controls.target.y;
reticle.position.z = controls.target.z;
scene.add(reticle);

// This creates a wireframe box to encompass the property, but without the diagonals.
var property_boundary = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
var box = new THREE.EdgesHelper(property_boundary, colors.property_boundary);
box.applyMatrix(new THREE.Matrix4().makeTranslation(5, 5, 5));
scene.add(box);

// A spotlight gives us shadows.
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
for (i = 0; i < gridSize; ++i) {
	for (j = 0; j < gridSize; ++j) {
		elevation.vertices.push(new THREE.Vector3(i/3, Math.random()/3, j/3));
	}
}

// Use those points to create faces for the terrain.
for (i = 0; i < gridSize - 1; ++i) {
	for (j = 0; j < gridSize - 1; ++j) {
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

//Add labels for the axis hardcoded position currently
var spritey = makeTextSprite( "Z",
		{ fontsize: 25,size: 250, borderColor: {r:255, g:0, b:0, a:1.0}, backgroundColor: {r:255, g:100, b:100, a:0.8} } );
	spritey.position.set(0,11,0);
	scene.add( spritey );
var spritey = makeTextSprite( "X",
		{ fontsize: 25,size: 250, borderColor: {r:255, g:0, b:0, a:1.0}, backgroundColor: {r:255, g:100, b:100, a:0.8} } );
	spritey.position.set(0,0,11);
	scene.add( spritey );
var spritey = makeTextSprite( "Y",
		{ fontsize: 25,size: 250, borderColor: {r:255, g:0, b:0, a:1.0}, backgroundColor: {r:255, g:100, b:100, a:0.8} } );
	spritey.position.set(11,0,0);
	scene.add( spritey );

function makeTextSprite( message, parameters ) {
		if ( parameters === undefined ) parameters = {};
		var fontface = parameters.hasOwnProperty("fontface") ? parameters["fontface"] : "Arial";
		var fontsize = parameters.hasOwnProperty("fontsize") ? parameters["fontsize"] : 18;
		var size = parameters.hasOwnProperty("size") ? parameters["size"] : 100;
		var borderThickness = parameters.hasOwnProperty("borderThickness") ? parameters["borderThickness"] : 4;
		var borderColor = parameters.hasOwnProperty("borderColor") ?parameters["borderColor"] : { r:0, g:0, b:0, a:1.0 };
		var backgroundColor = parameters.hasOwnProperty("backgroundColor") ?parameters["backgroundColor"] : { r:255, g:255, b:255, a:1.0 };
		var textColor = parameters.hasOwnProperty("textColor") ?parameters["textColor"] : { r:0, g:0, b:0, a:1.0 };

		var canvas = document.createElement('canvas');
		canvas.width=size;
		canvas.height=size;
		var context = canvas.getContext('2d');
		context.font = "Bold " + fontsize + "px " + fontface;
		var metrics = context.measureText( message );
		var textWidth = metrics.width;

		context.textAlign = 'center'
		context.fillStyle = "rgba("+textColor.r+", "+textColor.g+", "+textColor.b+", 1.0)";
		context.fillText( message, size/2, size/2 );
		
		var texture = new THREE.Texture(canvas)
		texture.needsUpdate = true;

		var spriteMaterial = new THREE.SpriteMaterial( { map: texture, useScreenCoordinates: false } );
		var sprite = new THREE.Sprite( spriteMaterial );
		sprite.scale.set(0.5 * fontsize, 0.25 * fontsize, 0.75 * fontsize);
		return sprite;
}

function render() {
	reticle.position.x = controls.target.x;
	reticle.position.y = controls.target.y;
	reticle.position.z = controls.target.z;
	renderer.render(scene, camera);
}
render();
