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

var mouse = {};

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
	camera.position.set(-30.0, -40.0, -50.0);
	camera.lookAt(new THREE.Vector3(0, 0, 0));

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

	// Simple lighting.
	scene.add(new THREE.AmbientLight(0xffffff));
	var light = new THREE.PointLight(0xa0a0a0, 1.0, 1000.0);
	light.position.x = -40.0;
	light.position.y = -30.0;
	light.position.z = -50.0;
	scene.add(light);
	centerLight = new THREE.PointLight(0xcccccc, 5.0, 50.0);
	scene.add(centerLight);
	var hemisphereLight = new THREE.HemisphereLight( 0xffffbb, 0x080820, .4 );
	scene.add(hemisphereLight);
	renderer.sortObjects = false;

	// Standard resize handler.
	window.addEventListener("resize", function () {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
	});

	// Add key events
	window.onkeypress = keypress;

	// Update mouse object when it moves
	renderer.domElement.addEventListener( 'mousemove', onMouseMove );


	// Obtain the Mesh containing the InstancedBufferGeometry and ShaderMaterial
	cylinderData = loadCylinderData(120 * 1000, "Rainbow Stuff");
	scene.add(cylinderData.visibleMesh);
	pickingScene.add(cylinderData.idMesh);

	render();
}

// Allow zooming in and out with +/- keys.
// Pick by pressing the spacebar
function keypress(event) {
	var code = event.charCode;

	if(code == 61){
		controls.dollyOut();
	}
	else if(code == 45){
		controls.dollyIn();
	}
	else if(code == 32){
		pick();
	}
	else{
		console.log(event.charCode);
		renderPickingScene = !renderPickingScene;
	}
   
  return false
}

function onMouseMove( e ) {

	mouse.x = e.clientX;
	mouse.y = e.clientY;

}


function pick() {

	//Only render the pixel that we need.
	renderer.setScissor(mouse.x, pickingTexture.height - mouse.y, 1, 1);
	renderer.enableScissorTest(true);

	//render the picking scene off-screen

	renderer.render( pickingScene, camera, pickingTexture );

	//create buffer for reading single pixel
	var pixelBuffer = new Uint8Array( 4 );

	//read the pixel under the mouse from the texture
	renderer.readRenderTargetPixels(pickingTexture, mouse.x, pickingTexture.height - mouse.y, 1, 1, pixelBuffer);

	//interpret the pixel as an ID

	var id = ( pixelBuffer[0] << 24 ) | ( pixelBuffer[1] << 16 ) | ( pixelBuffer[2] << 8 ) | ( pixelBuffer[3] );
	console.log(id);

	renderer.enableScissorTest(false);

}




// Update things every frame.
function update(time) {
	controls.update();
	stats.update();

	rotateCylinder(3.0);
	centerLight.position.copy(controls.target);
	//data.onHoverMaterial.uniforms.pointLightPosition.needsUpdate = true;
}

