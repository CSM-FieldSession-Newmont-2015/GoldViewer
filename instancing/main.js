// threejs stuff.
var camera          = null;
var canvas          = null;
var centerLight     = null;
var controls        = null;
var renderer        = null;
var scene           = null;
var stats           = null;

// Picking Scene stuff
var pickingScene       = null;
var renderPickingScene = false;
var pickingTexture     = null;

// State we use when updating.
var time           = null;
var lastTime       = null;
var startTime	   = null;
var lastMeshSwitch = Date.now() / 1e3;

// Meshes we draw.
var cylinderData   = null;
var hoverCylinder  = {};

// Variables for UI stuff
var uiVariables = {
	mouse:         null,
	lastClicked:   null,
	hovering:       null,
	downPosition:  null
}

// The GLSL identifiers corresponding to each attribute used in our shaders.
var attributeNames = [
	"position",
	"offset",
	"scale",
	"quaternion",
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

	scene = new THREE.Scene();
	pickingScene = new THREE.Scene();
	pickingTexture = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight );
	pickingTexture.texture.minFilter = THREE.LinearFilter;
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
	});

	// Add key events
	window.onkeypress = keypress;

	// Update mouse object when it moves
	renderer.domElement.addEventListener( 'mousemove', onMouseMove );
	renderer.domElement.addEventListener( 'click', onMouseClick );
	renderer.domElement.addEventListener( 'mousedown', onMouseDown);


	// Obtain the Mesh containing the InstancedBufferGeometry and ShaderMaterial
	cylinderData = loadCylinderData(100 * 1000, "Rainbow Stuff");
	scene.add(cylinderData.visibleMesh);
	pickingScene.add(cylinderData.idMesh);

	setupHoverCylinder();

	render();
}

// This cylinder will be used to show which cylinder is being highlighted
// By updating its attributes and uniforms at other parts of the program
function setupHoverCylinder(){

	var geometry  = new THREE.InstancedBufferGeometry().copy(cylinderGeom);
	geometry.maxInstancedCount = 1;

	//Set up some Attributes
	// We'll change the content of these when we hover over a cylinder

	var offsets = new THREE.InstancedBufferAttribute(
			new Float32Array(4 * 3),
			3,
			1);
	var scales = new THREE.InstancedBufferAttribute(
			new Float32Array(4 * 3),
			3,
			1);
	var rotations = new THREE.InstancedBufferAttribute(
			new Float32Array(4 * 4),
			4,
			1);
	var colors = new THREE.InstancedBufferAttribute(
			new Float32Array(4 * 3),
			3,
			1);

	geometry.addAttribute(attributeNames[0], cylinderGeom.attributes.position);
	geometry.addAttribute(attributeNames[1], offsets);
	geometry.addAttribute(attributeNames[2], scales);
	geometry.addAttribute(attributeNames[3], rotations);
	geometry.addAttribute(attributeNames[4], colors);
	var uniforms = phongUniforms;

	// To make it look like the other materials being used
	uniforms.diffuse.value = new THREE.Color(0.3, 0.4, 0.5);
	uniforms.shininess.value = 4;
	uniforms.refractionRatio.value = 1.0;

	var material = new THREE.ShaderMaterial({
		vertexShader:    GV_ShaderLib['phongVertexShader'],
		fragmentShader:  THREE.ShaderLib['phong'].fragmentShader,
		vertexColors:    THREE.VertexColors,
		lights:          true,
		uniforms:        uniforms,
		shading:         THREE.FlatShading
	})

	hoverCylinder.mesh = new THREE.Mesh(geometry, material);
	hoverCylinder.mesh.frustumCulled = false;
	hoverCylinder.mesh.visible = false
	hoverCylinder.attributes = geometry.attributes;
	hoverCylinder.uniforms = material.uniforms

	scene.add(hoverCylinder.mesh);

}

// Allow zooming in and out with +/- keys.
function keypress(event) {
	var code = event.charCode;

	if(code == 61){
		controls.dollyOut();
	}
	else if(code == 45){
		controls.dollyIn();
	}
	else{
		console.log(event.charCode);
		renderPickingScene = !renderPickingScene;
	}
   
  return false
}

function onMouseMove( e ) {
	uiVariables.mouse = new THREE.Vector2( e.clientX, e.clientY );
	var object = pick();
	updateHoverCylinder(object.id);
}

function onMouseClick( e ) {

	if(uiVariables.downPosition.distanceTo(uiVariables.mouse) > 4 ){
		return;
	}
	var intersected = pick();
	console.log(intersected.id);
	if(intersected.type == "interval"){
		updateClicked(intersected.id);
	}

}

