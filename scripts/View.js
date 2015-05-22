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
	var camera, cameraOrtho, scene, sceneOrtho, controls, raycaster, renderer;
	var maxDimension;
	var mouse = new THREE.Vector2();
	var INTERSECTED;
	var reticle;
	var size = property.box.size;
	var maxDimension = Math.max(size.x, size.y, size.z);
	var stats;

	var tooltipSprite;

	var cylinders=[];

	init();
	render();

	function init() {

		raycaster = new THREE.Raycaster();

		container = document.createElement('div');
		document.body.appendChild(container);

		var width = window.innerWidth;		//used to make the camera declarations prettier
		var height = window.innerHeight;
		maxDimension = Math.max(property.box.size.x, property.box.size.y, property.box.size.z);

		var center = property.box.center;

		//Sets up the camera object for the 3d scene
		camera = new THREE.PerspectiveCamera(45, width / height, 0.1, maxDimension*70);
		camera.up.set(0,0,1);
		camera.position.set(Math.max(maxDimension/5, size.x*1.2), Math.max(maxDimension/5,size.y*1.2), Math.max(maxDimension/5, size.z*1.2));
		camera.lookAt(center);

		//Sets up the 2d orthographic camera for tooltips
		cameraOrtho = new THREE.OrthographicCamera( width/-2, width/2, height/2, height/-2, 1, 1000);
		cameraOrtho.position.z = 1;
		cameraOrtho.position.x = 0;
		cameraOrtho.position.y = 0;

		sceneOrtho = new THREE.Scene();


		tooltipSprite = makeTextSprite("Hello, I'm a Tooltip", {fontsize: 18, size: 256}); //Create a basic tooltip display sprite TODO: Make tooltip display info about current drillhole
		tooltipSprite.scale.set(250,250,1);
		sceneOrtho.add(tooltipSprite);


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

		stats = new Stats();
		stats.domElement.style.position = 'absolute';
		stats.domElement.style.right = '0px';
		stats.domElement.style.bottom = '0px';
		container.appendChild(stats.domElement);

		addReticle();

		addSurveyLines();
		setTimeout(addMinerals, 2000);
		labelAxis();
		
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

	function addMinerals(){
		
		var material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
		var totalGeom = new THREE.Geometry();

		property.holes.forEach(function(hole){
			hole.minerals.forEach(function(mineral){
				mineral.intervals.forEach(function(interval){
					/*var geometry = new THREE.Geometry();
					geometry.vertices.push(interval.start);
					geometry.vertices.push(interval.end);
					scene.add(new THREE.Line(geometry, material));*/
					cylinder = cylinderMesh(interval.start, interval.end,25,material);
					cylinder.updateMatrix();
					cylinders.push(cylinder);
					cylinder.oreConcentration=interval.value;
					totalGeom.merge(cylinder.geometry, cylinder.matrix);

					scene.add(cylinder);
					cylinder.visible=false;
				});
			});
		});
		var total = new THREE.Mesh(totalGeom);
		total.matrixAutoUpdate = false;
    	scene.add(total);
	}

	function cylinderMesh(pointX, pointY, width, material) {
            var direction = new THREE.Vector3().subVectors(pointY, pointX);
            var orientation = new THREE.Matrix4();
            orientation.lookAt(pointX, pointY, new THREE.Object3D().up);
            orientation.multiply(new THREE.Matrix4().set(1, 0, 0, 0,
                0, 0, 1, 0,
                0, -1, 0, 0,
                0, 0, 0, 1));
            var edgeGeometry = new THREE.CylinderGeometry(width, width, direction.length(), 8, 1);
            var edge = new THREE.Mesh(edgeGeometry, material);
            edge.applyMatrix(orientation);
            edge.position.x = (pointY.x + pointX.x) / 2;
            edge.position.y = (pointY.y + pointX.y) / 2;
            edge.position.z = (pointY.z + pointX.z) / 2;
            return edge;
    }
	function addSurveyLines(){
		var material = new THREE.LineBasicMaterial({color:colors.black});
		property.holes.forEach(function(hole){
			geometry = new THREE.Geometry();
			hole.surveyPoints.forEach(function(point){
				geometry.vertices.push(point);
			});

			scene.add(new THREE.Line(geometry, material));
		});
	}

	function labelAxis(){
		var axis_format = {
			fontsize: 400,
			size: 1024
		};
		function kFormatter(num) {
   			 return num > 999 ? (num/1000) + 'k' : num
		}

		

		var spriteX = makeTextSprite("X", axis_format);
		spriteX.position.set(property.box.size.x, 0, 0);
		scene.add(spriteX);

		var spriteY = makeTextSprite("Y", axis_format);
		spriteY.position.set(0, property.box.size.y, 0);
		scene.add(spriteY);

		var spriteZ = makeTextSprite("Z", axis_format);
		spriteZ.position.set(0, 0, property.box.size.z); 
		scene.add(spriteZ);

		for(var i=0; i< property.box.size.x;i+=property.box.size.x/10){
			interval=Math.floor(i);
			interval=parseFloat(interval.toPrecision(2));
			var spriteLabel = makeTextSprite(kFormatter(interval), axis_format);
			spriteLabel.position.set(interval, 0, 0);
			scene.add(spriteLabel);
		}

		for(var i=0; i< property.box.size.y;i+=property.box.size.y/10){
			interval=Math.floor(i);
			interval=parseFloat(interval.toPrecision(2));
			var spriteLabel = makeTextSprite(kFormatter(interval), axis_format);
			spriteLabel.position.set(0, interval, 0);
			scene.add(spriteLabel);
		}

		for(var i=0; i< property.box.size.z;i+=property.box.size.z/3){
			interval=Math.floor(i);
			interval=parseFloat(interval.toPrecision(2));
			var spriteLabel = makeTextSprite(kFormatter(interval), axis_format);
			spriteLabel.position.set(0, 0, interval);
			scene.add(spriteLabel);
		}
	}

	
	function render(){
		requestAnimationFrame(render);
		controls.update();

		stats.update();

		camera.updateMatrixWorld();

		checkMouseIntercept();

		reticle.position.x = controls.target.x;
		reticle.position.y = controls.target.y;
		reticle.position.z = controls.target.z;

		renderer.clear();
		renderer.render(scene,camera);
		renderer.clearDepth();
		renderer.render(sceneOrtho,cameraOrtho);
	}

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

		var spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
		var sprite = new THREE.Sprite(spriteMaterial);
		sprite.scale.set(maxDimension/50, maxDimension/50,maxDimension/50);
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



	window.addEventListener('resize', function (event) {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
	});

	document.addEventListener('mousemove', onDocumentMouseMove, false);
	function onDocumentMouseMove(event) {

		event.preventDefault();
		//this will update the mouse position as well as make the tooltipSprite follow the mouse
		tooltipSprite.position.x= event.clientX-(window.innerWidth/2);
		tooltipSprite.position.y= -event.clientY+(window.innerHeight/2)+20;
		mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
	}

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
}