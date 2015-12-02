// threejs stuff.
var camera         = null;
var canvas         = null;
var controls       = null;
var renderer       = null;
var scene          = null;
var stats          = null;

// State we use when updating.
var time           = null;
var lastTime       = null;
var lastMeshSwitch = Date.now() / 1e3;

// Meshes we draw.
var cube           = null;
var cylinderData   = null;

// Entry point.
function start() {
	// Setup the FPS counter.
	stats = new Stats();
	stats.setMode(0);
	stats.domElement.style.position = "absolute";
	stats.domElement.style.left = "0px";
	stats.domElement.style.top = "0px";
	document.body.appendChild(stats.domElement);

	// Scene.
	scene = new THREE.Scene();

	// Camera. TODO: Calculator fov because it looks weird on unexpected ratios.
	var fov = 55;
	var ratio = window.innerWidth / window.innerHeight;
	camera = new THREE.PerspectiveCamera(fov, ratio, 0.1, 1.0e6);
	camera.up.set(0, 0, 1);
	camera.position.set(50.0, 50.0, 50.0);
	camera.lookAt(new THREE.Vector3(0, 0, 0));

	// Setup the WebGL Rendering context.
	canvas = document.getElementById("canvas");
	renderer = new THREE.WebGLRenderer({
		canvas: canvas,
		antialias: true,
	});
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0xdedede);
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
	var light = new THREE.PointLight(0xa0a0a0, 5.0, 1000.0);
	light.position.x = -40.0;
	light.position.y = -30.0;
	light.position.z = -50.0;
	scene.add(light);

	// Standard resize handler.
	window.addEventListener("resize", function () {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
	});

	cube = makeCubeMesh(1.0, 1.0, 1.0);
	//scene.add(cube);

	cyl = phongCylinder(3, 5, 7);
	cyl.translateZ(10);
	scene.add(cyl);

	cylinderData = loadCylinderData(120 * 1000, "Purple Stuff", new THREE.Color(0.5, 0.0, 0.5));
	scene.add(cylinderData.mesh);

	render();
}



// Update things every frame.
function update(time) {
	controls.update();
	stats.update();

	cube.rotation.x = Math.sin(1.0 * time);
	cube.rotation.y = Math.cos(1.01 * time);
	cube.rotation.z = Math.cos(1.02 * time);

	rotateCylinder(time);
	//cylinderData.mesh.geometry.addAttribute("position", cylinderGeom.attributes["position"])

	/*
	// Change once a second, give or take.
	if (Math.abs(time - lastMeshSwitch) > 10.0) {
		//console.log("Switching meshes.");

		lastMeshSwitch = time;

		// We need to re-add the mesh for it take effect.
		scene.remove(cylinderData.mesh);
		// Switch between each mesh.
		if (cylinderData.mesh.material === cylinderData.onHoverMaterial) {
			cylinderData.mesh.material = cylinderData.renderMaterial;
		} else {
			cylinderData.mesh.material = cylinderData.onHoverMaterial;
		}
		scene.add(cylinderData.mesh);
	}*/
}

function render() {
	requestAnimationFrame(render);

	update(Date.now() / 1e3);

	renderer.render(scene, camera);
}

function rotateCylinder(time){
	var radians = (time - lastTime) / 3;
	lastTime = time;
	var euler = new THREE.Euler(0, radians, 0, 'XYZ');
	var matrix = new THREE.Matrix4().makeRotationFromEuler(euler);
	//console.log(rotationMatrix);
	cylinderGeom.applyMatrix(matrix);
	cyl.geometry.applyMatrix(matrix);
}

function makeCubeMesh(x, y, z) {
	var geometry = new THREE.BoxGeometry(x, y, z);
	var material = new THREE.MeshPhongMaterial({
		color: (1 << 25) * Math.random(),
		//colors: THREE.FaceColors
	});
	return new THREE.Mesh(geometry, material);
}

