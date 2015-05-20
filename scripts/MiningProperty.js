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

	// Make sure none of the data goes below the maximum depth of this hole.
	var maxDepth = jsonHole["depth"];

	// Mineral deposits are saved with their concentration and depth down
	//   the hole, instead of coorinates. We'll need to calculate the
	//   coordinates from a given depth, or look it up in a cache.
	var depthMap = {};
	var depthToCoords = function (depth) {
		if (depth > maxDepth) {
			console.log("Hole \'" + hole.name + "\' " +
				"has a maximum depth of " + maxDepth + " " +
				"but has a reference to a depth of " + depth + ".\n" +
				"Using the maximum depth of " + maxDepth + " instead.");
			depth = maxDepth;
		}
		var lookup = depthMap[depth];
		if (lookup === undefined) {
			// The depth isn't in our depth map and we need to caclulate it.
			var calculateDepth = function(
					surveyDepthStart,
					surveyDepthEnd,
					surveyPointStart,
					surveyPointEnd,
					intervalDepth
				) {

				// Doing operations like we do modifies the arguments. ಠ_ಠ
				surveyPointStart = surveyPointStart.clone();
				surveyPointEnd   = surveyPointEnd.clone();

				// Total distance of this survey chunk in depth units. (meters)
				var depthDistance = surveyDepthEnd - surveyDepthStart;

				// Total distance of this survey chunk in coordinates. (m, m, m)
				var lineDistance = surveyPointEnd.sub(surveyPointStart);

				// The ratio of the survey line that we need to "follow down".
				// e.g. Survey line is from depth 10 to 12 and we want to
				//      start the interval at 11, we need to travel down
				//      (11 - 10) / (12 - 10) = 1 / 2 = 50% of the way down.
				var ratio = (intervalDepth - surveyDepthStart) / depthDistance;

				return lineDistance.multiplyScalar(ratio).add(surveyPointStart);
			};

			if (depth < 0) {
				console.log("Negative depth in " + hole.name);
			}

			// Here "lower" means smaller magnitude.
			// lowerDepth < depth < upperDepth.
			// lowerDepth and upperDepth are already in our map, so we shouldn't
			//   expect either of them to be equal to depth.
			// If they were, we wouldn't be in this if-body.

			// We assume depths are always integral, and search down.
			// TODO: Don't assume integral depths and search the map's keys instead.
			var lowerDepth = depth;
			while (depthMap[lowerDepth] === undefined && lowerDepth >= 0) {
				lowerDepth -= 1;
			}

			// ... and then up.
			var upperDepth = depth;
			while (depthMap[upperDepth] === undefined && upperDepth <= maxDepth) {
				upperDepth += 1;
			}

			if (lowerDepth == upperDepth) {
				console.log("In hole " + hole.name + ", lower and upper are equal.");
				console.log(lowerDepth);
			}

			depthMap[depth] = calculateDepth(
				lowerDepth,
				upperDepth,
				depthMap[lowerDepth],
				depthMap[upperDepth],
				depth);

			lookup = depthMap[depth];
		}
		return lookup.clone();
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
		depthMap[surveys[i]["depth"]] = vec3FromArray(location);
	}

	// Add the end point to the survey hole.
	var lastJSON = surveys[surveys.length - 1];
	var last = vec3FromArray(lastJSON["location"]);
	last.x += Math.cos(lastJSON["inclination"]) * Math.cos(lastJSON["azimuth"]);
	last.y += Math.cos(lastJSON["inclination"]) * Math.sin(lastJSON["azimuth"]);
	last.z += -lastJSON["depth"];

	depthMap[maxDepth] = last;
	hole.surveyPoints.push(last);

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

	// Go through and adjust each point.
	this.holes.forEach(function (hole) {
		hole.surveyPoints.forEach(function (point) {
			point.sub(offset);
		});

		hole.minerals.forEach(function (mineral) {
			mineral.intervals.forEach(function (interval) {
				interval.start.sub(offset);
				interval.end.sub(offset);
			});
		});
	});
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
