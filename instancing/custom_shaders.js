var GV_ShaderLib = {};

// Here we're setting up shaders strings that support instanced geometry
// and the built-in phong shaders for cylinders

var split = THREE.ShaderLib['phong'].vertexShader.split("void main() {");

var beforeMainVertexString = [

	"uniform float uniformScale;",
	"uniform float logWidths;",

	"attribute vec3 offset;",
	"attribute vec3 scale;",
	"attribute vec4 quaternion;\n",

	"varying vec4 vID;",
	"attribute vec4 id;",

	"vec3 rotate_vector( vec4 quat, vec3 vec ) {",
	"	return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz );\n",
	"}"

].join("\n");

var afterMainVertexString = [
			
	"vec3 newPosition = vec3(logWidths, logWidths, logWidths) * scale * position + vec3(1.0-logWidths, scale.y * (1.0 - logWidths), 1.0-logWidths) * position;",
	"newPosition = newPosition * vec3(uniformScale, 1.0, uniformScale);",
	"newPosition = rotate_vector( quaternion, newPosition);",
	"newPosition = newPosition + offset;\n",
	"vID = id;"

].join("\n");

GV_ShaderLib.phongVertexShader = [

			split[0],
			beforeMainVertexString,

			"void main() {",

			afterMainVertexString,
			split[1].replace(/position/g, "newPosition")

		].join( "\n" );

// This is the fragment shader used for picking. Allows us
// to identify over 2^31 unique cylinders on the screen

GV_ShaderLib.idVertexShader = [

		"attribute vec3 offset;",
		"attribute vec3 scale;",
		"attribute vec4 quaternion;\n",

		"attribute vec4 id;",
		"varying vec4 vID;\n",

		"vec3 rotate_vector( vec4 quat, vec3 vec ) {",
		"	return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz );",
		"}\n",

		"void main() {",

		"	vID = id;",
		"	vec3 newPosition = scale * position;",
		"	newPosition = rotate_vector( quaternion, newPosition);",
		"	newPosition = newPosition + offset;",
		"	gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);",

		"}"
	].join("\n");

GV_ShaderLib.idFragmentShader = [
		"varying vec4 vID;",

		"void main() {",

		"	gl_FragColor = vID;",

		"}"

	].join( "\n" );