function onMouseDown( e ) {
	uiVariables.downPosition = new THREE.Vector2(e.clientX, e.clientY);
}

function updateHoverCylinder(id) {
	if(id == uiVariables.hovering){
		return;
	}

	// If we're hovering over a new object, load its attributes
	// into the hoverCylinder
	if(id){
		var offset = data.offsets.array.slice(3*id, 3*id + 3);
		var quaternion = data.rotations.array.slice(4*id, 4*id + 4);
		var scale = data.scales.array.slice(3*id, 3*id + 3);
		var color = data.colors.array.slice(3*id, 3*id + 3);

		// Make it a little bit larger. However this won't work 
		// if logWidths is set to 0. Some workaround is needed
		scale[0] = scale[0] * 1.4;
		scale[1] = scale[1] * 1.2;
		scale[2] = scale[2] * 1.4;

		hoverCylinder.attributes.offset.array.set(offset);
		hoverCylinder.attributes.quaternion.array.set(quaternion);
		hoverCylinder.attributes.scale.array.set(scale);
		hoverCylinder.attributes.color.array.set(color);

		hoverCylinder.attributes.offset.needsUpdate = true;
		hoverCylinder.attributes.quaternion.needsUpdate = true;
		hoverCylinder.attributes.scale.needsUpdate = true;
		hoverCylinder.attributes.color.needsUpdate = true;

		//hoverCylinder.uniforms.emissive.value = 
				//new THREE.Color(color[0] / 3, color[1] / 3, color[2] / 3);
		hoverCylinder.mesh.visible = true;
	}
	else{
		// No mesh when hovering over the background
		hoverCylinder.mesh.visible = false;
	}


	uiVariables.hovering = id;
}

function updateClicked(id) {

	// If we clicked on a cylinder, move the target controls on it
	if(id != null){
		var location = data.offsets.array.slice(3*id, 3*id + 3);
		controls.target.set(location[0], location[1], location[2]);
	}
	uiVariables.lastClicked = id;
}


// This function renders to a texture offscreen and returns
//  the ID of the cylinder that is underneath the pointer
function pick() {

	//Only render the pixel that we need.
	renderer.setScissor(uiVariables.mouse.x, pickingTexture.height - uiVariables.mouse.y, 1, 1);
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
	renderer.readRenderTargetPixels(pickingTexture, uiVariables.mouse.x, pickingTexture.height - uiVariables.mouse.y, 1, 1, pixelBuffer);

	//interpret the pixel as an ID (Unsigned integer)
	var id = ( ( pixelBuffer[3] << 24 ) | ( pixelBuffer[0] << 16 ) | ( pixelBuffer[1] << 8 ) | ( pixelBuffer[2] << 0 ) ) >>> 0;

	var object = {};

	if(id == 0xfefefefe){		// special value reserved for background color
		object = {
			type: "background"
		}
	}
	else if( pixelBuffer [3] == 255){				// All user added objects should be
		console.log("intersected unknown object");	// completely opaque on the picking scene.
		object = {
			type: "unknown",
			id: null
		}
	}
	else {						// Otherwise we have a cylinder and it's ID
		object = {
			type: "interval",
			id: id
		}
	}

	//return renderer to its previous state
	renderer.enableScissorTest(false);
	renderer.setClearColor(clearColor, alpha);

	return object;
}




// Update things every frame.
function update(time) {
	controls.update();
	stats.update();

	rotateCylinder(3.0);

	// A point light to go at the controls target
	centerLight.position.copy(controls.target);

	// Have some uniforms slowly scale up and down to show off
	// the new capabilities
	phongUniforms.uniformScale.value = Math.sin((startTime - time)/3) + 2;
	phongUniforms.logWidths.value = Math.sin((startTime - time)/1.5) * .5 + .5;
}

