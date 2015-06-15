// Don't warn about indexing objects with strings, we use it on JSON objects.
/* jshint -W069 */


/**
 * Color constants used by different parts of the view.
 *
 * @type {Object.<string, number>}
 *
 * @todo  Rename these to refer to their use case, not color.
 */
var colors = {
	ambientLight: 0x404040, // Soft white
	axes: 0x5d5d5d, // Dark gray
	background: 0xdedede, // White with a smidgen of gray
	cameraLight: 0x404040, // Soft white
	reticleLight: 0xd1b419, // Solid gold
	terrain_frame: 0x26466d, // Dark-ish blue
	tooltipsSelection: 0xff00ff, // Bright pink
};

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
		'async': false,
		'global': false,
		'url': url,
		'dataType': "json",
		'success': function (data) {
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
	 *
	 * @todo  What type is this?
	 */
	var container = $('#viewFrame');

	/**
	 * Handle for the oribtal controls, which enables an orbiting view.
	 * @type {THREE.OrbitControls}
	 */
	var controls = null;

	/**
	 * Stores the data and metadata for the survey line holes.
	 *
	 * `holes.lines` contains the THREE.Mesh objects used to give lines their
	 * formatting.
	 *
	 * `holes.ids` contains the the meta data for each hole, stored in an object
	 * indexed by the hole's id, as a number.
	 */
	var holes = {};

	/**
	 * The object our ray caster is currently hitting, or null if it isn't
	 * intersecting anything.
	 * @type {THREE.Mesh}
	 */
	var intersected = null;

	/**
	 * The largest dimension of the property box. It cannot be calculated until
	 * the property is fully loaded.
	 * @type {Number}
	 *
	 * @todo  Move this into the property object.
	 */
	var maxDimension = 0;

	/**
	 * The number of segments used on the longest side of the property box.
	 * The other side uses however many fit, ensuring the terrain has square
	 * sides on its wireframe.
	 * @type {Number}
	 */
	var maxPossibleSegments = 30;

	/**
	 * Array of all the meshes for ray casting, indexed with their mesh id.
	 * @type {Array<THREE.Mesh>}
	 */
	var meshes = [];

	/**
	 * Metadata for intervals indexed with their mesh id.
	 * @type {Array}
	 */
	var mineralData = [];

	/**
	 * Fancy array with minerals meta-data.
	 * @see getMinerals
	 */
	var minerals = {};

	var motionInterval = null;

	/**
	 * Store the mouse position for ray casting.
	 * @type {THREE.Vector2}
	 */
	var mouse = new THREE.Vector2();

	/**
	 * We only activate ray casting when the mouse has stopped moving for a c
	 * certain amount of time. We keep track of whether the mouse has moved to
	 * aid in ray casting.
	 * @see  mouseTimeout
	 * @type {Boolean}
	 */
	var mouseMoved = false;

	/**
	 * If the mouse moves, we want to kill the setTimeout function we use.
	 * This stores the return value which we use to kill it.
	 */
	var mouseTimeout = null;

	/**
	 * The property JSON after it's loaded.
	 */
	var projectJSON = null;

	/**
	 * The property object after it's been processed.
	 */
	var property = null;

	/**
	 * The raycaster used for tooltips.
	 * @type {THREE.Raycaster}
	 */
	var raycaster = null;

	/**
	 * The threejs WebGL rendering object.
	 * @type {THREE.WebGLRenderer}
	 */
	var renderer = null;

	/**
	 * Our orbital controls rotate, or orbit, around a centeral point. It's
	 * hard to tell where that is, so we keep a sphere positioned there.
	 * @see  reticleLight
	 * @type {THREE.Mesh}
	 */
	var reticle = null;

	/**
	 * Our reticle emits a point light from its center.
	 * @type {THREE.PointLight}
	 */
	var reticleLight = null;

	/**
	 * ???
	 * @type {Number}
	 */
	var returnedGeometry = 0;

	/**
	 * The objects threejs uses to represent what it needs to draw.
	 * @type {THREE.Scene}
	 */
	var scene = new THREE.Scene();

	/**
	 * We emulate a second scene to get tool tips to work. This is the scene
	 *  for that.
	 *  @see  cameraOrtho
	 * @type {THREE.Scene}
	 */
	var sceneOrtho = new THREE.Scene();

	/**
	 * FPS counter. https://github.com/mrdoob/stats.js/
	 * @type {[type]}
	 */
	var stats = null;

	/**
	 * The terrain mesh to be laid over the property box.
	 *@type {THREE.Mesh}
	 */
	 var terrainMesh = null;

	/**
	 * We reuse the same sprite object for tooltips. If the user isn't hovering
	 * over something, we remove it from the scene and don't use it.
	 * @see  tooltipSpriteLocation
	 * @type {THREE.Sprite}
	 */
	var tooltipSprite = null;

	/**
	 * The location of the tooltip sprite.
	 * @see  tooltipSprite
	 * @type {THREE}
	 */
	var tooltipSpriteLocation = new THREE.Vector2();

	/**
	 * The count of total geometries we need to load for the minerals.
	 * This is used in the "Loading geometries" progress bar.
	 * @type {Number}
	 */
	var totalGeometries = 0;

	/**
	 * An array representing which meshes, out of the many we have, we actually
	 * want to render right now.
	 * @type {Array}
	 */
	var visibleMeshes = [];

	/**
	 * How quickly the mouse wheel zooms.
	 * @type {Number}
	 */
	var zoomSpeed = 1.2;

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
		controls.dollyIn(zoomSpeed);
	};

	/**
	 * Handle used by the controls to zoom out on an event, like a button press.
	 */
	this.zoomOut = function () {
		controls.dollyIn(1.0 / zoomSpeed);
	};

	/**
	 * Load minerals, the bounding box, the axis labels, the reticle, the lights,
	 *  and start rendering. This is called in addSurveyLines, which is called
	 *  after Terrain loads.
	 */
	function addLastElements() {
		getMinerals();
		addBoundingBox();
		addAxisLabels();
		addReticle();
		addLights();
		toggleVisible("surveyHoles");
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
	 *			color: String,
	 *          geometry: THREE.BufferGeometry,
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
							},
							color: property.analytes[mineral["name"]].color
						};
					}

					mineral["intervals"].forEach(
						function mineralIntervalsForEach(interval) {
							var path = interval["path"][0].concat(interval["path"][1]);
							var data = {
								mineral: mineral["name"],
								value: interval["value"],
								depth: {
									start: interval["from"],
									end: interval["to"]
								},
								path: new Float32Array(path),
								hole: hole["id"],
								id: currentID
							};
							minerals[mineral["name"]].intervals.push(data);
							mineralData[currentID] = data;
							currentID += 1;
						});
				});
		});

		totalGeometries = currentID;
		Object.keys(minerals).forEach(function (mineral) {
			minerals[mineral].minVisibleIndex = 0;
			minerals[mineral].maxVisibleIndex = minerals[mineral].intervals.length - 1;
			if (minerals[mineral].intervals.length === 0) {
				delete minerals[mineral];
			}
		});
		sortMinerals();
		loadSidebar(minerals,property);
		delegate(minerals);
	}

	/**
	 * Make a mesh, ready to render, from a buffer of vertices. This is intended
	 * to be called with data from the workers (see `delegate`) to create
	 * a single cylinder mesh, and save it in `meshes`.
	 * @see  delegate
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
	function makeMesh(data) {
		var intervalID = data[1];

		var material = new THREE.MeshBasicMaterial({
			color: colors.tooltipsSelection
		});
		var geometry = new THREE.BufferGeometry();

		geometry.addAttribute('position',
			new THREE.BufferAttribute(new Float32Array(data[0]), 3));

		var mesh = new THREE.Mesh(geometry, material);
		// Piggy back our data into the mesh, for easier access later.
		mesh.mineralData = mineralData[intervalID];
		// These meshes only exist for tool tips, so we don't actually
		//   want to render them.
		mesh.autoUpdate = false;

		// Save all of the meshes for tool tips.
		meshes[intervalID] = mesh;
		visibleMeshes[intervalID] = mesh;

		// Keep us up to date on how much has procssed ever x%.
		var percentInterval = Math.ceil(0.005 * totalGeometries);
		if (returnedGeometry % percentInterval === 0) {
			// We can measure how many of the geometries we've loaded,
			//   but we can't easily predict how long the BigMesh will
			//   take, so assume 2%.
			setProgressBar(98 * returnedGeometry / totalGeometries);
		}

		if (returnedGeometry >= totalGeometries) {
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
	function delegate(meshlessData) {
		var numWorkers = 1;
		var workers = [];

		function workerMessageEventListener(e) {
			returnedGeometry += 1;
			makeMesh(e.data);
		}

		for (var i = 0; i < numWorkers; i += 1) {
			var worker = new Worker('js/MeshWorker.js');
			worker.addEventListener('message', workerMessageEventListener);
			workers.push(worker);
		}

		var index = 0;
		Object.keys(minerals).forEach(function (mineral) {
			minerals[mineral].intervals.forEach(function (interval) {
				interval.path[2] += holes.ids[interval.hole].zOffset;
				interval.path[5] += holes.ids[interval.hole].zOffset;
				workers[index % numWorkers].postMessage([
					interval.path.buffer,
					interval.value,
					interval.id
				], [interval.path.buffer]);
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
	function sortMinerals() {
		Object.keys(minerals).forEach(function (mineral) {
			minerals[mineral].intervals.sort(function (a, b) {
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

		for(var mineral in minerals) {

			var numVertices = verticesPerInterval * minerals[mineral].intervals.length;
			var verts = new Float32Array(numVertices);
			var indeces = new Uint32Array(numVertices / 3);

			var counter = 0;
			minerals[mineral].intervals.forEach(function (interval) {
				var floatArray = new Float32Array(
					meshes[interval['id']].geometry.attributes.position.array);
				verts.set(floatArray, counter * verticesPerInterval);
				counter += 1;
			});

			for(var i = 0; i < numVertices / 3; i += 1){
				indeces[i] = i;
			}

			var geometry = new THREE.BufferGeometry();
			geometry.addAttribute('position',
				new THREE.BufferAttribute(verts, 3));
			geometry.addAttribute('index',
				new THREE.BufferAttribute(indeces, 3));
			geometry.computeFaceNormals();
			geometry.computeVertexNormals();
			
			geometry.addDrawCall({});	//if I give it the arguments inside the object, it breaks :(

			geometry.drawcalls[0].start = 0;
			geometry.drawcalls[0].count = numVertices / 3;
			geometry.drawcalls[0].index = 0;
			
			var color = colorFromString(property.analytes[mineral].color);
			var material = new THREE.MeshPhongMaterial({
				color: color,
				refractionRatio: 1.0,
				shininess: 4.0
			});
			minerals[mineral]["geometry"] = geometry;
			minerals[mineral]["mesh"] = new THREE.Mesh(geometry, material);

			scene.add(minerals[mineral]["mesh"]);

		}
		setProgressBar(100);
	}

	/**
	 * Load the survey holes from `projectJSON`, and then adjust them up, so
	 * they coincide with the surface terrain mesh.
	 *
	 * @param {THREE.PlaneGeometry} terrainMesh A plane representing the
	 *                                          surface mesh.
	 *
	 * @todo Unspaghettify this.
	 * @todo Return the holes object instead of modifying a global object.
	 */
	function addSurveyLines() {
		var totalMetersDrilled = 0;
		var surveyCaster = new THREE.Raycaster();
		var geometries = {};
		var up = vec3FromArray([0, 0, 1]);
		var down = vec3FromArray([0, 0, -1]);
		holes.lines = {};
		holes.ids = {};

		projectJSON["holes"].forEach(function (jsonHole) {


			var color = jsonHole["traceColor"];
			totalMetersDrilled+= jsonHole["depth"];

			if (geometries[color] === undefined) {
				geometries[color] = [];
			}

			var surveys = jsonHole["interpolatedDownholeSurveys"];
			var initialLocation = surveys[0].location;
			var lineGeometry = geometries[color];

			// Now we use the Raycaster to find the initial z value
			surveyCaster.set(vec3FromArray([
					initialLocation[0] - property.box.center.x,
					initialLocation[1] - property.box.center.y,
					0
				]),
				up);
			var intersect = surveyCaster.intersectObject(terrainMesh); //look up
			surveyCaster.set(surveyCaster.ray.origin, down);
			Array.prototype.push.apply(intersect, surveyCaster.intersectObject(terrainMesh)); //and down
			var zOffset = 0;
			if (intersect.length !== 0) {
				zOffset = intersect[0].distance - initialLocation[2];
			} else {
				console.log(
					"Survey hole #" + jsonHole["id"] +
					"'s raycast did not intersect the terrain mesh." +
					" Maybe it's out of bounds, or the raycaster is broken?");
			}

			var hole = {
				name: jsonHole["name"],
				longitude: jsonHole["longLat"][0],
				latitude: jsonHole["longLat"][1],
				location: jsonHole["location"],
				zOffset: zOffset
			};
			var holeId = jsonHole['id'];

			// Javascript uses 64-bit doubles to store all numbers. If they're
			// smaller than that, we can use them as exact integers.
			// We treat survey hole ids as integers, so it's important to check
			// that every id we load is within this bound.
			if (holeId >= (1 << 53)) {
				console.warn("Survey hole # " + holeId +
					" is too large to store as an integer. " +
					"Some hole ids may be rounded and behave strangely.");
			}
			holes.ids[holeId] = hole;

			lineGeometry.push(
				initialLocation[0],
				initialLocation[1],
				initialLocation[2] + zOffset);

			for (var i = 1; i < surveys.length - 1; i += 1) {
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
				surveys[surveys.length - 1].location[0],
				surveys[surveys.length - 1].location[1],
				surveys[surveys.length - 1].location[2] + zOffset);
		});
		property["totalMetersDrilled"] = Math.round(totalMetersDrilled);


		Object.keys(geometries).forEach(function (jsonColor) {
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

	this.autoRotate = function(){
		controls.autoRotate = !controls.autoRotate;
	}

	/**
	 * Retrieve image to display on terrain mesh
	 *
	 */
	function addTerrainImage(mesh) {
		//get the center of the property
		var latCenter = (property.longLatMin.y + property.longLatMax.y) / 2;
		var lngCenter = (property.longLatMin.x + property.longLatMax.x) / 2;
		//construct google maps request
		var mapImage = "https://maps.googleapis.com/maps/api/staticmap?" +
			"center=" + latCenter + "," + lngCenter +
			"&zoom=12&size=640x640&maptype=satellite" +
			"&visible=" + property.longLatMin.y + "," + property.longLatMin.x +
			"&visible=" + property.longLatMax.y + "," + property.longLatMax.x;

		// load a texture, set wrap mode to repeat
		THREE.ImageUtils.crossOrigin = '';
		var texture = THREE.ImageUtils.loadTexture(mapImage);
		var material = new THREE.MeshPhongMaterial({
			map: texture
		});
		mesh.material = material;
	}

	function addTerrain() {

		var sizeX = property.box.size.x * 1.01;
		var sizeY = property.box.size.y * 1.01;


		var maxTerrainDim = Math.max(sizeX, sizeY);
		var minTerrainDim = Math.min(sizeX, sizeY);
		var longSegments = Math.min(Math.ceil(maxTerrainDim / 2.0),
			maxPossibleSegments);
		var segmentLength = maxTerrainDim / longSegments;
		var shortSegments = Math.ceil(minTerrainDim / segmentLength);
		minTerrainDim = shortSegments * segmentLength;

		var xSegments, ySegments;
		var elevations = [];

		if (sizeX > sizeY) {
			xSegments = longSegments;
			ySegments = shortSegments;
			sizeY = minTerrainDim;
		} else {
			ySegments = longSegments;
			xSegments = shortSegments;
			sizeX = minTerrainDim;
		}

		var saveName = property.name + ".terrain";
		if (localStorage.hasOwnProperty(saveName)) {
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

		for (var i = latLngMin.lng(); i <= latLngMax.lng(); i += 2 * dx) {
			path.push(new google.maps.LatLng(latLngMin.lat(), i));
			path.push(new google.maps.LatLng(latLngMax.lat(), i));
			if (i + dx <= latLngMax.lng()) {
				path.push(new google.maps.LatLng(latLngMax.lat(), i + dx));
				path.push(new google.maps.LatLng(latLngMin.lat(), i + dx));
			}
			intervals += ySegments * 2;

			// Make sure we aren't requesting more than 512 intervals at a time.
			// (Google's limit)
			if (intervals > 512 - ySegments * 2) {
				// It's important to pass in a unique object for each iteration
				// of the loop. Otherwise, they all have the same object!
				sendElevationRequest({
					'path': path.slice(),
					'samples': intervals
				}, timeout);
				path = [];
				intervals = 0;
				timeout += 200;
				openRequests += 1;
			}
		}
		if (path.length !== 0) {
			var pathRequest = {
				'path': path,
				'samples': intervals
			};
			sendElevationRequest(pathRequest, timeout);
			openRequests += 1;
		}
		var counter = 0;

		function addToTerrain(results, status) {
			openRequests -= 1;
			if (status != google.maps.ElevationStatus.OK) {
				console.error(status);
				return;
			}
			results.forEach(function (thing) {
				var indeces = LatLongtoIndeces(thing);
				if (elevations[indeces[0]] === undefined) {
					elevations[indeces[0]] = [];
				}
				elevations[indeces[0]][indeces[1]] = thing.elevation;
			});
			if (openRequests === 0) {
				makeTerrainMesh();
				saveToCache(saveName, elevations);
			}

		}

		function sendElevationRequest(pathRequest, timeout) {
			setTimeout(function () {
				elevator.getElevationAlongPath(pathRequest, handleResults);
			}, timeout);

			function handleResults(results, status) {
				if (status == google.maps.ElevationStatus.OVER_QUERY_LIMIT) {
					setTimeout(sendElevationRequest(pathRequest, 2000));
				} else {
					addToTerrain(results, status);
				}
			}
		}

		function LatLongtoIndeces(latLong) {
			//location.A: Latitude!
			//location.F: Longitude!
			var width = Math.round((latLong.location.A - latLngMin.A) /
				(latLngMax.A - latLngMin.A) * (ySegments - 1));
			var height = Math.round((latLong.location.F - latLngMin.F) /
				(latLngMax.F - latLngMin.F) * xSegments);
			return [width, height];
		}

		function makeTerrainMesh() {
			var geometry = new THREE.PlaneGeometry(sizeX, sizeY, xSegments, ySegments - 1);
			var counter = 0;
			var vertices = geometry.vertices;
			var maxElevation = 0;

			for(var j = 0; j < ySegments; j += 1)
				for(var i = 0; i < xSegments; i += 1)
					maxElevation = Math.max(maxElevation, elevations[j][i]);

			var offset = property.box.center.z + property.box.size.z / 2 - maxElevation;
			for (var j = 0; j < ySegments; j += 1) {
				for (var i = 0; i <= xSegments; i += 1) {
					geometry.vertices[counter].z = elevations[j][i] + offset;
					counter += 1;
				}
			}

			var material = new THREE.MeshBasicMaterial({
				color: colors.terrain_frame,
				side: THREE.DoubleSide,
				transparent: true,
				wireframe: true,
				opacity: 0.2
			});
			terrainMesh = new THREE.Mesh(geometry, material);
			terrainMesh.geometry.computeBoundingBox();
			terrainMesh.geometry.computeBoundingSphere();
			terrainMesh.position.x += property.box.center.x;
			terrainMesh.position.y += property.box.center.y;

			terrainMesh.elementsNeedUpdate = true;

			var lineMaterial = new THREE.LineBasicMaterial({
				color: colors.terrain_frame,
				transparent: true,
				opacity: 0.2
			});
			var squareMesh = lineGeometryFromElevation(elevations, sizeX, sizeY);
			var noDiagonals = new THREE.Line(squareMesh, lineMaterial, THREE.LinePieces);
			noDiagonals.position.x -= (sizeX - property.box.size.x) / 2;
			noDiagonals.position.y -= (sizeY - property.box.size.y) / 2;

			scene.add(terrainMesh);
			setTimeout(function(){addSurveyLines()}, 0);
		}
	}

	function lineGeometryFromElevation(elevation, width, height) {
		var geometry = new THREE.BufferGeometry();
		var dx = width / (elevation[0].length - 1);
		var dy = height / (elevation.length - 1);

		var length1 = elevation.length;
		var length2 = elevation[0].length;

		//this should be the right size!
		var points = new Float32Array(((length1 - 1) * 2 * length2 + (length2 - 1) * 2 * length1) * 3);

		var i, j;
		var x = 0;
		var y = 0;
		var offset = 0;

		for (i = 0; i < elevation.length; i += 1) {
			x = 0;
			points.set([x, y, elevation[i][0]], offset);
			offset += 3;
			for (j = 1; j < elevation[0].length - 1; j += 1) {
				points.set([x, y, elevation[i][j]], offset);
				points.set([x, y, elevation[i][j]], offset + 3);
				offset += 6;
				x += dx;
			}
			points.set([x, y, elevation[i][elevation[0].length - 1]], offset);
			offset += 3;
			y += dy;
		}

		x = 0;
		for (j = 0; j < elevation[0].length; j += 1) {
			y = 0;
			points.set([x, y, elevation[0][j]], offset);
			offset += 3;
			for (i = 1; i < elevation.length - 1; i += 1) {
				points.set([x, y, elevation[i][j]], offset);
				points.set([x, y, elevation[i][j]], offset + 3);
				offset += 6;
				y += dy;
			}
			points.set([x, y, elevation[elevation.length - 1][j]], offset);
			offset += 3;
			x += dx;
		}

		geometry.addAttribute("position", new THREE.BufferAttribute(points, 3));

		return geometry;
	}

	function saveToCache(name, object) {
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
	function colorFromString(stringColor) {
		var color = stringColor.split("#");
		color = "0x" + color[1];
		return new THREE.Color(parseInt(color, 16));
	}

	/**
	 * Change which range of concentrations for a mineral are displayed.
	 * Anything out of the given range is not rendered.
	 *
	 * @param  {String} mineralName The string identifier from the property
	 *                              JSON file for the mineral.
	 * @param  {Number} lowerValue  The lower bound to keep meshes visible.
	 * @param  {Number} higherValue The upper bound to keep meshes visible.
	 *
	 * @todo I think Mason changed this to concentration values, not indices.
	 */
	this.updateVisibility = updateVisibility;

	function updateVisibility(mineralName, lowerValue, higherValue) {
		var mineral = null;

		try {
			mineral = minerals[mineralName];
		} catch (e) {
			mineral = null;
		}
		if (!mineral) {
			console.log("There's no data for " + mineralName +
				", so I can't update the visibility of it.\n" +
				"Did you mean any of these?\n    " +
				Object.keys(minerals).join("\n    "));
			return;
		}

		var intervals = mineral.intervals;
		var emptyMesh = new THREE.Mesh(new THREE.BoxGeometry(0, 0, 0));
		mineral.minVisibleIndex = -1;
		mineral.maxVisibleIndex = -1;

		//Here we iterate through all of the meshes of the mineral, setting
		//the interval to be visible if it is between the value bounds
		for (var i = 0; i < intervals.length; i += 1) {
			var value = intervals[i].value;
			if (value >= lowerValue && value <= higherValue) {
				visibleMeshes[intervals[i].id] = meshes[intervals[i].id];
				if (mineral.minVisibleIndex < 0) {
					mineral.minVisibleIndex = i;
				}
			} else {
				visibleMeshes[intervals[i].id] = emptyMesh;
				if (mineral.minVisibleIndex >= 0 &&
					mineral.maxVisibleIndex < 0) {
					mineral.maxVisibleIndex = i - 1;
				}
			}
		}
		if (mineral.maxVisibleIndex < 0) {
			mineral.maxVisibleIndex = intervals.length - 1;
		}

		// Now we make a new BufferGeometry from the old one,
		// and add it to our mesh!
		var verticesPerInterval =
			meshes[0].geometry.attributes.position.array.length;

		var drawcall = mineral.mesh.geometry.drawcalls[0];
		drawcall.index = mineral.minVisibleIndex * verticesPerInterval / 3;
		drawcall.count = (mineral.maxVisibleIndex - mineral.minVisibleIndex + 1) * verticesPerInterval / 3;
	}

	/**
	 * When `visible` is a truthy value, the current range on `mineralName`
	 * minerals is enabled.
	 * When `visible` is a falsey value, the current range on `mineralName`
	 * minerals is disabled.
	 * @public
	 *
	 * @param  {String}  mineralName Which type of minerals to filter.
	 * @param  {Boolean} visible     Whether minerals of this type should be
	 *                               rendered or not.
	 */
	function toggleVisible(mineralName, visible) {
		if(mineralName == "surveyHoles"){
			for(var line in holes.lines){
				if(visible == null){
					visible = !holes.lines[line].visible;
				}
				holes.lines[line].visible = visible;
			}
			return;
		}
		if(mineralName == "terrain"){
			if(visible == null){
				visible = !terrainMesh.visible;
			}
			terrainMesh.visible = visible;
			return;
		}

		var mineral = minerals[mineralName];
		var intervals = mineral.intervals;
		if(visible == null){
			visible = !mineral.mesh.visible;
		}
		mineral.mesh.visible = visible;

		var i = null;
		var start = mineral.minVisibleIndex;
		var end = mineral.maxVisibleIndex;
		if (visible) {
			for (i = start; i <= end; i += 1) {
				visibleMeshes[intervals[i].id] = meshes[intervals[i].id];
			}
		} else {
			var emptyMesh = new THREE.Mesh(new THREE.BoxGeometry(0, 0, 0));
			for (i = start; i < end; i += 1) {
				visibleMeshes[intervals[i].id] = emptyMesh;
			}
		}
	}
	// Export this function.
	this.toggleVisible = toggleVisible;


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
		}
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
			return (num > 1000 ? (num / 1000) + ' k' : num) + "m";
		}

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
				backgroundColor: {
					r: 0,
					g: 0,
					b: 0,
					a: 0
				},
				fontsize: 40
			});
			sprite.position.set(x, y, z);
			return sprite;
		}

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
				maxDimension / 20);

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
			var markerDistance = Math.max(length / 5 - 1, maxDimension / 20);
			for (var y = markerDistance; y < length; y += markerDistance) {
				scene.add(makeLabel(formatKm(y), 0, y, base));
			}
			y -= markerDistance / 1.2;
			scene.add(makeLabel("Y", 0, y, base));
		})();

		(function () {
			var length = property.box.size.z;
			var markerDistance = Math.max(length / 5 - 1, maxDimension / 20);
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

		reticleLight = new THREE.PointLight(
			colors.reticleLight,
			5,
			maxDimension / 15);
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

		reticle.position.copy(controls.target);
		reticleLight.position.copy(controls.target);
		cameraLight.position.copy(camera.position);

		renderer.clear();
		renderer.render(scene, camera);
		renderer.clearDepth();
		renderer.render(sceneOrtho, cameraOrtho);
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
		var fontface = parameters.hasOwnProperty("fontface") ?
			parameters["fontface"] : "Arial";
		var fontsize = parameters.hasOwnProperty("fontsize") ?
			parameters["fontsize"] : 30;
		var size = parameters.hasOwnProperty("size") ?
			parameters["size"] : 512;
		var textColor = parameters.hasOwnProperty("textColor") ?
			parameters["textColor"] : {
				r: 0,
				g: 0,
				b: 0,
				a: 1.0
			};
		var backgroundColor = parameters.hasOwnProperty("backgroundColor") ?
			parameters["backgroundColor"] : {
				r: 255,
				g: 250,
				b: 200,
				a: 0.8
			};

		var canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		var context = canvas.getContext('2d');
		context.font = fontsize + "px " + fontface;

		// Draw background rectangle
		//find the size of our text to draw the rectangle around
		var lines = message.split("\n");
		var lineHeight = fontsize;
		var maxTextWidth = 0;
		lines.forEach(function (line) {
			var textWidth = context.measureText(line).width;
			if (textWidth > maxTextWidth) {
				maxTextWidth = textWidth;
			}
		});
		//set the color to the input
		context.fillStyle = "rgba(" +
			backgroundColor.r + "," +
			backgroundColor.g + "," +
			backgroundColor.b + "," +
			backgroundColor.a + ")";

		context.fillRect(0.5 * size - 15,
			0.5 * size - fontsize - 15,
			maxTextWidth + 30,
			lines.length * lineHeight + 30);

		context.textAlign = 'left';
		context.fillStyle = "rgba(" +
			textColor.r + ", " +
			textColor.g + ", " +
			textColor.b + ", 1.0)";

		context.wrapText(message, size / 2, size / 2, 10000, fontsize);

		var texture = new THREE.Texture(canvas);
		texture.needsUpdate = true;

		var spriteMaterial = new THREE.SpriteMaterial({
			map: texture,
			transparent: true
		});

		var sprite = new THREE.Sprite(spriteMaterial);

		sprite.scale.set(
			maxDimension / 10,
			maxDimension / 10,
			maxDimension / 10);
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
	function getProperty(projectJSON) {
		var boxMin = vec3FromArray(projectJSON["boxMin"]);
		var boxMax = vec3FromArray(projectJSON["boxMax"]);
		var size = boxMax.clone().sub(boxMin);
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
				size: size,
				center: center
			}
		};

		projectJSON["analytes"].forEach(function (analyte) {
			property.analytes[analyte.name] = {
				color: analyte.color,
				description: analyte.description
			};
		});

		return property;
	}

	/**
	 * Checks if the mouse is "hovering over" any cylinders in `visibleMeshes`
	 * on the screen. If it finds something, it adds tool tip.
	 */
	function checkMouseIntercept() {

		// Don't ray cast if we're rotating, moving the reticle or haven't yet
		// set up the mineral intervals
		if (!raycaster || controls.autoRotate || motionInterval) {
			return;
		}
		raycaster.setFromCamera(mouse, camera);
		var intersects = raycaster.intersectObjects(visibleMeshes);

		if (intersects.length === 0) {
			intersected = null;
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
			"Mineral:\t" + data.mineral +
			"\nValue:  \t" + data.value +
			"\nDepth:  \t" + data.depth.start + '-' + data.depth.end +
			"\nHole:\t" + holes.ids[data.hole].name, {
				backgroundColor: {
					r: 11,
					g: 62,
					b: 111,
					a: 1
				},
				textColor: {
					r: 246,
					g: 246,
					b: 246,
					a: 1
				}
			});

		tooltipSprite.scale.set(250, 250, 1);
		tooltipSprite.position.z = 0;
		tooltipSprite.position.x = tooltipSpriteLocation.x;
		tooltipSprite.position.y = tooltipSpriteLocation.y;
		sceneOrtho.add(tooltipSprite);

	}

	/**
	 * Save a rendered frame as an image, returning the image data.
	 * @return {String} The image data.
	 */
	function takeScreenshot() {
		renderer.render(scene, camera);
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

			cameraOrtho.left = -window.innerWidth / 2;
			cameraOrtho.right = window.innerWidth / 2;
			cameraOrtho.top = window.innerHeight / 2;
			cameraOrtho.bottom = -window.innerHeight / 2;

			cameraOrtho.updateProjectionMatrix();

			renderer.setSize(window.innerWidth, window.innerHeight);
		});

		container.addEventListener('mousemove',
			function mousemoveEventListener(event) {
				event.preventDefault();

				// This will update the mouse position as well as make the
				//   tooltipSprite follow the mouse.
				var newX = event.clientX - (window.innerWidth / 2) + 20;
				var newY = -event.clientY + (window.innerHeight / 2) - 40;
				if (tooltipSpriteLocation.x == newX &&
					tooltipSpriteLocation.y == newY) {
					//If the mouse wasn't moved, ignore the following logic
					return;
				}
				tooltipSpriteLocation.x = newX;
				tooltipSpriteLocation.y = newY;

				mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
				mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
				mouseMoved = true;

				sceneOrtho.remove(tooltipSprite);
				scene.remove(intersected);
				intersected = null;

				window.clearTimeout(mouseTimeout);
				if (event.buttons === 0 && raycaster) {
					mouseTimeout = window.setTimeout(checkMouseIntercept, 150);
				}

				if (event.buttons % 4 - event.buttons % 2 == 2) { //panning!
					window.clearInterval(motionInterval);
					motionInterval = null;
				}
			}, false);

		container.addEventListener("click",
			function mouseClickEventListener(event) {
				if (!mouseMoved) {
					clearTimeout(motionInterval);
					motionInterval = null;
					if (intersected) {
						startMotion(intersected);
						sceneOrtho.remove(tooltipSprite);
						scene.remove(intersected);
						intersected = null;
					} else {
						motion = [];
					}
				}
			});

		container.addEventListener("mousedown",
			function mousedownEventListener(event) {
				event.preventDefault();
				mouseMoved = false;
				// autoRotate is true when both left and right buttons are
				// clicked simultaneously and false otherwise
				if (event.buttons == 3) {
					controls.autoRotate = true;
				} else {
					controls.autoRotate = false;
				}
			});
	}

	function startMotion(toHere) {
		if (toHere.geometry.boundingSphere === undefined) {
			toHere.computeBoundingSphere();
		}

		// Use the bounding sphere to get the center of the mesh
		// and to determine a reasonable distance to approach to
		var toSphere = toHere.geometry.boundingSphere;
		var movementVector = new THREE.Vector3();

		// get the movement vector
		movementVector.subVectors(toSphere.center, controls.target);

		// and subtract the radius of both of the bounding spheres from
		//the vector

		var tempVec1 = movementVector.clone();
		tempVec1.normalize();
		tempVec1.multiplyScalar(-1 * toSphere.radius);
		movementVector.add(tempVec1);

		tempVec1 = movementVector.clone();
		tempVec1.normalize();
		tempVec1.multiplyScalar(-1 * reticle.geometry.boundingSphere.radius);
		movementVector.add(tempVec1);

		var acceleration = movementVector.length() / 25000 + 0.01;

		var reticleMotion = getDeltasForMovement(movementVector, acceleration);
		var cameraMotion = getDeltasForMovement(movementVector,
			acceleration * 0.15);

		//get rid of the last interval, in case it exists
		window.clearInterval(motionInterval);

		//Start an interval to move the reticle around!
		//Trigger 100 times a second
		motionInterval = setInterval(function () {
			if (reticleMotion.length !== 0) {
				controls.target.add(reticleMotion.pop());
			}
			if (cameraMotion.length !== 0) {
				camera.position.add(cameraMotion.pop());
			}

			if (reticleMotion.length === 0 && cameraMotion.length === 0) {
				window.clearInterval(motionInterval);
				motionInterval = null;
			}
		}, 10);
	}

	function getDeltasForMovement(movementVector, acceleration) {

		//get the total length of the movement
		var length = movementVector.length();

		//now construct a motion array of Vector3's that will constantly
		//accelerate and then decelerate towards the object.
		var normalMovement = movementVector.clone();
		normalMovement.normalize();
		var totalMovement = 0;

		var speed = 0;
		var accelerate = [];
		var decelerate = [];

		while (totalMovement < length) {
			speed += acceleration;
			var movement = normalMovement.clone().multiplyScalar(speed);
			accelerate.push(movement);
			totalMovement += speed;
			if (totalMovement >= length) {
				break;
			}
			decelerate.unshift(movement);
			totalMovement += speed;
		}

		//we probably just overshot it, so pop off the movements until
		//we're in front of it, then touch us to the sphere

		var motion = accelerate.concat(decelerate);

		while (totalMovement > length) {
			totalMovement -= motion.pop().length();
		}
		normalMovement.multiplyScalar(length - totalMovement);
		motion.push(normalMovement);

		return motion;
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
			new THREE.IcosahedronGeometry(maxDimension / 2000, 3),
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
			700 * maxDimension);

		camera.up.set(0, 0, 1);

		camera.position.set(
			1.5 * maxDimension,
			1.5 * maxDimension,
			1.5 * maxDimension + property.box.center.z - 0.5 * property.box.size.z);

		camera.lookAt(property.box.center);

		//Sets up the 2d orthographic camera for tooltips
		cameraOrtho = new THREE.OrthographicCamera(
			window.innerWidth / -2,
			window.innerWidth / 2,
			window.innerHeight / 2,
			window.innerHeight / -2,
			1,
			1000);
		cameraOrtho.position.z = 1;
		cameraOrtho.position.x = 0;
		cameraOrtho.position.y = 0;
	}

	function setupRenderer() {
		renderer = new THREE.WebGLRenderer({
			antialias: true,
		});
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setClearColor(colors.background, 1);
		renderer.sortObjects = false;
		renderer.autoClear = false;
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
		controls.minDistance = maxDimension / 200;
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

	function getHistogramCSV(JSONData, ShowLabel) {
		//If JSONData is not an object then JSON.parse will parse the JSON string in an Object
		var arrData = typeof JSONData != 'object' ? JSON.parse(JSONData) : JSONData;

		var CSV = '';
		var row = null;
		var index = null;

		//This condition will generate the Label/Header
		if (ShowLabel) {
			row = "";

			//This loop will extract the label from 1st index of on array
			for (index in arrData[0]) {
				//Now convert each value to string and comma-seprated
				row += index + ',';
			}

			row = row.slice(0, -1);

			//append Label row with line break
			CSV += row + '\r\n';
		}

		//1st loop is to extract each row
		for (var i = 0; i < arrData.length; i++) {
			row = "";

			//2nd loop will extract each column and convert it in string comma-seprated
			for (index in arrData[i]) {
				row += '"' + arrData[i][index] + '",';
			}

			row.slice(0, row.length - 1);

			//add a line break after each row
			CSV += row + '\r\n';
		}

		if (CSV === '') {
			console.log("Invalid CSV data from minerals");
		}

		return CSV;
	}
}
