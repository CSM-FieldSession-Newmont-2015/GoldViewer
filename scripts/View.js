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
	var reticle;
	var size = property.box.size;
	var maxDimension = Math.max(size.x, size.y, size.z);

	init();

	function init() {

		container = document.createElement('div');
		document.body.appendChild(container);

		var width = window.innerWidth;		//used to make the camera declarations prettier
		var height = window.innerHeight;
		var center = property.box.center;

		camera = new THREE.PerspectiveCamera(45, width / height, 0.1, maxDimension*70);
		camera.up.set(0,0,1);
		camera.position.set(Math.max(maxDimension/5, size.x*1.2), Math.max(maxDimension/5,size.y*1.2), Math.max(maxDimension/5, size.z*1.2));
		camera.lookAt(center);
		cameraOrtho = new THREE.OrthographicCamera( width/-2, width/2, height/2, height/-2, 1, 1000);


		scene = new THREE.Scene;
		scene.add(new THREE.AmbientLight(colors.soft_white));

		controls = new THREE.OrbitControls(camera);
		controls.zoomSpeed = 3.0;
		controls.minDistance = maxDimension / 100;
		controls.maxDistance = maxDimension * 2;
		controls.target = property.box.center;

		renderer = new THREE.WebGLRenderer({antialias: true});
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setClearColor(colors.background, 1);
		renderer.sortObjects = false;
		renderer.autoClear=false;
		container.appendChild(renderer.domElement);

		var property_boundary = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z));
		var box = new THREE.EdgesHelper(property_boundary, colors.axes);
		box.applyMatrix(new THREE.Matrix4().makeTranslation(center.x, center.y, center.z));

		scene.add(box);

		addReticle();

		addSurveyLines();
		
	}

	function addReticle(){
		reticle = new THREE.Mesh(
			new THREE.SphereGeometry(maxDimension / 1000),
			new THREE.MeshLambertMaterial({ color: colors.black }));
		reticle.position.x = controls.target.x;
		reticle.position.y = controls.target.y;
		reticle.position.z = controls.target.z;
		scene.add(reticle);
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

		reticle.position.x = controls.target.x;
		reticle.position.y = controls.target.y;
		reticle.position.z = controls.target.z;

		renderer.clear();
		renderer.render(scene, camera);
	}


	window.addEventListener('resize', function (event) {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
	});
}