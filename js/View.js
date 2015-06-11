/* global $ */
/* global colors */
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
	gold: 0xffd700,
	dark_gold: 0xccac00
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
	var renderer              = null;
	var reticle               = null;
	var stats                 = null;
	var projectJSON           = null;
	var property              = null;
	var holes                 = {};
	var minerals              = {};
	var meshes                = [];
	var returnedGeometry      = 0;
	var totalGeometries       = 0;
	var scene                 = new THREE.Scene();
	var sceneOrtho            = new THREE.Scene();
	var mouse                 = new THREE.Vector2();
	var tooltipSpriteLocation = new THREE.Vector2();
	var raycaster             = new THREE.Raycaster();
	var tooltipSprite         = null;
	var intersected           = null;
	var container             = $('#viewFrame');
	var maxDimension          = 0;
	var mineralData           = [];
	var mouseTimeout          = null;
	var checkMouse            = false;
	var reticleLight          = null;

	this.start = function () {
		init();
	};

	this.zoomIn = function () {
		controls.dollyIn(1.1);

	};

	this.zoomOut = function () {
		controls.dollyIn(0.9);
	};

	function init() {
		projectJSON = loadJSON(projectURL);
		property = getProperty(projectJSON);

		maxDimension = Math.max(
			property.box.size.x,
			property.box.size.y,
			property.box.size.z);
		container.contents().find('body').html('<div></div>');
		container = container.contents().find('div:first').get(0);
		setupCamera();
		setupRenderer();
		setupControls();
		setupStats();
		setupWindowListeners();

		addTerrain(scene, property, addSurveyLines);
	}

	function addLastElements(){
		getMinerals();
		addBoundingBox();
		addAxisLabels();
		addReticle();
		addLights();
		render();
	}

	/*
	This is the layout of the minerals object:
	{
		"mesh": THREE.Mesh

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
		var holesJSON = projectJSON["holes"];
		var currentID = 0;

		holesJSON.forEach(function holesJsonForEach(hole) {
			hole["downholeDataValues"].forEach(
				function downholeDataForEach(mineral) {
				if (minerals[mineral["name"]] === undefined) {
					minerals[mineral["name"]] = {
						intervals: [],
						mesh: {
							vertices: null
						}
					};
				}

				mineral["intervals"].forEach(
					function mienralIntervalsForEach(interval) {
					var path = interval["path"][0].concat(interval["path"][1]);
					var data = {
						mineral: mineral["name"],
						value:   interval["value"],
						depth: {
							start : interval["from"],
							end   : interval["to"]
						},
						path:    new Float32Array(path),
						hole:    hole["id"],
						id : currentID
					};
					minerals[mineral["name"]].intervals.push(data);
					mineralData[currentID] = data;
					currentID += 1;
				});
			});
		});

		totalGeometries = currentID;
		sortMinerals();
		delegate(minerals);
	}

	function makeMesh(data){
		var intervalID = data[1];

		var material = new THREE.MeshBasicMaterial({color: colors.pink});
		var geometry = new THREE.BufferGeometry();

		geometry.addAttribute('position',
			new THREE.BufferAttribute(new Float32Array(data[0]), 3));

		var mesh           = new THREE.Mesh(geometry, material);
		// Piggy back our data into the mesh, for easier access later.
		mesh.mineralData   = mineralData[intervalID];
		// These meshes only exist for tool tips, so we don't actually
		//   want to render them.
		mesh.visible       = false;
		mesh.autoUpdate    = false;

		// Save all of the meshes for tool tips.
		meshes[intervalID] = mesh;

		// Keep us up to date on how much has procssed ever x%.
		var percentInterval = Math.ceil(0.005 * totalGeometries);
		if (returnedGeometry % percentInterval == 0) {
			// We can measure how many of the geometries we've loaded,
			//   but we can't easily predict how long the BigMesh will
			//   take, so assume 2%.
			setProgressBar(98 * returnedGeometry / totalGeometries);
		}

		if (returnedGeometry >= totalGeometries){
			makeBigMeshes();
			checkMouse = true;
		}
	}

	function delegate(meshlessData){
		var numWorkers = 1;
		var workers    = [];

		for(var i = 0; i < numWorkers; i += 1){
			var worker = new Worker('js/MeshWorker.js');
			worker.addEventListener('message',
				function workerMessageEventListener(e) {
					returnedGeometry += 1;
					makeMesh(e.data);
			});
			workers.push(worker);
		}

		var index = 0;
		Object.keys(minerals).forEach(function(mineral){
			minerals[mineral].intervals.forEach(function(interval){
				interval.path[2] += holes.ids[interval.hole].zOffset;
				interval.path[5] += holes.ids[interval.hole].zOffset;
				workers[index%numWorkers].postMessage([
						interval.path.buffer,
						interval.value,
						interval.id
					],
						[interval.path.buffer]);
				index += 1;
			});
		});
		return;
	}

	function sortMinerals(){
		Object.keys(minerals).forEach(function(mineral){
			minerals[mineral].intervals.sort(function(a, b){
				return a.value - b.value;
			});
		});
	}

	function makeBigMeshes() {
		if (meshes.length === 0) {
			console.log("`meshes` is empty. Are there any intervals?");
			return;
		}

		var verticesPerInterval = meshes[0].geometry.attributes
			.position.array.length;

		Object.keys(minerals).forEach(function(mineral){

			var numVertices = verticesPerInterval * minerals[mineral].intervals.length;
			var verts = new Float32Array(numVertices);

			var counter = 0;
			minerals[mineral].intervals.forEach(function(interval){
				var logMe = new Float32Array(meshes[interval['id']].geometry.attributes.position.array);
				verts.set(logMe, counter * verticesPerInterval);
				counter += 1;
			});
			var geometry = new THREE.BufferGeometry();
			geometry.addAttribute('position', new THREE.BufferAttribute(verts, 3));
			geometry.computeFaceNormals();
			geometry.computeVertexNormals();

			var color = colorFromString(property.analytes[mineral].color);
			var material = new THREE.MeshLambertMaterial({color: color});
			minerals[mineral]["mesh"] = new THREE.Mesh(geometry, material);

			scene.add(minerals[mineral]["mesh"]);

		});
        // Progress is done!
		setProgressBar(100);
	}

	/* Layout of the holes object:
	holes = {
		lines: {
			tracecolor: THREE.Line
		},
		ids: {
			id: {
				name: String,
				longitude: Float,
				latitude: Float,
				location: [Float],
				zOffset: Float
			}
		}
	}
	*/

	function addSurveyLines(surfaceMesh) {
		var surveyCaster = new THREE.Raycaster();
		var geometries = {};
		var up = vec3FromArray([0, 0, 1]);
		holes.lines = {};
		holes.ids = {};

		projectJSON["holes"].forEach(function (jsonHole) {


			var color = jsonHole["traceColor"];

			if(geometries[color] === undefined){
				geometries[color] = [];
			}

			var surveys = jsonHole["interpolatedDownholeSurveys"];
			var initialLocation = surveys[0].location;
			var lineGeometry = geometries[color];

			//Now we use the Raycaster to find the initial z value
			surveyCaster.set(vec3FromArray([initialLocation[0] - property.box.center.x, initialLocation[1] - property.box.center.y, 0]), up);
			var intersect = surveyCaster.intersectObject(surfaceMesh);
			var zOffset = 0;
			if(intersect.length != 0){
				zOffset = intersect[0].distance - initialLocation[2];
			}else{
				console.log("found a survey hole outside the bounding property");
			}

			var hole = {
				name: jsonHole["name"],
				longitude: jsonHole["longLat"][0],
				latitude: jsonHole["longLat"][1],
				location: jsonHole["location"],
				zOffset: zOffset
			}
			holes.ids[jsonHole['id']] = hole;

			Array.prototype.push.apply(lineGeometry, [initialLocation[0], initialLocation[1], initialLocation[2] + zOffset]);


			for (var i = 1; i < surveys.length - 1; i += 1 ) {
				Array.prototype.push.apply(
					lineGeometry,
					[surveys[i].location[0], surveys[i].location[1], surveys[i].location[2] + zOffset]);
				Array.prototype.push.apply(
					lineGeometry,
					[surveys[i].location[0], surveys[i].location[1], surveys[i].location[2] + zOffset]);
			}
				Array.prototype.push.apply(
					lineGeometry,
					[surveys[surveys.length-1].location[0], surveys[surveys.length-1].location[1], surveys[surveys.length-1].location[2] + zOffset]);
		});

		Object.keys(geometries).forEach(function(jsonColor){
			var color = colorFromString(jsonColor);

			var material = new THREE.LineBasicMaterial({
				transparent: true,
				opacity: 0.8,
				color: color
			});

			var buffGeometry = new THREE.BufferGeometry();
			buffGeometry.addAttribute('position',
				new THREE.BufferAttribute(
					new Float32Array(geometries[jsonColor]),
					3));

			holes.lines[jsonColor] = new THREE.Line(buffGeometry,
				material,
				THREE.LinePieces);
			scene.add(holes.lines[jsonColor]);
		});
		addLastElements();
	}

	function colorFromString(stringColor){
			var color = stringColor.split("#");
			color = "0x"+color[1];
			return new THREE.Color(parseInt(color, 16));
	}

	function addAxisLabels() {
		function wrapText(text, x, y, maxWidth, lineHeight) {
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
		// Need this function for creating multi-line text sprites.
		CanvasRenderingContext2D.prototype.wrapText = wrapText;

		// Formats numbers with a km or m prefix.
		function formatKm(num) {
			num = parseFloat(Math.floor(num).toPrecision(2));
			return (num > 1000 ? (num/1000) + ' k' : num) + "m";
		};

		function makeLabel(name, x, y, z) {
			var sprite = makeTextSprite(name, {
				backgroundColor: {r:255, g:100, b:100, a:0}
			});
			sprite.position.set(x, y, z);
			return sprite;
		};

		// Our box is offset from the origin.
		var base = property.box.center.z - property.box.size.z / 2;

		// Force a scope.
		(function () {
			var lentgh = property.box.size.x;
			// Lay out the X-axis labels. Ensure they are at least a minimum
			//   distance apart. This minimum distance is set in makeTextSprite,
			//   with the "sprite.scale.set(*)" line.
			var markerDistance = Math.max(length / 5 - 1, maxDimension/20);
			for (var x = markerDistance; x < length; x += markerDistance) {
				scene.add(makeLabel(formatKm(x), x, 0, base));
			}
			// Write out the axis name a littlebit after the last label.
			x -= markerDistance / 2;
			scene.add(makeLabel("X", x, 0, base));
		})();

		(function () {
			var lentgh = property.box.size.y;
			var markerDistance = Math.max(length / 5 - 1, maxDimension/20);
			for (var y = markerDistance; y < length; y += markerDistance) {
				scene.add(makeLabel(formatKm(y), 0, y, base));
			}
			y -= markerDistance / 2;
			scene.add(makeLabel("Y", 0, y, base));
		})();

		(function () {
			var lentgh = property.box.size.z;
			var markerDistance = Math.max(length / 5 - 1, maxDimension/20);
			for (var z = markerDistance; z < length; z += markerDistance) {
				scene.add(makeLabel(formatKm(z), 0, 0, z + base));
			}
			z -= markerDistance / 2;
			scene.add(makeLabel("Z", 0, 0, z + base));
		})();
	}

	function addLights() {
		var ambientLight = new THREE.AmbientLight(colors.soft_white);
		scene.add(ambientLight);

		// Apply the adjustment that our box gets.
		var offset = property.box.center.z - 0.5 * property.box.size.z;

		var light = new THREE.PointLight(colors.soft_white, 6.0, 20.0 * maxDimension);
		// Position the point light above the box, in a corner.
		light.position.z = 3.0 * property.box.size.z + offset;
		scene.add(light);
	}

	function render() {
		requestAnimationFrame(render);
		controls.update();

		stats.update();

		camera.updateMatrixWorld();

		reticle.position.x = controls.target.x;
		reticle.position.y = controls.target.y;
		reticle.position.z = controls.target.z;

		reticleLight.position.x = controls.target.x;
		reticleLight.position.y = controls.target.y;
		reticleLight.position.z = controls.target.z;

		renderer.clear();
		renderer.render(scene,camera);
		renderer.clearDepth();
		renderer.render(sceneOrtho,cameraOrtho);
	}

	function makeTextSprite(message, parameters) {
		if (parameters === undefined) parameters = {};
		var fontface  = parameters.hasOwnProperty("fontface")
			? parameters["fontface"] : "Arial";
		var fontsize  = parameters.hasOwnProperty("fontsize")
			? parameters["fontsize"] : 30;
		var size      = parameters.hasOwnProperty("size")
			? parameters["size"] : 512;
		var textColor = parameters.hasOwnProperty("textColor")
			? parameters["textColor"] : { r: 0, g: 0, b: 0, a: 1.0 };
		var backgroundColor = parameters.hasOwnProperty("backgroundColor")
			? parameters["backgroundColor"]
			: { r: 255, g: 250, b: 200, a: 0.8 };

		var canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		var context = canvas.getContext('2d');
		context.font = "Bold " + fontsize + "px " + fontface;

		// Draw background rectangle
		var lines = message.split("\n");
		var lineHeight= fontsize;
		var maxTextWidth=0;
		lines.forEach(function (line){
			var textWidth=context.measureText(line).width;
			if(textWidth>maxTextWidth){
				maxTextWidth=textWidth;
			}
		});

		context.fillStyle = "rgba("
			+ backgroundColor.r + ","
			+ backgroundColor.g + ","
			+ backgroundColor.b + ","
			+ backgroundColor.a
			+ ")";

		context.fillRect(0.5*size,
			0.5*size - fontsize,
			maxTextWidth,
			lines.length*lineHeight);

		context.textAlign = 'left';
		context.fillStyle = "rgba("
			+ textColor.r + ", "
			+ textColor.g + ", "
			+ textColor.b + ", 1.0)";

		context.wrapText(message, size / 2, size / 2, 10000, fontsize);

		var texture = new THREE.Texture(canvas);
		texture.needsUpdate = true;

		var spriteMaterial = new THREE.SpriteMaterial({
			map: texture,
			transparent: true
		});

		var sprite = new THREE.Sprite(spriteMaterial);

		sprite.scale.set(
			maxDimension/10,
			maxDimension/10,
			maxDimension/10);
		return sprite;
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
			analytes: {},
			formatVersion: projectJSON["formatVersion"],
			box: {
				size:   size,
				center: center
			}
		};

		projectJSON["analytes"].forEach(function (analyte){
			property.analytes[analyte.name] = {
				color: analyte.color,
				description: analyte.description
			}
		});

		return property;
	}

	function checkMouseIntercept() {
		if(!checkMouse)
			return;
		raycaster.setFromCamera(mouse, camera);
		var intersects = raycaster.intersectObjects(meshes);

		if (intersects.length > 0) {
			if (intersected != intersects[0].object) {
				if (intersected) {
					scene.remove(intersected);
				}
				intersected = intersects[0].object;

				intersected.material = new THREE.MeshLambertMaterial({emissive: colors.pink});
				scene.add(intersected);
			}

			// Set sprite to be in front of the orthographic camera so it
			//   is visible.
			var data = intersected.mineralData;
			tooltipSprite = makeTextSprite(
				"Mineral:\t" + data.mineral
				+ "\nValue:  \t" + data.value
				+ "\nDepth:  \t" + data.depth.start + '-' + data.depth.end
				+ "\nHole ID:\t" + data.hole);
			tooltipSprite.scale.set(250,250,1);
			tooltipSprite.position.z=0;
			tooltipSprite.position.x=tooltipSpriteLocation.x;
			tooltipSprite.position.y=tooltipSpriteLocation.y;
			sceneOrtho.add(tooltipSprite);

		} else {
			if (intersected) {
				scene.remove(intersected);
			}
			intersected = null;
		}
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

		container.addEventListener('mousemove',
			function mousemouseEventListener(event) {
			event.preventDefault();

			mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

			//this will update the mouse position as well as make the tooltipSprite follow the mouse
			tooltipSpriteLocation.x=event.clientX-(window.innerWidth/2);
			tooltipSpriteLocation.y=-event.clientY+(window.innerHeight/2)+20;

			sceneOrtho.remove(tooltipSprite);

			clearTimeout(mouseTimeout);
			if(event.buttons == 0){
				mouseTimeout = setTimeout(function(){checkMouseIntercept();}, 70);
			};
		}, false);

		container.addEventListener("mousedown",
			function mousedownEventListener(event) {
				event.preventDefault();
				if (controls.autoRotate) {
					controls.autoRotate = false;
				}
			});
	}

	function addBoundingBox() {
		var geometry = new THREE.BoxGeometry(
			property.box.size.x,
			property.box.size.y,
			property.box.size.z);

		var property_boundary = new THREE.Mesh(geometry);

		var box = new THREE.EdgesHelper(property_boundary, colors.axes);
		box.applyMatrix(new THREE.Matrix4()
			.makeTranslation(
				property.box.center.x,
				property.box.center.y,
				property.box.center.z));

		scene.add(box);
	}

	function addReticle() {
		reticle = new THREE.Mesh(
			new THREE.SphereGeometry(maxDimension / 1000, 20, 20),
			new THREE.MeshBasicMaterial({ color: colors.dark_gold, wireframe: true }));
		reticle.position.x = controls.target.x;
		reticle.position.y = controls.target.y;
		reticle.position.z = controls.target.z;
		scene.add(reticle);

		reticleLight = new THREE.PointLight(colors.gold, 3, 200);
		scene.add(reticleLight);
	}

	function setupCamera() {
		//Sets up the camera object for the 3d scene
		camera = new THREE.PerspectiveCamera(45,
			window.innerWidth / window.innerHeight,
			0.1,
			700*maxDimension);

		camera.up.set(0,0,1);

		camera.position.set(
			1.5 * maxDimension,
			1.5 * maxDimension,
			1.5 * maxDimension
				+ property.box.center.z - 0.5 * property.box.size.z);

		camera.lookAt(property.box.center);

		//Sets up the 2d orthographic camera for tooltips
		cameraOrtho = new THREE.OrthographicCamera(
			window.innerWidth/-2,
			window.innerWidth/2,
			window.innerHeight/2,
			window.innerHeight/-2,
			1,
			1000);
		cameraOrtho.position.z = 1;
		cameraOrtho.position.x = 0;
		cameraOrtho.position.y = 0;
	}

	function setupRenderer() {
		renderer = new THREE.WebGLRenderer({antialias: true});
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setClearColor(colors.background, 1);
		renderer.sortObjects = false;
		renderer.autoClear=false;
		container.appendChild(renderer.domElement);

		// Load GL stuff.
		var gl = renderer.context;
		if (!gl.getExtension("OES_element_index_uint")) {
			console.error(
				"Could not to load OES_element_index_uint. Is it supported?\n");
			var msg = [];
			msg.push("Supported extensions:");
			gl.getSupportedExtensions().sort().forEach(function (ext) {
				msg.push("\t" + ext);
			});
			console.error(msg.join('\n'));
		}
	}

	function setupControls() {
		if (camera === null) {
			console.error("Controls must be initialized after camera.");
			return;
		}
		controls = new THREE.OrbitControls(camera,
			$('#viewFrame').contents().find('div').get(0));
		controls.zoomSpeed = 3.0;
		controls.minDistance = maxDimension / 100;
		controls.maxDistance = maxDimension * 2;
		controls.target = property.box.center;
		controls.autoRotate = true;
	}

	function setupStats() {
		if (container === null) {
			console.error("Stats must be initialized after container.");
			return;
		}
		stats = new Stats();
		stats.domElement.style.position = 'absolute';
		stats.domElement.style.right = '0px';
		stats.domElement.style.bottom = '0px';
		container.appendChild(stats.domElement);
	}

	// Convert [a, b, c, d..] into {x: a, y: b, z: c}.
	//   Disregard anything after the third element.
	//   Anything missing is assumed to be 0.
	function vec3FromArray(array) {
		return new THREE.Vector3(array[0], array[1], array[2]);
	}
}
