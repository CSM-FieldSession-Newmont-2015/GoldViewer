importScripts('libs/three.js');

var started = false;
var busy = false;
setInterval(function () {
	closeIfIdle();
}, 3000);

self.addEventListener('message', function (e) {
	busy = true;
	started = true;
	calcGeometry(e.data);
});

var cylinderEdges = 7;
var matrix4 = new THREE.Matrix4()
	.set(
		1,  0,  0,  0,
		0,  0,  1,  0,
		0, -1,  0,  0,
		0,  0,  0,  1);

/**
 * Compute a cylinder width given a concentration. There are upper and lower bounds on the width.
 * @param  {Number} value The concentration
 * @return {Number}       The scaled width
 */
function determineWidth(value) {
	// TODO: Maybe make these parameters to determineWidth?
	var min = 0.1;
	var max = 15.0;
	var width = Math.log(value + 1.0) * 2.0 / Math.log(10);

	// Clamp the width into a (hard coded) range.
	if (width < min) {
		width = min;
	} else if (width > max) {
		width = max;
	}

	return width;
}

/**
 * Convert [a, b, c, d..] into {x: a, y: b, z: c}, disregarding anything
 * after the third element. Anything missing is given a default by
 * THREE.Vector3. This is, as of r71, 0.0.

 * @param  {Array}      An array of coordinate values.
 *
 * @return {THREE.Vector3} The Vector3 made from the array.
 */
function vec3FromArray(array) {
	return new THREE.Vector3(array[0], array[1], array[2]);
}

/**
 * Closes the worker when it runs out of things to do.
 */
function closeIfIdle() {
	if (started && !busy) {
		close();
	}
	busy = false;
}

/**
 * Constructs the geometry of all the cylinders, and sends the result as a message.
 * @param  {Array} intervalData Should be in the form [[Float]*6, Float, Int],
 *                              giving the starting point, ending point, the ore concentration,
 *                              and interval ID.
 */
function calcGeometry(intervalData) {

	busy = true;
	var floats = new Float32Array(intervalData[0]);
	var vec1 = vec3FromArray(floats);
	var vec2 = vec3FromArray([floats[3], floats[4], floats[5]]);
	var holeID = intervalData[2];

	var geometry = makeCylinderGeometry(vec1, vec2, determineWidth(intervalData[1]));
	postMessage(
		[
			geometry.attributes.position.array.buffer,
			holeID
		], [
			geometry.attributes.position.array.buffer
		]);
}

/**
 * Constructs a cylinder geometry from two points and a width. The order of the first two points
 * does not matter.
 * @param  {THREE.Vector3} pointA The top of the cylinder
 * @param  {THREE.Vector3} pointB The bottom of the cylinder
 * @param  {Number} width  The width
 * @return {THREE.BufferGeometry}        A geometry of a cylinder with its top and bottom centered
 *                           at the two points with width `width`.
 */
function makeCylinderGeometry(pointA, pointB, width) {
	// Sometimes, cylinders' ends overlap *exactly* and the two planes start Z-fighting.
	// By adding a random variance to each coordinate, this shouldn't happen.
	// These values are chosen to be much too small for anyone to ever notice,
	// but if this does cause problems it'll be fun to debug.
	var dx = 1.5e-2 * (Math.random() - 0.5);
	var dy = 1.5e-2 * (Math.random() - 0.5);
	var dz = 1.5e-2 * (Math.random() - 0.5);

	var transform = new THREE.Matrix4();
	transform.makeTranslation((pointB.x + pointA.x) / 2 + dx, (pointB.y + pointA.y) / 2 + dy, (pointB.z + pointA.z) / 2 + dz);

	var orientation = new THREE.Matrix4();
	orientation.lookAt(pointA, pointB, new THREE.Object3D().up);
	orientation.multiply(matrix4);

	var direction = new THREE.Vector3().subVectors(pointB, pointA);
	var geometry = new THREE.CylinderGeometry(width, width, direction.length(), cylinderEdges, 1);
	geometry.applyMatrix(orientation);
	geometry.applyMatrix(transform);

	return new THREE.BufferGeometry().fromGeometry(geometry);
}
