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

// Given an object loaded from Newmont's JSON, return an object with
//   the hole meta data and a list of lines representing the survey lines.
function parseHoleData(jsonHole) {
	var hole = {};

	// This data has absolutely no bearing on rendering, but has uses
	//   for things like tooltips and debugging.
	hole.id = jsonHole["id"];
	hole.name = jsonHole["name"];

	var surveys = jsonHole["downholeSurveys"];
	hole.survey_points = []
	for (var i = 0; i < surveys.length; i += 1 ) {
		hole.survey_points.push(vec3FromArray(surveys[i]["location"]));
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

console.log("Example property:");
var property = new PropertyFromJSON(sampleJSON);
pprint(property);
