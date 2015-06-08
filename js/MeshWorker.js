importScripts('/js/libs/three.js');


self.addEventListener('message', function(e) {
	calcMeshes(e.data);
});

function calcMeshes(holesJSON){
	console.log(holesJSON);
	Object.keys(holesJSON).forEach(function(mineral){
		holesJSON[mineral].forEach(function(interval){
			var mesh = cylinderMesh(interval.path.start, interval.path.end, 1);
			interval.mesh = mesh;
		})
	})
	postMessage(JSON.stringify(holesJSON));
	close();
}

function cylinderMesh(pointX, pointY, width) {

	var direction = new THREE.Vector3().subVectors(pointY, pointX);
	var orientation = new THREE.Matrix4();

	var transform = new THREE.Matrix4();
	transform.makeTranslation((pointY.x + pointX.x) / 2, (pointY.y + pointX.y) / 2, (pointY.z + pointX.z) / 2);

	orientation.lookAt(pointX, pointY, new THREE.Object3D().up);
	orientation.multiply(new THREE.Matrix4().set
		(1, 0, 0, 0,
		0, 0, 1, 0,
		0, -1, 0, 0,
		0, 0, 0, 1));
	var edgeGeometry = new THREE.CylinderGeometry(width, width, direction.length(), 8, 1);
	edgeGeometry.applyMatrix(orientation);
	edgeGeometry.applyMatrix(transform);

	return new THREE.Mesh(edgeGeometry);
}