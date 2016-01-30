/**
 * The object which manages everything.
 *
 * @param {string} projectURL A URL to a JSON file with the property data in
 *                            the jsondh format.
 */
function View( projectURL ) {

	/**
	 * The base geometry used for instancing interval cylinders.
	 * @type {THREE.BufferGeometry}
	 */
	var baseCylinderGeometry = null;

	/**
	 * Version of the objects stored in the cache. This way they will automatically
	 * reload whenever changes would otherwise make old object invalid
	 */
	var cacheVersion = "v1.0";

	/**
	 * The perspective camera which presents the user's view of the property.
	 * @type {THREE.Camera}
	 */
	var camera = null;

	/**
	 * An orthographic camera used to render tooltips.
	 * @type {THREE.OrthographicCamera}
	 */
	var cameraOrtho = null;

	/**
	 * The DOM element containing our canvas.
	 * @type {iframe}
	 */
	var container = $( '#viewFrame' );

	/**
	 * Handle for the orbital controls, which enables an orbiting view.
	 * @type {THREE.OrbitControls}
	 */
	var controls = null;

	/**
	 * ID counter used to count off the interval cylinders
	 * @type {Number}
	 */
	var currentID = 0;

	/**
	 * Scale which the width of the interval cylinder's widths with be
	 * multiplied by before being added to the scene.
	 * @type {Number}
	 */
	var cylinderScale = 1.0;

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
	 * This boolean determines whether the application will try to load the
	 * terrain mesh from the HTML5 cache.
	 * @type {Boolean}
	 */
	var loadFromCache = true;

	/**
	 * The number of segments used on the longest side of the property box.
	 * The other side uses however many fit, ensuring the terrain has square
	 * sides on its wireframe.
	 * @type {Number}
	 */
	var maxPossibleSegments = 50;

	/**
	 * Fancy array with minerals meta-data.
	 * @see getMinerals
	 */
	var minerals = {};

	/**
	 * Store the mouse position for ray casting.
	 * @type {THREE.Vector2}
	 */
	var mouse = new THREE.Vector2();

	/**
	 * This scene is used for rendering images off-screen for gpu-picking.
	 * @type {THREE.Scene}
	 */
	var pickingScene = null;

	/**
	 * The texture we render to for gpu-picking.
	 * @type {THREE.WebGLRenderTarget}
	 */
	var pickingTexture = null;

	/**
	 * The property JSON after it's loaded.
	 */
	var project = {};

	/**
	 * The property object after it's been processed.
	 */
	var property = null;

	/**
	 * The threejs WebGL rendering object.
	 * @type {THREE.WebGLRenderer}
	 */
	var renderer = null;

	/**
	 * Our orbital controls rotate, or orbit, around a centeral point. It's
	 * hard to tell where that is, so we keep a sphere positioned there.
	 * @type {THREE.Mesh}
	 */
	var reticle = null;

	/**
	 * The objects threejs uses to represent what it needs to draw.
	 * @type {THREE.Scene}
	 */
	var scene = null;

	/**
	 * We emulate a second scene to get tool tips to work. This is the scene
	 *  for that.
	 *  @see  cameraOrtho
	 * @type {THREE.Scene}
	 */
	var sceneOrtho = new THREE.Scene();

	/**
	 * Size in bytes of file holding the project.json object
	 * @type {Number}
	 */
	var byteSize = null;

	/**
	 * FPS counter. https://github.com/mrdoob/stats.js/
	 * @type {THREE.Stats}
	 */
	var stats = null;

	/**
	 * The terrain mesh to be laid over the property box.
	 *@type {THREE.Mesh}
	 */
	 var terrainMesh = null;

	/**
	 * Contains timeouts and event listeners we add to the window and container
	 * @type {Object}
	 */
	var timeouts = {};

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
	 * Entry point for view. Call this after `new View();`.
	 */

	this.start = function () {

		View.getJsonSize( projectURL, setSize );

		// Starts an asynchronous ajax request to setup
		View.loadJSON( projectURL, setup.bind( this ) );

		// In the meantime, run the methods not dependent on the project
		baseCylinderGeometry = makeCylinderGeometry( 1, 1, 6 );
		setupContainerAndStats();
		setupRenderer();
		setupCameraAndControls();
		setupScene();

		setupWindowListeners();

		render();
	}

	// The callback given to getJsonSize. The parameter reads in the byte size
	//  of the JSON being loaded, and loads the property from cache if it exists
	function setSize( bytes ) {

		byteSize = Number( bytes );

		var saveName = projectURL + byteSize + cacheVersion + '.property' ;

		if( loadFromCache && !property && localStorage.hasOwnProperty( saveName ) ){
			property = JSON.parse( localStorage[ saveName ] );
			loadFromProperty( property );
		}
	}

	function setup( json ) {

		project.json = json

		if( !property ){
			property = getProperty();
			loadFromProperty();
		}

		interpolateDownholeSurveys();
		addSurveyLines();
		
		// If our JSON file is less than a gigabyte, we should be fine loading in all
		// the minerals simultaneously and adding them to the scene.
		if( !byteSize || byteSize < 1024 * 1024 * 1024 ){

			getMinerals();

		} else {
			console.log( "JSON object detected to be large. (" + ( size >> 20 ) + " MB)\n" +
				         "Manually add analytes using the sidebar " );
		}

		this.property = property;
		this.controls = controls;
		this.minerals = minerals;
		this.scene = scene;
		this.url = projectURL;

	}

	// Detached from the rest of setup because none of this needs the full
	//  project JSON to be completed
	function loadFromProperty() {

		addTerrain();
		addBoundingBox();
		addAxisLabels();
		addReticle();
		addLights();

		loadSidebar( property );

		finishSetup();
	}

	// Returns a simple indexed bufferGeometry representing a cylinder. Included
	//  because the THREE library doesn't index the positions with its built-in fromGeometry() method
	function makeCylinderGeometry(diameter, height, sides){

		var cylinder = new THREE.CylinderGeometry(diameter / 2, diameter / 2, height, sides);

		// Manually take the positions and indices from the initial cylinder geometry
		var positions = new Float32Array(cylinder.vertices.length * 3);

		for(var i = 0; i < cylinder.vertices.length; i += 1) {
			positions.set(cylinder.vertices[i].toArray(), i * 3)
		}

		var indices = new Uint16Array(cylinder.faces.length * 3);

		for(var i = 0; i < cylinder.faces.length; i += 1){
			indices[i*3]   = cylinder.faces[i].a;
			indices[i*3+1] = cylinder.faces[i].b;
			indices[i*3+2] = cylinder.faces[i].c;
		}

		var bufferCylinder = new THREE.BufferGeometry();

		bufferCylinder.addAttribute("position", new THREE.BufferAttribute(positions, 3));
		bufferCylinder.setIndex(new THREE.BufferAttribute(indices, 1));

		// Rotate it so that z is pointing up
		bufferCylinder.rotateX( Math.PI / 2 );

		return bufferCylinder;
	}

	// Adds locations to the rawDownholeSurveys
	function interpolateDownholeSurveys() {
		var warn = false

		project.json.holes.forEach( function ( hole ) {
			var location = vec3FromArray( hole.location );

			// If rawDownholeSurveys is not defined, make a deep copy of the
			//  interpolatedDownholeSurveys object.
			if( !hole.rawDownholeSurveys ){
				hole.rawDownholeSurveys = hole.interpolatedDownholeSurveys;
				warn = true;
			}

			hole.rawDownholeSurveys[0].location = location.clone();
			hole.rawDownholeSurveys[0].quaternion = new THREE.Quaternion().setFromAzimuthInclination(
																		hole.rawDownholeSurveys[0].azimuth,
																		hole.rawDownholeSurveys[0].inclination );

			// For every next survey after the first, move the location down by the given depth, and clone it.
			// Also make a quaternion for the rotation of cylinders that lie along this hole
			for( var i = 1; i < hole.rawDownholeSurveys.length; i += 1 ) {

				var thisSurvey = hole.rawDownholeSurveys[ i ];
				var lastSurvey = hole.rawDownholeSurveys[ i - 1 ];

				thisSurvey.location = location.moveDownhole(
					thisSurvey.depth - lastSurvey.depth,
					lastSurvey.azimuth, 
					lastSurvey.inclination ).clone();

				thisSurvey.quaternion = new THREE.Quaternion().setFromAzimuthInclination( thisSurvey.azimuth, thisSurvey.inclination );
			}

		} );

		if( warn ){
			console.warn( "interpolatedDownholeSurveys is deprecated. Use rawDownholeSurveys instead." );
		}
	}


	/**
	 * Parse `project.json["holes"]` into `minerals`, which looks like this:
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
	 */

	// Adds all minerals to the scene
	function getMinerals() {

		( function() {
			var i = 0;
			var analytes = Object.keys( property[ "analytes" ] );
			setTimeout( addNextMineral, 100 );

			function addNextMineral(){
				var mineral = getMineral( analytes[i] );
				if( mineral )
					scene.add( mineral.mesh );

				if( ++i < analytes.length )
					setTimeout( addNextMineral, 100 );
			}
		} )();
	}

	// Extracts a single mineral from the JSON object and prepares it for
	//  rendering in the scene.
	function getMineral( mineral ) {

		// Return if it's not listed in the JSON
		if( !property.analytes[ mineral ] ){
			console.error( mineral + " not found in the analytes object in project's JSON." );
			return;
		}

		// Return if it has already been instantiated
		if( minerals[ mineral ] || minerals[ mineral ] === null ){
			return;
		}

		loadFromJSON();

		if( minerals[ mineral ].intervals.length == 0 ){
			console.warn( mineral + " did not have any intervals in the JSON." );

			minerals[ mineral ] = null;

			checkDeleteProject();
			return;
		}

		sortIntervals();
		loadAttributes();
		createMeshes();
		addMineralToSidebar( mineral, minerals[ mineral ].intervals );
		checkDeleteProject();

		return minerals[ mineral ];


		// Reformats the data from project.json into the mineral's intervals object
		function loadFromJSON(){

			minerals[ mineral ] = {
					color: property.analytes[ mineral ].color,
					intervals: [],
					startID: currentID,
					maxValue: 0
				}

			var holesJSON = project.json.holes;

			// by adding this small value to the length of the cylinders,
			//  we can prevent the z fighting on the tops and bottoms
			var preventZFighting = ( Object.keys(minerals).length - 1 ) * Math.PI / 100;

			// Iterate over all the holes in the JSON object
			for( var i = 0; i < holesJSON.length; i += 1 ){

				// Iterate over all the different minerals in each hole
				holesJSON[ i ].downholeDataValues.forEach( function( dhValue ){

					// Return unless we found the mineral that we're looking for
					if( dhValue.name != mineral){
						return;
					}

					// Iterate over all the intervals of this mineral found in this hole.
					//  Add each to the intervals array to be sorted and added to a Mesh
					for( var j = 0; j < dhValue.intervals.length; j += 1 ){
						var interval = dhValue.intervals[ j ];

						// In the case that there are two consecutive intervals with the
						//  same value, collapse them before adding them to intervals
						while( j < dhValue.intervals.length - 1 && interval.to >= dhValue.intervals[ j + 1 ].from
						                                        && interval.value == dhValue.intervals[ j + 1 ].value ){

							interval.to = Math.max( interval.to, dhValue.intervals[ ++j ].to );

						}

						// Interpolate the cylinder down the hole
						var interpolated = interpolateInterval( interval, holesJSON[ i ] );
						Array.prototype.push.apply( minerals[ mineral ].intervals, interpolated );

						minerals[ mineral ].maxValue = Math.max( interval.value, minerals[ mineral ].maxValue );
					}

				} );
			}

			return;

			// Returns a list of interpolated intervals that coincide with the hole
			//  that they are found on. Prevents long intervals from "short-cutting"
			//  from their beginning location to their end location.
			function interpolateInterval( rawInterval, hole ){

				var intervals = [];
				var from      = rawInterval.from;
				var rawDH     = hole.rawDownholeSurveys;

				var index = 1;
				// Now we traverse down the hole, making a new interval for each
				//  time the rawInterval spans between rawDH surveys.
				//  Stop once we pass the interval.
				while( index < rawDH.length && rawInterval.to > rawDH[ index ].depth ){
					// if from < survey depth and to > survey depth, then the interval must be split
					if( from < rawDH[ index ].depth ){
						var interval = makeInterval( rawDH[ index - 1 ], from, rawDH[ index ].depth, rawInterval, hole.id );
						intervals.push( interval );
						
						from = rawDH[ index ].depth;
					}
					index += 1;
				}

				// Last interval that doesn't span across two surveys
				if( from != rawInterval.to ){
					intervals.push( makeInterval( rawDH[ index - 1], from, rawInterval.to, rawInterval, hole.id ) );
				}

				return intervals;
			}


			// Helper function to format interval data
			function makeInterval( survey, from, to, rawInterval, holeID ){
				// by getting the depth halfway through the interval, it allows
				//  us to find the center of its location
				var halfWayDepth = from + ( to - from ) / 2 - survey.depth;
				var location = survey.location.clone().moveDownhole(
										halfWayDepth, 
										survey.azimuth,
										survey.inclination );
				
				var interval = new View.Interval( {
					length:      to - from + preventZFighting,
					location:    location,
					holeID:      holeID,
					quaternion:  survey.quaternion,
					value:       rawInterval.value,
					from:        from,
					to:          to
				} );

				return interval;
			}
		}

		// Sorts the intervals in descending order, and gives them IDs
		function sortIntervals() {

			var intervals = minerals[ mineral ].intervals;
			intervals.sort( function ( a, b ) {
				return b.value - a.value;
			} );

			for( var i = 0; i < intervals.length; i += 1, currentID += 1 ){
				intervals[ i ].id = currentID;
				holes.ids[ intervals[ i ].holeID ].intervalIDs.push( currentID );
			}

			minerals[ mineral ].endID = currentID - 1;
		}

		// Sets up the attributes to be rendered as an instanced geometry
		function loadAttributes() {
			var intervals = minerals[ mineral ].intervals;
			var instances = intervals.length;

			// This buffer holds all the attributes that won't change.
			var staticInterleavedBuffer = new THREE.InstancedInterleavedBuffer( new Float32Array( instances * 13 ), 13, 1 );

			var data = {
				interleavedBuffer: staticInterleavedBuffer,

				// Use staticInterleavedBuffer, 3 items in offsets attribute, starting at offset 0
				offsets:   new THREE.InterleavedBufferAttribute( staticInterleavedBuffer, 3, 0 ),
				heights:   new THREE.InterleavedBufferAttribute( staticInterleavedBuffer, 1, 3 ),
				widths:    new THREE.InterleavedBufferAttribute( staticInterleavedBuffer, 1, 4 ),
				rotations: new THREE.InterleavedBufferAttribute( staticInterleavedBuffer, 4, 5 ),
				idColors:  new THREE.InterleavedBufferAttribute( staticInterleavedBuffer, 4, 9 ),

				/* Extra bits to determine how each cylinder is rendered... */
				/*
				**  When set to true, the bits have the following effects
				**  0: do not render
				**  1: emit hover color
				**  2: emit diffuse color
				**  3: increase size
				**  4: decrease size
				**  5: transparent
				**  6: remove
				*/
				bitAttributes: new THREE.InstancedBufferAttribute( new Float32Array( instances ), 1, 1 ).setDynamic( true )
			}

			minerals[ mineral ].data = data;

			for( var i = 0; i < instances; i += 1 ) {

				data.offsets.setXYZ( i, intervals[ i ].location.x,
					                    intervals[ i ].location.y,
					                    intervals[ i ].location.z );
				data.heights.setX(   i, intervals[ i ].length );
				data.widths.setX(    i, Math.log( intervals[ i ].value + 1 ) /
					                    Math.log( minerals[ mineral ].maxValue ) );

				// Use the quaternion that we took from the survey line
				var quaternion = intervals[ i ].quaternion;

				data.rotations.setXYZW( i,
										quaternion.x,
										quaternion.y,
										quaternion.z,
										quaternion.w );

				// Will set a unique color for over 2^31 objects (~4 billion)
				//  to go onto the idMesh
				var idA = ((intervals[i].id >>> 24) & 0xff) / 0xff;
				var idR = ((intervals[i].id >>> 16) & 0xff) / 0xff;
				var idG = ((intervals[i].id >>>  8) & 0xff) / 0xff;
				var idB = ((intervals[i].id >>>  0) & 0xff) / 0xff;
				data.idColors.setXYZW( i, idR, idG, idB, idA );
			}
		}

		// Initializes the visible and picking meshes, and their corresponding
		//  geometry and materials
		function createMeshes() {
			var data = minerals[ mineral ].data;

			var geometry = new THREE.InstancedBufferGeometry().copy( baseCylinderGeometry );
			geometry.maxInstancedCount = minerals[ mineral ].intervals.length;

			geometry.addAttribute( "position",    baseCylinderGeometry.attributes.position );
			geometry.addAttribute( "offset",      data.offsets );
			geometry.addAttribute( "height",      data.heights );
			geometry.addAttribute( "width",       data.widths );
			geometry.addAttribute( "quaternion",  data.rotations );
			geometry.addAttribute( "dynamicBits", data.bitAttributes );
			geometry.addAttribute( "id",          data.idColors );
 
			data.uniforms = THREE.UniformsUtils.clone( THREE.ShaderLib['instancing_visible'].uniforms );

			data.uniforms.diffuse.value = colorFromString( minerals[ mineral ].color );
			data.uniforms.uniformSceneScale.value = cylinderScale;

			// Scale each mineral down a little bit more than the last.
			//  Prevents Z-Fighting when logWidths is set to 0.
			var numberMinerals = Object.keys( minerals ).length;
			data.uniforms.constantWidth.value = Math.pow( .99, numberMinerals - 1 );

			// Set up a phong material with our custom vertex shader
			var visibleMaterial = new THREE.ShaderMaterial({
				uniforms: 			data.uniforms,
				vertexShader:   	THREE.ShaderLib["instancing_visible"].vertexShader,
				fragmentShader: 	THREE.ShaderLib["instancing_visible"].fragmentShader,
				lights: 			true,
				//transparent: 		true,
				shading: 			THREE.FlatShading
			});

			// Use our custom fragment shader to render the IDs
			var idMaterial = new THREE.ShaderMaterial({
				uniforms: 			data.uniforms,
				vertexShader:   	THREE.ShaderLib["instancing_picking"].vertexShader,
				fragmentShader: 	THREE.ShaderLib["instancing_picking"].fragmentShader,
				lights:             false,
				transparent:        false
			});

			var visibleMesh = new THREE.Mesh( geometry, visibleMaterial );
			minerals[ mineral ].mesh = visibleMesh;
			visibleMesh.frustumCulled = false;

			var pickingMesh = new THREE.Mesh( geometry, idMaterial );
			visibleMesh.pickingMesh = pickingMesh;
			pickingMesh.frustumCulled = false;
		}
	}

	// delete the JSON object when it's no longer needed to free memory
	function checkDeleteProject() {

		if( project.json.analytes.length == Object.keys( minerals ).length ){
			return delete project.json;
		}

	}

	function mineralIDToInterval( id ) {
		var mineral = minerals[ mineralIDToMineral( id ) ];
		return mineral.intervals[ id - mineral.startID ];
	}

	function mineralIDToMineral( id ) {
		for( var mineral in minerals ) {
			if( minerals[ mineral ] && id >= minerals[ mineral ].startID && id <= minerals[ mineral ].endID ){
				return mineral;
			}
		}
	}

	/**
	 * Load the survey holes from `project.json`
	 *
	 * @todo Return the holes object instead of modifying a global object.
	 */
	function addSurveyLines() {

		var geometries = {};
		holes.lines = {};
		holes.ids = {};

		project.json["holes"].forEach( function ( jsonHole ) {

			// Make a different geometry for each differently colored type of line
			var color = jsonHole["traceColor"];
			if ( geometries[color] === undefined ) {
				geometries[color] = [];
			}

			var surveys = jsonHole["rawDownholeSurveys"];

			var hole = {
				name:        jsonHole["name"],
				longitude:   jsonHole["longLat"][0],
				latitude:    jsonHole["longLat"][1],
				location:    jsonHole["location"],
				intervalIDs: []
			};

			holes.ids[ jsonHole[ 'id' ] ] = hole;

			// Last survey listed in the hole
			var lastSurvey = surveys[ surveys.length - 1 ];

			// Add a placeholder survey at the bottom of the hole if there isn't one already there
			if( jsonHole.depth > lastSurvey.depth ){
				var location = lastSurvey.location.clone();
				location.moveDownhole( jsonHole.depth - lastSurvey.depth,
									   lastSurvey.azimuth,
									   lastSurvey.inclination );

				lastSurvey = {
					depth: jsonHole.depth,
					azimuth: lastSurvey.azimuth,
					inclination: lastSurvey.inclination,
					location: location,
					quaternion: lastSurvey.quaternion
				}

				surveys.push( lastSurvey );

			}


			// Push all of the locations to the geometry
			Array.prototype.push.apply( geometries[ color ], surveys[0].location.toArray() );

			for ( var i = 1; i < surveys.length - 1; i += 1 ) {
				// Points in the middle are both at the end of one segment, and the start of the next
				Array.prototype.push.apply( geometries[ color ], surveys[ i ].location.toArray() );
				Array.prototype.push.apply( geometries[ color ], surveys[ i ].location.toArray() );
			}

			Array.prototype.push.apply( geometries[ color ], lastSurvey.location.toArray() );
		} );


		// Create the Line objects to add to the scene
		Object.keys( geometries ).forEach( function ( jsonColor ) {

			var color = colorFromString( jsonColor );

			var material = new THREE.LineBasicMaterial( {
				transparent: true,
				opacity: 0.6,
				color: color
			} );

			var buffGeometry = new THREE.BufferGeometry();
			buffGeometry.addAttribute( 'position',
				new THREE.BufferAttribute( 
					new Float32Array( geometries[jsonColor] ),
					3 ) );

			holes.lines[jsonColor] = new THREE.LineSegments( buffGeometry,
				material );

			holes.lines[jsonColor].matrixAutoUpdate = false;
			scene.add( holes.lines[jsonColor] );

		} );
	}

	// Creates the terrain mesh from the browser cache, or by using elevations from
	//  Google Map's elevation services.
	function addTerrain() {

		var saveName = projectURL + byteSize + cacheVersion + ".terrain";

		if ( localStorage.hasOwnProperty( saveName ) && loadFromCache ) {
			//console.log( 'Loading ' + saveName + ' from cache.' );
			var elevationObj = JSON.parse( localStorage[ saveName ] );

			terrainMesh = makeBasicTerrainMesh( elevationObj );
			return elevateTerrainMesh( elevationObj );
		}

		// Otherwise make it from scratch
		var elevator = new google.maps.ElevationService();

		var latLngMin = [ property.longLatMin[1], property.longLatMin[0] ];
		var latLngMax = [ property.longLatMax[1], property.longLatMax[0] ];

		// This is the object where we will store the elevations returned from google,
		//  as well as other metadata
		var elevationObj = {
			elevations: []
		};

		var size = property.box.size;

		var maxTerrainDim = Math.max( size[0], size[1] ) * 1.02;
		var minTerrainDim = Math.min( size[0], size[1] ) * 1.02;

		// This variable makes it so that small property boxes don't wind up with too many segments
		var maxDimSegmentAmount = Math.ceil( Math.min( maxTerrainDim / 2.0,
			maxPossibleSegments ) );

		var segmentLength = maxTerrainDim / maxDimSegmentAmount;

		var minDimSegmentAmount = Math.ceil( minTerrainDim / segmentLength );
		minTerrainDim = minDimSegmentAmount * segmentLength;

		// Determine the number of samples to be obtained for each dimension, and determine
		//  the x/y size of our final mesh
		if ( size[0] >= size[1] ) {
			elevationObj.sizeX    = maxTerrainDim;
			elevationObj.sizeY    = minTerrainDim;
			elevationObj.xSamples = maxDimSegmentAmount + 1;
			elevationObj.ySamples = minDimSegmentAmount + 1;
		} else {
			elevationObj.sizeY    = maxTerrainDim;
			elevationObj.sizeX    = minTerrainDim;
			elevationObj.ySamples = maxDimSegmentAmount + 1;
			elevationObj.xSamples = minDimSegmentAmount + 1;
		}

		// Make a Mesh to go on top of the box until we get the elevation data from Google.		

		terrainMesh = makeBasicTerrainMesh( elevationObj );
		terrainMesh.position.z += property.box.max[2];
		scene.add( terrainMesh );


		var dx = ( latLngMax[1] - latLngMin[1] ) / elevationObj.xSamples;
		var dy = ( latLngMax[0] - latLngMin[0] ) / elevationObj.ySamples;

		( function() {
			var x = 0;
			var y = 0;

			var request = { };

			makeRequest();

			function makeRequest() {

				var latLngs = [];

				while( y < elevationObj.ySamples && latLngs.length < 128 ) {

					var lng = latLngMin[1] + x * dx;
					var lat = latLngMin[0] + y * dy;
					var latLng = new google.maps.LatLng( {lat: lat, lng: lng} );

					latLngs.push( latLng );

					if( ++x >= elevationObj.xSamples ){
						x = 0;
						y = y + 1;
					}

				}

				request['locations'] = latLngs;

				sendRequest();

			}

			function sendRequest(){
				elevator.getElevationForLocations( request, handleResult );
			}

			function handleResult( result, status ) {

				if( status != google.maps.ElevationStatus.OK ){
					return window.setTimeout( sendRequest, 1000 );
				}

				for( var i = 0; i < result.length; i += 1 ){
					elevationObj.elevations.push( result[ i ].elevation );
				}

				if( y >= elevationObj.ySamples){
					saveToCache( saveName, elevationObj );
					terrainMesh.position.z -= property.box.max[2];
					return elevateTerrainMesh( elevationObj );
				}

				window.setTimeout( makeRequest, 100 );
			}

		} )();


		function elevateTerrainMesh( elevationObj ) {

			var maxElevation = Number.MAX_VALUE * -1;
			var minElevation = Number.MAX_VALUE;

			for( var count = 0; count < elevationObj.elevations.length; count += 1 ){
				terrainMesh.geometry.vertices[ count ].z = elevationObj.elevations[ count ];
				maxElevation = Math.max( maxElevation, elevationObj.elevations[ count ] );
				minElevation = Math.min( minElevation, elevationObj.elevations[ count ] );
			}

			terrainMesh.geometry.verticesNeedUpdate = true;

			var zOffset = 0;

			// Make the terrain flush with the top of the property box
			zOffset = Math.max( zOffset, property.box.max[2] - maxElevation );
			zOffset = Math.min( zOffset, property.box.max[2] - minElevation );
			terrainMesh.position.z += zOffset;

			terrainMesh.updateMatrixWorld();
			terrainMesh.matrixAutoUpdate = false;

			scene.add( terrainMesh, false );
		}

		function makeBasicTerrainMesh( elevationObj ){

			var geometry = new THREE.PlaneGeometry( elevationObj.sizeX,
			                                        elevationObj.sizeY,
			                                        elevationObj.xSamples - 1,
			                                        elevationObj.ySamples - 1 );

			var material = new THREE.MeshBasicMaterial( {
				color: View.colors.terrain_frame,
				side: THREE.DoubleSide,
				transparent: true,
				wireframe: true,
				map: new THREE.Texture(),
				opacity: 0.14
			} );

			var mesh = new THREE.Mesh( geometry, material );
			mesh.wireMaterial = material;

			mesh.position.x += property.box.center[0];
			mesh.position.y += property.box.center[1];

			return mesh;
		}
	}

	function addImageToTerrain( imageURL ){

		// If there's no url, add the last image, or a satellite image
		if( !imageURL ){
			if( terrainMesh.imageMaterial ){
				return terrainMesh.material = terrainMesh.imageMaterial;
			}
			return addSatelliteImage();
		}

		var loader = new THREE.TextureLoader();
		loader.setCrossOrigin( "" );

		return loader.load( imageURL, function( texture ){

			texture.minFilter = THREE.LinearFilter;

			var material = new THREE.MeshBasicMaterial( {
				map: texture,
				side: THREE.DoubleSide,
				transparent: true,
				opacity: .8
			} );

			terrainMesh.material = material;
			terrainMesh.imageMaterial = material;

		} );

	}
	this.addImageToTerrain = addImageToTerrain;

	// Adds a satellite image from Google maps to the terrain mesh
	function addSatelliteImage() {

		var TILE_SIZE = 256;

		var url = "https://maps.googleapis.com/maps/api/staticmap?maptype=satellite&scale=2";

		var latLngMin = new google.maps.LatLng( {
			lat: property.longLatMin[1],
			lng: property.longLatMin[0] } );

		var latLngMax = new google.maps.LatLng( {
			lat: property.longLatMax[1],
			lng: property.longLatMax[0] } );

		var latLngCenter = new google.maps.LatLng( {
			lat: ( latLngMax.lat() + latLngMin.lat() ) / 2,
			lng: ( latLngMax.lng() + latLngMin.lng() ) / 2,
		} );

		url += "&center=" + latLngCenter.lat() + "," + latLngCenter.lng();

		var zoom = findMaxZoom( latLngMin, latLngMax, 640, 640 );

		url += "&zoom=" + zoom

		var minPoint = project( latLngMin );
		var maxPoint = project( latLngMax );

		var pixelSizeX = Math.ceil( Math.abs( maxPoint.x - minPoint.x ) * ( 1 << zoom ) );
		var pixelSizeY = Math.ceil( Math.abs( maxPoint.y - minPoint.y ) * ( 1 << zoom ) );

		url += "&size=" + pixelSizeX + "x" + pixelSizeY;

		return addImageToTerrain( url );

		// Returns the maximum zoom level that would fit latLng1 and latLng2
		//  onto a space given by dimensionX and dimensionY.
		//  Assumes that the points do not straddle the date line
		function findMaxZoom( latLng1, latLng2, dimensionX, dimensionY ){

			var point1 = project( latLng1 );
			var point2 = project( latLng2 );

			maxZoomX = ( -Math.log( Math.abs( point1.x - point2.x ) + 1e-12 ) +
				          Math.log( dimensionX ) ) / Math.log( 2 );
			maxZoomY = ( -Math.log( Math.abs( point1.y - point2.y ) + 1e-12 ) +
				          Math.log( dimensionY ) ) / Math.log( 2 );

			// Max zoom level is currently 26
			return THREE.Math.clamp( Math.floor( Math.min( maxZoomX, maxZoomY ) ), 0, 26 );

		}

		// The mapping between latitude, longitude and pixels is defined by the web
		// mercator projection.
		function project( latLng ) {
			var siny = Math.sin(latLng.lat() * Math.PI / 180);

			// Truncating to 0.9999 effectively limits latitude to 89.189. This is
			// about a third of a tile past the edge of the world tile.
			siny = Math.min(Math.max(siny, -0.9999), 0.9999);

			return new google.maps.Point(
			    TILE_SIZE * ( 0.5 + latLng.lng() / 360 ),
			    TILE_SIZE * ( 0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)) );
		}

	}
	this.addSatelliteImage = addSatelliteImage;

	function saveToCache( name, object ) {
		localStorage[name] = JSON.stringify( object );
		console.log( "Saving " + name + " data to cache." );
	}

	/**
	 * Convert a hex-color string starting with "#" to a THREE.Color object.
	 *
	 * @example
	 * // Returns "0x123456"
	 * colorFromString( "#0123456" );
	 *
	 * @param  {String} stringColor
	 *
	 * @return {THREE.Color}
	 */
	function colorFromString( stringColor ) {
		var color = stringColor.split( "#" );
		color = "0x" + color[1];
		return new THREE.Color( parseInt( color, 16 ) );
	}

	/**
	 * Change which range of concentrations for a mineral are displayed.
	 * Anything out of the given range is not rendered.
	 *
	 * @param  {String} mineralName The string identifier from the property
	 *                              JSON file for the mineral.
	 * @param  {Number} lowerValue  The lower bound to keep meshes visible.
	 * @param  {Number} higherValue The upper bound to keep meshes visible.
	 */
	this.updateVisibility = updateVisibility;

	function updateVisibility( mineralName, lowerValue, higherValue ) {

		var mineral = minerals[ mineralName ] || getMineral( mineralName );
		
		if ( !mineral ) {
			console.log( "There's no data for " + mineralName +
				", so I can't update the visibility of it.\n" +
				"Did you mean any of these?\n    " +
				Object.keys( minerals ).join( "\n    " ) );
			return;
		}

		lowerValue = lowerValue || 0;
		var intervals = mineral.intervals;

		var count = 0;

		while( count < intervals.length && intervals[ count ].value >= lowerValue ){

			// If we're above our higher value, set the remove flag
			if(intervals[ count ].value >= higherValue ){
				mineral.data.bitAttributes.array[ count ] = mineral.data.bitAttributes.array[ count ] | (1 << 6);
			}else{
				mineral.data.bitAttributes.array[ count ] -= mineral.data.bitAttributes.array[ count ] & (1 << 6);
			}

			count += 1;
		}

		mineral.data.bitAttributes.needsUpdate = true;
		mineral.mesh.geometry.maxInstancedCount = count;
	}

	/**
	 * When `visible` is a truthy value, the current range on `mineralName`
	 * minerals is enabled.
	 * When `visible` is a falsey value, the current range on `mineralName`
	 * minerals is disabled.
	 * @public
	 *
	 * @param  {String}  objectName  Which type of mineral or mesh to filter.
	 * @param  {Boolean} visible     Whether minerals of this type should be
	 *                               rendered or not.
	 */
	function toggleVisible( objectName, visible ) {

		if( objectName == "surveyHoles" ){
			for( var line in holes.lines ){
				if( visible == null ){
					visible = !holes.lines[line].visible;
				}
				holes.lines[line].visible = visible;
			}
			return;
		}

		if( objectName == "terrain" ){
			if( !terrainMesh )
				return;

			if( visible || terrainMesh.material.id == terrainMesh.wireMaterial.id ){
				return addImageToTerrain();
			}
			return terrainMesh.material = terrainMesh.wireMaterial;
		}

		var mineral = minerals[objectName];

		// If it wasn't in the minerals object, maybe it hasn't been instantiated yet.
		if( !mineral ){
			mineral = getMineral( objectName );
			if( mineral ){
				return scene.add( mineral.mesh );
			}
			return;
		}

		var intervals = mineral.intervals;
		if( visible == null ){
			visible = !mineral.mesh.visible;
		}
		mineral.mesh.visible = visible;
		mineral.mesh.pickingMesh.visible = visible;

		var i = null;
		var start = mineral.minVisibleIndex;
		var end = mineral.maxVisibleIndex;
		if( start < 0 ){ // no visible meshes in the interval
			return;
		}
		if ( visible ) {
			for ( i = start; i <= end; i += 1 ) {
				visibleMeshes[intervals[i].id] = meshes[intervals[i].id];
			}
		} else {
			var emptyMesh = new THREE.Mesh( new THREE.BoxGeometry( 0, 0, 0 ) );
			for ( i = start; i <= end; i += 1 ) {
				visibleMeshes[intervals[i].id] = emptyMesh;
			}
		}
	}
	// Export this function.
	this.toggleVisible = toggleVisible;


	/**
	 * Loads the axis labels - incremental values and the axis label at the end.
	 * The distance between concecutive labels has a minimum. ( See source ).
	 *
	 * @todo  Move some assumptions here ( like a minimum distance ) into
	 *        arguments to make them easier to notice and update.
	 */
	function addAxisLabels() {
		function wrapText( text, x, y, maxWidth, lineHeight ) {
			var lines = text.split( "\n" );

			for ( var i = 0; i < lines.length; i++ ) {
				var words = lines[i].split( ' ' );
				var line = '';

				for ( var n = 0; n < words.length; n++ ) {
					var testLine = line + words[n] + ' ';
					var metrics = this.measureText( testLine );
					var testWidth = metrics.width;

					if ( testWidth > maxWidth && n > 0 ) {
						this.fillText( line, x, y );
						line = words[n] + ' ';
						y += lineHeight;
					} else {
						line = testLine;
					}
				}

				this.fillText( line, x, y );
				y += lineHeight;
			}
		}
		// Need this function for creating multi-line text sprites.
		CanvasRenderingContext2D.prototype.wrapText = wrapText;

		/**
		 * Round a number to two digits and append a meter( m ) or kilometer( km )
		 * label to it.
		 *
		 * @param  {Number} num The distance in meters.
		 *
		 * @return {Number}     The rounded number.
		 */
		function formatKm( num ) {
			num = parseFloat( Math.floor( num ).toPrecision( 2 ) );
			return ( num > 1000 ? ( num / 1000 ) + ' k' : num ) + "m";
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
		function makeLabel( name, x, y, z ) {
			var sprite = makeTextSprite( name, {
				backgroundColor: {
					r: 0,
					g: 0,
					b: 0,
					a: 0
				},
				fontsize: 40
			} );
			sprite.position.set( x, y, z );
			return sprite;
		}

		// Our box is offset from the origin.
		var base = property.box.center[2] - property.box.size[2] / 2;

		// Force a scope.
		( function () {
			var length = property.box.size[0];
			// Lay out the X-axis labels. Ensure they are at least a minimum
			//   distance apart. This minimum distance is set in makeTextSprite,
			//   with the "sprite.scale.set( * )" line.
			var markerDistance = Math.max( 
				property.box.size[0] / 5 - 1,
				property.maxDimension / 20 );

			//add zero
			scene.add( makeLabel( formatKm( 0 ), 0, 0, base ) );

			for ( var x = markerDistance; x < length; x += markerDistance ) {
				scene.add( makeLabel( formatKm( x ), x, 0, base ) );

			}
			// Write out the axis name a littlebit after the last label.
			x -= markerDistance / 1.2;
			scene.add( makeLabel( "X", x, 0, base ) );
		} )();

		( function () {
			var length = property.box.size[1];
			var markerDistance = Math.max( length / 5 - 1, property.maxDimension / 20 );
			for ( var y = markerDistance; y < length; y += markerDistance ) {
				scene.add( makeLabel( formatKm( y ), 0, y, base ) );
			}
			y -= markerDistance / 1.2;
			scene.add( makeLabel( "Y", 0, y, base ) );
		} )();

		( function () {
			var length = property.box.size[2];
			var markerDistance = Math.max( length / 5 - 1, property.maxDimension / 20 );
			for ( var z = markerDistance; z < length; z += markerDistance ) {
				scene.add( makeLabel( formatKm( z ), 0, 0, z + base ) );
			}
			z -= markerDistance / 1.2;
			scene.add( makeLabel( "Z", 0, 0, z + base ) );
		} )();
	}

	/**
	 * Loads the scene with the lights we use. This includes:
	 *     - Ambient lighting
	 *     - A point light in the sky
	 *     - A point light superimposed over the camera
	 *     - A light at the center of our reticle
	 */
	function addLights() {
		var ambientLight = new THREE.AmbientLight( View.colors.ambientLight );
		scene.add( ambientLight );

		var hemisphereLight = new THREE.HemisphereLight( View.colors.ambientLight, View.colors.reticleLight, 0.6 );
		scene.add( hemisphereLight );

		camera.light = new THREE.PointLight( View.colors.cameraLight, 3, property.maxDimension );
		scene.add( camera.light );

		reticle.light = new THREE.PointLight( 
			View.colors.reticleLight,
			3,
			property.maxDimension / 15 );
		scene.add( reticle.light );
	}


	// This function renders to a texture offscreen and returns
	//  the ID of the cylinder that is underneath the pointer
	function pick() {

		//Only render the pixel that we need.
		renderer.setScissor(mouse.x, pickingTexture.height - mouse.y, 1, 1);
		renderer.enableScissorTest(true);

		//Save these values to restore after the picking
		var clearColor = renderer.getClearColor().clone();
		var alpha = renderer.getClearAlpha();
		var antialias = renderer.antialias;

		renderer.setClearColor(0xffffff, 0xfe/0xff);
		renderer.antialias = false;

		//render the picking scene off-screen
		renderer.render( pickingScene, camera, pickingTexture, true );


		//create buffer for reading single pixel
		var pixelBuffer = new Uint8Array( 4 );

		//read the pixel under the mouse from the texture
		renderer.readRenderTargetPixels(pickingTexture, mouse.x, pickingTexture.height - mouse.y, 1, 1, pixelBuffer);

		//interpret the pixel as an ID (Unsigned integer)
		var id = ( ( pixelBuffer[3] << 24 ) | ( pixelBuffer[0] << 16 ) | ( pixelBuffer[1] << 8 ) | ( pixelBuffer[2] << 0 ) ) >>> 0;

		var object = {};

		if( id == 0xfefefefe ){		// special value reserved for background color
			object = {
				type: "background"
			}
		}
		else if( pixelBuffer [3] == 255 ){				// All user added objects should be	completely opaque on the picking scene.
			object = {
				type: "custom",
				id: id - 0xff000000
			}
		}
		else if( id < 0xfefefefe ){						// Otherwise we have a cylinder and it's ID
			object = {
				type: "interval",
				id: id
			}
		}
		else{
			console.log( "intersected object with invalid ID:" );
			object = {
				type: "unknown"
			}
		}

		//return renderer to its previous state
		renderer.enableScissorTest(false);
		renderer.setClearColor( clearColor, alpha );
		renderer.antialias = antialias;

		return object;
	}

	this.pick = pick;

	/**
	 * The main render loop.
	 */
	function render() {

		timeouts.animation = requestAnimationFrame( render );
		
		stats.update();
		controls.update();

		rotateBaseCylinder( -2 );

		camera.updateMatrixWorld();

		if( reticle ){
			reticle.position.copy( controls.target );
			reticle.light.position.copy( controls.target );
			camera.light.position.copy( camera.position );
		}

		
		renderer.render( scene, camera, undefined, true );
		renderer.clearDepth();
		renderer.render( sceneOrtho, cameraOrtho );
	}

	function rotateBaseCylinder( rpm ) {
		var theta = rpm * 2 * Math.PI / 60 / 60;
		baseCylinderGeometry.rotateZ( theta );
	}

	function addUnsupportedSprite() {
		console.log('here');
	}

	/**
	 * Create a sprite with text.
	 * @param  {Object} message    A string or string-able object to put as the
	 *                             text on the sprite.
	 * @param  {Object} parameters Settings for the sprite. ( see source )
	 *
	 * @return {THREE.Sprite}      The resulting sprite.
	 *
	 * @todo  Document `parameters`.
	 */
	function makeTextSprite( message, parameters ) {
		if ( parameters === undefined ) parameters = {};
		var fontface = parameters.hasOwnProperty( "fontface" ) ?
			parameters["fontface"] : "Arial";
		var fontsize = parameters.hasOwnProperty( "fontsize" ) ?
			parameters["fontsize"] : 30;
		var size = parameters.hasOwnProperty( "size" ) ?
			parameters["size"] : 512;
		var textColor = parameters.hasOwnProperty( "textColor" ) ?
			parameters["textColor"] : {
				r: 0,
				g: 0,
				b: 0,
				a: 1.0
			};
		var backgroundColor = parameters.hasOwnProperty( "backgroundColor" ) ?
			parameters["backgroundColor"] : {
				r: 255,
				g: 250,
				b: 200,
				a: 0.8
			};

		var canvas = document.createElement( 'canvas' );
		canvas.width = size;
		canvas.height = size;
		var context = canvas.getContext( '2d' );
		context.font = fontsize + "px " + fontface;

		// Draw background rectangle
		//find the size of our text to draw the rectangle around
		var lines = message.split( "\n" );
		var lineHeight = fontsize;
		var maxTextWidth = 0;
		lines.forEach( function ( line ) {
			var textWidth = context.measureText( line ).width;
			if ( textWidth > maxTextWidth ) {
				maxTextWidth = textWidth;
			}
		} );
		//set the color to the input
		context.fillStyle = "rgba( " +
			backgroundColor.r + "," +
			backgroundColor.g + "," +
			backgroundColor.b + "," +
			backgroundColor.a + " )";

		context.fillRect( 0.5 * size - 15,
			0.5 * size - fontsize - 15,
			maxTextWidth + 30,
			lines.length * lineHeight + 30 );

		context.textAlign = 'left';
		context.fillStyle = "rgba( " +
			textColor.r + ", " +
			textColor.g + ", " +
			textColor.b + ", 1.0 )";

		context.wrapText( message, size / 2, size / 2, 10000, fontsize );

		var texture = new THREE.Texture( canvas );
		texture.needsUpdate = true;

		var spriteMaterial = new THREE.SpriteMaterial( {
			map: texture,
			transparent: true
		} );

		var sprite = new THREE.Sprite( spriteMaterial );

		sprite.scale.set( 
			property.maxDimension / 10,
			property.maxDimension / 10,
			property.maxDimension / 10 );
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
	 *     originShift: Array[Number],
	 *     boxMin: Array[Number],
	 *     boxMax: Array[Number],
	 *     longLatMin: Array[Number],
	 *     longLatMax: Array[Number],
	 *     desurveyMethod: String,
	 *     analytes: [{
	 *         color: String,
	 *         description: String
	 *     }],
	 *     formatVersion: Number,
	 *     box: {
	 *         size:   Array[Number],
	 *         center: Array[Number]
	 *     }
	 * }
	 * @param  {Object} project.json The property JSON loaded as a javascript
	 *                              object.
	 *
	 * @return {Object} The property object.
	 *
	 * @todo  Use a string to store format versions?
	 */
	function getProperty() {
		var boxMin = project.json["boxMin"];
		var boxMax = project.json["boxMax"];

		var boxSize = [ boxMax[0] - boxMin[0], boxMax[1] - boxMin[1], boxMax[2] - boxMin[2] ];
		var maxDimension = Math.max( boxSize[0], boxSize[1], boxSize[2] );
		var center = [ boxMin[0] + .5*boxSize[0], boxMin[1] + .5*boxSize[1], boxMin[2] + .5*boxSize[2] ];

		var property = {
			name: project.json["projectName"],
			description: project.json["description"],
			numHoles: project.json["numHoles"],
			epsg: project.json["projectionEPSG"],
			originShift: project.json["originShift"],
			maxDimension: maxDimension,
			longLatMin: project.json["longLatMin"],
			longLatMax: project.json["longLatMax"],
			desurveyMethod: project.json["desurveyMethod"],
			analytes: {},
			formatVersion: project.json["formatVersion"],
			box: {
				min: boxMin,
				max: boxMax,
				size: boxSize,
				center: center
			}
		};

		project.json["analytes"].forEach( function ( analyte ) {
			property.analytes[analyte.name] = {
				color: analyte.color,
				description: analyte.description
			};
		} );

		saveToCache( projectURL + byteSize + cacheVersion + '.property', property );

		return property;
	}

	function removeHoverInformation() {

		window.clearTimeout( timeouts.sprite );
		sceneOrtho.remove( tooltipSprite );

		if( intersected ){
			setIntervalAttributes( intersected.id );
			intersected = null;
		}

	}

	/**
	 * This is the method to be called after a timeout of the mouse not moving
	 * It checks for a mouse intercept and then will highlight an interval and
	 * show its tooltip if it is being hovered over
	 */
	function checkHover() {

		var pickObject = pick();

		if( intersected && pickObject.id == intersected.id && pickObject.type == intersected.type ){
			return;
		}
		
		removeHoverInformation();

		intersected = pickObject;

		if( !intersected || intersected.type == "background" || intersected.type == "custom" ){
			return;
		}

		if( intersected.type == "interval" ){
			setIntervalAttributes( intersected.id, [ 'hover', 'emit', 'transparent' ] );
		}


		var mineral = mineralIDToMineral( intersected.id );
		var interval = minerals[ mineral ].intervals[ intersected.id - minerals[ mineral ].startID ];

		// Set sprite to be in front of the orthographic camera so it
		//   is visible.
		tooltipSprite = makeTextSprite( 
			"Mineral: " + mineral +
			"\nValue: " + interval.value +
			"\nDepth: " + interval.from + '-' + interval.to +
			"\nHole: " + holes.ids[interval.holeID].name, {
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
			} );

		tooltipSprite.scale.set( 250, 250, 1 );
		tooltipSprite.position.z = 0;
		tooltipSprite.position.x =  mouse.x - ( window.innerWidth / 2 ) + 25;
		tooltipSprite.position.y = -mouse.y + ( window.innerHeight / 2 ) - 50;

		timeouts.sprite = window.setTimeout( function(){
			sceneOrtho.add( tooltipSprite );
		}, 300 );

	}

	// Updates the bitAttributes of the cylindergiven by the parameter id
	//  and therefore changes how it renders on-screen.
	//  The attributes parameter should be an array of attributes for the 
	function setIntervalAttributes( id, attributes ){

		var value = 0;

		if( attributes ){
			/*
			 **  dnr:         do not render
			 **  hover:       change diffuse to hover color
			 **  emit:        emit diffuse color
			 **  big:         increase size
			 **  small:       decrease size
			 **  transparent: transparent
			 **  remove:      removes the cylinder from visible & picking scenes
			*/
			var attributeList = [ 'dnr', 'hover', 'emit', 'big', 'small', 'transparent', 'remove' ];


			for( var i = 0; i < attributeList.length; i += 1 ){
				if( attributes.includes( attributeList[ i ] ) ){
					value += 1 << i;
				}
			}
		}

		var mineral = mineralIDToMineral( id );

		if( !mineral ){
			return;
		}

		var index = id - minerals[ mineral ].startID;
		var bitAttributes = minerals[ mineral ].data.bitAttributes;

		bitAttributes.array[ index ] = value;
		bitAttributes.needsUpdate = true;

		return value;
	}

	/**
	 * Save a rendered frame as an image, returning the image data.
	 * @return {String} The image data.
	 */
	this.takeScreenshot = function( link ){
		var alpha = renderer.getClearAlpha();
		renderer.setClearAlpha( 0 );

		renderer.render( scene, camera, undefined, true );
		renderer.render( sceneOrtho, cameraOrtho );

		renderer.setClearAlpha( alpha );
		link.href = renderer.domElement.toDataURL('image/png');
		link.download = "Gold Viewer Screenshot";
	}

	/**
	 * Convert [a, b, c, d..] into {x: a, y: b, z: c}, disregarding anything
	 * after the third element. Anything missing is given 0.0

	 * @param  {Array}      An array of coordinate values.
	 *
	 * @return {THREE.Vector3} The Vector3 made from the array.
	 */
	function vec3FromArray( array ) {
		return new THREE.Vector3( array[0], array[1], array[2] );
	}

	// Below here is only setup functions, typically called once.

	function setupWindowListeners() {

		// Resize the camera when the window is resized.
		timeouts.windowResize = function ( event ) {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();

			cameraOrtho.left = -window.innerWidth / 2;
			cameraOrtho.right = window.innerWidth / 2;
			cameraOrtho.top = window.innerHeight / 2;
			cameraOrtho.bottom = -window.innerHeight / 2;

			cameraOrtho.updateProjectionMatrix();

			renderer.setSize( window.innerWidth, window.innerHeight );
			pickingTexture.setSize( window.innerWidth, window.innerHeight );
		}

		window.addEventListener( 'resize', timeouts.windowResize );

		container.onmousemove = function( event ) {

			if( event.clientX = mouse.x && event.clientY == mouse.y ){
				return;
			}

			mouse.x = event.clientX;
			mouse.y = event.clientY;

			// Check what we're hovering over if the camera isn't moving and no buttons are being pressed
			if( !timeouts.motion && !controls.autoRotate && event.buttons == 0 ){
				return checkHover();
			}

			// Clear the motion interval if the user begins panning
			if ( event.buttons % 4 - event.buttons % 2 == 2  && timeouts.motion ) {
				window.clearInterval( timeouts.motion );
				timeouts.motion = null;
				checkHover();
			}
		}

		container.onclick = function( event ) {

			// If the mouse has moved less than 3 pixels from the down loaction, interperet
			//  it as a click rather than just a button release
			if( mouse.downLocation && mouse.distanceTo( mouse.downLocation ) < 3 ){

				if( timeouts.motion ){
					clearInterval( timeouts.motion );
					timeouts.motion = null;
					return checkHover();
				}

				var intersected = pick();

				if ( intersected.type == "interval" ) {
					return startMotionToMesh( mineralIDToInterval( intersected.id ).mesh, !event.ctrlKey );
				}

				if (intersected.type == "custom" ) {
					return startMotionToMesh( scene.getObjectById( intersected.id ), !event.ctrlKey );
				}
			}

		}

		container.onmousedown = function( event ){

			removeHoverInformation();
			controls.autoRotate = false;
			mouse.downLocation = new THREE.Vector2( mouse.x, mouse.y );

		}

		window.onkeypress = function( event ){

			var code = event.charCode;
			switch(code){
				case 61: 		//+
					controls.dollyOut();
					break;
				case 45: 		//-
					controls.dollyIn();
					break;
				default:
			}

		}
	}

	// Moves the controls target to the given mesh so that once the motion is finished, the user
	//  will be able to rotate, pan and zoom around the object they're moving to.
	function startMotionToMesh( mesh, withCamera ) {

		removeHoverInformation();
		mesh.updateMatrixWorld();

		// Use the bounding sphere to guess the center of the object
		if ( !mesh.geometry.boundingSphere ) {
			mesh.geometry.computeBoundingSphere();
		}

		var source = controls.target.clone();
		var target = mesh.geometry.boundingSphere.center.clone().add( mesh.position );
		var direction = target.clone().sub( source ).normalize();

		var raycaster = new THREE.Raycaster( source, direction );
		var intersection = raycaster.intersectObject( mesh );

		// If we didn't find an intersection, move to the center of the object
		if( intersection.length == 0 ){
			return startMotion( target.add( mesh.position ) );
		}

		var maxScale = Math.max( mesh.scale.x, mesh.scale.y, mesh.scale.z );

		var totalDistance = source.distanceTo( target );
		var distanceFromCenter = totalDistance - intersection[0].distance;
		var reticleRadius = reticle.geometry.boundingSphere.radius;

		var movement = direction.multiplyScalar( totalDistance -
		                                         distanceFromCenter * 1.5 -
		                                         reticleRadius * 3 -
		                                         maxScale * mesh.geometry.boundingSphere.radius / 10 );

		newTarget = controls.target.clone().add( movement );

		if( !withCamera ){
			return startMotion( newTarget );
		}

		if( withCamera == true ){
			var cameraTarget = camera.position.clone().add( movement );
			return startMotion( newTarget, cameraTarget );
		}

		var azimuth = Math.random() * Math.PI * 2;
		var inclination = ( Math.random() - .5 ) * Math.PI / 4;
		var distance = Math.max( mesh.geometry.boundingSphere.radius * maxScale, 10 ) * ( 1 + Math.random() ) * 3;

		var cameraDest = target.moveDownhole( distance, azimuth, inclination );

		return startMotion( newTarget, cameraDest );

	}

	function startMotion( controlsDestination, cameraDestination ){

		var controlsMovementVector = controlsDestination.clone().sub( controls.target );

		var acceleration = controlsMovementVector.length() / 25000 + 0.01;

		var reticleMotion = getDeltasForMovement( controlsMovementVector, acceleration );
		var cameraMotion =   [];

		if( cameraDestination ){
			var cameraMovementVector = cameraDestination.clone().sub( camera.position );

			cameraMotion = getDeltasForMovement( cameraMovementVector, acceleration * 0.25 * 
			                                     ( cameraMovementVector.length() / ( controlsMovementVector.length() + 2) ) );
		}

		//get rid of the last interval, in case it exists
		window.clearInterval( timeouts.motion );

		//Start an interval to move the reticle around!
		//Trigger 100 times a second
		timeouts.motion = setInterval( function () {
			if ( reticleMotion.length !== 0 ) {
				controls.target.add( reticleMotion.pop() );
			}
			if ( cameraMotion.length !== 0 ) {
				camera.position.add( cameraMotion.pop() );
			}

			if ( reticleMotion.length === 0 && cameraMotion.length === 0 ) {
				window.clearInterval( timeouts.motion );
				timeouts.motion = null;
				checkHover();
			}
		}.bind( this ), 10 );
	}

	function getDeltasForMovement( movementVector, acceleration ) {

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

		while ( totalMovement < length ) {
			speed += acceleration;
			var movement = normalMovement.clone().multiplyScalar( speed );
			accelerate.push( movement );
			totalMovement += speed;
			if ( totalMovement >= length ) {
				break;
			}
			decelerate.unshift( movement );
			totalMovement += speed;
		}

		//we probably just overshot it, so pop off the movements until
		//we're in front of it, then touch us to the sphere

		var motion = accelerate.concat( decelerate );

		while ( totalMovement > length ) {
			totalMovement -= motion.pop().length();
		}
		normalMovement.multiplyScalar( length - totalMovement );
		motion.push( normalMovement );

		return motion;
	}

	function addBoundingBox() {

		var geometry = new THREE.BoxGeometry( 
			property.box.size[0],
			property.box.size[1],
			property.box.size[2] );

		var property_boundary = new THREE.Mesh( geometry );

		var box = new THREE.EdgesHelper( property_boundary, View.colors.axes );
		box.applyMatrix( new THREE.Matrix4()
			.makeTranslation( 
				property.box.center[0],
				property.box.center[1],
				property.box.center[2] ) );
		box.matrixAutoUpdate = false;
		scene.add( box );

	}

	function addReticle() {

		reticle = new THREE.Mesh( 
			new THREE.IcosahedronGeometry( Math.sqrt( property.maxDimension ) / 50, 3 ),
			new THREE.MeshBasicMaterial( {
				color: View.colors.reticleLight,
				wireframe: true
			} ) );

		scene.add( reticle, false );
	}

	function finishSetup() {

		var boxCenter = vec3FromArray( property.box.center );

		camera.position.set( 
			 1.3 * property.maxDimension,
			-1.3 * property.maxDimension,
			 1.3 * property.maxDimension + boxCenter.z - 0.5 * property.box.size[2] );

		camera.lookAt( boxCenter );

		controls.minDistance = reticle.geometry.boundingSphere.radius * 5;
		controls.maxDistance = property.maxDimension * 2;
		controls.target = boxCenter;
		controls.autoRotate = true;

		cylinderScale = Math.sqrt( Math.max( property.box.size[0], property.box.size[1] ) );
	}

	function setupCameraAndControls() {

		//Sets up the camera object for the 3d scene
		camera = new THREE.PerspectiveCamera( 45,
			window.innerWidth / window.innerHeight,
			0.1,
			Math.pow( 10, 6 ) );

		camera.up.set( 0, 0, 1 );

		//Sets up the 2d orthographic camera for tooltips
		cameraOrtho = new THREE.OrthographicCamera( 
			window.innerWidth / -2,
			window.innerWidth / 2,
			window.innerHeight / 2,
			window.innerHeight / -2,
			1,
			1000 );
		cameraOrtho.position.set( 0, 0, 1 );

		controls = new THREE.OrbitControls( camera,
			$( '#viewFrame' ).contents().find( 'div' ).get( 0 ) );

		controls.zoomSpeed = 3.0;
		controls.autoRotateSpeed = 1.0;

	}

	function setupRenderer() {

		renderer = new THREE.WebGLRenderer( {
			antialias: true,
			alpha: true
		} );


		renderer.setSize( window.innerWidth, window.innerHeight );
		renderer.setClearColor( View.colors.background, 1 );
		renderer.sortObjects = false;
		renderer.autoClear = false;
		container.appendChild( renderer.domElement );

		// Load GL stuff.
		var gl = renderer.context;
		if ( !gl.getExtension( "OES_element_index_uint" ) || !gl.getExtension( "ANGLE_instanced_arrays" ) ) {
			console.error( 
				"Could not to load OES_element_index_uint or ANGLE_instanced_arrays. Are they supported?\n" );
			var msg = [];
			msg.push( "Supported extensions:" );
			gl.getSupportedExtensions().sort().forEach( function ( ext ) {
				msg.push( "\t" + ext );
			} );
			console.error( msg.join( '\n' ) );
		}
	}

	function setupScene() {

		scene = new THREE.Scene();
		pickingScene = new THREE.Scene();

		pickingTexture = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight );
		pickingTexture.texture.generateMipmaps = false;

		( function(){

			// Override the old scene.add function with a closure so that when we add
			//  a mesh to the scene, we also add an ID mesh to the picking scene
			var sceneAddCache = scene.add;

			// If pick is false, then the object will not be pickable
			scene.add = function( mesh, pick ) {

				var result = sceneAddCache.apply( this, [mesh] );

				if( !( mesh instanceof THREE.Mesh ) || pick == false ){
					return;
				}

				// If the pickingMesh has already been instantiated, return
				if( mesh.pickingMesh && mesh.pickingMesh.geometry == mesh.geometry ){
					pickingScene.add( mesh.pickingMesh );
					return result;
				}

				// Create the picking mesh with the same geometry, and a color that
				//  reflects the added mesh's id
				var pickingMesh = new THREE.Mesh( mesh.geometry,
					new THREE.MeshBasicMaterial( {
						color: new THREE.Color( mesh.id ),
						side: THREE.DoubleSide
					} )
				);

				mesh.pickingMesh = pickingMesh;
				pickingMesh.matrixAutoUpdate = false;
				pickingScene.add( pickingMesh );

				// Also make it so that our picking mesh moves, rotates and
				//  scales with the visible mesh.
				( function(){
					var updateMatrixCache = mesh.updateMatrix;

					mesh.updateMatrix = function() {

						updateMatrixCache.apply( this );

						pickingMesh.position.copy( mesh.position );
						pickingMesh.quaternion.copy( mesh.quaternion );
						pickingMesh.scale.copy( mesh.scale );
						pickingMesh.visible = mesh.visible;

						pickingMesh.updateMatrix();

					}
				} )();

				return result;
			}

			// Also override the scene.remove function to remove items from the picking scene
			var sceneRemoveCache = scene.remove;

			scene.remove = function( mesh ){

				if( mesh && mesh.pickingMesh ){
					pickingScene.remove( mesh.pickingMesh );
				}

				return sceneRemoveCache.apply( this, [mesh] );
			}

		} )();

		return scene;
	}

	// Provides an API for controlling how the cylinders are being rendered
	this.Cylinders = {
		logWidths: logWidths,
		normalizeWidths: normalizeWidths,
		setUniformScale: setSceneScale,
		setMineralScale: setMineralScale
	}

	function logWidths ( value ){

		if( value == undefined ){
			value = 1.0;
		}

		value = Number( value );

		for( var mineral in minerals ){
			if( minerals[ mineral ] ){
				minerals[ mineral ].data.uniforms.logWidths.value = value;
			}
		}
	}

	function normalizeWidths () {

		for( var mineral in minerals ){
			if( !minerals[ mineral ] ){
				continue;
			}
			minerals[ mineral ].data.uniforms.uniformMineralScale.value = 1;
		}

	}

	function setSceneScale( value ) {

		cylinderScale = value || cylinderScale;

		for( var mineral in minerals ) {
			if( minerals[ mineral ] ){
				minerals[ mineral ].data.uniforms.uniformSceneScale.value = cylinderScale;
			}
		}

		return cylinderScale;

	}

	function setMineralScale( mineral, value ) {

		if( minerals[ mineral ] ) {

			value = value || minerals[ mineral ].data.uniforms.uniformMineralScale.value;
			minerals[ mineral ].data.uniforms.uniformMineralScale.value = value;

		}

		return value;

	}

	function setupContainerAndStats() {

		container.contents().find( 'body' ).html( '<div></div>' );
		container = container.contents().find( 'div:first' ).get( 0 );

		stats = new Stats();
		stats.domElement.style.position = 'absolute';
		stats.domElement.style.right = '0px';
		stats.domElement.style.bottom = '0px';
		container.appendChild( stats.domElement );

	}

	View.Interval = function( fields ){

		// Default value, should be overwritten
		this.id = 0;

		for( var key in fields ){
			this[ key ] = fields[ key ];
		}

		return this;
	}

	View.Interval.prototype = {

		constructor: View.Interval,

		get mesh() {

			var mineral = mineralIDToMineral( this.id );
			var index = this.id - minerals[ mineral ].startID;
			var data = minerals[ mineral ].data;

			var width = data.widths.getX( index );
			var height = data.heights.getX( index );
			var position = new THREE.Vector3( data.offsets.getX( index ),
				                              data.offsets.getY( index ),
				                              data.offsets.getZ( index ) );

			var quaternion = new THREE.Quaternion( data.rotations.getX( index ),
				                                   data.rotations.getY( index ),
				                                   data.rotations.getZ( index ),
				                                   - data.rotations.getW( index ) );

			var logWidths = data.uniforms.logWidths.value;
			var uniformScale = data.uniforms.uniformMineralScale.value;
			uniformScale *= data.uniforms.uniformSceneScale.value;

			var scale = new THREE.Vector3( width, width, height );
			scale.multiply( new THREE.Vector3( logWidths, logWidths, 1 ) );
			scale.add( new THREE.Vector3( 1 - logWidths, 1 - logWidths, 0 ) );
			scale.multiply( new THREE.Vector3( uniformScale, uniformScale, 1 ) );

			var bitAttributes = data.bitAttributes.getX( index );

			var diffuse = data.uniforms.diffuse.value;
			var emissive = new THREE.Color( 0, 0, 0 );
			var opacity = data.uniforms.opacity.value;

			if( bitAttributes & 1 << View.Render.HoverColor )
				diffuse = data.uniforms.hoverColor.value;

			if( bitAttributes & 1 << View.Render.EmitDiffuse )
				emissive = diffuse;

			if( bitAttributes & 1 << View.Render.Transparent )
				opacity = data.uniforms.uniformTransparency.value;

			var material = new THREE.MeshPhongMaterial( {
				color:           diffuse,
				emissive:        emissive,
				opacity:         opacity,
				refractionRatio: data.uniforms.refractionRatio.value,
				shading:         THREE.FlatShading,
				shininess:       data.uniforms.shininess.value,
				transparent:     true
			});

			var geometry = baseCylinderGeometry.clone();

			var mesh = new THREE.Mesh( geometry, material );
			mesh.position.copy( position );
			mesh.quaternion.copy( quaternion );
			mesh.scale.copy( scale );

			return mesh;
		}
	}

	// To be called when the view object is no longer being used.
	//  Allows the garbage collector to free up memory.
	this.dispose = function(){

		window.clearInterval( timeouts.motion );
		window.removeEventListener( 'resize', timeouts.windowResize );
		cancelAnimationFrame( timeouts.animation );
		
		renderer.dispose();
	}

}

