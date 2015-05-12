
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );


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

var geometry = new THREE.CylinderGeometry( 1, 1, 1, 16);
var material = new THREE.MeshBasicMaterial( {wireframe: false, color: 0x00ff00 } );
var cube = new THREE.Mesh( geometry, material );
scene.add( cube );

var box = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)));
box.material.color.setRGB( 1, 1, 1);
scene.add(box);

//********** Surface ***********
			var gridSize = 8;

			var elevation = new THREE.Geometry();
			for (i = 0; i < gridSize; ++i) {
			    for (j = 0; j < gridSize; ++j) {
			        elevation.vertices.push(
                        new THREE.Vector3(i, Math.random(), j)
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

			elevation.applyMatrix( new THREE.Matrix4().makeTranslation(-gridSize/2, 0, -gridSize/2) );
			elevation.computeBoundingBox();

			var material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
			material.wireframe = true;
			var surface = new THREE.Mesh( elevation, material );
			scene.add( surface );

			camera.position.z = 5;
			camera.position.y = 5;
			camera.lookAt(new THREE.Vector3(0,0,0));

//******************************
camera.position.z = 5;

function render() {
	//requestAnimationFrame( render );
	//cube.rotation.x += 0.1;
	//cube.rotation.y += 0.01;

	renderer.render( scene, camera );
}
render();