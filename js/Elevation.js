var property;
var scene;
var segments = 14;
var northwest = new google.maps.LatLng(36.628581, -118.341994);
var southeast = new google.maps.LatLng(36.528581, -118.241994);

function addTerrain(_scene, _property) {
    scene = _scene;
    property = _property;
    var dx = (southeast.lng() - northwest.lng()) / segments;
    var dy = (southeast.lat() - northwest.lat()) / segments;
    var elevator = new google.maps.ElevationService();
    var path = [];

    for (var i = 0; i <= segments; i += 2) {
        path.push(new google.maps.LatLng(northwest.lat() + i * dy, northwest.lng()), new google.maps.LatLng(northwest.lat() + i * dy, southeast.lng()));
        path.push(new google.maps.LatLng(northwest.lat() + (i + 1) * dy, southeast.lng()), new google.maps.LatLng(northwest.lat() + (i + 1) * dy, northwest.lng()));
    }

    // Create a PathElevationRequest object using this array.
    var pathRequest = {
        'path': path,
        'samples': (segments + 1) * (segments + 1)
    }

    // Initiate the path request.
    elevator.getElevationAlongPath(pathRequest, plotTerrain);
}

function plotTerrain(results, status) {
    if (status != google.maps.ElevationStatus.OK) {
        return;
    }
    var elevations = results;
    var maxX = property.box.size.x;
    var maxY = property.box.size.y;
    var geometry = new THREE.PlaneGeometry(maxX, maxY, segments, segments);

    for (var i = 0; i < segments; i += 2) {
        for (var j = 0; j <= segments; j++) {
            geometry.vertices[(segments + 1) * i + j].z = elevations[(segments + 1) * i + j].elevation - elevations[0].elevation;
        }
        for (var j = segments; j >= 0; j--) {
            geometry.vertices[(segments + 1) * (i + 1) + j].z = elevations[(segments + 1) * (i + 1) + j].elevation - elevations[0].elevation;
        }
    }
    for (var j = 0; j <= segments; j++) {
        geometry.vertices[(segments + 1) * segments + j].z = elevations[(segments + 1) * segments + j].elevation - elevations[0].elevation;
    }

    var material = new THREE.MeshBasicMaterial({ color: colors.terrain_frame, side: THREE.DoubleSide, wireframe: true });
    var plane = new THREE.Mesh(geometry, material);
    plane.position.x += property.box.size.x/2;
    plane.position.y += property.box.size.y/2;
    scene.add(plane);

/*
    // Draw 100 lines on each side.
    var dx = maxX / 100.0;
    var dy = maxY / 100.0;
    var minZ = property.box.center.z + property.box.size.z / 2;
    var maxdz = property.box.size.z / 5.0;

    var meshGeometry = new THREE.Geometry();
    var material = new THREE.LineBasicMaterial({
        color: colors.terrain_frame,
    });

    var heights = [];

    // Draw lines along the y axis.
    for (var x = 0; x < maxX; x += dx) {
        var lineGeometry = new THREE.Geometry();
        heights[x] = [];
        for (var y = 0; y < maxY; y += dy) {
            var z = maxdz * Math.random() + minZ;
            heights[x][y] = z;
            lineGeometry.vertices.push(new THREE.Vector3(x, y, z));
        }
        scene.add(new THREE.Line(lineGeometry, material));
        meshGeometry.merge(lineGeometry);
    }

    // And then along the x axis.
    for (var y = 0; y < maxY; y += dy) {
        var lineGeometry = new THREE.Geometry();
        for (var x = 0; x < maxX; x += dx) {
            var z = heights[x][y];
            lineGeometry.vertices.push(new THREE.Vector3(x, y, z));
        }
        scene.add(new THREE.Line(lineGeometry, material));
        meshGeometry.merge(lineGeometry);
    }

    var mesh = new THREE.Mesh(meshGeometry, material);
    // scene.add(mesh);
*/
}