THREE.Vector3.prototype.moveDownhole = function( depth, azimuth, inclination ){

	azimuth = THREE.Math.degToRad( azimuth );
	inclination = THREE.Math.degToRad( inclination );

	this.x += depth * Math.sin( azimuth ) * Math.cos( inclination );
	this.y += depth * Math.cos( azimuth ) * Math.cos( inclination );
	this.z += depth * Math.sin( inclination );

	return this;

}

THREE.Quaternion.prototype.setFromAzimuthInclination = function( azimuth, inclination ){

	var temp = new THREE.Euler( 0 , THREE.Math.degToRad( 90 - inclination ), THREE.Math.degToRad( azimuth + 90 ) );

	return this.setFromEuler( temp );
}

/**
 * Color constants used by different parts of the view.
 *
 * @type {Object.<string, number>}
 *
 * @todo  Rename these to refer to their use case, not color.
 */
View.colors = {
	ambientLight: 0x404040, // Soft white
	axes: 0x5d5d5d, // Dark gray
	background: 0xdedede, // White with a smidgen of gray
	cameraLight: 0x404040, // Soft white
	reticleLight: 0xd1b419, // Solid gold
	terrain_frame: 0x26466d, // Dark-ish blue
	tooltipsSelection: 0xff00ff, // Bright pink
};


/**
 * Constants that designate which bit should be true in bitAttributes
 *  for a cylinder to be rendered in a certain way.
 */
View.Render = {
	DoNotRender: 0,
	HoverColor: 1,
	EmitDiffuse: 2,
	Bigger: 3,
	Smaller: 4,
	Transparent: 5,
	Remove: 6
}


/**
 * // TODO: Figure out what should be used in place of markdown.
 * Loads a JSON data file from `url`.
 *
 * @param  {string} url A url which points to a remote or local JSON file.
 *
 * @return {Object}     The parsed JSON file, or null.
 */
View.loadJSON = function( url, callback ) {

	$.ajax( {
		url: url,
		dataType: "json",
		crossDomain: true,
		success: function ( data ) { setTimeout( function() { callback ( data ) }, 0 ); }
	} );

}

View.getJsonSize = function( url, callback ) {
	
	var xhr = $.ajax( {
	  type:  "HEAD",
	  url: url,
	  success: function( msg ) { callback( xhr.getResponseHeader( 'Content-Length' ) ); }
	} );

}
