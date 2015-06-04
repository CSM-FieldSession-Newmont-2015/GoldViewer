var canvas = null;
var gl = null;

var container = null;
var renderer = null;
var camera = null;
var scene = null;

var controls =null;

var height = null;
var width = null;

var cubes_count = 3 * 1000;

var time = 0;
var dt = 1.5;

var cube = null;

function numberWithCommas(x) {
	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function render() {
	requestAnimationFrame(render);
	controls.update();
	renderer.render(scene, camera);
}

// A random float in [-1.0, 1.0].
function randUnit(scale) {
	scale |= 1.0;
	return scale * (2.0 * Math.random() - 1.0);
}

function makeCylinderMesh(name, color, cylinders) {
	var vertices = [];
	var faces = [];

	// Make a couple cylinders per mineral type.
	cylinders.forEach(function (cylinder) {
		var faceOffset = vertices.length/3;

		cylinder.vertices.forEach(function (vert) {
			vertices.push(vert.x, vert.y, vert.z);
		});

		cylinder.faces.forEach(function (face) {
			faces.push(faceOffset + face.a, faceOffset + face.b, faceOffset + face.c);
		});
	});

	vertices = new Float32Array(vertices);
	faces = new Uint32Array(faces);

	var geometry = new THREE.BufferGeometry();
	geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
	geometry.addAttribute('index', new THREE.BufferAttribute(faces, 3));
	geometry.computeVertexNormals();

	var material = new THREE.MeshBasicMaterial({
		color: color
	});

	// Buffer sizes are limited by uint16s, so we need to break up the buffers into
	//   multiple draw calls when the buffer is too long.
	var maxBufferLength = (1 << 16) - 1;
	if (vertices.length >= maxBufferLength) {
		console.log("There are " + numberWithCommas(vertices.length) + " vertices. Switching to drawCalls.");
		for (var i = 0; i < vertices.length / maxBufferLength; i += 1) {
			geometry.addDrawCall(i*maxBufferLength, maxBufferLength);
		}
	}

	return new THREE.Mesh(geometry, material);
}

function start() {
	canvas = document.getElementById("glcanvas");
	height = window.innerHeight;
	width = window.innerWidth;
	renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
	renderer.setSize(width, height);
	renderer.setClearColor(0xdedede);

	container = document.createElement("div");
	container.appendChild(renderer.domElement);

	document.body.appendChild(renderer.domElement);

	// Camera
	camera = new THREE.PerspectiveCamera(
		45,  // view angle
		width / height, // aspect
		0.1, // near
		1000  // far
	);

	camera.up.set(0, 0, 1);

	var scale = 4.0;
	camera.position.x = scale;
	camera.position.y = scale;
	camera.position.z = scale;

	camera.lookAt(new THREE.Vector3(0, 0, 0));
	controls= new THREE.OrbitControls(camera);
	// Scene
	scene = new THREE.Scene();
	scene.add(camera);

	// Cylinders
	var goldCylinders = [];

	/*var cylinderCount = 10 * 1000;
	for (var i = 0; i < cylinderCount; i += 1) {
		var transform = new THREE.Matrix4();

		// ...and random positions.
		transform.makeTranslation(randUnit(), randUnit(), randUnit());

		// ...and random sizes
		var height = 0.5 * Math.random() + 0.5;
		var width = height * 0.1 * Math.random();

		var cylinder = new THREE.CylinderGeometry(width, width, height, 4);
		cylinder.applyMatrix(transform);

		goldCylinders.push(cylinder);
	}*/

	function cylinderMesh(pointX, pointY, width) {
		var direction = new THREE.Vector3().subVectors(pointY, pointX);
		var orientation = new THREE.Matrix4();

		var transform = new THREE.Matrix4();
		transform.makeTranslation((pointY.x + pointX.x) / 2, (pointY.y + pointX.y) / 2, (pointY.z + pointX.z) / 2);

		orientation.lookAt(pointX, pointY, new THREE.Object3D().up);
		orientation.multiply(new THREE.Matrix4().set(1, 0, 0, 0,
			0, 0, 1, 0,
			0, -1, 0, 0,
			0, 0, 0, 1));
		var edgeGeometry = new THREE.CylinderGeometry(width, width, direction.length(), 8, 1);
		edgeGeometry.applyMatrix(orientation);
		edgeGeometry.applyMatrix(transform);
		return edgeGeometry;
	}

	var test = cylinderMesh(new THREE.Vector3( 0,1, 0 ),new THREE.Vector3( 0, 99, 5 ),1)
	goldCylinders.push(test);
	//test = cylinderMesh(new THREE.Vector3( 1, 999, 0 ),new THREE.Vector3( 0, 0, 0 ),5)
	//goldCylinders.push(test.geometry);

	var mesh = makeCylinderMesh("Gold", 0xcc9900, goldCylinders);
	scene.add(mesh);

	render();
}
