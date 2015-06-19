// threejs stuff.
var camera         = null;
var canvas         = null;
var controls       = null;
var renderer       = null;
var scene          = null;
var stats          = null;

// State we use when updating.
var time           = null;
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
	var light = new THREE.PointLight(0xa0a0a0, 5.0, 10.0);
	light.position.x = -4.0;
	light.position.y = -3.0;
	light.position.z = -5.0;
	scene.add(light);

	// Standard resize handler.
	window.addEventListener("resize", function () {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
	});

	cube = makeCubeMesh(1.0, 1.0, 1.0);
	scene.add(cube);

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

	// Change once a second, give or take.
	if (Math.abs(time - lastMeshSwitch) > 1.0) {
		console.log("Switching meshes.");

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
	}
}

function render() {
	requestAnimationFrame(render);

	update(Date.now() / 1e3);

	renderer.render(scene, camera);
}

function makeCubeMesh(x, y, z) {
	var geometry = new THREE.BoxGeometry(x, y, z);
	var material = new THREE.MeshPhongMaterial({
		color: (1 << 25) * Math.random(),
		colors: THREE.FaceColors
	});
	return new THREE.Mesh(geometry, material);
}

// Makes a basic, "root" geometry for all of the cylinders to copy.
function makeCylinderGeometry(height, width, sides) {
	var radius = width / 2.0;
	var regularGeometry = new THREE.CylinderGeometry(radius, radius, height, sides);
	var bufferGeometry  = new THREE.BufferGeometry().fromGeometry(regularGeometry);
	return bufferGeometry;
}

function loadCylinderData(instances, type, color) {
	console.log("Making " + instances + " of " + JSON.stringify(color) + " " + type + ".");
	var baseGeometry = makeCylinderGeometry(1.0, 1.0, 7);

	var data = {
		type: type ? type : "A Mineral!",

		positions: new THREE.BufferAttribute(
			new Float32Array(baseGeometry.attributes["position"].array),
			3),
		offsets: new THREE.InstancedBufferAttribute(
			new Float32Array(instances * 3),
			3,
			1),
		scales: new THREE.InstancedBufferAttribute(
			new Float32Array(instances * 3),
			3,
			1),
	};

	// Remember, JavaScript only has scope in functions.
	var i = null;

	// This is where you'd call the functions to load offsets, scales, and concentrations.
	// For this proof-of-concept, we just make the data up.

	// Random offsets.
	for (i = 0; i < data.offsets.count; i += 1) {
		// Put them in a 100.0 cube.
		data.offsets.setXYZ(i, 100.0*Math.random(), 100.0*Math.random(), 100.0*Math.random());
	}

	// Random scaling.
	for (i = 0; i < data.scales.count; i += 1) {
		var height = Math.random() + 0.5;
		var width = 0.3 * height * Math.random() + 0.1;
		// Keep them square on top.
		data.scales.setXYZ(i, width, Math.random(), width);
	}

	// Make the final geometry.
	var geometry = new THREE.InstancedBufferGeometry();
	geometry.maxInstancedCount = instances;

	// The GLSL identifiers corresponding to each attribute.
	var attributeNames = [
		"position",
		"offset",
		"scale"];

	geometry.addAttribute(attributeNames[0], data.positions);
	geometry.addAttribute(attributeNames[1], data.offsets);
	geometry.addAttribute(attributeNames[2], data.scales);

	// Load the shaders.

	// The shader used for generic rendering.
	var vsRenderSource = document.getElementById('renderVertexShader').textContent;
	var fsRenderSource = document.getElementById('renderFragmentShader').textContent;

	var time = Date.now();

	data.renderMaterial = new THREE.RawShaderMaterial({
		uniforms: {
			time:  { type: "f",  value: time},
			color: { type: "4f", value: [color.r, color.g, color.b, 1.0] }
		},
		vertexShader:   vsRenderSource.replace("@@name@@", type),
		fragmentShader: fsRenderSource.replace("@@name@@", type),

		transparent: true,
		attributes: attributeNames.slice(),
	});

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
	attributeNames.push("color");
	geometry.addAttribute("color", colors);

	// The material to use when writing to a texture for hover-over detection.
	var vsHoverSource = document.getElementById('hoverVertexShader' ).textContent;
	var fsHoverSource = document.getElementById('hoverFragmentShader' ).textContent;

	data.onHoverMaterial = new THREE.RawShaderMaterial({
		uniforms: {
			time: { type: "f", value: time},
		},
		vertexShader:   vsHoverSource.replace("@@name@@", type),
		fragmentShader: fsHoverSource.replace("@@name@@", type),

		transparent: true,
		attributes: attributeNames.slice(),
	});

	// We only use the onHoverMaterial in special cases, so default to using the renderMaterial.
	data.mesh = new THREE.Mesh(geometry, data.renderMaterial);
	data.mesh = new THREE.Mesh(geometry, data.onHoverMaterial);
	return data;
}