function render() {
	requestAnimationFrame(render);

	update(Date.now() / 1e3);

	if(renderPickingScene){
		//renderer.setClearAlpha(0);
		renderer.render(pickingScene, camera);
		//renderer.setClearAlpha(1);
	}else{
		renderer.render(scene, camera);
	}
	//renderer.render(pickingScene, camera);
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

// Makes a basic, "root" geometry for all of the cylinders to copy.
function makeCylinderGeometry(height, width, sides) {
	var radius = width / 2.0;
	regularGeometry = new THREE.CylinderGeometry(radius, radius, height, sides);
	regularGeometry.computeVertexNormals();
	regularGeometry.computeFaceNormals();

	var vertices = [];
	for(var i = 0; i < regularGeometry.vertices.length; i+=1){
		vertices.push(regularGeometry.vertices[i].x);
		vertices.push(regularGeometry.vertices[i].y);
		vertices.push(regularGeometry.vertices[i].z);
	}
	vertices = new Float32Array(vertices);

	var indices = [];
	for(var i = 0; i < regularGeometry.faces.length; i+=1){
		indices.push(regularGeometry.faces[i].a);
		indices.push(regularGeometry.faces[i].b);
		indices.push(regularGeometry.faces[i].c);
	}
	indices = new Uint16Array(indices);

	cylinderGeom  = new THREE.BufferGeometry().fromGeometry(regularGeometry);

	// Edit the position and index attributes so that we don't make reduntant
	// calls on the vertex shader
	cylinderGeom.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
	cylinderGeom.setIndex(new THREE.BufferAttribute(indices, 1));
	return cylinderGeom;
}


// Returns a Mesh with random instanced geometry and a Shadermaterial.
// Contains a number of cylinders given by the instances argument.

function loadCylinderData(instances, type) {
	console.log("Making " + instances + " of " + type + ".");
	var baseGeometry = makeCylinderGeometry(1.0, 1.0, 8);

	data = {
		type: type ? type : "A Mineral!",

		positions: new THREE.BufferAttribute(
			new Float32Array(baseGeometry.attributes["position"].array.length + 9),
			3),
		offsets: new THREE.InstancedBufferAttribute(
			new Float32Array(instances * 3),
			3,
			1),
		scales: new THREE.InstancedBufferAttribute(
			new Float32Array(instances * 3),
			3,
			1),
		rotations: new THREE.InstancedBufferAttribute(
			new Float32Array(instances * 4),
			4,
			1)
	};

	// Remember, JavaScript only has scope in functions.
	var i = null;

	// This is where you'd call the functions to load offsets, scales, and concentrations.
	// For this proof-of-concept, we just make the data up.

	// Random offsets.
	for (i = 0; i < data.offsets.count; i += 1) {
		// Put them in a 100 size square.
		var x = 200.0*Math.random();
		var y = 200.0*Math.random();
		var z = 200.0*Math.random();
		data.offsets.setXYZ(i, x, y, z);
	}

	// Random scaling.
	for (i = 0; i < data.scales.count; i += 1) {
		var height = Math.random() + 0.1;
		var width = Math.random() + 0.1;
		// Keep them square on top.
		data.scales.setXYZ(i, width, height, width);
	}

	// Random directions.
	for (i = 0; i < data.rotations.count; i += 1) {
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
	data.geometry.addAttribute(attributeNames[2], data.scales);
	data.geometry.addAttribute(attributeNames[3], data.rotations);

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
	for (i = 0; i < colors.count; i += 1) {

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

	
	phongUniforms.diffuse.value = new THREE.Color(0.3, 0.4, 0.5);
	phongUniforms.shininess.value = 4;
	phongUniforms.refractionRatio.value = 1.0;

	// This uniform, when set to 1 will make all cylinders
	// to render at custom widths.
	// At 0, it will render the cylinders at a constant width
	phongUniforms.logWidths = {
		type: "f",
		value: 1
	}

	// This uniform will scale all the uniforms larger or smaller
	// than their initial size
	phongUniforms.uniformScale = {
		type: "f",
		value: 1
	}

	// Set up a phong material with our custom vertex shader
	data.visibleMaterial = new THREE.ShaderMaterial({
		uniforms: 			phongUniforms,
		vertexShader:   	GV_ShaderLib['phongVertexShader'],
		fragmentShader: 	THREE.ShaderLib['phong'].fragmentShader,
		lights: 			true,
		transparent: 		false,
		vertexColors: 		THREE.VertexColors,
		shading: 			THREE.FlatShading
	});
	data.visibleMaterial.update();

	// Use our custom fragment shader to render the IDs
	data.idMaterial = new THREE.ShaderMaterial({
		uniforms: 			phongUniforms,
		vertexShader:   	GV_ShaderLib['phongVertexShader'],
		fragmentShader: 	GV_ShaderLib['idFragmentShader'],
		vertexColors: 		THREE.NoColors,
		transparent:        false
	})

	// We only use the onHoverMaterial in special cases, so default to using the renderMaterial.
	//data.mesh = new THREE.Mesh(geometry, data.renderMaterial);
	data.visibleMesh = new THREE.Mesh(data.geometry, data.visibleMaterial);
	data.idMesh = new THREE.Mesh(data.geometry, data.idMaterial);
	data.visibleMesh.frustumCulled = false;
	data.idMesh.frustumCulled = false;

	return data;
}