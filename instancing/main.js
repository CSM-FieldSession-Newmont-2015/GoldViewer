
var camera   = null;
var canvas   = null;
var controls = null;
var renderer = null;
var scene    = null;
var stats    = null;
var time     = null;

var cube      = null;
var cylinders = null;

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
	camera.position.set(350.0, 350.0, 350.0);
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

	cylinders = makeInstancedCylinders(15 * 1000);
	scene.add(cylinders);

	render();
}

// Update things every frame.
function update(time) {
	controls.update();
	stats.update();

	cube.rotation.x = Math.sin(1.0 * time);
	cube.rotation.y = Math.cos(1.01 * time);
	cube.rotation.z = Math.cos(1.02 * time);

	// TODO: This does not work.
//	cylinders.material.uniforms.color.value[0] = Math.sin(time) * Math.sin(time);
//	cylinders.material.needsUpdate = true;
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

function makeInstancedCylinders(instances) {
	var i = null;
	var vector = new THREE.Vector4();

	var baseGeometry = makeCylinderGeometry(1.0, 1.0, 7);
	var geometry = new THREE.InstancedBufferGeometry();
	geometry.maxInstancedCount = instances;

	// Set positions
	var positions = new THREE.BufferAttribute(
		new Float32Array(baseGeometry.attributes["position"].array),
		3);
	geometry.addAttribute("position", positions);

	// Set offsets
	var offsets = new THREE.InstancedBufferAttribute(
		new Float32Array(instances * 3),
		3, // elements of --^ per item. We're passing vec3s, so it's 3.
		1); // meshPerAttribute
	for (i = 0; i < offsets.count; i += 1) {
		// Random offsets.
		offsets.setXYZ(i, 200.0*Math.random(), 200.0*Math.random(), 200.0*Math.random());
	}
	geometry.addAttribute("offset", offsets);

	// Set the scale (along each axis)
	var scales = new THREE.InstancedBufferAttribute(
		new Float32Array(instances * 3),
		3, // Scale the x, the y, and/or the z axes.
		1);

	for (i = 0; i < scales.count; i += 1) {
		var height = Math.random() + 0.5;
		// Keep them square.
		var width = 0.3 * height * Math.random() + 0.1;
		scales.setXYZ(i, width, Math.random(), width);
	}

	geometry.addAttribute("scale", scales);

	// Setup material with its shader.
	var material = new THREE.RawShaderMaterial({
		uniforms: {
			time: { type: "f", value: 0},
			color: { type: "4f", value: [1.0, 1.0, 1.0, 1.0] }
		},
		vertexShader: document.getElementById( 'vertexShader' ).textContent.replace("@@name@@", "Mineral!"),
		fragmentShader: document.getElementById( 'fragmentShader' ).textContent,
		side: THREE.DoubleSide,
		transparent: true,
		attributes: [
			"position",
			"offset",
			"scale",
		],
		side: THREE.DoubleSide,
	});

	material.uniforms.time.value = Date.now();

	return new THREE.Mesh(geometry, material);
}
