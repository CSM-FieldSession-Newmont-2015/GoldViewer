// Visual Studio Code uses these to hush warnings about
//   variable names it can't find declared.
/* global THREE */

function loadJSON(url) {
	var json = null;
	$.ajax({
		'async':    false,
		'global':   false,
		'url':      url,
		'dataType': "json",
		'success':  function (data) {
			json = data;
		}
	});
	return json;
}

// Convert [a, b, c, d..] into {x: a, y: b, z: c}.
//   Disregard anything after the third element.
//   Anything missing is assumed to be 0.
function vec3FromArray(array) {
	return new THREE.Vector3(array[0], array[1], array[2]);
}

// Take a single hole, as it exists in Newmont's JSON under the "holes" tag,
//   and convert it into a Javascript object ready to be passed to the
//   rendering engine.
function parseHoleData(jsonHole) {
	var hole = {};

	// The metadata can be used for tooltips and debuggin.
	hole.id = jsonHole["id"];
	hole.name = jsonHole["name"];

	// Mineral deposits are saved with their concentration and depth down
	//   the hole, instead of coorinates. We'll need to calculate the
	//   coordinates from a given depth, or look it up in a cache.
	var depthMap = {};
	var depthToCoords = function (depth) {

		//iterate until we find a depth in our hole greater than or equal to 
		//the mineral's location
		var index = 1;
		while(depths[index] < depth && index < depths.length){
			index+=1;
		}

		index -= 1;
		var lastPoint = depthMap[depths[index]];

		var depthDiff = depth - depths[index];
		var pos = lastPoint.location.clone();
		pos.x += depthDiff * Math.cos(lastPoint.inclination) * Math.sin(lastPoint.azimuth);
		pos.y += depthDiff * Math.cos(lastPoint.inclination) * Math.cos(lastPoint.azimuth);
		pos.z += depthDiff * Math.sin(lastPoint.inclination);
		return pos;
	};

	// Process the survey hole.
	// We do this by making a list of points, which we'll connect later
	//   using OpenGL.
	// We assume any individual hole's survey line is continuous,
	//   *and in order*. If they're not in order, bad things happen (TM).
	var surveys = jsonHole["downholeSurveys"];
	hole.surveyPoints = [];
	for (var i = 0; i < surveys.length; i += 1 ) {

		var location = surveys[i]["location"];
		hole.surveyPoints.push(vec3FromArray(location));
		depthMap[surveys[i]["depth"]] = {
			azimuth:     surveys[i]["azimuth"]/180 * Math.PI,
			inclination: surveys[i]["inclination"]/180 * Math.PI,
			location:    vec3FromArray(location)
		};
	}

	var depths = Object.keys(depthMap);
	depths.sort(function(a,b){return a - b});

	/*
	// Add the end point to the survey hole.
	var lastJSON = surveys[surveys.length - 1];
	var last = vec3FromArray(lastJSON["location"]);
	last.x += Math.cos(lastJSON["inclination"]) * Math.cos(lastJSON["azimuth"]);
	last.y += Math.cos(lastJSON["inclination"]) * Math.sin(lastJSON["azimuth"]);
	last.z += -lastJSON["depth"];

	depthMap[maxDepth] = last;
	hole.surveyPoints.push(last);
	
	*/
	// And then the intervals with mineral deposits.
	hole.minerals = [];
	var mineralsJSON = jsonHole["downholeDataValues"];
	for (var i = 0; i < mineralsJSON.length; i += 1) {
		var intervals = [];

		var intervalsJSON = mineralsJSON[i]["intervals"];
		for (var k = 0; k < intervalsJSON.length; k += 1) {
			intervals.push({
				value: intervalsJSON[k]["value"],
				// The intervals are stored by depth in the hole,
				//   not the coordinates. We need to adjust that to use them.
				start: depthToCoords(intervalsJSON[k]["from"]),
				end  : depthToCoords(intervalsJSON[k]["to"])
			});
		}

		hole.minerals.push({
			type: mineralsJSON[i]["name"],
			intervals: intervals
		});
	}

	return hole;
}


/*
This the structure of a MiningProperty object.
{
	"name": String,
	"description": String,
	"projectionEPSG": Number,
	"box": {
		"size":   THREE.Vector3,
		"center": THREE.Vector3
	},
	"holes": [
		{
			"id": Number,
			"name": String,
			"surveyPoints": [ THREE.Vector3 ],
			"minerals": [
				{
					"type": "Au",
					"intervals": [
						{
							"value": Number,
							"start": THREE.Vector3,
							"end":   THREE.Vector3
						}
					]
				}
			]
		}
	]
}
*/
function MiningPropertyFromJSON(propertyJSON) {
	this.name = propertyJSON["projectName"];
	this.description = propertyJSON["description"];
	this.projectionEPSG = propertyJSON["projectionEPSG"]; // Some sort of coordinate.

	var boxMin = vec3FromArray(propertyJSON["boxMin"]);
	var boxMax = vec3FromArray(propertyJSON["boxMax"]);

	// We need to adjust each point so that the bottom corner is at (0, 0, 0).
	// This is our offset for that.
	var offset = boxMin.clone();

	var size   = boxMax.clone().sub(boxMin);
	var center = size.clone().multiplyScalar(0.5);

	this.box = {
		size:   size,
		center: center,
	};

	this.holes = [];
	var holesJSON = propertyJSON["holes"];
	for (var i = 0; i < holesJSON.length; i += 1) {
		this.holes.push(parseHoleData(holesJSON[i]));
	}

	var intervals = 0;

	// Go through and adjust each point.
	this.holes.forEach(function (hole) {
		hole.surveyPoints.forEach(function (point) {
			point.sub(offset);
		});

		hole.minerals.forEach(function (mineral) {
			mineral.intervals.forEach(function (interval) {
				intervals += 1;
				interval.start.sub(offset);
				interval.end.sub(offset);
			});
		});
	});

	console.log("Found " + this.holes.length + " holes.");
	console.log("Found " + intervals + " intervals.");
};

function miningPropertyFromURL(url, onError) {
	if (!onError) {
		onError = function() {
			console.log("[Error] Something went wrong when trying to load MiningProperty JSON from\"",
				url, "\".");
		};
	}
	var data = loadJSON(url);

	if (!data) {
		onError();
	}

	return new MiningPropertyFromJSON(data);
}
