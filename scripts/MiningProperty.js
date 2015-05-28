// Visual Studio Code uses these to hush warnings about
//   variable names it can't find declared.
/* global THREE */

// This variable is used to enable error checks when JSON is loading.
var enableErrorChecks = false;

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

function printCallStackIfFalse(predicate, msg) {
	if (predicate) {
		return;
	}
	console.error(msg);
	console.trace();
}

// Convert [a, b, c, d..] into {x: a, y: b, z: c}.
//   Disregard anything after the third element.
//   Anything missing is assumed to be 0.
function vec3FromArray(array) {
	printCallStackIfFalse(array != undefined,
		"'array' wasn't defined when we expected it to be.");
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
	hole.traceColor = jsonHole["traceColor"];


	// Process the survey hole.
	// We do this by making a list of points, which we'll connect later
	//   using OpenGL.
	// We assume any individual hole's survey line is continuous,
	//   *and in order*. If they're not in order, bad things happen (TM).
	var surveys = jsonHole["interpolatedDownholeSurveys"];
	hole.surveyPoints = [];
	for (var i = 0; i < surveys.length; i += 1 ) {

		var location = vec3FromArray(surveys[i]["location"]);
		hole.surveyPoints.push(location);
	}


	// And then the intervals with mineral deposits.
	hole.minerals = [];
	var mineralsJSON = jsonHole["downholeDataValues"];
	for (var i = 0; i < mineralsJSON.length; i += 1) {
		var intervals = [];

		var intervalsJSON = mineralsJSON[i]["intervals"];
		intervalsJSON.forEach( function(intervalJSON) {

			interval = {
				value: intervalJSON["value"],

				// We are only storing depth for testing consistency.
				depth: {
					start: intervalJSON["from"],
					end  : intervalJSON["to"]
				},
				path: {
					start:  vec3FromArray(intervalJSON["path"][0]),
					end  :  vec3FromArray(intervalJSON["path"][1])
				}
			};

			// If error checking is enabled, make sure that the azimuth and
			//   inclination match up with the given path.
			if (enableErrorChecks) {
				// TODO: check for data consistency.
			}

			intervals.push(interval);

		});

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
	if (propertyJSON["formatVersion"] != 0.02) {
		console.error("Unsupported format version: " + propertyJSON["formatVersion"]);
		return null;
	}

	this.name        = propertyJSON["projectName"];
	this.description = propertyJSON["description"];
	this.epsg        = propertyJSON["projectionEPSG"];

	var boxMin = vec3FromArray(propertyJSON["boxMin"]);
	var boxMax = vec3FromArray(propertyJSON["boxMax"]);

	var originShift = propertyJSON["originShift"];

	var size = boxMax.clone().sub(boxMin);
	var center = size.clone().multiplyScalar(0.5).add(boxMin);
	this.box = {
		size:   size,
		center: center
	};

	this.longLatMin = vec3FromArray(propertyJSON["longLatMin"]);
	this.longLatMax = vec3FromArray(propertyJSON["longLatMax"]);

	this.desurveyMethod = propertyJSON["MidpointSplit"];

	this.analytes = propertyJSON["analytes"];

	var holes = [];
	propertyJSON["holes"].forEach(function (hole) {
		holes.push(parseHoleData(hole));
	});
	this.holes = holes;

	var expectedHoles = propertyJSON["numHoles"];
	if (this.holes.length != expectedHoles) {
		console.error("Expected " + expectedHoles + "holes, but found " + this.holes.length + " holes.");
	}
}

function miningPropertyFromURL(url, onError) {
	if (!onError) {
		onError = function() {
			console.error("Something went wrong when trying to load MiningProperty JSON from URL:" +
			              "\n\t" + url, ".");
		};
	}
	var data = loadJSON(url);

	if (!data) {
		onError();
	}

	return new MiningPropertyFromJSON(data);
}
