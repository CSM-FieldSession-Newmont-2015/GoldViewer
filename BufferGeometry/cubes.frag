precision highp float;

#define MAX_DIR_LIGHTS 0
#define MAX_POINT_LIGHTS 0
#define MAX_SPOT_LIGHTS 0
#define MAX_HEMI_LIGHTS 0
#define MAX_SHADOWS 0

#define USE_COLOR

uniform mat4 viewMatrix;
uniform vec3 cameraPosition;

varying vec3 vViewPosition;
varying vec3 vNormal;

void main() {

	vec3 normal = normalize( vNormal );

	// directional light

	const vec3 lightCol1 = vec3( 0.5, 0.8, 1.0 );
	const vec3 lightDir1 = vec3( 0.0, -1.0, 0.0 );
	const float intensity1 = 0.5;

	vec4 lDirection1 = viewMatrix * vec4( lightDir1, 0.0 );
	vec3 lightVec1 = normalize( lDirection1.xyz );

	// point light

	const vec3 lightPos2 = vec3( 0.0, 0.0, 0.0 );
	const vec3 lightCol2 = vec3( 1.0, 0.5, 0.0 );
	const float maxDistance2 = 2000.0;
	const float intensity2 = 1.5;

	vec4 lPosition = viewMatrix * vec4( lightPos2, 1.0 );
	vec3 lVector = lPosition.xyz + vViewPosition.xyz;

	vec3 lightVec2 = normalize( lVector );
	float lDistance2 = 1.0 - min( ( length( lVector ) / maxDistance2 ), 1.0 );

	// point light

	const vec3 lightPos3 = vec3( 0.0, -1000.0, 1000.0 );
	const vec3 lightCol3 = vec3( 1.0, 0.1, 0.0 );
	const float maxDistance3 = 3000.0;
	const float intensity3 = 1.0;

	vec4 lPosition3 = viewMatrix * vec4( lightPos3, 1.0 );
	vec3 lVector3 = lPosition3.xyz + vViewPosition.xyz;

	vec3 lightVec3 = normalize( lVector3 );
	float lDistance3 = 1.0 - min( ( length( lVector3 ) / maxDistance3 ), 1.0 );

	//

	float diffuse1 = intensity1 * max( dot( normal, lightVec1 ), 0.0 );
	float diffuse2 = intensity2 * max( dot( normal, lightVec2 ), 0.0 ) * lDistance2;
	float diffuse3 = intensity2 * max( dot( normal, lightVec3 ), 0.0 ) * lDistance3;

	gl_FragColor = vec4( diffuse1 * lightCol1 + diffuse2 * lightCol2 + diffuse3 * lightCol3, 1.0 );

}


