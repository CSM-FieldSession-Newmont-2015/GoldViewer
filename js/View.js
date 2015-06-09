// Visual Studio Code uses these to hush warnings about
//   variable names it can't find declared.
/* global dat */
/* global Stats */
/* global THREE */

var colors = {
	axes: 0x5d5d5d,
	background: 0xdedede,
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
	var container             = document.createElement('div');
	var maxDimension          = Math.max(property.box.size.x, property.box.size.y, property.box.size.z);

	var cylinders = [];

	this.start = function () {
		init();
		render();
	}

	function init() {
		setupCamera();
		setupRenderer();
		document.body.appendChild(container);
		setupControls();
		setupStats();
		setupWindowListeners();

		addBoundingBox();
		addAxisLabels();
		addReticle();
		addSurveyLines();
		addLights();
		addMinerals();
	}

	function setupWindowListeners() {
		// Resize the camera when the window is resized.
		window.addEventListener('resize', function resizeEventListener(event) {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();

			cameraOrtho.left= - window.innerWidth / 2;
			cameraOrtho.right=  window.innerWidth / 2;
			cameraOrtho.top= window.innerHeight / 2;
			cameraOrtho.bottom=- window.innerHeight / 2;

			cameraOrtho.updateProjectionMatrix();

			renderer.setSize(window.innerWidth, window.innerHeight);
		});

		document.addEventListener('mousemove', function mousemouseEventListener(event) {
			event.preventDefault();

			mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

			//this will update the mouse position as well as make the tooltipSprite follow the mouse
			tooltipSpriteLocation.x=event.clientX-(window.innerWidth/2);
			tooltipSpriteLocation.y=-event.clientY+(window.innerHeight/2)+20;
		}, false);

		document.addEventListener("mousedown", function mousedownEventListener(event) {
			event.preventDefault();

			if (controls.autoRotate) {
				controls.autoRotate = false;
			}
		})
	}

	function addBoundingBox() {
		var property_boundary = new THREE.Mesh(new THREE.BoxGeometry(property.box.size.x, property.box.size.y, property.box.size.z));
		var box = new THREE.EdgesHelper(property_boundary, colors.axes);
		box.applyMatrix(new THREE.Matrix4().makeTranslation(property.box.center.x, property.box.center.y, property.box.center.z));
		scene.add(box);
	}

	function addReticle() {
		reticle = new THREE.Mesh(
			new THREE.SphereGeometry(
				maxDimension / 1000, // Radius
				// These two values determine how smooth the sphere looks.
				20, // widthSegments
				20  // heightSegments
				),
			new THREE.MeshLambertMaterial({
				color: colors.black,
				transparent: true,
				opacity: 0.6 // Chosen through several trials of intense rigor.
			}));
		reticle.position.x = controls.target.x;
		reticle.position.y = controls.target.y;
		reticle.position.z = controls.target.z;
		scene.add(reticle);
	}

	function addMinerals() {
		property.analytes.forEach(function forEachAnalytes(analyte) {
			var color = new THREE.Color(parseInt(analyte.color,16));
			var list = [];

			var material = new THREE.MeshBasicMaterial({ color: colors.pink });

			property.holes.forEach(function forEachHole(hole) {
				hole.minerals.forEach(function forEachMineral(mineral) {
					mineral.intervals.forEach(function forEachInterval(interval) {
						cylinder = cylinderMesh(interval.path.start, interval.path.end, Math.PI);
						list.push(cylinder);
						var cylinderObject = new THREE.Mesh(cylinder, material);
						cylinders.push(cylinderObject);
						cylinderObject.oreConcentration=interval.value;
						cylinderObject.oreType=mineral.type;
						cylinderObject.holeId=hole.id;

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

		var matrix = new THREE.Matrix4();
		transform.makeTranslation((pointY.x + pointX.x) / 2, (pointY.y + pointX.y) / 2, (pointY.z + pointX.z) / 2);

		orientation.lookAt(pointX, pointY, new THREE.Object3D().up);
		orientation.multiply(new THREE.Matrix4().set
			(1, 0, 0, 0,
			0, 0, 1, 0,
			0, -1, 0, 0,
			0, 0, 0, 1));
		var edgeGeometry = new THREE.CylinderGeometry(width, width, direction.length(), 6, 1);
		matrix.multiplyMatrices( transform,orientation );
		edgeGeometry.applyMatrix(matrix);
		return edgeGeometry;
	}

	function makeCylinderMesh(name, color, cylinders) {
		var vertices = [];
		var faces = [];

		cylinders.forEach(function cylindersForEach(cylinder) {
			var faceOffset = vertices.length/3;

			cylinder.vertices.forEach(function vertsForEach(vert) {
				vertices.push(vert.x, vert.y, vert.z);
			});

			cylinder.faces.forEach(function facesForEach(face) {
				faces.push(faceOffset + face.a, faceOffset + face.b, faceOffset + face.c);
			});
		});

		vertices = new Float32Array(vertices);
		// We enable an extension which allows us to index faces with 32-bit integers,
		//   instead of 16-bit shorts.
		faces = new Uint32Array(faces);

		var geometry = new THREE.BufferGeometry();
		// Both of these attributes are defined by three.js.
		geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
		geometry.addAttribute('index', new THREE.BufferAttribute(faces, 3));
		geometry.computeVertexNormals();

		var material = new THREE.MeshPhongMaterial({
			color: color,
			shading: THREE.FlatShading
		});

		return new THREE.Mesh(geometry, material);
	}

	function addSurveyLines() {
		var material = new THREE.LineBasicMaterial({color:colors.black});
		property.holes.forEach(function holesForEach(hole) {
			geometry = new THREE.Geometry();
			hole.surveyPoints.forEach(function pointsForEach(point) {
				geometry.vertices.push(point);
			});

			scene.add(new THREE.Line(geometry, material));
		});
	}

	function addAxisLabels() {
		// Need this function for creating multi-line text sprites.
		CanvasRenderingContext2D.prototype.wrapText = function wrapText(text, x, y, maxWidth, lineHeight) {
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
		function formatKm(num) {
			num = parseFloat(Math.floor(num).toPrecision(2));
			return (num > 1000 ? (num/1000) + ' k' : num) + "m";
		};

		function makeLabel(name, x, y, z) {
			var sprite = makeTextSprite(name);
			sprite.position.set(x, y, z);
			return sprite;
		};

		// Our box is offset from the origin.
		var base = property.box.center.z - property.box.size.z / 2;

		// Force a scope.
		(function () {
			// Lay out the X-axis labels. Ensure they are at least a minimum distance apart.
			// This minimum distance is set in makeTextSprite, with the "sprite.scale.set(*)" line.
			var markerDistance = Math.max(property.box.size.x / 5 - 1, maxDimension/20);
			for (var x = markerDistance; x < property.box.size.x; x += markerDistance) {
				scene.add(makeLabel(formatKm(x), x, 0, base));
			}
			// Write out the axis name a littlebit after the last label.
			x -= markerDistance / 2;
			scene.add(makeLabel("X", x, 0, base));
		})();

		(function () {
			// Lay out the Y-axis labels. Ensure they are at least a minimum distance apart.
			// This minimum distance is set in makeTextSprite, with the "sprite.scale.set(*)" line.
			var markerDistance = Math.max(property.box.size.y / 5 - 1, maxDimension/20);
			for (var y = markerDistance; y < property.box.size.y; y += markerDistance) {
				scene.add(makeLabel(formatKm(y), 0, y, base));
			}
			// Write out the axis name a littlebit after the last label.
			y -= markerDistance / 2;
			scene.add(makeLabel("Y", 0, y, base));
		})();

		(function () {
			// Lay out the Z-axis labels. Ensure they are at least a minimum distance apart.
			// This minimum distance is set in makeTextSprite, with the "sprite.scale.set(*)" line.
			var markerDistance = Math.max(property.box.size.z / 5 - 1, maxDimension/20);
			for (var z = markerDistance; z < property.box.size.z; z += markerDistance) {
				scene.add(makeLabel(formatKm(z), 0, 0, z + base));
			}
			// Write out the axis name a littlebit after the last label.
			z -= markerDistance / 2;
			scene.add(makeLabel("Z", 0, 0, z + base));
		})();
	}

	function addLights() {
		var ambientLight = new THREE.AmbientLight(colors.soft_white);
		scene.add(ambientLight);

		var light = new THREE.DirectionalLight(0x020202, 10.0);
		light.position.set(0, 0, 3.0 * property.box.size.z);
		light.castShadows = true;
		light.shadowDarkness = 0.5;
		scene.add(light);
	}

	function render() {
		requestAnimationFrame(render);
		controls.update();

		stats.update();

		camera.updateMatrixWorld();

		// TODO: Only do this when the mouse is clicked.
		//checkMouseIntercept();

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
				tooltipSprite = makeTextSprite(intersected.holeId+"\n"+intersected.oreType+"\n"+intersected.oreConcentration+" g/ton", {fontsize: 18, size: 256}); //Create a basic tooltip display sprite TODO: Make tooltip display info about current drillhole
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
		camera.position.set(
			1.5 * maxDimension,
			1.5 * maxDimension,
			1.5 * maxDimension + property.box.center.z - 0.5 * property.box.size.z);
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

		// Load GL stuff.
		gl = renderer.context;
		if (null === gl.getExtension("OES_element_index_uint")) {
			console.error(
				"Could not to load OES_element_index_uint. Is it supported?\n"
				+ "Note, some vertices may not render.");
			var msg = [];
			msg.push("Supported extensions:");
			gl.getSupportedExtensions().forEach(function (ext) {
				msg.push("\t" + ext);
			});
			console.debug(msg.join('\n'));
		}
	}

	function setupControls() {
		if (camera === null) {
			console.error("Initialize camera before controls, Fool.");
			return;
		}
		controls = new THREE.OrbitControls(camera);
		controls.zoomSpeed = 3.0;
		controls.minDistance = maxDimension / 100;
		controls.maxDistance = maxDimension * 2;
		controls.target = property.box.center;
		controls.autoRotate = true;
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
