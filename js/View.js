// Visual Studio Code uses these to hush warnings about
//   variable names it can't find declared.
/* global dat */
/* global Stats */
/* global THREE */

var colors = {
	axes: 0x5d5d5d,
	background: 0xdedede,
	black: 0x000000,
	pink: 0xff00ff,
	soft_white: 0x404040,
	terrain_frame: 0x009900,
	white: 0xffffff,
};

function loadJSON(url) {
	var json = null;
	$.ajax({
		'async':    false,
		'global':   false,
		'url':      url,
		'dataType': "json",
		'success':  function (data) {
			json = data;
		}
	});
	return json;
}

function View(projectURL) {

	var camera                = null;
	var cameraOrtho           = null;
	var controls              = null;
	var intersected           = null;
	var renderer              = null;
	var reticle               = null;
	var stats                 = null;
	var tooltipSprite         = null;
	var projectJSON           = null;
	var property              = null;
	var holes                 = null;
	var maxDimension          = null;
	var minerals              = {};
	var meshes                = [];
	var returnedGeometry      = 0;
	var currentID             = 0;
	var finishedParsing       = false;
	var scene                 = new THREE.Scene();
	var sceneOrtho            = new THREE.Scene();
	var mouse                 = new THREE.Vector2();
	var tooltipSpriteLocation = new THREE.Vector2();
	var raycaster             = new THREE.Raycaster();
	var container             = $('#viewFrame');
	var maxDimension          = 0;

	var cylinders = [];

	this.start = function () {
		init();
		render();
	}

	function init() {
		projectJSON = loadJSON(projectURL);
		property = getProperty(projectJSON);

		maxDimension = Math.max(property.box.size.x, property.box.size.y, property.box.size.z);
	    container.contents().find('body').html('<div></div>');
	    container = container.contents().find('div:first').get(0);
		setupCamera();
		setupRenderer();
		setupControls();
		setupStats();
		setupWindowListeners();

		// Do this first, since it takes so long.
		getMinerals();

		addBoundingBox();
		addSurveyLines();
		addAxisLabels();
		addReticle();
		addLights();
		addSurveyLines();
		addTerrain(scene, property);
	}

	/*
	This is the layout of the minerals object:
	{
		//e. g. 'Au', 'Ag', etc.
		MineralString: [
			{
				"value": Number,
				"hole": String,
				"depth": {
					"start": Number,
					"end":   Number
				},
				"path": {
					"start": THREE.Vector3,
					"end": THREE.Vector3
				},
				"mesh": THREE.Mesh
			}
		]
	}
	*/
	function getMinerals() {

		holesJSON = projectJSON["holes"];
		holesJSON.forEach(function(hole){

			hole["downholeDataValues"].forEach(function(mineral){
				if(minerals[mineral["name"]] === undefined){
					minerals[mineral["name"]] = {};
					minerals[mineral["name"]].intervals = [];
					minerals[mineral["name"]]["mesh"] = {
						vertices: null,
						normals: null
					}
				}
				mineral["intervals"].forEach(function(interval){
					data = {
						mineral: mineral["name"],
						value: interval["value"],
						depth: {
							start : interval["from"],
							end   : interval["to"]
						},
						path: new Float32Array(interval["path"][0].concat(interval["path"][1])),
						hole      : hole["id"],
						id : currentID
					};
					minerals[mineral["name"]].intervals.push(data);
					meshes[currentID] = data;
					currentID += 1;
				});
			});

		});
		sortMinerals();
		delegate(minerals);
	}

	function calcGeometry(intervalData){

		var floats = new Float32Array(intervalData[0]);
		var vec1 = vec3FromArray(floats);
		var vec2 = vec3FromArray([floats[3], floats[4], floats[5]]);

		var geometry = cylinderMesh(vec1, vec2, determineWidth(intervalData[1]));
		console.log(geometry.attributes);
		postMessage([geometry.attributes.position.array.buffer, geometry.attributes.normal.array.buffer, geometry.attributes.uv.array.buffer, intervalData[2]], [geometry.attributes.position.array.buffer, geometry.attributes.normal.array.buffer, geometry.attributes.uv.array.buffer]);
	}

	function makeMesh(e){
		var data = e.data;
		var basic = new THREE.MeshBasicMaterial({color: colors.pink});
		returnedGeometry += 1;
		var geometry = new THREE.BufferGeometry();
		geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(e.data[0]), 3 ));
		//geometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(e.data[1]), 3 ));
		var mesh = new THREE.Mesh(geometry, basic);
		meshes[data[3]] = mesh;
		mesh.visible = false;
		//scene.add(mesh);
		if(returnedGeometry%1000 == 0)
			console.log(returnedGeometry/1000);
		if(returnedGeometry >= currentID){
			setTimeout(makeBigMeshes(), 2000);
		}
	}

	function delegate(meshlessData){

		var workers = [];
		for(var i = 0; i < 4; i += 1){
			var newWorker = new Worker('../js/MeshWorker.js');
			newWorker.addEventListener('message', makeMesh);
			workers.push(newWorker);
		}
		var index = 0;
		Object.keys(minerals).forEach(function(mineral){
			minerals[mineral].intervals.forEach(function(interval){
				workers[index%4].postMessage([interval.path.buffer, interval.value, interval.id], [interval.path.buffer]);
				index += 1;
			});
		});
		return;
	}

	function addMineralsToScene(){
		minerals['Au'].forEach(function(interval){
			console.log(interval.mesh);
			var material = new THREE.MeshBasicMaterial({ color: colors.pink });
			//scene.add(new THREE.Mesh(interval.mesh, material));
		})
	}

	function sortMinerals(){
		Object.keys(minerals).forEach(function(mineral){
			minerals[mineral].intervals.sort(function(a, b){
				return a.value - b.value;
			});
		});
	}

	function addReticle() {
		reticle = new THREE.Mesh(
			new THREE.SphereGeometry(
				maxDimension / 1000, // Radius
				// These two values determine how smooth the sphere looks.
				20, // widthSegments
				20  // heightSegments
				),
			new THREE.MeshLambertMaterial({
				color: colors.black,
				transparent: true,
				opacity: 0.6 // Chosen through several trials of intense rigor.
			}));
		reticle.position.x = controls.target.x;
		reticle.position.y = controls.target.y;
		reticle.position.z = controls.target.z;
		scene.add(reticle);
	}

	function makeBigMeshes() {
		Object.keys(minerals).forEach(function(mineral){
			setTimeout(1);
			var mesh = minerals[mineral]["mesh"];
			var verts = [];
			var norms = [];
			console.log(mineral);
			minerals[mineral].intervals.forEach(function(interval){
				Array.prototype.push.apply(verts, meshes[interval['id']].geometry.attributes.position.array);
				// Normals don't work.
				//Array.prototype.push.apply(norms, meshes[interval['id']].geometry.attributes.normal.array);
			});
			minerals[mineral].mesh.vertices = new Float32Array(verts);
			//minerals[mineral].mesh.normals = new Float32Array(norms);
			var geometry = new THREE.BufferGeometry();
			geometry.addAttribute('position', new THREE.BufferAttribute(mesh['vertices'], 3));
			//geometry.addAttribute('normal', new THREE.BufferAttribute(mesh['normals'], 3));
			var mesh = new THREE.Mesh(geometry);
			scene.add(mesh);

		});
		console.log('done');
	}

	function addSurveyLines() {

		getHoles();

		var material = new THREE.LineBasicMaterial({transparent: true, opacity: 0.9, color:colors.black});
		holes.forEach(function holesForEach(hole) {
			geometry = new THREE.Geometry();
			hole.surveyPoints.forEach(function pointsForEach(point) {
				geometry.vertices.push(point);
			});

			scene.add(new THREE.Line(geometry, material));
		});
	}

	function getHoles(){
		holes = [];
		projectJSON["holes"].forEach(function (hole) {
			holes.push(parseHoleData(hole));
		});
	}

	function parseHoleData(jsonHole) {
		var hole = {};

		// The metadata can be used for tooltips and debuggin.
		hole.id = jsonHole["id"];
		hole.name = jsonHole["name"];
		hole.traceColor = jsonHole["traceColor"];

		var surveys = jsonHole["interpolatedDownholeSurveys"];
		hole.surveyPoints = [];
		for (var i = 0; i < surveys.length; i += 1 ) {

			var location = vec3FromArray(surveys[i]["location"]);
			hole.surveyPoints.push(location);
		}

		return hole;
	}

	function addAxisLabels() {
		// Need this function for creating multi-line text sprites.
		CanvasRenderingContext2D.prototype.wrapText = function wrapText(text, x, y, maxWidth, lineHeight) {
			var lines = text.split("\n");

			for (var i = 0; i < lines.length; i++) {
				var words = lines[i].split(' ');
				var line = '';

				for (var n = 0; n < words.length; n++) {
					var testLine = line + words[n] + ' ';
					var metrics = this.measureText(testLine);
					var testWidth = metrics.width;

					if (testWidth > maxWidth && n > 0) {
						this.fillText(line, x, y);
						line = words[n] + ' ';
						y += lineHeight;
					} else {
						line = testLine;
					}
				}

				this.fillText(line, x, y);
				y += lineHeight;
			}
		};

		// Formats numbers with a km or m prefix.
		function formatKm(num) {
			num = parseFloat(Math.floor(num).toPrecision(2));
			return (num > 1000 ? (num/1000) + ' k' : num) + "m";
		};

		function makeLabel(name, x, y, z) {
			var sprite = makeTextSprite(name);
			sprite.position.set(x, y, z);
			return sprite;
		};

		// Our box is offset from the origin.
		var base = property.box.center.z - property.box.size.z / 2;

		// Force a scope.
		(function () {
			// Lay out the X-axis labels. Ensure they are at least a minimum distance apart.
			// This minimum distance is set in makeTextSprite, with the "sprite.scale.set(*)" line.
			var markerDistance = Math.max(property.box.size.x / 5 - 1, maxDimension/20);
			for (var x = markerDistance; x < property.box.size.x; x += markerDistance) {
				scene.add(makeLabel(formatKm(x), x, 0, base));
			}
			// Write out the axis name a littlebit after the last label.
			x -= markerDistance / 2;
			scene.add(makeLabel("X", x, 0, base));
		})();

		(function () {
			// Lay out the Y-axis labels. Ensure they are at least a minimum distance apart.
			// This minimum distance is set in makeTextSprite, with the "sprite.scale.set(*)" line.
			var markerDistance = Math.max(property.box.size.y / 5 - 1, maxDimension/20);
			for (var y = markerDistance; y < property.box.size.y; y += markerDistance) {
				scene.add(makeLabel(formatKm(y), 0, y, base));
			}
			// Write out the axis name a littlebit after the last label.
			y -= markerDistance / 2;
			scene.add(makeLabel("Y", 0, y, base));
		})();

		(function () {
			// Lay out the Z-axis labels. Ensure they are at least a minimum distance apart.
			// This minimum distance is set in makeTextSprite, with the "sprite.scale.set(*)" line.
			var markerDistance = Math.max(property.box.size.z / 5 - 1, maxDimension/20);
			for (var z = markerDistance; z < property.box.size.z; z += markerDistance) {
				scene.add(makeLabel(formatKm(z), 0, 0, z + base));
			}
			// Write out the axis name a littlebit after the last label.
			z -= markerDistance / 2;
			scene.add(makeLabel("Z", 0, 0, z + base));
		})();
	}

	function addLights() {
		var ambientLight = new THREE.AmbientLight(colors.soft_white);
		scene.add(ambientLight);

		var light = new THREE.PointLight(0xffffff, 100.0, 20.0 * maxDimension);
		light.position.set(0, 0, 3.0 * property.box.size.z + property.box.center.z - property.box.size.z / 2);
		scene.add(light);
	}

	function render() {
		requestAnimationFrame(render);
		controls.update();

		stats.update();

		camera.updateMatrixWorld();

		// TODO: Only do this when the mouse is clicked.
		//checkMouseIntercept();

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
		var fontface  = parameters.hasOwnProperty("fontface") ? parameters["fontface"] : "Arial";
		var fontsize  = parameters.hasOwnProperty("fontsize") ? parameters["fontsize"] : 80;
		var size      = parameters.hasOwnProperty("size") ? parameters["size"] : 512;
		var textColor = parameters.hasOwnProperty("textColor") ?
			parameters["textColor"] : { r: 0, g: 0, b: 0, a: 1.0 };

		var canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		var context = canvas.getContext('2d');
		context.font = "Bold " + fontsize + "px " + fontface;

		context.textAlign = 'left';
		context.fillStyle = "rgba(" + textColor.r + ", " + textColor.g + ", " + textColor.b + ", 1.0)";
		context.wrapText(message, size / 2, size / 2,10000,fontsize);

		var texture = new THREE.Texture(canvas);
		texture.needsUpdate = true;

		var spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
		var sprite = new THREE.Sprite(spriteMaterial);
		sprite.scale.set(maxDimension/10, maxDimension/10,maxDimension/10);
		return sprite;
	}

	function checkMouseIntercept() {
		raycaster.setFromCamera(mouse, camera);
		var intersects = raycaster.intersectObjects(cylinders);

		if (intersects.length > 0) {
			if (intersected != intersects[0].object) {
				if (intersected) {
					var material = intersected.material;
					if (material.emissive) {
						material.emissive.setHex(intersected.currentHex);
					} else {
						material.color.setHex(intersected.currentHex);
					}
				}
				intersected = intersects[0].object;
				//set sprite to be in front of the orthographic camera so it is visible
				sceneOrtho.remove(tooltipSprite);
				tooltipSprite = makeTextSprite(intersected.holeId+"\n"+intersected.oreType+"\n"+intersected.oreConcentration+" g/ton", {fontsize: 18, size: 256}); //Create a basic tooltip display sprite TODO: Make tooltip display info about current drillhole
				tooltipSprite.scale.set(250,250,1);
				tooltipSprite.position.z=0;
				tooltipSprite.position.x=tooltipSpriteLocation.x;
				tooltipSprite.position.y=tooltipSpriteLocation.y;
				sceneOrtho.add(tooltipSprite);

				material = intersected.material;
				if (material.emissive) {
					intersected.currentHex = intersected.material.emissive.getHex();
					material.emissive.setHex(0xff0000);
				}
				else {
					intersected.currentHex = material.color.getHex();
					material.color.setHex(0xff0000);
				}

			}

		} else {
			if (intersected) {
				material = intersected.material;

				if (material.emissive) {
					material.emissive.setHex(intersected.currentHex);
				} else {
					material.color.setHex(intersected.currentHex);
				}
			}
			//set sprite to be behind the ortographic camer so it is not visible
			sceneOrtho.remove(tooltipSprite);
			intersected = null;
		}
	}

	function getProperty(projectJSON){
		var boxMin = vec3FromArray(projectJSON["boxMin"]);
		var boxMax = vec3FromArray(projectJSON["boxMax"]);
		var size   = boxMax.clone().sub(boxMin);
		var center = size.clone().multiplyScalar(0.5).add(boxMin);

		var property = {
			name: projectJSON["projectName"],
			description: projectJSON["description"],
  			numHoles: projectJSON["numHoles"],
			epsg: projectJSON["projectionEPSG"],
			originShift: projectJSON["originShift"],
			boxMin: boxMin,
			boxMax: boxMax,
  			longLatMin: vec3FromArray(projectJSON["longLatMin"]),
  			longLatMax: vec3FromArray(projectJSON["longLatMax"]),
  			desurveyMethod: projectJSON["desurveyMethod"],
  			analytes: projectJSON["analytes"],
  			formatVersion: projectJSON["formatVersion"],
			box: {
				size:   size,
				center: center
			}
		};

		property.analytes.forEach(function (analyte){
			var color = analyte.color.split("#");
			color = "0x"+color[1];
			analyte.color = color;
		});

		return property;
	}

	function setupWindowListeners() {
		// Resize the camera when the window is resized.
		window.addEventListener('resize', function resizeEventListener(event) {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();

			cameraOrtho.left= - window.innerWidth / 2;
			cameraOrtho.right=  window.innerWidth / 2;
			cameraOrtho.top= window.innerHeight / 2;
			cameraOrtho.bottom=- window.innerHeight / 2;

			cameraOrtho.updateProjectionMatrix();

			renderer.setSize(window.innerWidth, window.innerHeight);
		});

		document.addEventListener('mousemove', function mousemouseEventListener(event) {
			event.preventDefault();

			mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

			//this will update the mouse position as well as make the tooltipSprite follow the mouse
			tooltipSpriteLocation.x=event.clientX-(window.innerWidth/2);
			tooltipSpriteLocation.y=-event.clientY+(window.innerHeight/2)+20;
		}, false);

		document.addEventListener("mousedown", function mousedownEventListener(event) {
			event.preventDefault();

			if (controls.autoRotate) {
				controls.autoRotate = false;
			}
		})
	}

	function addBoundingBox() {
		var property_boundary = new THREE.Mesh(new THREE.BoxGeometry(property.box.size.x, property.box.size.y, property.box.size.z));
		var box = new THREE.EdgesHelper(property_boundary, colors.axes);
		box.applyMatrix(new THREE.Matrix4().makeTranslation(property.box.center.x, property.box.center.y, property.box.center.z));
		scene.add(box);
	}

	function addRandomTerrain() {
		var maxX = property.box.size.x;
		var maxY = property.box.size.y;

		// Draw 100 lines on each side.
		var dx = maxX / 100.0;
		var dy = maxY / 100.0;
		var minZ = property.box.center.z + property.box.size.z/2;
		var maxdz = property.box.size.z / 5.0;

		var meshGeometry = new THREE.Geometry();
		var material = new THREE.LineBasicMaterial({
			color: colors.terrain_frame,
			transparent: true,
			opacity: 0.8
		});

		var heights = [];

		// Draw lines along the y axis.
		for (var x = 0; x < maxX; x += dx) {
			var lineGeometry = new THREE.Geometry();
			heights[x] = [];
			for (var y = 0; y < maxY; y += dy) {
				var z = maxdz * Math.random() + minZ;
				heights[x][y] = z;
				lineGeometry.vertices.push(new THREE.Vector3(x, y, z));
			}
			scene.add(new THREE.Line(lineGeometry, material));
			meshGeometry.merge(lineGeometry);
		}

		// And then along the x axis.
		for (var y = 0; y < maxY; y += dy) {
			var lineGeometry = new THREE.Geometry();
			for (var x = 0; x < maxX; x += dx) {
				var z = heights[x][y];
				lineGeometry.vertices.push(new THREE.Vector3(x, y, z));
			}
			scene.add(new THREE.Line(lineGeometry, material));
			meshGeometry.merge(lineGeometry);
		}
	}

	function addReticle() {
		reticle = new THREE.Mesh(
			new THREE.SphereGeometry(maxDimension / 1000),
			new THREE.MeshLambertMaterial({ color: colors.black }));
		reticle.position.x = controls.target.x;
		reticle.position.y = controls.target.y;
		reticle.position.z = controls.target.z;
		scene.add(reticle);
	}

	function setupCamera() {
		//Sets up the camera object for the 3d scene
		camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, maxDimension*700);
		camera.up.set(0,0,1);
		camera.position.set(
			1.5 * maxDimension,
			1.5 * maxDimension,
			1.5 * maxDimension + property.box.center.z - 0.5 * property.box.size.z);
		camera.lookAt(property.box.center);

		//Sets up the 2d orthographic camera for tooltips
		cameraOrtho = new THREE.OrthographicCamera( window.innerWidth/-2, window.innerWidth/2, window.innerHeight/2, window.innerHeight/-2, 1, 1000);
		cameraOrtho.position.z = 1;
		cameraOrtho.position.x = 0;
		cameraOrtho.position.y = 0;
	}

	function setupRenderer() {
		renderer = new THREE.WebGLRenderer({antialias: false});
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setClearColor(colors.background, 1);
		renderer.sortObjects = false;
		renderer.autoClear=false;
		container.appendChild(renderer.domElement);

		// Load GL stuff.
		gl = renderer.context;
		if (null === gl.getExtension("OES_element_index_uint")) {
			console.error(
				"Could not to load OES_element_index_uint. Is it supported?\n"
				+ "Note, some vertices may not render.");
			var msg = [];
			msg.push("Supported extensions:");
			gl.getSupportedExtensions().forEach(function (ext) {
				msg.push("\t" + ext);
			});
			console.debug(msg.join('\n'));
		}
	}

	function setupControls() {
		if (camera === null) {
			console.error("Initialize camera before controls, Fool.");
			return;
		}
		controls = new THREE.OrbitControls(camera, $('#viewFrame').contents().find('div').get(0));
		controls.zoomSpeed = 3.0;
		controls.minDistance = maxDimension / 100;
		controls.maxDistance = maxDimension * 2;
		controls.target = property.box.center;
		controls.autoRotate = true;
	}

	function setupStats() {
		if (container === null) {
			console.error("Please initialize the container before Stats, Fool.");
			return;
		}
		stats = new Stats();
		stats.domElement.style.position = 'absolute';
		stats.domElement.style.right = '0px';
		stats.domElement.style.bottom = '0px';
		container.appendChild(stats.domElement);
	}
}

