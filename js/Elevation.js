/* global colors */
/* global google */
/* global THREE */

var property;
var scene;
var segments = 10;
var currentRow = 0;

var latLngMin;
var latLngMax;
var dx;
var dy;
var maxX;
var maxY;
var geometry;

var map;
var elevator;

function addTerrain(_scene, _property) {
	scene = _scene;
	property = _property

	latLngMin = new google.maps.LatLng(property.longLatMin.y, property.longLatMin.x);
	latLngMax = new google.maps.LatLng(property.longLatMax.y, property.longLatMax.x);

	dx = (latLngMax.lng() - latLngMin.lng()) / segments;
	dy = (latLngMax.lat() - latLngMin.lat()) / segments;

	maxX = property.box.size.x;
	maxY = property.box.size.y;

	geometry = new THREE.PlaneGeometry(maxX, maxY, segments, segments);

	elevator = new google.maps.ElevationService();

	var path = [];
	path.push(new google.maps.LatLng(latLngMin.lat() + currentRow * dy, latLngMin.lng()), new google.maps.LatLng(latLngMin.lat() + currentRow * dy, latLngMax.lng()));

	// Create a PathElevationRequest object using this array.
	var pathRequest = {
		'path': path,
		'samples': segments + 1
	};

	// Initiate the path request.
	elevator.getElevationAlongPath(pathRequest, plotTerrain);
}

function plotTerrain(results, status) {
	if (status != google.maps.ElevationStatus.OK) {
		console.error("Google ElevationStatus] " + status);
		return;
	}

	var elevations = results;

	for (var i = 0; i <= segments; i++) {
		geometry.vertices[(segments + 1) * currentRow + i].z = elevations[i].elevation;
	}

	if (currentRow < segments) {
		// Do nothing for a while, because Google has rate limits.
		setTimeout(function () { }, 200);
		currentRow++;

		var path = [];

		path.push(new google.maps.LatLng(latLngMin.lat() + currentRow * dy, latLngMin.lng()), new google.maps.LatLng(latLngMin.lat() + currentRow * dy, latLngMax.lng()));

		// Create a PathElevationRequest object using this array.
		var pathRequest = {
			'path': path,
			'samples': segments + 1
		};

		// Initiate the path request.
		elevator.getElevationAlongPath(pathRequest, plotTerrain);
	} else {
		var material = new THREE.MeshBasicMaterial({
			color: colors.terrain_frame,
			side: THREE.DoubleSide,
			wireframe: true
		});

		var plane = new THREE.Mesh(geometry, material);
		plane.position.x += property.box.size.x / 2;
		plane.position.y += property.box.size.y / 2;

		scene.add(plane);
	}
}
