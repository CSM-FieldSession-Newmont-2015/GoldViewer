
var colors = {
	background:        0xeeeeee,
	cylinder:          0xff00ff,
	property_boundary: 0x5d5d5d,
	white:             0xffffff,
	soft_white:        0x404040,
	terrain_frame:     0x009900,
};

var cylinder_count = 950;

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

var renderer = new THREE.WebGLRenderer({});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(colors.background, 1);
// Enable shadow stuff.
renderer.shadowMapEnabled = true;
renderer.shadowMapType = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);

// Generate a bunch of cylinders in random locations, within the box.
var cylinder_geometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10);
var cylinder_material = new THREE.MeshLambertMaterial({color: colors.cylinder});

for (var i = 0; i < cylinder_count; i += 1) {
	var cylinder = new THREE.Mesh(cylinder_geometry, cylinder_material);
	// We multiply by 7 for y because we draw the terrain at 7.
	// Otherwise, we multiply by 10 because the property box has length 10.
	cylinder.position.x = 10*Math.random();
	cylinder.position.y = 7*Math.random();
	cylinder.position.z = 10*Math.random();
	if (cylinder_count <= 1000) {
		// Shadows slow things down, so we only turn them on when we can afford it.
		//   1000 is an arbitrary cut off.
		cylinder.castShadow = true;
	}
	scene.add(cylinder);
}

// This creates a wireframe box to encompass the property, but without the diagonals.
var property_boundary = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
var box = new THREE.EdgesHelper(property_boundary, colors.property_boundary);
box.applyMatrix(new THREE.Matrix4().makeTranslation(5, 5, 5));
box.castShadow = true;
scene.add(box);

// This creates a floor of sorts for everything to sit on. It helps orient oneself.
var plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(35, 35),
	                       new THREE.MeshLambertMaterial({color: colors.white}));
plane.receiveShadow = true;
// Render both sides. Otherwise, it goes invicible.
plane.material.side = THREE.DoubleSide;
// We want the plane flat in the xz plane.
plane.rotation.x = -0.5*Math.PI;
// Position *just* below the cube, so the cube and plane don't compete for the screen.
//   and center the plane under the center of the cube.
plane.position.set(5, -0.1, 5);
scene.add(plane);

// A spotlight gives us shadows.
var spotlight = new THREE.SpotLight(colors.white);
// This position is pretty arbitrary. It looks nice here, so I put it here.
spotlight.position.set(-35, 80, -35);
spotlight.castShadow = true;
scene.add(spotlight);

// And ambiant light ensures every face is lit, even if it's just a little.
scene.add(new THREE.AmbientLight(colors.soft_white));

// Add a terrain wireframe.
var gridSize = 11;
var elevation = new THREE.Geometry();

// Create points for a grid, with a random y offset.
for (i = 0; i < gridSize; ++i) {
	for (j = 0; j < gridSize; ++j) {
		elevation.vertices.push(new THREE.Vector3(i, Math.random(), j));
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

function render() {
	renderer.render(scene, camera);
}
render();
