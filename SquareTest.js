
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 1000 );


//Resize the camera when the window is resized
window.addEventListener('resize', function(event){
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize( window.innerWidth, window.innerHeight );
		render();
	});

controls = new THREE.OrbitControls( camera );
controls.addEventListener( 'change', render );

var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setClearColor(0x252525, 1);
document.body.appendChild( renderer.domElement );

var geometry = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10);
geometry.computeFaceNormals();
geometry.computeVertexNormals();

var material = new THREE.MeshLambertMaterial({
	color: 0xff00ff,
	side: 2,
	shading: THREE.FlatShading,
});

for (var i = 0; i < 100; i += 1) {
	var matrix = new THREE.Matrix4().makeTranslation(10*Math.random(), 10*Math.random(), 10*Math.random());
	matrix.matrixAutoUpdate = false;

	var cylinder = new THREE.Mesh( geometry, material );
	cylinder.applyMatrix(matrix);
	scene.add(cylinder);
}

var box = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)));
box.material.color.setRGB( 1, 1, 1);
box.applyMatrix( new THREE.Matrix4().makeTranslation(5, 5, 5) );
scene.add(box);

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

			var material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
			material.wireframe = true;
			var surface = new THREE.Mesh( elevation, material );
			surface.position.y = -5;
			scene.add( surface );

			camera.position.z = 5;
			camera.position.y = 5;
			camera.lookAt(new THREE.Vector3(5,5,5));

//******************************
camera.position.x = 20;
camera.position.y = 20;
camera.position.z = 20;

function render() {
	renderer.render( scene, camera );
}
render();