function render() {
	requestAnimationFrame(render);

	update(Date.now() / 1e3);

	if(renderPickingScene){
		renderer.setClearAlpha(0);
		renderer.render(pickingScene, camera);
		renderer.setClearAlpha(1);
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

	cylinderGeom  = new THREE.InstancedBufferGeometry().fromGeometry(regularGeometry);

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
	var baseGeometry = makeCylinderGeometry(10.0, 10.0, 8);

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

	data.positions.array.set(baseGeometry.attributes.position.array);
	data.positions.array.set(new Float32Array([1000, 1000, 1000, 0, 1000, 1000, 1000, 0, 1000]), baseGeometry.attributes.position.array.length);
	cylinderGeom.attributes.position.array = data.positions.array;

	// This is where you'd call the functions to load offsets, scales, and concentrations.
	// For this proof-of-concept, we just make the data up.

	// Random offsets.
	for (i = 0; i < data.offsets.count; i += 1) {
		// Put them in a 100.0 cube.
		data.offsets.setXYZ(i, 100.0*Math.random(), 100.0*Math.random(), 100.0*Math.random());
	}

	// Random scaling.
	for (i = 0; i < data.scales.count; i += 1) {
		var height = Math.random() * 0.1 + 0.05;
		var width = Math.random() * 0.1 + 0.05;
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
	ggg = new THREE.CylinderGeometry(4.0, 4.0, 5.0, 7);
	ggg.computeFaceNormals();
	ggg.computeVertexNormals();
	data.geometry = new THREE.InstancedBufferGeometry().fromGeometry(ggg);
	//geometry.computeVertexNormals();
	//geometry.computeFaceNormals();
	data.geometry.maxInstancedCount = instances;

	// The GLSL identifiers corresponding to each attribute.
	var attributeNames = [
		"position",
		"offset",
		"scale",
		"quaternion",
		"color"];

		console.log(data);
	data.geometry.addAttribute(attributeNames[0], cylinderGeom.attributes.position);
	//geometry.addAttribute(attributeNames[1], cylinderGeom.attributes.)
	data.geometry.addAttribute(attributeNames[1], data.offsets);
	data.geometry.addAttribute(attributeNames[2], data.scales);
	data.geometry.addAttribute(attributeNames[3], data.rotations);
	data.geometry.setIndex(cylinderGeom.index);

	// Load the shaders.

	// The shader used for generic rendering.
	var vsRenderSource = document.getElementById('renderVertexShader').textContent;
	var fsRenderSource = document.getElementById('renderFragmentShader').textContent;

	phongUniforms = THREE.ShaderLib.phong.uniforms;

	

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
	for (i = 1; i <= colors.count; i += 1) {
		r = Math.random();//((i >> 16) & 0xff) / 0x100;
		g = Math.random();//((i >> 8)  & 0xff) / 0x100;
		b = Math.random();//(i         & 0xff) / 0x100;
		colors.setXYZ(i-1, r, g, b);

		// Will set a unique color for up to 2^24 objects (~16 million)
		idR = ((i >> 24) & 0xff) / 0x100;
		idG = ((i >> 16) & 0xff) / 0x100;
		idB = ((i >>  8) & 0xff) / 0x100;
		idA = (i         & 0xff) / 0x100;
		idColors.setXYZW(i-1, idR, idG, idB, idA);
	}

	
	data.geometry.addAttribute("color", colors);
	data.geometry.addAttribute("id", idColors);

	
	phongUniforms.diffuse.value = new THREE.Color(0.3, 0.4, 0.5);
	phongUniforms.shininess.value = 4;
	phongUniforms.refractionRatio.value = 1.0;


	data.visibleMaterial = new THREE.ShaderMaterial({
		uniforms: 			phongUniforms,
		vertexShader:   	phongVertexShaderModified,
		fragmentShader: 	phongFragmentShaderModified,
		lights: 			true,
		transparent: 		false,
		vertexColors: 		THREE.VertexColors,
		shading: 			THREE.FlatShading
	});
	data.visibleMaterial.update();

	data.idMaterial = new THREE.ShaderMaterial({
		uniforms: 			phongUniforms,
		vertexShader:   	phongVertexShaderModified,
		fragmentShader: 	idFragmentShader,
		vertexColors: 		THREE.NoColors
	})

	// We only use the onHoverMaterial in special cases, so default to using the renderMaterial.
	//data.mesh = new THREE.Mesh(geometry, data.renderMaterial);
	data.visibleMesh = new THREE.Mesh(data.geometry, data.visibleMaterial);
	data.idMesh = new THREE.Mesh(data.geometry, data.idMaterial);
	return data;
}

var beforeMainVertexString = [

			"attribute vec3 offset;",
			"attribute vec3 scale;",
			"attribute vec4 quaternion;\n",
			"varying vec4 vID;",
			"attribute vec4 id;",

			"vec3 rotate_vector( vec4 quat, vec3 vec ) {",
			"	return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz );\n",
			"}\n"

		].join("\n");

var afterMainVertexString = [
			
				"vec3 newPosition = scale * position;",
				"newPosition = rotate_vector( quaternion, newPosition);",
				"newPosition = newPosition + offset;\n",
				"vID = id;"

			].join("\n");

var phongVertexShaderModified = [

			"#define PHONG",

			"varying vec3 vViewPosition;",

			"#ifndef FLAT_SHADED",

			"	varying vec3 vNormal;",

			"#endif",

			THREE.ShaderChunk[ "common" ],
			THREE.ShaderChunk[ "uv_pars_vertex" ],
			THREE.ShaderChunk[ "uv2_pars_vertex" ],
			THREE.ShaderChunk[ "displacementmap_pars_vertex" ],
			THREE.ShaderChunk[ "envmap_pars_vertex" ],
			THREE.ShaderChunk[ "lights_phong_pars_vertex" ],
			THREE.ShaderChunk[ "color_pars_vertex" ],
			THREE.ShaderChunk[ "morphtarget_pars_vertex" ],
			THREE.ShaderChunk[ "skinning_pars_vertex" ],
			THREE.ShaderChunk[ "shadowmap_pars_vertex" ],
			THREE.ShaderChunk[ "logdepthbuf_pars_vertex" ],

			beforeMainVertexString,

			"void main() {",

			afterMainVertexString,

			[

				THREE.ShaderChunk[ "uv_vertex" ],
				THREE.ShaderChunk[ "uv2_vertex" ],
				THREE.ShaderChunk[ "color_vertex" ],

				THREE.ShaderChunk[ "beginnormal_vertex" ],
				THREE.ShaderChunk[ "morphnormal_vertex" ],
				THREE.ShaderChunk[ "skinbase_vertex" ],
				THREE.ShaderChunk[ "skinnormal_vertex" ],
				THREE.ShaderChunk[ "defaultnormal_vertex" ],

			"#ifndef FLAT_SHADED", // Normal computed with derivatives when FLAT_SHADED

			"	vNormal = normalize( transformedNormal );",

			"#endif",

				THREE.ShaderChunk[ "begin_vertex" ],
				THREE.ShaderChunk[ "displacementmap_vertex" ],
				THREE.ShaderChunk[ "morphtarget_vertex" ],
				THREE.ShaderChunk[ "skinning_vertex" ],
				THREE.ShaderChunk[ "project_vertex" ],
				THREE.ShaderChunk[ "logdepthbuf_vertex" ],

			"	vViewPosition = - mvPosition.xyz;",

				THREE.ShaderChunk[ "worldpos_vertex" ],
				THREE.ShaderChunk[ "envmap_vertex" ],
				THREE.ShaderChunk[ "lights_phong_vertex" ],
				THREE.ShaderChunk[ "shadowmap_vertex" ],

			"}"
			].join("\n").replace(/position/g, "newPosition")//.replace(/normal[^a-zA-Z]/g, "newNormal")

		].join( "\n" );

var phongFragmentShaderModified = [

		"#define PHONG",

		"uniform vec3 diffuse;",
		"uniform vec3 emissive;",
		"uniform vec3 specular;",
		"uniform float shininess;",
		"uniform float opacity;",


		THREE.ShaderChunk[ "common" ],
		THREE.ShaderChunk[ "color_pars_fragment" ],
		THREE.ShaderChunk[ "uv_pars_fragment" ],
		THREE.ShaderChunk[ "uv2_pars_fragment" ],
		THREE.ShaderChunk[ "map_pars_fragment" ],
		THREE.ShaderChunk[ "alphamap_pars_fragment" ],
		THREE.ShaderChunk[ "aomap_pars_fragment" ],
		THREE.ShaderChunk[ "lightmap_pars_fragment" ],
		THREE.ShaderChunk[ "emissivemap_pars_fragment" ],
		THREE.ShaderChunk[ "envmap_pars_fragment" ],
		THREE.ShaderChunk[ "fog_pars_fragment" ],
		THREE.ShaderChunk[ "lights_phong_pars_fragment" ],
		THREE.ShaderChunk[ "shadowmap_pars_fragment" ],
		THREE.ShaderChunk[ "bumpmap_pars_fragment" ],
		THREE.ShaderChunk[ "normalmap_pars_fragment" ],
		THREE.ShaderChunk[ "specularmap_pars_fragment" ],
		THREE.ShaderChunk[ "logdepthbuf_pars_fragment" ],

		"void main() {",

		"	vec3 outgoingLight = vec3( 0.0 );",
		"	vec4 diffuseColor = vec4( diffuse, opacity );",
		"	vec3 totalAmbientLight = ambientLightColor;",
		"	vec3 totalEmissiveLight = emissive;",
		"	vec3 shadowMask = vec3( 1.0 );",


			THREE.ShaderChunk[ "logdepthbuf_fragment" ],
			THREE.ShaderChunk[ "map_fragment" ],
			THREE.ShaderChunk[ "color_fragment" ],
			THREE.ShaderChunk[ "alphamap_fragment" ],
			THREE.ShaderChunk[ "alphatest_fragment" ],
			THREE.ShaderChunk[ "specularmap_fragment" ],
			THREE.ShaderChunk[ "normal_phong_fragment" ],
			THREE.ShaderChunk[ "lightmap_fragment" ],
			THREE.ShaderChunk[ "hemilight_fragment" ],
			THREE.ShaderChunk[ "aomap_fragment" ],
			THREE.ShaderChunk[ "emissivemap_fragment" ],

			THREE.ShaderChunk[ "lights_phong_fragment" ],
			THREE.ShaderChunk[ "shadowmap_fragment" ],

			"totalDiffuseLight *= shadowMask;",
			"totalSpecularLight *= shadowMask;",

			"#ifdef METAL",

			"	outgoingLight += diffuseColor.rgb * ( totalDiffuseLight + totalAmbientLight ) * specular + totalSpecularLight + totalEmissiveLight;",

			"#else",

			"	outgoingLight += diffuseColor.rgb * ( totalDiffuseLight + totalAmbientLight ) + totalSpecularLight + totalEmissiveLight;",

			"#endif",

			THREE.ShaderChunk[ "envmap_fragment" ],

			THREE.ShaderChunk[ "linear_to_gamma_fragment" ],

			THREE.ShaderChunk[ "fog_fragment" ],

		"	gl_FragColor = vec4( outgoingLight, diffuseColor.a );",


		"}"

	].join( "\n" );

var idFragmentShader = [
		"varying vec4 vID;",

		"void main() {",

		"	gl_FragColor = vID;",

		"}"

	].join( "\n" );
