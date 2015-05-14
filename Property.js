var json_data = {
	"projectName": "Drillhole Traces",
	"description": "A project with two drillhole traces and no other data.",
	"boxMin": [10000.0, 50000.0, 1000.0],
	"boxMax": [15000.0, 55000.0, 1500.0],
	"formatVersion:": 0.01,
	"holes": [
		{"id": 1, "holeName": "DDH-01", "points": [[12500.0, 52500.0, 1400.0], [12500.0, 52500.0, 1100.0]] },
		{"id": 2, "holeName": "DDH-02", "points": [[12600.0, 52500.0, 1300.0], [12600.0, 52500.0, 1000.0]] }
	]
}

// We shouldn't rely on threejs for this too much.
var Vec3 = THREE.Vector3;

// Property class.
// Encapsulates all of the data about a property which we might want.
var Property = (function () {
	var name = "Property Demo";
	var description = "Example description";
	var box = {
		size:     new Vec3(),
		position: new Vec3(),
	};
	var survey_lines = [];

	var from_json = function (jdata) {
		name = jdata["projectName"];
		description = jdata["description"];

		var boxmin = new Vec3(jdata["boxMin"][0], jdata["boxMin"][1], jdata["boxMin"][2]);
		var boxmax = new Vec3(jdata["boxMax"][0], jdata["boxMax"][1], jdata["boxMax"][2]);
		box = {
			size:     boxmax.sub(boxmin),
			position: boxmin,
		}

		for (var i = 0; i < jdata["holes"].length; i += 1) {
			var hole = jdata["holes"][i];

			var points = []
			for (var j = 0; j < hole["points"].length; j += 1) {
				var point = hole["points"][i];
				points.push(new Vec3(point[0], point[1], point[2]));
			}

			survey_lines.push({
				name:   hole["holeName"],
				points: points,
			});
		}
	}
	return function() {
		from_json: from_json
	};
})();

/*
{
	"projectName": "Drillhole Traces",
	"description": "A project with two drillhole traces and no other data.",
	"boxMin": new THREE.Vector3(10000.0, 50000.0, 1000.0),
	"boxMax": new THREE.Vector3(15000.0, 55000.0, 1500.0),
	"formatVersion:": 0.01,
	"holes": [
		{
			"id": 1,
			"holeName": "DDH-01",
			"points": [
				new THREE.Vector3(12500.0, 52500.0, 1400.0),
				new THREE.Vector3(12500.0, 52500.0, 1100.0)
			],
		},
		{
			"id": 2,
			"holeName": "DDH-02",
			"points": [
				new THREE.Vector3(12600.0, 52500.0, 1300.0),
				new THREE.Vector3(12600.0, 52500.0, 1000.0)
			],
		},
	],
};
*/