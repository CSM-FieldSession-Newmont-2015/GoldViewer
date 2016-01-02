// threejs stuff.
var camera             = null;
var canvas             = null;
var centerLight        = null;
var controls           = null;
var renderer           = null;
var scene              = null;
var stats              = null;

// Picking Scene stuff
var pickingScene       = null;
var pickingTexture     = null;

// Meshes we draw.
var cylinderData       = null;

// UI variables
var downPosition        = null;
var hoverCylinderId     = null;
var lastInteractionTime = performance.now();
var mouse               = null;
var renderPickingScene  = false;


// The GLSL identifiers corresponding to each attribute used in our shaders.
var attributeNames = [
	"position",
	"offset",
	"height",
	"width",
	"quaternion",
	"dynamicBits",
	"color"];

// Entry point.
function start() {

	// Set up the FPS counter.
	stats = new Stats();
	stats.setMode(0);
	stats.domElement.style.position = "absolute";
	stats.domElement.style.left = "0px";
	stats.domElement.style.top = "0px";
	document.body.appendChild(stats.domElement);

	// Set up our scenes
	scene = new THREE.Scene();
	pickingScene = new THREE.Scene();
	pickingTexture = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight );
	pickingTexture.texture.generateMipmaps = false;

	// Camera. TODO: Calculator fov because it looks weird on unexpected ratios.
	var fov = 55;
	var ratio = window.innerWidth / window.innerHeight;
	camera = new THREE.PerspectiveCamera(fov, ratio, 0.1, 1.0e6);
	camera.up.set(0, 0, 1);
	camera.position.set(0.0, 0.0, 0.0);

	// Setup the WebGL Rendering context.
	canvas = document.getElementById("canvas");
	renderer = new THREE.WebGLRenderer({
		canvas: canvas,
		antialias: true
	});
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0xdedede);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0xffffff);
	document.body.appendChild(renderer.domElement);

	// We're going to load a *lot* of vertices. Make sure we can index them.
	var ext = renderer.getContext().getExtension("OES_element_index_uint");
	if (!ext) {
		throw new Error("extension not supported!");
	}

	// Setup basic orbiting controls.
	controls = new THREE.OrbitControls(camera);
	controls.target = new THREE.Vector3(20, 20, 20);

	// Simple lighting.
	scene.add(new THREE.AmbientLight(0xffffff));
	var light = new THREE.PointLight(0xa0a0a0, 1.0, 1000.0);
	light.position.x = -40.0;
	light.position.y = -30.0;
	light.position.z = -50.0;
	scene.add(light);
	centerLight = new THREE.PointLight(0xcccccc, 5.0, 100.0);
	scene.add(centerLight);
	var hemisphereLight = new THREE.HemisphereLight( 0xffffbb, 0x080820, .6 );
	scene.add(hemisphereLight);

	// Standard resize handler.
	window.addEventListener("resize", function () {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
		pickingTexture.setSize(window.innerWidth, window.innerHeight);
		lastInteractionTime = performance.now();
	});

	// Add key events
	window.onkeypress = keypress;

	// Update mouse object when it moves
	renderer.domElement.addEventListener('mousemove', onMouseMove  );
	renderer.domElement.addEventListener('click',     onMouseClick );
	renderer.domElement.addEventListener('mousedown', onMouseDown  );


	// Obtain the Mesh containing the InstancedBufferGeometry and ShaderMaterial
	numInstances = 100 * 1000;
	cylinderData = loadCylinderData(numInstances, "Rainbow Stuff");
	scene.add(cylinderData.visibleMesh);
	pickingScene.add(cylinderData.idMesh);

	render();
}

// Allow zooming in and out with +/- keys.
function keypress(event) {
	var code = event.charCode;
	switch(code){
		case 61: 		//+
			controls.dollyOut();
			break;
		case 45: 		//-
			controls.dollyIn();
			break;
		case 100: 		//D
			phongUniforms.logWidths.value = Math.max(0, phongUniforms.logWidths.value - .05);
			break;
		case 97: 		//A
			phongUniforms.logWidths.value = Math.min(1, phongUniforms.logWidths.value + .05);
			break;
		case 119: 		//W
			phongUniforms.uniformScale.value *= 1.05;
			break;
		case 115: 		//S
			phongUniforms.uniformScale.value /= 1.05;
			break;
		case 99:		//C
			renderPickingScene = !renderPickingScene;
			break;
		default: 
			//console.log(event.charCode);
		}
	lastInteractionTime = performance.now();
}

function onMouseMove( e ) {
	mouse = new THREE.Vector2( e.clientX, e.clientY );
	var object = pick();
	updateHoverCylinder(object.id);
	lastInteractionTime = performance.now();
}

