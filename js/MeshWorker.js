importScripts('/js/libs/three.js');

var started = false;
var busy = false;
setInterval(function() {closeIfIdle()}, 3000);

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
	return 3;
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

//intervalData should be in the form [[Float, Float, Float, Float, Float, Float], Float, Int]
//giving the starting point, ending point, the ore concentration, and interval ID

function calcGeometry(intervalData){

	var floats = new Float32Array(intervalData[0]);
	var vec1 = vec3FromArray(floats);
	var vec2 = vec3FromArray([floats[3], floats[4], floats[5]]);

	var geometry = cylinderMesh(vec1, vec2, determineWidth(intervalData[1]));
	//console.log(geometry);
	postMessage([geometry.attributes.position.array.buffer, geometry.attributes.normal.array.buffer, geometry.attributes.uv.array.buffer, intervalData[2]], [geometry.attributes.position.array.buffer, geometry.attributes.normal.array.buffer, geometry.attributes.uv.array.buffer]);
}

function cylinderMesh(pointX, pointY, width) {

	var direction = new THREE.Vector3().subVectors(pointY, pointX);
	var orientation = new THREE.Matrix4();

	var transform = new THREE.Matrix4();
	transform.makeTranslation((pointY.x + pointX.x) / 2, (pointY.y + pointX.y) / 2, (pointY.z + pointX.z) / 2);

	orientation.lookAt(pointX, pointY, new THREE.Object3D().up);
	orientation.multiply(matrix4);
	var edgeGeometry = new THREE.CylinderGeometry(width, width, direction.length(), cylinderEdges, 1);
	edgeGeometry.applyMatrix(orientation);
	edgeGeometry.applyMatrix(transform);

	return new THREE.BufferGeometry().fromGeometry(edgeGeometry);
}