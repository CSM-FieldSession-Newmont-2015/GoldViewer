// Visual Studio Code uses these to hush warnings about
//   variable names it can't find declared.
/* global dat */
/* global Stats */
/* global THREE */

var colors = {
	axes: 0x5d5d5d,
	background: 0xeeeeee,
	black: 0x000000,
	pink: 0xff00ff,
	soft_white: 0x404040,
	terrain_frame: 0x009900,
	white: 0xffffff,
};

function View(property){

	var container, stats;
	var camera, scene, controls, raycaster, renderer;

	var mouse = new THREE.Vector2();
	var INTERSECTED;

	init();

	function init() {

		container = document.createElement('div');
		document.body.appendChild(container);

		var maxDimension = Math.max(property.box.size.x, property.box.size.y, property.box.size.z);
		camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, maxDimension*7);
		camera.up.set(0,0,1);
		camera.position.set(Math.max(maxDimension/5, property.box.size.x), Math.max(maxDimension/5,property.box.size.y), Math.max(maxDimension/5, property.box.size.z));
		camera.lookAt(property.box.center);

		scene = new THREE.Scene;
		scene.add(new THREE.AmbientLight(colors.soft_white));

		controls = new THREE.OrbitControls(camera);
		controls.zoomSpeed = 3.0;
		controls.minDistance = 1;
		controls.maxDistance = maxDimension * 2;
		//controls.target = new THREE.Vector3(property.box.center);

		renderer = new THREE.WebGLRenderer({antialias: true});
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setClearColor(colors.background, 1);
		//renderer.sortObjects = false;
		//renderer.autoClear=false;
		container.appendChild(renderer.domElement);

		var property_boundary = new THREE.Mesh(new THREE.BoxGeometry(property.box.size.x, property.box.size.y, property.box.size.z));
		var box = new THREE.EdgesHelper(property_boundary, colors.axes);

		var cylinder_geometry = new THREE.CylinderGeometry(1, 1, 3, 10);
		var cylinder_material = new THREE.MeshBasicMaterial({ color: colors.pink });

		var cylinder = new THREE.Mesh(cylinder_geometry, cylinder_material);
		scene.add(cylinder);

		scene.add(box);

		var box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial({wireframe: true}));
		scene.add(box);

		
	}

	render();
	function render(){
		requestAnimationFrame(render);
		controls.update();

		camera.updateMatrixWorld();

		//renderer.clear();
		//console.log("rendering");
		renderer.render(scene, camera);
	}


	window.addEventListener('resize', function (event) {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
	});
}