function onMouseClick( e ) {
	
	if(downPosition.distanceTo(mouse) > 4 ){
		return;
	}
	
	var intersected = pick();
	if(intersected.type == "interval"){
		if(!e.altKey){
			updateClicked(intersected.id);
		}else{
			data.bitAttributes.array[intersected.id] += 1 ;
			data.bitAttributes.needsUpdate = true;
		}
	}
}

function onMouseDown( e ) {
	downPosition = new THREE.Vector2(e.clientX, e.clientY);
}

function updateHoverCylinder(id) {
	if(id == hoverCylinderId){
		return;
	}

	// If we're hovering over a new object, change its bits!
	if(id){
		var number = Math.random() * 300;
		data.bitAttributes.array[id] = number - (number % 2);
	}

	// If it was invisible, keep it invisible
	data.bitAttributes.array[hoverCylinderId] = data.bitAttributes.array[hoverCylinderId] % 2;
	data.bitAttributes.needsUpdate = true;
	hoverCylinderId = id;
}

function updateClicked(id) {

	// If we clicked on a cylinder, move the target controls on it
	if(id != null){
		controls.target.set(
			data.offsets.getX(id),
			data.offsets.getY(id),
			data.offsets.getZ(id)
			);
		controls.update();

		// Update hover stuff
		intersected = pick();
		updateHoverCylinder(intersected.id);
	}
}


