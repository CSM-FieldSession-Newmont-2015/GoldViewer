/* global THREE */

importScripts('libs/three.js');

var started = false;
var busy = false;
setInterval(function() { closeIfIdle(); }, 3000);

self.addEventListener('message', function(e) {
	busy = true;
	started = true;
	calcGeometry(e.data);
});

var cylinderEdges = 6;
var matrix4 = new THREE.Matrix4().set
		(1, 0, 0, 0,
		0, 0, 1, 0,
		0, -1, 0, 0,
		0, 0, 0, 1);

function determineWidth(value){
	return Math.log(value + 1) * 2.0;
}

// Convert [a, b, c, d..] into {x: a, y: b, z: c}.
//   Disregard anything after the third element.
//   Anything missing is assumed to be 0.
function vec3FromArray(array) {
	return new THREE.Vector3(array[0], array[1], array[2]);
}

function closeIfIdle(){
	if(started && !busy){
		console.log('closing worker');
		close();
	}
	busy = false;
}

// `intervalData` should be in the form [[Float]*6, Float, Int],
// giving the starting point, ending point, the ore concentration, and interval ID.
function calcGeometry(intervalData){

	var floats = new Float32Array(intervalData[0]);
	var vec1 = vec3FromArray(floats);
	var vec2 = vec3FromArray([floats[3], floats[4], floats[5]]);

	var geometry = makeCylinderGeometry(vec1, vec2, determineWidth(intervalData[1]));
	postMessage(
		[
			geometry.attributes.position.array.buffer,
			geometry.attributes.normal.array.buffer,
			geometry.attributes.uv.array.buffer,
			intervalData[2]
		],
		[
			geometry.attributes.position.array.buffer,
			geometry.attributes.normal.array.buffer,
			geometry.attributes.uv.array.buffer
		]);
}

function makeCylinderGeometry(pointA, pointB, width) {

	var transform = new THREE.Matrix4();
	transform.makeTranslation((pointB.x + pointA.x) / 2, (pointB.y + pointA.y) / 2, (pointB.z + pointA.z) / 2);

	var orientation = new THREE.Matrix4();
	orientation.lookAt(pointA, pointB, new THREE.Object3D().up);
	orientation.multiply(matrix4);

	var direction = new THREE.Vector3().subVectors(pointB, pointA);
	var geometry = new THREE.CylinderGeometry(width, width, direction.length(), cylinderEdges, 1);
	geometry.applyMatrix(orientation);
	geometry.applyMatrix(transform);

	return new THREE.BufferGeometry().fromGeometry(geometry);
}
