
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
renderer.setClearColor(0x252525);
document.body.appendChild( renderer.domElement );

var geometry = new THREE.CylinderGeometry( 1, 1, 1, 16);
var material = new THREE.MeshBasicMaterial( {wireframe: false, color: 0x00ff00 } );
var cube = new THREE.Mesh( geometry, material );
scene.add( cube );

var box = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)));
box.material.color.setRGB( 1, 1, 1);
scene.add(box);

camera.position.z = 5;

function render() {
	//requestAnimationFrame( render );
	//cube.rotation.x += 0.1;
	//cube.rotation.y += 0.01;

	renderer.render( scene, camera );
}
render();

document.addEventListener('keydown', function(event) {
	if(event.keyCode == 37) {
		//alert('Left was pressed');
		camera.position.x -=1;
	}
	else if(event.keyCode == 39) {
		//alert('Right was pressed');
		camera.position.x +=1;
	}
	else if(event.keyCode == 38) {
		//alert('Up was pressed');
		camera.position.y +=1;
	}
	else if(event.keyCode == 40) {
		//alert('Down was pressed');
		camera.position.y -=1;
	}
});