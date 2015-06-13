/* global $ */
/* global colors */
/* global Stats */
/* global THREE */

/**
 * Color constants used by different parts of the view.
 *
 * @type {Object.<string, number>}
 */
var colors = {
	ambientLight     : 0x404040, // Soft white
	axes             : 0x5d5d5d, // Dark gray
	background       : 0xdedede, // White with a smidgen of gray
	cameraLight      : 0x404040, // Soft white
	reticleLight     : 0xd1b419, // Solid gold
	terrain_frame    : 0x26466d, // Dark-ish blue
	tooltipsSelection: 0xff00ff, // Bright pink
}

/**
 * // TODO: Figure out what should be used in place of markdown.
 * Loads a JSON data file from `url`.
 *
 * @param  {string} url A url which points to a remote or local JSON file.
 *
 * @return {Object}     The parsed JSON file, or null.
 */
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

/**
 * The object which manages everything.
 *
 * @param {string} projectURL A URL to a JSON file with the property data in
 *                            the jsondh format.
 */
function View(projectURL) {
	/**
	 * The perspective camera which presents the user's view of the property.
	 * @type {THREE.Camera}
	 */
	var camera = null;

	/**
	 * A light source which moves around with the camera.
	 * @type {THREE.PointLight}
	 */
	var cameraLight = null;

	/**
	 * An orthographic camera used to render tooltips.
	 * @type {THREE.Raycaster}
	 */
	var cameraOrtho = null;

	/**
	 * The DOM element containing our canvas.
	 * @type {???}
	 * @todo  What type is this?
	 */
	var container = $('#viewFrame');

	/**
	 * Handle for the oribtal controls, which enables an orbiting view.
	 * @type {THREE.OrbitControls}
	 */
	var controls = null;

	// TODO: Comment the rest of these.
	var holes                 = {};
	var minerals              = {};
	var meshes                = [];
	var visibleMeshes         = [];
	var returnedGeometry      = 0;
	var totalGeometries       = 0;
	var maxPossibleSegments   = 60;
	var scene                 = new THREE.Scene();
	var sceneOrtho            = new THREE.Scene();
	var mouse                 = new THREE.Vector2();
	var tooltipSpriteLocation = new THREE.Vector2();
	var raycaster             = new THREE.Raycaster();
	var tooltipSprite         = null;
	var intersected           = null;
	var maxDimension          = 0;
	var meshes                = [];
	var mineralData           = [];
	var minerals              = {};
	var mouse                 = new THREE.Vector2();
	var mouseTimeout          = null;
	var projectJSON           = null;
	var property              = null;
	var raycaster             = null;
	var renderer              = null;
	var reticle               = null;
	var reticleLight          = null;
	var returnedGeometry      = 0;
	var scene                 = new THREE.Scene();
	var sceneOrtho            = new THREE.Scene();
	var stats                 = null;
	var tooltipSprite         = null;
	var tooltipSpriteLocation = new THREE.Vector2();
	var totalGeometries       = 0;
	var visibleMeshes         = [];

	/**
	 * Entry point for view. Call this after `new View();`.
	 */
	this.start = function () {
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

		addTerrain();
	};

	/**
	 * Handle used by the controls to zoom in on an event, like a button press.
	 */
	this.zoomIn = function () {
		controls.dollyIn(1.2);
	};

	/**
	 * Handle used by the controls to zoom out on an event, like a button press.
	 */
	this.zoomOut = function () {
		controls.dollyIn(1.0/1.2);
	};

	/**
	 * Load minerals, the bounding box, the axis labels, the reticle, the lights,
	 *  and start rendering. This is called in addSurveyLines, which is called
	 *  after Terrain loads.
	 */
	function addLastElements(){
		getMinerals();
		addBoundingBox();
		addAxisLabels();
		addReticle();
		addLights();
		render();
	}

	/**
	 * Parse `projectJSON["holes"]` into `minerals`, which looks like this:
	 * ```
	 * {
	 *      MineralString: {
	 *          intervals: [
	 *              {
	 *                  value: Number,
	 *                  hole:  String,
	 *                  id:    Number,
	 *                  depth: {
	 *                      start: Number,
	 *                      end:   Number
	 *                  },
	 *                  path: {
	 *                      start: THREE.Vector3,
	 *                      end: THREE.Vector3
	 *                  }
	 *              }
	 *          ],
	 *          mesh: THREE.Mesh,
	 *          minVisibleIndex: Integer,
	 *          maxVisibleIndex: Integer
	 *      }
	 * }
	 * ```
	 * Where `MineralString` is the string used to mark the mineral in the
	 * original file. e.g., for gold it is often "Au".
	 *
	 * After completing, this calls `delegate(minerals)`.
	 *
	 * @todo  Unspaghettify this.
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
		Object.keys(minerals).forEach(function(mineral){
			minerals[mineral].minVisibleIndex = 0;
			minerals[mineral].maxVisibleIndex = minerals[mineral].intervals.length - 1;
		})
		sortMinerals();
		//pass the histogram data
		delegate(minerals);
	}

	/**
	 * Make a mesh, ready to render, from a buffer of vertices. This is intended
	 * to be called with data from the workers (see `delegate`) to create
	 * a single cylinder mesh, and save it in `meshes`.
	 * `data` is expected to be a flat array of floats.
	 *
	 * The array`[new THREE.Vector3(1, 2, 3), new THREE.Vector3(4, 5, 6)]`
	 * should be passed in as `[1, 2, 3, 4, 5, 6]`.
	 *
	 * @param  {[number]} data An flat array of floats.
	 *
	 * @todo  Return the data, instead of writing out to globals.
	 * @todo  Unspaghettify this.
	 */
	function makeMesh(data){
		var intervalID = data[1];

		var material = new THREE.MeshBasicMaterial({
			color: colors.tooltipsSelection
		});
		var geometry = new THREE.BufferGeometry();

		geometry.addAttribute('position',
			new THREE.BufferAttribute(new Float32Array(data[0]), 3));

		var mesh           = new THREE.Mesh(geometry, material);
		// Piggy back our data into the mesh, for easier access later.
		mesh.mineralData   = mineralData[intervalID];
		// These meshes only exist for tool tips, so we don't actually
		//   want to render them.
		mesh.autoUpdate    = false;

		// Save all of the meshes for tool tips.
		meshes[intervalID] = mesh;
		visibleMeshes[intervalID] = mesh;

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
			setupRaycaster();
		}
	}

	/**
	 * Initiate the HTML5 Web Worker(s) to load the mesh data for the mineral
	 * cylinders.
	 *
	 * @param  {Minerals} meshlessData A `Minerals` object with meshless
	 *                                 mineral data.
	 *
	 * @todo Return the data instead of just assigning it to minerals.
	 */
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

	/**
	 * Sort each `intervals` array in the minerals object based on
	 * concentration.
	 *
	 * @todo Take in an array of intervals and sort it / return a sorted copy.
	 */
	function sortMinerals(){
		Object.keys(minerals).forEach(function(mineral){
			minerals[mineral].intervals.sort(function(a, b){
				return a.value - b.value;
			});
		});
	}

	/**
	 * Make a single, massive mesh for all of the cylinders of a single type
	 * of mineral. This is used to easily add and remove minerals of a type
	 * to the scene.
	 */
	function makeBigMeshes() {
		if (meshes.length === 0) {
			console.log("`meshes` is empty. Are there any intervals?");
			return;
		}

		var verticesPerInterval = meshes[0].geometry.attributes
			.position.array.length;

		Object.keys(minerals).forEach(function(mineral){

			var numVertices = verticesPerInterval
				* minerals[mineral].intervals.length;
			var verts = new Float32Array(numVertices);

			var counter = 0;
			minerals[mineral].intervals.forEach(function(interval){
				var logMe = new Float32Array(
					meshes[interval['id']].geometry.attributes.position.array);
				verts.set(logMe, counter * verticesPerInterval);
				counter += 1;
			});
			var geometry = new THREE.BufferGeometry();
			geometry.addAttribute('position',
				new THREE.BufferAttribute(verts, 3));
			geometry.computeFaceNormals();
			geometry.computeVertexNormals();

			var color = colorFromString(property.analytes[mineral].color);
			var material = new THREE.MeshPhongMaterial({
				color: color,
				refractionRatio: 1.0,
				shininess: 4.0});
			minerals[mineral]["mesh"] = new THREE.Mesh(geometry, material);

			scene.add(minerals[mineral]["mesh"]);

		});
		setProgressBar(100);
	}

	/**
	 * Load the survey holes from `projectJSON`, and then adjust them up, so
	 * they coincide with the surface terrain mesh.
	 *
	 * @param {THREE.PlaneGeometry} surfaceMesh A plane representing the
	 *                                          surface mesh.
	 *
	 * @todo Unspaghettify this.
	 */
	function addSurveyLines(surfaceMesh) {
		var surveyCaster = new THREE.Raycaster();
		surveyCaster.far = 1e6;
		var geometries = {};
		var up = vec3FromArray([0, 0, 1]);
		var down = vec3FromArray([0, 0, -1]);
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

			//console.log("Initial location: "+(initialLocation[2] - property.box.center.z));
			//Now we use the Raycaster to find the initial z value
			surveyCaster.set(vec3FromArray([
					initialLocation[0] - property.box.center.x,
					initialLocation[1] - property.box.center.y,
					0]),
					up);
			var intersect = surveyCaster.intersectObject(surfaceMesh);	//look up
			//console.log(surveyCaster);
			surveyCaster.set(surveyCaster.ray.origin, down);
			Array.prototype.push.apply(intersect, surveyCaster.intersectObject(surfaceMesh));	//and down
			var zOffset = 0;
			if(intersect.length != 0){
				zOffset = intersect[0].distance - initialLocation[2];
			}else{
				console.log(
					"Survey hole #" + jsonHole["id"]
					+ "'s raycast did not intersect the terrain mesh."
					+ " Maybe it's out of bounds, or the raycaster is broken?");
			}

			var hole = {
				name: jsonHole["name"],
				longitude: jsonHole["longLat"][0],
				latitude: jsonHole["longLat"][1],
				location: jsonHole["location"],
				zOffset: zOffset
			}
			holes.ids[jsonHole['id']] = hole;

			lineGeometry.push(
				initialLocation[0],
				initialLocation[1],
				initialLocation[2] + zOffset);

			for (var i = 1; i < surveys.length - 1; i += 1 ) {
				// Push the point twice.
				lineGeometry.push(
					surveys[i].location[0],
					surveys[i].location[1],
					surveys[i].location[2] + zOffset,
					surveys[i].location[0],
					surveys[i].location[1],
					surveys[i].location[2] + zOffset);
			}
				lineGeometry.push(
					surveys[surveys.length-1].location[0],
					surveys[surveys.length-1].location[1],
					surveys[surveys.length-1].location[2] + zOffset);
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

	function addTerrain(){

		var sizeX = property.box.size.x * 1.01;
		var sizeY = property.box.size.y * 1.01;


		var maxTerrainDim = Math.max(sizeX, sizeY);
		var minTerrainDim = Math.min(sizeX, sizeY);
		var longSegments = Math.min(Math.ceil(maxTerrainDim/2.0), maxPossibleSegments);
		var segmentLength = maxTerrainDim / longSegments;
		var shortSegments = Math.ceil(minTerrainDim / segmentLength);
		minTerrainDim = shortSegments * segmentLength;

		var xSegments, ySegments;
		var elevations = [];

		if(sizeX > sizeY){
			xSegments = longSegments;
			ySegments = shortSegments;
			sizeY = minTerrainDim;
		}else{
			ySegments = longSegments;
			xSegments = shortSegments;
			sizeX = minTerrainDim;
		};

		var saveName = property.name + ".terrain";
		if(localStorage.hasOwnProperty(saveName)){
			elevations = JSON.parse(localStorage[saveName]);
			makeTerrainMesh();
			return;
		}

		var elevator = new google.maps.ElevationService();
		var openRequests = 0;

		var latLngMin = new google.maps.LatLng(property.longLatMin.y, property.longLatMin.x);
		var latLngMax = new google.maps.LatLng(property.longLatMax.y, property.longLatMax.x);

		var dx = (latLngMax.lng() - latLngMin.lng()) / xSegments;
		var dy = (latLngMax.lat() - latLngMin.lat()) / ySegments;

		var path = [];

		var intervals = 0;
		var timeout = 0;

		for(var i = latLngMin.lng(); i <= latLngMax.lng(); i += 2*dx){
			path.push(new google.maps.LatLng(latLngMin.lat(), i));
			path.push(new google.maps.LatLng(latLngMax.lat(), i));
			if(i + dx <= latLngMax.lng()){
				path.push(new google.maps.LatLng(latLngMax.lat(), i + dx));
				path.push(new google.maps.LatLng(latLngMin.lat(), i + dx));
			}
			intervals += ySegments * 2;

			//make sure we aren't requesting more than 512 intervals at a time
			if(intervals > 512 - ySegments * 2){
				(function(){
					var pathRequest = {
						'path': path.slice(),
						'samples': intervals
					};
					sendElevationRequest(pathRequest, timeout);
				})();
				path = [];
				intervals = 0;
				timeout += 200;
				openRequests += 1;
			}

		}
		if(path.length != 0){
			var pathRequest = {
				'path': path,
				'samples': intervals
			};
			sendElevationRequest(pathRequest, timeout);
			openRequests += 1;
		}
		var counter = 0;

		function addToTerrain(results, status){
			openRequests -= 1;
			if(status != google.maps.ElevationStatus.OK) {
				console.error(status);
				return;
			}
			results.forEach(function(thing){
				var indeces = LatLongtoIndeces(thing);
				if(elevations[indeces[0]] === undefined){
					elevations[indeces[0]] = [];
				}
				elevations[indeces[0]][indeces[1]] = thing.elevation;
			});
			if(openRequests == 0){
				makeTerrainMesh();
				saveToCache(saveName, elevations);
			}

		}

		function sendElevationRequest(pathRequest, timeout){
			setTimeout(function(){elevator.getElevationAlongPath(pathRequest, handleResults)}, timeout);
			function handleResults(results, status){
				if(status == google.maps.ElevationStatus.OVER_QUERY_LIMIT){
					setTimeout(sendElevationRequest(pathRequest, 2000));
				}else{
					addToTerrain(results, status);
				}
			}
		}

		function LatLongtoIndeces(latLong){
			//location.A: Latitude!
			//location.F: Longitude!
			var width = Math.round((latLong.location.A - latLngMin.A) /
				(latLngMax.A - latLngMin.A) * (ySegments-1));
			var height = Math.round((latLong.location.F - latLngMin.F) /
				(latLngMax.F - latLngMin.F) * xSegments);
			return [width, height];
		};

		function makeTerrainMesh(){
			var geometry = new THREE.PlaneGeometry(sizeX, sizeY, xSegments, ySegments-1);
			var counter = 0;
			var vertices = geometry.vertices;
			for(var j = 0; j < ySegments; j += 1){
				for(var i = 0; i <= xSegments; i += 1){
					geometry.vertices[counter].z = elevations[j][i];
					counter += 1;
				}
			}
			//var buffered = new THREE.BufferGeometry().fromGeometry(geometry);
			var material = new THREE.MeshBasicMaterial({
				color: colors.terrain_frame,
				side: THREE.DoubleSide,
				transparent: true,
				wireframe: true,
				opacity: 0.2
			});
			var surfaceMesh = new THREE.Mesh(geometry, material);
			surfaceMesh.position.x += property.box.size.x / 2;
			surfaceMesh.position.y += property.box.size.y / 2;
			scene.add(surfaceMesh);
			addSurveyLines(surfaceMesh);
		}
	}

	function saveToCache(name, object){
		localStorage[name] = JSON.stringify(object);
		console.log("Saving " + name + " data to cache.");
	}


	/**
	 * Convert a hex-color string starting with "#" to a THREE.Color object.
	 *
	 * @example
	 * // Returns "0x123456"
	 * colorFromString("#0123456");
	 *
	 * @param  {String} stringColor
	 *
	 * @return {THREE.Color}
	 */
	function colorFromString(stringColor){
			var color = stringColor.split("#");
			color = "0x"+color[1];
			return new THREE.Color(parseInt(color, 16));
	}

	/**
	 * Change which range of concentrations for a mineral are displayed.
	 * Anything out of the given range is not rendered.
	 *
	 * @param  {String} mineralName The string identifier from the property
	 *                              JSON file for the mineral.
	 * @param  {Number} lowerIndex  The lower INDEX in the meshes array to
	 *                              keep visible.
	 * @param  {Number} higherIndex The upper INDEX in the meshes array to
	 *                              keep visible.
	 *
	 * @todo I think Mason changed this to concentration values, not indices.
	 */
	function updateVisibility(mineralName, lowerIndex, higherIndex){
		var mineral = minerals[mineralName];
		var intervals = mineral.intervals;
		lowerIndex *= intervals.length;
		higherIndex *= intervals.length;
		console.log('lower:' + lowerIndex + '\nhigher:' + higherIndex
			+ '\nmin:' + mineral.minVisibleIndex + '\nmax:' + mineral.maxVisibleIndex)

		for(var i = mineral.minVisibleIndex; i < lowerIndex; i += 1){
			visibleMeshes[intervals[i].id] = emptyMesh;
		}
		for(var i = mineral.maxVisibleIndex; i < higherIndex; i += 1){
			visibleMeshes[intervals[i].id] = meshes[intervals[i].id];
		}
		for(var i = mineral.minVisibleIndex; i >= lowerIndex; i -= 1){
			visibleMeshes[intervals[i].id] = meshes[intervals[i].id];
		}
		for(var i = mineral.maxVisibleIndex; i >= higherIndex; i -= 1){
			visibleMeshes[intervals[i].id] = emptyMesh;
		}
		mineral.minVisibleIndex = lowerIndex;
		mineral.maxVisibleIndex = higherIndex;
		mineral.mesh.geometry.drawCalls = [];
		mineral.mesh.geometry.addDrawCall({start: 199, count: 200, index: 0});
		console.log(visibleMeshes);
	}

	/**
	 * When `visible` is a truthy value, the current range on `mineralName`
	 * minerals is enabled.
	 * When `visible` is a falsey value, the current range on `mineralName`
	 * minerals is disabled.
	 *
	 * @param  {} mineralName [description]
	 * @param  {[type]} visible     [description]
	 */
	function toggleVisible(mineralName, visible){
		var mineral = minerals[mineralName];
		mineral.mesh.visible = visible;
		scene.updateVisibility;
		var intervals = mineral.intervals;
		console.log(visible)
		if(visible){
			for(var i = mineral.minVisibleIndex; i < mineral.maxVisibleIndex; i += 1){
				visibleMeshes[intervals[i].id] = meshes[intervals[i].id];
			}
		}
		else{
			var emptyMesh             = new THREE.Mesh(new THREE.BoxGeometry(0, 0, 0));
			for(var i = mineral.minVisibleIndex; i < mineral.maxVisibleIndex; i += 1){
				visibleMeshes[intervals[i].id] = emptyMesh;
			}
		}
	}

	/**
	 * Loads the axis labels - incremental values and the axis label at the end.
	 * The distance between concecutive labels has a minimum. (See source).
	 *
	 * @todo  Move some assumptions here (like a minimum distance) into
	 *        arguments to make them easier to notice and update.
	 */
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

		/**
		 * Round a number to two digits and append a meter(m) or kilometer(km)
		 * label to it.
		 *
		 * @param  {Number} num The distance in meters.
		 *
		 * @return {[type]}     The rounded number.
		 */
		function formatKm(num) {
			num = parseFloat(Math.floor(num).toPrecision(2));
			return (num > 1000 ? (num/1000) + ' k' : num) + "m";
		};

		/**
		 * Helper function to make a text sprite with standard formatting.
		 *
		 * @param  {Object} name  An object, which will be converted to string.
		 * @param  {Number} x     The x coordinate to place the label.
		 * @param  {Number} y     The y coordinate to place the label.
		 * @param  {Number} z     The z coordinate to place the label.
		 *
		 * @return {THREE.Sprite} The requested sprite.
		 */
		function makeLabel(name, x, y, z) {
			var sprite = makeTextSprite(name, {
				backgroundColor: {r:0, g:0, b:0, a:0},
				fontsize: 40
			});
			sprite.position.set(x, y, z);
			return sprite;
		};

		// Our box is offset from the origin.
		var base = property.box.center.z - property.box.size.z / 2;

		// Force a scope.
		(function () {
			var length = property.box.size.x;
			// Lay out the X-axis labels. Ensure they are at least a minimum
			//   distance apart. This minimum distance is set in makeTextSprite,
			//   with the "sprite.scale.set(*)" line.
			var markerDistance = Math.max(
				property.box.size.x / 5 - 1,
				maxDimension/20);

			//add zero
			scene.add(makeLabel(formatKm(0), 0, 0, base));

			for (var x = markerDistance; x < length; x += markerDistance) {
				scene.add(makeLabel(formatKm(x), x, 0, base));

			}
			// Write out the axis name a littlebit after the last label.
			x -= markerDistance / 1.2;
			scene.add(makeLabel("X", x, 0, base));
		})();

		(function () {
			var length = property.box.size.y;
			var markerDistance = Math.max(length / 5 - 1, maxDimension/20);
			for (var y = markerDistance; y < length; y += markerDistance) {
				scene.add(makeLabel(formatKm(y), 0, y, base));
			}
			y -= markerDistance / 1.2;
			scene.add(makeLabel("Y", 0, y, base));
		})();

		(function () {
			var length = property.box.size.z;
			var markerDistance = Math.max(length / 5 - 1, maxDimension/20);
			for (var z = markerDistance; z < length; z += markerDistance) {
				scene.add(makeLabel(formatKm(z), 0, 0, z + base));
			}
			z -= markerDistance / 1.2;
			scene.add(makeLabel("Z", 0, 0, z + base));
		})();
	}

	/**
	 * Loads the scene with the lights we use. This includes:
	 *     - Ambient lighting
	 *     - A point light in the sky
	 *     - A point light superimposed over the camera
	 *     - A light at the center of our reticle
	 */
	function addLights() {
		var ambientLight = new THREE.AmbientLight(colors.ambientLight);
		scene.add(ambientLight);

		// Apply the adjustment that our box gets.
		var offset = property.box.center.z - 0.5 * property.box.size.z;

		cameraLight = new THREE.PointLight(colors.cameraLight, 3, maxDimension);
		scene.add(cameraLight);

		reticleLight = new THREE.PointLight(colors.reticleLight, 5, maxDimension / 15);
		scene.add(reticleLight);
	}

	/**
	 * The main render loop.
	 */
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

		cameraLight.position.x = camera.position.x;
		cameraLight.position.y = camera.position.y;
		cameraLight.position.z = camera.position.z;

		renderer.clear();
		renderer.render(scene,camera);
		renderer.clearDepth();
		renderer.render(sceneOrtho,cameraOrtho);
	}

	/**
	 * Create a sprite with text.
	 * @param  {Object} message    A string or string-able object to put as the
	 *                             text on the sprite.
	 * @param  {Object} parameters Settings for the sprite. (see source)
	 *
	 * @return {THREE.Sprite}      The resulting sprite.
	 *
	 * @todo  Document `parameters`.
	 */
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
		context.font = fontsize + "px " + fontface;

		// Draw background rectangle
		//find the size of our text to draw the rectangle around
		var lines = message.split("\n");
		var lineHeight= fontsize;
		var maxTextWidth=0;
		lines.forEach(function (line){
			var textWidth=context.measureText(line).width;
			if(textWidth>maxTextWidth){
				maxTextWidth=textWidth;
			}
		});
		//set the color to the input
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

	/**
	 * Create a property object from the JSON format.
	 *
	 * Property objects look like this:
	 * {
	 *     name: String,
	 *     description: String,
	 *     numHoles: Number,
	 *     epsg: Number,
	 *     originShift: THREE.Vector3,
	 *     boxMin: THREE.Vector3,
	 *     boxMax: THREE.Vector3,
	 *     longLatMin: THREE.Vector3,
	 *     longLatMax: THREE.Vector3,
	 *     desurveyMethod: String,
	 *     analytes: [{
	 *         color: String,
	 *         description: String
	 *     }],
	 *     formatVersion: Number,
	 *     box: {
	 *         size:   THREE.Vector3,
	 *         center: THREE.Vector3
	 *     }
	 * }
	 * @param  {Object} projectJSON The property JSON loaded as a javascript
	 *                              object.
	 *
	 * @return {Object} The property object.
	 *
	 * @todo  Use a string to store format versions?
	 */
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

	/**
	 * Checks if the mouse is "hovering over" any cylinders in `visibleMeshes`
	 * on the screen. If it finds something, it adds tool tip.
	 */
	function checkMouseIntercept() {
		if(!raycaster) {
			return;
		}
		raycaster.setFromCamera(mouse, camera);
		var intersects = raycaster.intersectObjects(visibleMeshes);

		if(intersects.length == 0){
			return;
		}

		intersected = intersects[0].object;

		intersected.material = new THREE.MeshLambertMaterial({
			emissive: colors.tooltipsSelection
		});
		scene.add(intersected);

		// Set sprite to be in front of the orthographic camera so it
		//   is visible.
		var data = intersected.mineralData;
		tooltipSprite = makeTextSprite(
			"Mineral:\t" + data.mineral
			+ "\nValue:  \t" + data.value
			+ "\nDepth:  \t" + data.depth.start + '-' + data.depth.end
			+ "\nHole:\t" + holes.ids[data.hole].name,
			{backgroundColor: {r:11, g:62, b:111, a:1},
			 textColor: {r:246, g:246, b:246, a:1}});

		tooltipSprite.scale.set(250,250,1);
		tooltipSprite.position.z=0;
		tooltipSprite.position.x=tooltipSpriteLocation.x;
		tooltipSprite.position.y=tooltipSpriteLocation.y;
		sceneOrtho.add(tooltipSprite);

	}

	/**
	 * Save a rendered frame as an image, returning the image data.
	 * @return {String} The image data.
	 */
	function takeScreenshot() {
		renderer.render(scene, camera)
		return renderer.domElement.toDataURL();
	}
	// Expose this to the console.
	this.takeScreenshot = takeScreenshot;

	/**
	 * Convert [a, b, c, d..] into {x: a, y: b, z: c}, disregarding anything
	 * after the third element. Anything missing is given a default by
	 * THREE.Vector3. This is, as of r71, 0.0.

	 * @param  {[Number]}      An array of coordinate values.
	 *
	 * @return {THREE.Vector3} The Vector3 made from the array.
	 */
	function vec3FromArray(array) {
		return new THREE.Vector3(array[0], array[1], array[2]);
	}

