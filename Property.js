// Visual Studio Code uses these to hush warnings about
//   variable names it can't find declared.
/* global THREE */

var sampleJSON = (function () {
    var json = null;
    $.ajax({
        'async': false,
        'global': false,
        'url': "mt_pleasant_west_subset.json",
        'dataType': "json",
        'success': function (data) {
            json = data;
        }
    });
    return json;
})(); 


function pprint(thing) {
	console.log(JSON.stringify(thing, null, 2));
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
	var depthMap = {}
	var depthToCoords = function (depth) {
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

			// Here "lower" means smaller magnitude.
			// lowerDepth < depth < upperDepth.
			// lowerDepth and upperDepth are already in our map, so we shouldn't
			//   expect either of them to be equal to depth.
			// If they were, we wouldn't be in this if-body.

			// We assume depths are always integral, and search down.
			// TODO: Don't assume integral depths and search the map's keys instead.
			var lowerDepth = depth;
			while (depthMap[lowerDepth] === undefined) {
				lowerDepth -= 1;
			}

			// ... and then up.
			var upperDepth = depth;
			while (depthMap[upperDepth] === undefined) {
				upperDepth += 1;
			}

			depthMap[depth] = calculateDepth(
				lowerDepth,
				upperDepth,
				depthMap[lowerDepth],
				depthMap[upperDepth],
				depth);

			console.log("Depth == ", depth);
			pprint(depthMap[lowerDepth])
			pprint(depthMap[depth])
			pprint(depthMap[upperDepth]);
			console.log("");

			lookup = depthMap[depth];
		}
		return lookup;
	};

	// Process the survey hole.
	// We do this by making a list of points, which we'll connect later
	//   using OpenGL.
	// We assume any individual hole's survey line is continuous,
	//   *and in order*. If they're not in order, bad things happen (TM).
	var surveys = jsonHole["downholeSurveys"];
	hole.surveyPoints = []
	for (var i = 0; i < surveys.length; i += 1 ) {
		var location = surveys[i]["location"];

		hole.surveyPoints.push(vec3FromArray(location));
		depthMap[surveys[i]["depth"]] = vec3FromArray(location);
	}

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

function PropertyFromJSON(propertyJSON) {
	this.name = propertyJSON["projectName"];
	this.description = propertyJSON["description"];

	var boxMin = vec3FromArray(propertyJSON["boxMin"]);
	var boxMax = vec3FromArray(propertyJSON["boxMax"]);
	this.box = {
		size:     boxMax.sub(boxMin),
		position: boxMin,
	};

	this.holes = [];
	var holesJSON = propertyJSON["holes"];
	for (var i = 0; i < holesJSON.length; i += 1) {
		this.holes.push(parseHoleData(holesJSON[i]));
	}
};

var property = new PropertyFromJSON(sampleJSON);
console.log("Example property:");
pprint(property);
