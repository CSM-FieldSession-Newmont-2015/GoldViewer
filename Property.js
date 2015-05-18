// Visual Studio Code uses these to hush warnings about
//   variable names it can't find declared.
/* global THREE */

var sampleJSON = {
	"projectName": "Mt Pleasant West Subset",
	"description": "A smaller subset of holes within the larger Mt Pleasant West area.",
	"projectionEPSG": 28351,
	"boxMin": [305104.60,6617982.92,437.90],
	"boxMax": [306136.77,6618077.70,440.10],
	"formatVersion": 0.01,
	"holes":
	[
		{
			"id": 1569866,
			"name": "KSS-267",
			"depth": 2.00,
			"location": [305153.75,6618024.24,440.00],
			"downholeSurveys":
			[
				{
					"depth": 0.00,
					"azimuth": 0.00,
					"inclination": -90.00,
					"location": [305153.75,6618024.24,440.00]
				},
				{
					"depth": 2.00,
					"azimuth": 0.00,
					"inclination": -90.00,
					"location": [305153.75,6618024.24,438.00]
				}
			],
			"downholeDataValues":
			[
				{
					"name": "Au",
					"intervals":
					[
						{"from": 1.00,"to": 2.00,"value": 0.00600}
					]
				},
				{
					"name": "As",
					"intervals":
					[
						{"from": 1.00,"to": 2.00,"value": 4.00000}
					]
				}
			]
		},
		{
			"id": 1569867,
			"name": "KSS-268",
			"depth": 2.00,
			"location": [305199.75,6617999.24,440.00],
			"downholeSurveys":
			[
				{
					"depth": 0.00,
					"azimuth": 0.00,
					"inclination": -90.00,
					"location": [305199.75,6617999.24,440.00]
				},
				{
					"depth": 2.00,
					"azimuth": 0.00,
					"inclination": -90.00,
					"location": [305199.75,6617999.24,438.00]
				}
			],
			"downholeDataValues":
			[
				{
					"name": "Au",
					"intervals":
					[
						{"from": 1.00,"to": 2.00,"value": 0.00800}
					]
				},
				{
					"name": "As",
					"intervals":
					[
						{"from": 1.00,"to": 2.00,"value": 0.01000}
					]
				}
			]
		},
		{
			"id": 1569868,
			"name": "KSS-269",
			"depth": 2.00,
			"location": [306136.77,6617987.23,440.00],
			"downholeSurveys":
			[
				{
					"depth": 0.00,
					"azimuth": 0.00,
					"inclination": -90.00,
					"location": [306136.77,6617987.23,440.00]
				},
				{
					"depth": 2.00,
					"azimuth": 0.00,
					"inclination": -90.00,
					"location": [306136.77,6617987.23,438.00]
				}
			],
			"downholeDataValues":
			[
				{
					"name": "Au",
					"intervals":
					[
						{"from": 1.00,"to": 2.00,"value": 0.00700}
					]
				},
				{
					"name": "As",
					"intervals":
					[
						{"from": 1.00,"to": 2.00,"value": 0.01000}
					]
				}
			]
		}
	]
};

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
			// This depth isn't in our map. We'll have to extrapolate
			//   from depths which are to calculate it.
			// TODO: Calculate the depth.
			// Until then, treat undefined as the 0-vector and warn in the
			//   console.
			// This should make some interesting visual effects.
			console.log("[Warning] A depth of", depth,
				"was requested when loading the property,",
				"but didn't exist in the depth map.",
				"Using (0, 0, 0) instead.\n",
				"This will cause problems. Please see the TODO near me.");
			return new THREE.Vector3();
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
