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
	var camera, cameraOrtho, scene, controls, raycaster, renderer;

	var mouse = new THREE.Vector2();
	var INTERSECTED;

	init();

	function init() {

		container = document.createElement('div');
		document.body.appendChild(container);

		var width = window.innerWidth;		//used to make the camera declarations prettier
		var height = window.innerHeight;
		var maxDimension = Math.max(property.box.size.x, property.box.size.y, property.box.size.z);
		camera = new THREE.PerspectiveCamera(45, width / height, 0.1, maxDimension*7000);
		camera.up.set(0,0,1);
		camera.position.set(Math.max(maxDimension/5, property.box.size.x), Math.max(maxDimension/5,property.box.size.y), Math.max(maxDimension/5, property.box.size.z));
		camera.lookAt(property.box.center);

		cameraOrtho = new THREE.OrthographicCamera( width/-2, width/2, height/2, height/-2, 1, 1000);


		scene = new THREE.Scene;
		scene.add(new THREE.AmbientLight(colors.soft_white));

		controls = new THREE.OrbitControls(camera);
		controls.zoomSpeed = 3.0;
		controls.minDistance = 1;
		controls.maxDistance = maxDimension * 2;
		controls.target = property.box.center;

		renderer = new THREE.WebGLRenderer({antialias: true});
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setClearColor(colors.background, 1);
		//renderer.sortObjects = false;
		//renderer.autoClear=false;
		container.appendChild(renderer.domElement);

		var property_boundary = new THREE.Mesh(new THREE.BoxGeometry(property.box.size.x, property.box.size.y, property.box.size.z));
		var box = new THREE.EdgesHelper(property_boundary, colors.axes);
		box.applyMatrix(new THREE.Matrix4().makeTranslation(property.box.center.x, property.box.center.y, property.box.center.z));

		var cylinder_geometry = new THREE.CylinderGeometry(1, 1, 3, 10);
		var cylinder_material = new THREE.MeshBasicMaterial({ color: colors.pink });

		var cylinder = new THREE.Mesh(cylinder_geometry, cylinder_material);
		scene.add(cylinder);

		scene.add(box);

		addSurveyLines();
		
	}

	function addSurveyLines(){
		var material = undefined;//new THREE.LineBasicMaterial({color:colors.black});
		property.holes.forEach(function(hole){
			geometry = new THREE.Geometry();
			hole.surveyPoints.forEach(function(point){
				geometry.vertices.push(point);
			});
			scene.add(new THREE.Line(geometry, material));
		});
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