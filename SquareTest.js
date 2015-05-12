var scene = new THREE.Scene();

var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

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

var renderer = new THREE.WebGLRenderer({
	antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xeeeeee, 1);
// Enable shadow stuff.
renderer.shadowMapEnabled = true;
renderer.shadowMapType = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);

// Generate a bunch of cylinders in random locations, within the box.
var cylinder_geometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10);
var pink_material = new THREE.MeshLambertMaterial({color: 0xff00ff});

for (var i = 0; i < 200; i += 1) {
	var cylinder = new THREE.Mesh(cylinder_geometry, pink_material);
	// We multiply by 10 because the property_boundary size is 10.
	cylinder.position.x = 10*Math.random();
	cylinder.position.y = 10*Math.random();
	cylinder.position.z = 10*Math.random();
	cylinder.castShadow = true;
	scene.add(cylinder);
}

// This creates a wireframe box to encompass the property, but without the diagonals.
var property_boundary = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
var box = new THREE.EdgesHelper(property_boundary, 0x5d5d5d);
box.applyMatrix(new THREE.Matrix4().makeTranslation(5, 5, 5));
scene.add(box);

// This creates a floor of sorts for everything to sit on. It helps orient oneself.
var plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(35, 35),
	                       new THREE.MeshLambertMaterial({color: 0xffffff}));
plane.receiveShadow = true;
// Render both sides. Otherwise, it goes invicible.
plane.material.side = THREE.DoubleSide;
// We want the plane flat in the xz plane.
plane.rotation.x = -0.5*Math.PI;
// Position *just* below the cube, so the cube and plane don't compete for the screen.
plane.position.y = -0.1; 
// Center the plane under the center of the cube.
plane.position.x = 5;
plane.position.z = 5;
scene.add(plane);

// A spotlight gives us shadows.
var spotlight = new THREE.SpotLight(0xffffff);
// This position is pretty arbitrary. It looks nice here, so I put it here.
spotlight.position.set(-35, 80, -35);
spotlight.castShadow = true;
scene.add(spotlight);

// And ambiant light ensures every face is lit, even if it's just a little.
scene.add(new THREE.AmbientLight(0x404040));

//********** Surface ***********
			var gridSize = 11;

			var elevation = new THREE.Geometry();
			for (i = 0; i < gridSize; ++i) {
				for (j = 0; j < gridSize; ++j) {
					elevation.vertices.push(
						new THREE.Vector3(i, Math.random()-0.5, j)
						);
				}
			}

			for (i = 0; i < gridSize - 1; ++i) {
				for (j = 0; j < gridSize - 1; ++j) {
					elevation.faces.push(
						new THREE.Face3(j + i * gridSize, j + 1 + i * gridSize, j + (i + 1) * gridSize),
						new THREE.Face3(j + (i + 1) * gridSize, j + 1 + i * gridSize, j + 1 + (i + 1) * gridSize)
						);
				}
			}

			elevation.applyMatrix(new THREE.Matrix4().makeTranslation(0, 8, 0));
			elevation.computeBoundingBox();

			var material = new THREE.MeshBasicMaterial({ color: 0x006600 });
			material.wireframe = true;
			var surface = new THREE.Mesh(elevation, material);
			surface.position.y = -5;
			scene.add(surface);

			camera.position.z = 5;
			camera.position.y = 5;
			camera.lookAt(new THREE.Vector3(5,5,5));

//******************************
camera.position.x = 20;
camera.position.y = 20;
camera.position.z = 20;

function render() {
	renderer.render(scene, camera);
}
render();
