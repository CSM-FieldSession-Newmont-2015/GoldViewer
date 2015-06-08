importScripts('/js/libs/three.js');


self.addEventListener('message', function(e) {
	getMinerals(e.data);
});


// Convert [a, b, c, d..] into {x: a, y: b, z: c}.
//   Disregard anything after the third element.
//   Anything missing is assumed to be 0.
function vec3FromArray(array) {
	return new THREE.Vector3(array[0], array[1], array[2]);

}

function getMinerals(propertyJSON){
	var meshlessData = {};
	var holes = propertyJSON["holes"];
	var intervals = 0;

	holes.forEach(function(hole){

		hole["downholeDataValues"].forEach(function(mineral){
			if(meshlessData[mineral["name"]] === undefined){
				meshlessData[mineral["name"]] = [];
			}
			mineral["intervals"].forEach(function(interval){
				data = {
					value: interval["value"],
					depth: {
						start : interval["from"],
						end   : interval["to"]
					},
					path: {
						start : vec3FromArray(interval["path"][0]),
						end   : vec3FromArray(interval["path"][1])
					},
					hole      : hole["id"]
				};
				meshlessData[mineral["name"]].push(data);
				intervals += 1;
			});

			// Every 1000 intervals, we're going to spawn a
			//  worker to calculate the meshes of given intervals.
			//  This is a heavy garbage-collection process, and
			//  garbage collection only happens when workers terminate.
			if(intervals > 1 * 10000){
				intervals = 0;
				postMessage(meshlessData);
				meshlessData = {};
			}
		});
	});

	postMessage(meshlessData);
	close();
}