// Below here is only setup functions, typically called once.

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
			function mousemoveEventListener(event) {
			event.preventDefault();

			// This will update the mouse position as well as make the
			//   tooltipSprite follow the mouse.
			var newX = event.clientX-(window.innerWidth/2) + 15;
			var newY = -event.clientY+(window.innerHeight/2) - 20;
			if(tooltipSpriteLocation.x == newX && tooltipSpriteLocation.y == newY){
				//If the mouse wasn't moved, ignore the following logic
				return;
			}
			tooltipSpriteLocation.x = newX;
			tooltipSpriteLocation.y = newY;

			mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

			sceneOrtho.remove(tooltipSprite);
			scene.remove(intersected);

			window.clearTimeout(mouseTimeout);
			if(event.buttons == 0 && raycaster){
				mouseTimeout = window.setTimeout(checkMouseIntercept, 150);
			}
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
			new THREE.IcosahedronGeometry(maxDimension / 1000, 3),
			new THREE.MeshBasicMaterial({
				color: colors.reticleLight,
				wireframe: true
			}));
		reticle.position.x = controls.target.x;
		reticle.position.y = controls.target.y;
		reticle.position.z = controls.target.z;
		scene.add(reticle);
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
		renderer = new THREE.WebGLRenderer({
			antialias: true,
			preserveDrawingBuffer: true // This might have performance impacts.
		});
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

	function setupRaycaster() {
		raycaster = new THREE.Raycaster();
	}
}
