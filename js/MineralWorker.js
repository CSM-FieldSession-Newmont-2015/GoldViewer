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
	holes.forEach(function(hole){

		hole["downholeDataValues"].forEach(function(mineral){
			if(minerals[mineral["name"]] === undefined){
				minerals[mineral["name"]] = [];
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
				minerals[mineral["name"]].push(data);
			});
		});
	});
}