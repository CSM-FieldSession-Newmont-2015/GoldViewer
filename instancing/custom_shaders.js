// Here we set up shaders and uniforms that support instanced geometry
//  with the built-in phong material and gpu picking for over
//  2^31 unique cylinders.

establishShaders();

function establishShaders(){
	THREE.ShaderLib["instancing_visible"] = {};
	THREE.ShaderLib["instancing_picking"] = {};

	// Split on void main() to reconstruct with other logic before and after
	var vertexSplit = THREE.ShaderLib['phong'].vertexShader.split("void main() {");
	var fragmentSplit = THREE.ShaderLib['phong'].fragmentShader.split("void main() {");


	// This method returns true of the bitwise location at the given point is true,
	//  if f were to be represented by an integer. Allows us to set custom render flags and
	//  gives more control over the scene.
	var checkBitFloat = [

			"bool checkBit( in float f, in float location){",
			"	float exp = pow(2.0, location);",
			"	bool result = (mod(f, exp * 2.0) >= exp);",
			"	return result;",
			"}"

		].join("\n");

	// The next six variables are used for both the visible and picking materials

	var beforeMainVertexString = [

			"uniform float uniformScale;",
			"uniform float logWidths;",

			"attribute vec3 offset;",
			"attribute float height;",
			"attribute float width;",
			"attribute vec4 quaternion;",


			"attribute vec4 id;",
			"attribute float dynamicBits;",

			"varying vec4 vID;",
			"varying float vDynamicBits;",

			"",
			"vec3 rotate_vector( in vec4 quat, in vec3 vec ) {",
			"	return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz );",
			"}",
			"",

			"",
			checkBitFloat,
			""

		].join("\n");

	var mainVertexString = [

			"void main(){",
			"	float overallScale = uniformScale;"

		].join("\n");

	var afterMainVertexString = [
			
			"if(checkBit(dynamicBits, 0.0)){",
			"	gl_Position = vec4(0.0, 0.0, 0.0, 0.0);",
			"	return;",
			"}",
			"",
			"vec3 newPosition = vec3(logWidths, 1.0, logWidths) * vec3(width, height, width) * position + vec3(1.0-logWidths, 0.0, 1.0-logWidths) * position;",
			"newPosition = newPosition * vec3(overallScale, 1.0, overallScale);",
			"newPosition = rotate_vector( quaternion, newPosition);",
			"newPosition = newPosition + offset;",
			"vDynamicBits = float(dynamicBits);"

		].join("\n\t");

	var beforeMainFragmentString = [

			"varying float vDynamicBits;",
			"uniform float uniformTransparency;",
			"uniform vec3  hoverColor;",
			"",
			checkBitFloat

		].join("\n");

	var mainFragmentString = [

			"void main(){"

		].join("\n");

	var afterMainFragmentString = [
		].join("\n");


	// Reconstructing all of bits

	THREE.ShaderLib["instancing_visible"].vertexShader = [

				vertexSplit[0],
				beforeMainVertexString,
				mainVertexString,

				"if(checkBit(dynamicBits, 3.0)){",
				"	overallScale *= 1.2;",
				"}",

				"if(checkBit(dynamicBits, 4.0)){",
				"	overallScale /= 1.2;",
				"}",

				afterMainVertexString,
				vertexSplit[1].replace(/position/g, "newPosition")

			].join( "\n" );

	THREE.ShaderLib["instancing_visible"].fragmentShader = [
				fragmentSplit[0],
				beforeMainFragmentString,

				"void main(){",

				afterMainFragmentString,

				"vec3 newEmissive = emissive;",

				"float opacity = 1.0;",
				
				"if(checkBit(vDynamicBits, 2.0)){",
				"	newEmissive = diffuse;",
				"}",

				"if(checkBit(vDynamicBits, 3.0)){",
				"	newEmissive = hoverColor;",
				"}",

				"if(checkBit(vDynamicBits, 5.0)){",
				"	opacity = uniformTransparency;",
				"}",

				
				fragmentSplit[1].replace(/emissive/g, "newEmissive").replace(/diffuseColor\.a/g, "opacity")
			].join("\n");

	THREE.ShaderLib["instancing_visible"].uniforms = makeUniforms();


	// Now set up the picking shader
	THREE.ShaderLib["instancing_picking"].vertexShader = [

			vertexSplit[0],
			beforeMainVertexString,

			mainVertexString,

			"	vID = id;",

			afterMainVertexString,
			vertexSplit[1].replace(/position/g, "newPosition")

		].join("\n");

	THREE.ShaderLib["instancing_picking"].fragmentShader = [
			"varying vec4 vID;",

			"varying float vDynamicBits;",

			"void main() {",

			"gl_FragColor = vID;",

			"}"

		].join( "\n" );

	THREE.ShaderLib["instancing_picking"].uniforms = makeUniforms();


	// Set up some material uniforms to make the material aesthetically nice
	//  and provide controls for our shaders
	function makeUniforms(){

		var uniforms = THREE.UniformsUtils.clone(THREE.ShaderLib['phong'].uniforms);

		uniforms.shininess.value = 4.0
		uniforms.refractionRatio.value = 1.0;

		uniforms.diffuse = {
			type: "c",
			value: new THREE.Color(0.3, 0.3, 0.3)
		}

		uniforms.hoverColor = {
			type: "c",
			value: new THREE.Color(1.0, 0.0, 1.0)
		}

		// When set to 1, this uniform will make all cylinders render at 
		//  custom widths. At 0, it will render the cylinders at a constant width.
		//  Midway values will interpolate between the two.
		uniforms.logWidths = {
			type: "f",
			value: 1
		}

		// This uniform will scale all the cylinders larger or smaller
		//  than their initial size
		uniforms.uniformScale = {
			type: "f",
			value: 1
		}

		// This controls how transparent individual cylinders become when individually
		//  selected with bit attributes.
		uniforms.uniformTransparency = {
			type: "f",
			value: 0.7
		}

		return uniforms;
	}
}