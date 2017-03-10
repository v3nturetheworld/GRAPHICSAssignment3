// Vertex shader for Sphere

// Per-vertex variables
attribute vec4 vPosition;
attribute vec4 vNormal;
attribute vec4 vSpecular;
attribute float vShininess;
attribute vec2 vTexCoord;

// Light information.  Four lights are supported.  Light positions are
// stored in a mat4, one light position per row. If the last (w) coordinate
// of the light position is 0, it is treated as a directional light source.
uniform mat4 vLightPos;  // light pos in viewing coord

// Light on/off information for the 4 light sources.  For vLightPos[i],
// vLightOn is non-zero to use the light, 0 to ignore it.
uniform vec4 vLightOn;

// Transformations
uniform mat4 vModelViewMatrix;
uniform mat4 vProjectionMatrix;

// Interpolated output values for fragment shader
varying vec4 fSpecular;         // specular reflectivity
varying float fShininess;       // shininess coeff (beta)
varying vec4 fNormal;           // surface normal vector
varying vec2 fTexCoord;
varying vec4 fPosition;

// The light direction and halfway vectors have one per light source.  We
// pack these into mat4, one per row
varying mat4 fLightHalfway;     // halfway vector
varying mat4 fLightDir;         // light direction vector

void main()
{
  vec4 normal = vec4(vNormal.xyz, 0.0);  // make sure last coord is 0

  // Transform the position and normal vector to viewing coord
  vec4 position_in_vc = vModelViewMatrix * vPosition;
  gl_Position = vProjectionMatrix * position_in_vc;
  fNormal = normalize(vModelViewMatrix * normal);

  // Compute vector from point to each light source
  for (int i = 0; i < 4; ++i) {
    if (vLightOn[i] != 0.0) {
      vec3 to_light;
      if (vLightPos[i].w != 0.0) {  // if point source
        to_light = normalize(vLightPos[i].xyz - position_in_vc.xyz);
      } else {
        to_light = normalize(vLightPos[i].xyz);  // if directional source
      }

      // Compute halfway vector - this will be interpolated between vertices.
      // Since we're in viewing coords, the vector to the eye is just the vector
      // to the origin.
      fLightHalfway[i] = vec4(normalize(to_light + normalize(-position_in_vc.xyz)), 0.0);
      fLightDir[i] = vec4(to_light, 0.0);
    }
  }
  fPosition = gl_Position;
  fSpecular = vSpecular;
  fShininess = vShininess;
  fTexCoord = vTexCoord;
}