// This function renders to a texture offscreen and returns
//  the ID of the cylinder that is underneath the pointer
function pick() {

	//Only render the pixel that we need.
	renderer.setScissor(mouse.x, pickingTexture.height - mouse.y, 1, 1);
	renderer.enableScissorTest(true);

	//Save these values to restore after the picking
	var clearColor = renderer.getClearColor();
	var alpha = renderer.getClearAlpha();

	renderer.setClearColor(0xffffff, 0xfe/0xff);

	//render the picking scene off-screen
	renderer.render( pickingScene, camera, pickingTexture );

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
	else if( pixelBuffer [3] == 255 ){				// All user added objects should be
		console.log("intersected custom object");	// completely opaque on the picking scene.
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
	renderer.setClearColor(clearColor, alpha);

	return object;
}



// Slowly rotates the base cylinder geometry 
// The speed argument determines how many revolutions the
//  cylinder makes per minute at 60 fps
function rotateCylinder(speed){
	var radians = speed * Math.PI * 2 / 60 / 60;
	var euler = new THREE.Euler(0, radians, 0, 'XYZ');
	var matrix = new THREE.Matrix4().makeRotationFromEuler(euler);
	cylinderGeom.applyMatrix(matrix);
}

// Returns a Mesh with random instanced geometry and a Shadermaterial.
// Contains a number of cylinders given by the instances argument.

function loadCylinderData(instances, type) {
	console.log("Making " + instances + " of " + type + ".");
	
	cylinderGeom = makeCylinderGeometry(1, 1, 8);


	var staticInterleavedBuffer = new THREE.InstancedInterleavedBuffer( new Float32Array(instances * 9), 9, 1 );

	data = {

		// By interleaving our attributes, hardware can boost frames by taking advantage
		//  of spatial locality in memory.

		// All static attributes go together
		staticInterleavedBuffer: staticInterleavedBuffer,

		// Use staticInterleavedBuffer, starting at offset 0, 3 items in offsets attribute
		offsets:   new THREE.InterleavedBufferAttribute( staticInterleavedBuffer, 3, 0 ),
		// Use staticInterleavedBuffer, starting at offset 3, 1 item in heights attribute
		heights:   new THREE.InterleavedBufferAttribute( staticInterleavedBuffer, 1, 3 ),
		widths:    new THREE.InterleavedBufferAttribute( staticInterleavedBuffer, 1, 4 ),
		rotations: new THREE.InterleavedBufferAttribute( staticInterleavedBuffer, 4, 5 ),

		/* Extra bits to determine how each cylinder is rendered...

		**  When set to true, the bits have the following effects
		**  0: do not render
		**  1: emit hover color
		**  2: emit diffuse color
		**  3: increase size
		**  4: decrease size
		**  5: transparent
		*/
		bitAttributes: new THREE.InstancedBufferAttribute( new Float32Array( instances ), 1, 1 ).setDynamic( true ),

		positions: new THREE.BufferAttribute( new Float32Array(cylinderGeom.attributes["position"].array.length), 3 ),
	};

	// This is where you'd call the functions to load offsets, scales, and concentrations.
	// For this proof-of-concept, we just make the data up.

	// Random offsets.
	for (var i = 0; i < data.offsets.count; i += 1) {
		// Put them in a 100 size square.
		var x = 200.0*Math.random();
		var y = 200.0*Math.random();
		var z = 200.0*Math.random();
		data.offsets.setXYZ(i, x, y, z);
	}

	// Random scaling.
	for (var i = 0; i < data.heights.count; i += 1) {
		var height = Math.random() * 1.5 + 0.1;
		var width = Math.random() * 1.5 + 0.1;
		// Keep them square on top.
		data.heights.setX(i, height);
		data.widths.setX(i, width);
	}

	// Random directions.
	for (var i = 0; i < data.rotations.count; i += 1) {
		var x = Math.random() * 2*Math.PI;
		var y = Math.random() * 2*Math.PI;
		var z = Math.random() * 2*Math.PI;
		var w = Math.random() * 2*Math.PI;
		var quaternion = new THREE.Quaternion(x, y, z, w);
		quaternion.normalize();
		data.rotations.setXYZW(i, quaternion.x, quaternion.y, quaternion.z, quaternion.w);
	}

	// Make the final geometry.
	data.geometry = new THREE.InstancedBufferGeometry().copy(cylinderGeom);
	data.geometry.maxInstancedCount = instances;


	// Add all of the attributes
	data.geometry.addAttribute(attributeNames[0], cylinderGeom.attributes.position);
	data.geometry.addAttribute(attributeNames[1], data.offsets);
	data.geometry.addAttribute(attributeNames[2], data.heights);
	data.geometry.addAttribute(attributeNames[3], data.widths);
	data.geometry.addAttribute(attributeNames[4], data.rotations);
	data.geometry.addAttribute(attributeNames[5], data.bitAttributes);

	phongUniforms = THREE.UniformsUtils.clone(THREE.ShaderLib['phong'].uniforms);


	// Give each cylinder a unique color which maps to its index. We'll use this on the texture
	// to id which cylinder we're hovering over.
	
	var colors = new THREE.InstancedBufferAttribute(
		new Float32Array(instances * 3),
		3,
		1);


	var idColors = new THREE.InstancedBufferAttribute(
		new Float32Array(instances * 4),
		4,
		1);


	var r, g, b;
	var idR, idG, idB, idA;
	for (i = 0; i < idColors.count; i += 1) {

		
		// Rainbow colors for the visible mesh
		r = Math.random();
		g = Math.random();
		b = Math.random();
		colors.setXYZ(i, r, g, b);
		

		// Will set a unique color for over 2^31 objects (~4 billion)
		// to go onto the idMesh
		idA = ((i >>> 24) & 0xff) / 0xff;
		idR = ((i >>> 16) & 0xff) / 0xff;
		idG = ((i >>>  8) & 0xff) / 0xff;
		idB = ((i >>>  0) & 0xff) / 0xff;
		idColors.setXYZW(i, idR, idG, idB, idA);
	}

	data.colors = colors;
	data.geometry.addAttribute("color", colors);
	data.geometry.addAttribute("id", idColors);

	
	phongUniforms = THREE.UniformsUtils.clone(THREE.ShaderLib["instancing_visible"].uniforms);

	// Set up a phong material with our custom vertex shader
	data.visibleMaterial = new THREE.ShaderMaterial({
		uniforms: 			phongUniforms,
		vertexShader:   	THREE.ShaderLib["instancing_visible"].vertexShader,
		fragmentShader: 	THREE.ShaderLib["instancing_visible"].fragmentShader,
		lights: 			true,
		transparent: 		true,
		vertexColors: 		THREE.VertexColors,
		shading: 			THREE.FlatShading
	});

	// Use our custom fragment shader to render the IDs
	data.idMaterial = new THREE.ShaderMaterial({
		uniforms: 			phongUniforms,
		vertexShader:   	THREE.ShaderLib["instancing_picking"].vertexShader,
		fragmentShader: 	THREE.ShaderLib["instancing_picking"].fragmentShader
	})

	// We only use the onHoverMaterial in special cases, so default to using the renderMaterial.
	//data.mesh = new THREE.Mesh(geometry, data.renderMaterial);
	data.visibleMesh = new THREE.Mesh(data.geometry, data.visibleMaterial);
	data.idMesh = new THREE.Mesh(data.geometry, data.idMaterial);
	data.visibleMesh.frustumCulled = false;
	data.idMesh.frustumCulled = false;

	return data;
}


// Update things every frame.
function update() {
	controls.update();
	stats.update();

	// A point light to go at the controls target
	centerLight.position.copy(controls.target);

	rotateCylinder(5.0);
}

function render() {
	requestAnimationFrame(render);

	// If the user stopped interacting with the viewer, stop rendering a static scene
	if(lastInteractionTime < performance.now() - 3000){
		return;
	}

	update();

	if(renderPickingScene){
		renderer.render(pickingScene, camera);
	}else{
		renderer.render(scene, camera);
	}
}

// Returns a simple indexed cylinder BufferGeometry. Included
//  because the THREE library wouldn't index the positions with its built-in method
function makeCylinderGeometry(diameter, height, sides){

	var cylinder = new THREE.CylinderGeometry(diameter / 2, diameter / 2, height, sides);

	//Just take the positions and indices from the initial cylinder geometry
	var positions = new Float32Array(cylinder.vertices.length * 3);
	for(var i = 0; i < cylinder.vertices.length; i += 1){
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

	return bufferCylinder;
}