// Makes a basic, "root" geometry for all of the cylinders to copy.
function makeCylinderGeometry(height, width, sides) {
	var radius = width / 2.0;
	var regularGeometry = new THREE.CylinderGeometry(radius, radius, height, sides);
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

function loadCylinderData(instances, type, color) {
	console.log("Making " + instances + " of " + JSON.stringify(color) + " " + type + ".");
	var baseGeometry = makeCylinderGeometry(10.0, 10.0, 7);

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
	geometry = new THREE.InstancedBufferGeometry().fromGeometry(ggg);
	//geometry.computeVertexNormals();
	//geometry.computeFaceNormals();
	geometry.maxInstancedCount = instances;

	// The GLSL identifiers corresponding to each attribute.
	var attributeNames = [
		"position",
		"offset",
		"scale",
		"quaternion",
		"color"];

		console.log(data);
	geometry.addAttribute(attributeNames[0], cylinderGeom.attributes.position);
	//geometry.addAttribute(attributeNames[1], cylinderGeom.attributes.)
	geometry.addAttribute(attributeNames[1], data.offsets);
	geometry.addAttribute(attributeNames[2], data.scales);
	geometry.addAttribute(attributeNames[3], data.rotations);
	geometry.setIndex(cylinderGeom.index);
	geometry.computeVertexNormals();
	geometry.computeFaceNormals();

	// Load the shaders.

	// The shader used for generic rendering.
	var vsRenderSource = document.getElementById('renderVertexShader').textContent;
	var fsRenderSource = document.getElementById('renderFragmentShader').textContent;

	phongUniforms = THREE.ShaderLib.phong.uniforms;
	//phongUniforms.color = { type: "4f", value: [color.r, color.g, color.b, 1.0] }

	

	// Give each cylinder a unique color which maps to its index. We'll use this on the texture
	// to id which cylinder we're hovering over.
	var colors = new THREE.InstancedBufferAttribute(
		new Float32Array(instances * 3),
		3,
		1);

	var r, g, b;
	for (i = 1; i <= colors.count; i += 1) {
		r = ((i >> 16) & 0xff) / 0x100;
		g = ((i >> 8)  & 0xff) / 0x100;
		b = (i         & 0xff) / 0x100;
		colors.setXYZ(i-1, r, g, b);
	}
	var color2 = new THREE.BufferAttribute(
		new Float32Array(3),
		3);
	color2.setXYZ(0, 0.2, 0.3, 0.4);
	console.log(color2);
	
	geometry.addAttribute("color", colors);
	cylinderGeom.addAttribute("color", color2);

	
	phongUniforms.diffuse.value = new THREE.Color(0.3, 0.4, 0.5);
	phongUniforms.shininess.value = 4;
	phongUniforms.refractionRatio.value = 1.0;

	// The material to use when writing to a texture for hover-over detection.
	var vertexShader = THREE.ShaderLib.phong.vertexShader;
	var split = vertexShader.split("void main() {");
	console.log(beforeMainVertexString);
	var modifiedVertexShader = [
			split[0],
			beforeMainVertexString,
			"void main() {",
			afterMainVertexString,
			split[1]
			].join("\n");


	data.onHoverMaterial = new THREE.ShaderMaterial({
		uniforms: 			phongUniforms,
		vertexShader:   	phongVertexShaderModified,
		fragmentShader: 	THREE.ShaderLib.phong.fragmentShader,
		lights: 			true,
		transparent: 		false,
		vertexColors: 		THREE.VertexColors,
		shading: 			THREE.FlatShading
	});
	data.onHoverMaterial.update();

	// We meed to do this to make sure the mesh doesn't get culled at weird angles.
	//geometry.computeBoundingBox();

	// We only use the onHoverMaterial in special cases, so default to using the renderMaterial.
	//data.mesh = new THREE.Mesh(geometry, data.renderMaterial);
	data.mesh = new THREE.Mesh(geometry, data.onHoverMaterial);
	return data;
}

function phongCylinder(radius, height, segments){
	var geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
	geometry = new THREE.BufferGeometry().fromGeometry(geometry);
	geometry.computeFaceNormals();
	geometry.computeVertexNormals();
	var material = new THREE.MeshPhongMaterial({
		color: new THREE.Color(0.4, 0.5, 0.6),
				refractionRatio: 1.0,
				shininess: 4.0
	})
	var mesh = new THREE.Mesh(geometry, material);
	return mesh;
}

var beforeMainVertexString = [

			"attribute vec3 offset;",
			"attribute vec3 scale;",
			"attribute vec4 quaternion;\n",

			"vec3 rotate_vector( vec4 quat, vec3 vec ) {\n\t",
				"return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz );\n",
			"}\n\n"

		].join("\n");

var afterMainVertexString = [
			
				"vec3 newPosition = scale * position;",
				"newPosition = rotate_vector( quaternion, newPosition);",
				"newPosition = newPosition + offset;"
			].join("\n");

var phongVertexShaderModified = [

			"#define PHONGMODIFIED",

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

			"#define PHONGMODIFIED",

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