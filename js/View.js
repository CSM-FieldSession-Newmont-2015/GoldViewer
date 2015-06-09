// Visual Studio Code uses these to hush warnings about
//   variable names it can't find declared.
/* global dat */
/* global Stats */
/* global THREE */

var colors = {
	axes: 0x5d5d5d,
	background: 0xeeeeee,
	black: 0x000000,
	pink: 0xff00ff,
	soft_white: 0x404040,
	terrain_frame: 0x009900,
	white: 0xffffff,
};


function View(property) {

	var camera                = null;
	var cameraOrtho           = null;
	var controls              = null;
	var intersected           = null;
	var renderer              = null;
	var reticle               = null;
	var stats                 = null;
	var tooltipSprite         = null;
	var scene                 = new THREE.Scene();
	var sceneOrtho            = new THREE.Scene();
	var mouse                 = new THREE.Vector2();
	var tooltipSpriteLocation = new THREE.Vector2();
	var raycaster             = new THREE.Raycaster();
	var container             = $('#viewFrame');
	var maxDimension          = Math.max(property.box.size.x, property.box.size.y, property.box.size.z);

	var cylinders=[];

	this.start = function () {
		init();
		render();
	}

	function init() {
	    container.contents().find('body').html('<div></div>');
	    container = container.contents().find('div:first').get(0);
	    setupCamera();
		setupRenderer();
		setupControls();
		setupStats();

		addBoundingBox();
		addAxisLabels();
		addReticle();
		addSurveyLines();
		addMinerals();
		addTerrain(scene, property);
	}

	function setupWindowListeners() {
		// Resize the camera when the window is resized.
		window.addEventListener('resize', function (event) {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();

			cameraOrtho.left= - window.innerWidth / 2;
			cameraOrtho.right=  window.innerWidth / 2;
			cameraOrtho.top= window.innerHeight / 2;
			cameraOrtho.bottom=- window.innerHeight / 2;

			cameraOrtho.updateProjectionMatrix();

			renderer.setSize(window.innerWidth, window.innerHeight);
		});

		document.addEventListener('mousemove', function (event) {
			event.preventDefault();

			mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

			//this will update the mouse position as well as make the tooltipSprite follow the mouse
			tooltipSpriteLocation.x=event.clientX-(window.innerWidth/2);
			tooltipSpriteLocation.y=-event.clientY+(window.innerHeight/2)+20;
		}, false);
	}

	function addBoundingBox() {
		var property_boundary = new THREE.Mesh(new THREE.BoxGeometry(property.box.size.x, property.box.size.y, property.box.size.z));
		var box = new THREE.EdgesHelper(property_boundary, colors.axes);
		box.applyMatrix(new THREE.Matrix4().makeTranslation(property.box.center.x, property.box.center.y, property.box.center.z));
		scene.add(box);
	}

	function addRandomTerrain() {
		var maxX = property.box.size.x;
		var maxY = property.box.size.y;

		// Draw 100 lines on each side.
		var dx = maxX / 100.0;
		var dy = maxY / 100.0;
		var minZ = property.box.center.z + property.box.size.z/2;
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
	}

	function addReticle() {
		reticle = new THREE.Mesh(
			new THREE.SphereGeometry(maxDimension / 1000),
			new THREE.MeshLambertMaterial({ color: colors.black }));
		reticle.position.x = controls.target.x;
		reticle.position.y = controls.target.y;
		reticle.position.z = controls.target.z;
		scene.add(reticle);
	}

	function addMinerals() {
		property.analytes.forEach(function (analyte) {
			var color = new THREE.Color(parseInt(analyte.color,16));
			var list = [];

			var material = new THREE.MeshBasicMaterial({ color: colors.pink });

			property.holes.forEach(function (hole) {
				hole.minerals.forEach(function (mineral) {
					mineral.intervals.forEach(function (interval) {

						cylinder = cylinderMesh(interval.path.start, interval.path.end, maxDimension/500);
						list.push(cylinder);
						var cylinderObject = new THREE.Mesh(cylinder, material);
						cylinders.push(cylinderObject);
						cylinderObject.oreConcentration=interval.value;
						cylinderObject.oreType=mineral.type;

						scene.add(cylinderObject);
						cylinderObject.visible=false;
					});
				});
			});

			var mesh = makeCylinderMesh("Gold", color, list);
			scene.add(mesh);
		});
	}

	function cylinderMesh(pointX, pointY, width) {
		var direction = new THREE.Vector3().subVectors(pointY, pointX);
		var orientation = new THREE.Matrix4();

		var transform = new THREE.Matrix4();
		transform.makeTranslation((pointY.x + pointX.x) / 2, (pointY.y + pointX.y) / 2, (pointY.z + pointX.z) / 2);

		orientation.lookAt(pointX, pointY, new THREE.Object3D().up);
		orientation.multiply(new THREE.Matrix4().set
			(1, 0, 0, 0,
			0, 0, 1, 0,
			0, -1, 0, 0,
			0, 0, 0, 1));
		var edgeGeometry = new THREE.CylinderGeometry(width, width, direction.length(), 8, 1);
		edgeGeometry.applyMatrix(orientation);
		edgeGeometry.applyMatrix(transform);
		return edgeGeometry;
	}

	function makeCylinderMesh(name, color, cylinders) {
		var vertices = [];
		var faces = [];

		// Make a couple cylinders per mineral type.
		cylinders.forEach(function (cylinder) {
			var faceOffset = vertices.length/3;

			cylinder.vertices.forEach(function (vert) {
				vertices.push(vert.x, vert.y, vert.z);
			});

			cylinder.faces.forEach(function (face) {
				faces.push(faceOffset + face.a, faceOffset + face.b, faceOffset + face.c);
			});
		});

		vertices = new Float32Array(vertices);
		faces = new Uint32Array(faces);

		var geometry = new THREE.BufferGeometry();
		geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
		geometry.addAttribute('index', new THREE.BufferAttribute(faces, 3));
		geometry.computeVertexNormals();

		var material = new THREE.MeshBasicMaterial({
			color: color
		});

		// Buffer sizes are limited by uint16s, so we need to break up the buffers into
		//   multiple draw calls when the buffer is too long.
		var maxBufferLength = (1 << 16) - 1;
		if (vertices.length >= maxBufferLength) {
			for (var i = 0; i < vertices.length / maxBufferLength; i += 1) {
				geometry.addDrawCall(i*maxBufferLength, maxBufferLength);
			}
		}

		return new THREE.Mesh(geometry, material);
	}

	function addSurveyLines() {
		var material = new THREE.LineBasicMaterial({color:colors.black});
		property.holes.forEach(function (hole) {
			geometry = new THREE.Geometry();
			hole.surveyPoints.forEach(function (point) {
				geometry.vertices.push(point);
			});

			scene.add(new THREE.Line(geometry, material));
		});
	}

	function addAxisLabels() {
		// Need this function for creating multi-line text sprites.
		CanvasRenderingContext2D.prototype.wrapText = function (text, x, y, maxWidth, lineHeight) {
			var lines = text.split("\n");

			for (var i = 0; i < lines.length; i++) {
				var words = lines[i].split(' ');
				var line = '';

				for (var n = 0; n < words.length; n++) {
					var testLine = line + words[n] + ' ';
					var metrics = this.measureText(testLine);
					var testWidth = metrics.width;

					if (testWidth > maxWidth && n > 0) {
						this.fillText(line, x, y);
						line = words[n] + ' ';
						y += lineHeight;
					} else {
						line = testLine;
					}
				}

				this.fillText(line, x, y);
				y += lineHeight;
			}
		};

		// Formats numbers with a km or m prefix.
		var kFormatter = function (num) {
			return (num > 999 ? (num/1000) + ' k' : num) + "m";
		};

		var makeLabel = function (name, x, y, z) {
			var sprite = makeTextSprite(name);
			sprite.position.set(x, y, z);
			return sprite;
		};

		scene.add(makeLabel("X", 1.1 * property.box.size.x, 0, 0));
		scene.add(makeLabel("Y", 0, 1.1 * property.box.size.y, 0));
		scene.add(makeLabel("Z", 0, 0, 1.1 * property.box.size.z));

		var i = 0;
		var positions = new THREE.Vector3();
		var labelsPerAxis = 5;
		var positionsDelta = property.box.size.clone().divideScalar(labelsPerAxis);
		// Don't draw one at 0m.
		positions.add(positionsDelta);

		for (; i < labelsPerAxis; i += 1, positions.add(positionsDelta)) {
			var x = parseFloat(Math.floor(positions.x).toPrecision(2));
			var y = parseFloat(Math.floor(positions.y).toPrecision(2))
;			var z = parseFloat(Math.floor(positions.z).toPrecision(2));
			scene.add(makeLabel(kFormatter(x), x, 0, 0));
			scene.add(makeLabel(kFormatter(y), 0, y, 0));
			scene.add(makeLabel(kFormatter(z), 0, 0, z));
		}
	}

	function render() {
		requestAnimationFrame(render);
		controls.update();

		stats.update();

		camera.updateMatrixWorld();

		checkMouseIntercept();

		reticle.position.x = controls.target.x;
		reticle.position.y = controls.target.y;
		reticle.position.z = controls.target.z;

		renderer.clear();
		renderer.render(scene,camera);
		renderer.clearDepth();
		renderer.render(sceneOrtho,cameraOrtho);
	}

	function makeTextSprite(message, parameters) {
		if (parameters === undefined) parameters = {};
		var fontface  = parameters.hasOwnProperty("fontface") ? parameters["fontface"] : "Arial";
		var fontsize  = parameters.hasOwnProperty("fontsize") ? parameters["fontsize"] : 80;
		var size      = parameters.hasOwnProperty("size") ? parameters["size"] : 512;
		var textColor = parameters.hasOwnProperty("textColor") ?
			parameters["textColor"] : { r: 0, g: 0, b: 0, a: 1.0 };

		var canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		var context = canvas.getContext('2d');
		context.font = "Bold " + fontsize + "px " + fontface;

		context.textAlign = 'left';
		context.fillStyle = "rgba(" + textColor.r + ", " + textColor.g + ", " + textColor.b + ", 1.0)";
		context.wrapText(message, size / 2, size / 2,10000,fontsize);

		var texture = new THREE.Texture(canvas);
		texture.needsUpdate = true;

		var spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
		var sprite = new THREE.Sprite(spriteMaterial);
		sprite.scale.set(maxDimension/10, maxDimension/10,maxDimension/10);
		return sprite;
	}

	function checkMouseIntercept() {
		raycaster.setFromCamera(mouse, camera);
		var intersects = raycaster.intersectObjects(cylinders);

		if (intersects.length > 0) {
			if (intersected != intersects[0].object) {
				if (intersected) {
					var material = intersected.material;
					if (material.emissive) {
						material.emissive.setHex(intersected.currentHex);
					} else {
						material.color.setHex(intersected.currentHex);
					}
				}
				intersected = intersects[0].object;
				//set sprite to be in front of the orthographic camera so it is visible
				sceneOrtho.remove(tooltipSprite);
				tooltipSprite = makeTextSprite(intersected.oreType+"\n"+intersected.oreConcentration+" g/ton", {fontsize: 18, size: 256}); //Create a basic tooltip display sprite TODO: Make tooltip display info about current drillhole
				tooltipSprite.scale.set(250,250,1);
				tooltipSprite.position.z=0;
				tooltipSprite.position.x=tooltipSpriteLocation.x;
				tooltipSprite.position.y=tooltipSpriteLocation.y;
				sceneOrtho.add(tooltipSprite);

				material = intersected.material;
				if (material.emissive) {
					intersected.currentHex = intersected.material.emissive.getHex();
					material.emissive.setHex(0xff0000);
				}
				else {
					intersected.currentHex = material.color.getHex();
					material.color.setHex(0xff0000);
				}

			}

		} else {
			if (intersected) {
				material = intersected.material;

				if (material.emissive) {
					material.emissive.setHex(intersected.currentHex);
				} else {
					material.color.setHex(intersected.currentHex);
				}
			}
			//set sprite to be behind the ortographic camer so it is not visible
			sceneOrtho.remove(tooltipSprite);
			intersected = null;
		}
	}

	function setupCamera() {
		//Sets up the camera object for the 3d scene
		camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, maxDimension*700);
		camera.up.set(0,0,1);
		camera.position.set(Math.max(maxDimension/5, property.box.size.x*1.2), Math.max(maxDimension/5,property.box.size.y*1.2), Math.max(maxDimension/5, property.box.size.z*1.2));
		camera.lookAt(property.box.center);

		//Sets up the 2d orthographic camera for tooltips
		cameraOrtho = new THREE.OrthographicCamera( window.innerWidth/-2, window.innerWidth/2, window.innerHeight/2, window.innerHeight/-2, 1, 1000);
		cameraOrtho.position.z = 1;
		cameraOrtho.position.x = 0;
		cameraOrtho.position.y = 0;
	}

	function setupRenderer() {
		renderer = new THREE.WebGLRenderer({antialias: false});
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setClearColor(colors.background, 1);
		renderer.sortObjects = false;
		renderer.autoClear=false;
		container.appendChild(renderer.domElement);
	}

	function setupControls() {
		if (camera === null) {
			console.error("Initialize camera before controls, Fool.");
			return;
		}
		controls = new THREE.OrbitControls(camera, $('#viewFrame').contents().find('div').get(0));
		controls.zoomSpeed = 3.0;
		controls.minDistance = maxDimension / 100;
		controls.maxDistance = maxDimension * 2;
		controls.target = property.box.center;
	}

	function setupStats() {
		if (container === null) {
			console.error("Please initialize the container before Stats, Fool.");
			return;
		}
		stats = new Stats();
		stats.domElement.style.position = 'absolute';
		stats.domElement.style.right = '0px';
		stats.domElement.style.bottom = '0px';
		container.appendChild(stats.domElement);
	}
}
