/**
 * Sphere - tesellated sphere of radius 1
 * 
 * COMP3801 Intro to Computer Graphics
 *   
 * @author Mike Goss (mikegoss@cs.du.edu)
 */

"use strict";

Sphere.prototype = Object.create(ModelInterface.prototype);

/**
 * Constructor - Initialize object data
 * 
 * @param modelName - string for modelName field
 * @param gl - WebGL context for rendering
 * @param constructorParams - [0] is number of recursive tesselations
 */
function Sphere(modelName, gl, constructorParams, texture) {
  ModelInterface.call(this, modelName, gl);
  this.tesselationLevels = constructorParams[0];
  this.showTexture = false;

  // Create shader program
  var shaderProgram = this.shaderProgram = 
          initShaders(gl, "SphereVShaderL7.glsl", "SphereFShaderL7.glsl");
  gl.useProgram(shaderProgram);

  // Set up the buffers for the vertex coords, etc.
  this.BuildSphere();

  // Vertex shader uniform locations
  this.vLightPos = gl.getUniformLocation(shaderProgram, "vLightPos");
  this.vLightOn = gl.getUniformLocation(shaderProgram, "vLightOn");
  this.vModelViewMatrix = gl.getUniformLocation(shaderProgram, "vModelViewMatrix");
  this.vProjectionMatrix = gl.getUniformLocation(shaderProgram, "vProjectionMatrix");
  
  // Fragment shader uniform locations
  this.fLightDiffuse = gl.getUniformLocation(shaderProgram, "fLightDiffuse");
  this.fLightAmbient = gl.getUniformLocation(shaderProgram, "fLightAmbient");
  this.fLightSpecular = gl.getUniformLocation(shaderProgram, "fLightSpecular");
  this.fLightOn = gl.getUniformLocation(shaderProgram, "fLightOn");
  //this.fShowTexture = gl.getAttribLocation(shaderProgram, "fShowTexture");
  this.fTexSampler = gl.getUniformLocation(shaderProgram, "fTexSampler");
  console.log("TExture stuff: " + modelName);
  this.InitTexture(modelName + ".jpg");
};

// Initial 3D vertices of octahedron approximating
// the sphere
Sphere.prototype.initialCoords = [
  vec3(0.0, 0.0, 1.0),
  vec3(1.0, 0.0, 0.0),
  vec3(0.0, 1.0, 0.0),
  vec3(0.0, 0.0, 1.0),
  vec3(0.0, 1.0, 0.0),
  vec3(-1.0, 0.0, 0.0),
  vec3(0.0, 0.0, 1.0),
  vec3(-1.0, 0.0, 0.0),
  vec3(0.0, -1.0, 0.0),
  vec3(0.0, 0.0, 1.0),
  vec3(0.0, -1.0, 0.0),
  vec3(1.0, 0.0, 0.0),
  vec3(0.0, 0.0, -1.0),
  vec3(0.0, 1.0, 0.0),
  vec3(1.0, 0.0, 0.0),
  vec3(0.0, 0.0, -1.0),
  vec3(-1.0, 0.0, 0.0),
  vec3(0.0, 1.0, 0.0),
  vec3(0.0, 0.0, -1.0),
  vec3(0.0, -1.0, 0.0),
  vec3(-1.0, 0.0, 0.0),
  vec3(0.0, 0.0, -1.0),
  vec3(1.0, 0.0, 0.0),
  vec3(0.0, -1.0, 0.0)
];

/**
 * Split a triangle face into four faces
 * 
 * @param src - array of vec3 from which to pull next source triangle
 * @param srcPos - index in source array of next triangle
 * @param dest - array of vec3 to which to append next 4 destination triangles
 */
Sphere.prototype.SplitTriangle = function(src, srcPos, dest) {
  // Read source triangle
  var vtx = [];
  vtx.push(src[srcPos]);
  vtx.push(src[srcPos + 1]);
  vtx.push(src[srcPos + 2]);

  // Calculate and normalize edge midpoints
  var mid = [];
  for (var edge = 0; edge < 3; ++edge) {
    mid.push(normalize(mix(vtx[edge], vtx[(edge+1)%3], 0.5)));
  }

  // Generate four new triangles
  dest.push(mid[0]); dest.push(mid[1]); dest.push(mid[2]);
  dest.push(vtx[0]); dest.push(mid[0]); dest.push(mid[2]);
  dest.push(vtx[1]); dest.push(mid[1]); dest.push(mid[0]);
  dest.push(vtx[2]); dest.push(mid[2]); dest.push(mid[1]);
};

/**
* Generate a tessellated sphere
* 
*/
Sphere.prototype.BuildSphere = function() {
  var gl = this.gl;
  var vertexCoords = this.initialCoords;
  var numVertices = vertexCoords.length;

  // Tessellate the sphere
  for (var level = 0; level < this.tesselationLevels; ++level) {
    var nextVertexCoords = [];
    for (var v = 0; v < numVertices; v += 3) {
      this.SplitTriangle(vertexCoords, v, nextVertexCoords);
    }
    vertexCoords = nextVertexCoords;
    numVertices = vertexCoords.length;
  } 
  var vertexTexCoords = [];
  for(var i = 0; i < vertexCoords.length; ++i)
  {
      var v = vertexCoords[i];
      vertexTexCoords.push(this.convertToSpherical(v[0],v[1],v[2]));
  }
  this.numVertices = numVertices;

  // Create buffer for vertex coords
  var flattenedVertexCoords = flatten(vertexCoords);
  this.vertexCoordBuffer = gl.createBuffer();
  gl.bindBuffer( gl.ARRAY_BUFFER, this.vertexCoordBuffer );
  gl.bufferData( gl.ARRAY_BUFFER, flattenedVertexCoords, gl.STATIC_DRAW );

  // Initialize the vertex position attribute from the vertex shader
  this.vPosition = gl.getAttribLocation(this.shaderProgram, "vPosition");
  gl.enableVertexAttribArray(this.vPosition);

  // Create buffer for vertex normals
  this.normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flattenedVertexCoords, gl.STATIC_DRAW);

  // Initialize the normal position attribute from the vertex shader
  this.vNormal = gl.getAttribLocation(this.shaderProgram, "vNormal");
  gl.enableVertexAttribArray(this.vNormal);
  
  
  // Build reflectance values
  var vertexSpecularReflectance = [];
  var vertexShininess = [];
  
  for (var i = 0; i < numVertices; ++i) {
    vertexSpecularReflectance.push(vec3(1.0, 1.0, 1.0));
    vertexShininess.push(35.0);
  }

  // Put reflectance values in buffers
  this.vertexSpecularBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexSpecularBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(vertexSpecularReflectance), gl.STATIC_DRAW);
  this.vSpecular = gl.getAttribLocation(this.shaderProgram, "vSpecular");
  gl.enableVertexAttribArray(this.vSpecular);
  
  this.hasTexCoords = vertexTexCoords.length > 0;
  if(this.hasTexCoords)
  {
      this.vertexTexCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexTexCoordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, flatten(vertexTexCoords), gl.STATIC_DRAW);
      this.vTexCoord = gl.getAttribLocation(this.shaderProgram, "vTexCoord");
      console.log("vTexCoord: " + this.vTexCoord);
      gl.enableVertexAttribArray(this.vTexCoord);
  }

  this.vertexShininessBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexShininessBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(vertexShininess), gl.STATIC_DRAW);
  console.log("Test");
  this.vShininess = gl.getAttribLocation(this.shaderProgram, "vShininess");
  gl.enableVertexAttribArray(this.vShininess);
};
Sphere.prototype.convertToSpherical = function(x,y,z)
{
    var t = (Math.asin(z) / Math.PI) + 0.5;
    var s = 0.0;
    if (z > -1.0 && z < 1.0) {
        s = (Math.atan2(y, x) / Math.PI) * 0.5 + 0.5;
    }
    return vec2(s,t);
}
/**
 * Redraw - called from window redraw callback to clear and redraw window
 * 
 * @param matrixStack the current MatrixStack object
 * @param projectionMatrix the current projection matrix (mat4)
 * @param lightPositions array of vec4 light positions in viewing coords
 * @param diffuseIntensities array of vec3 light source diffuse intensities
 * @param ambientIntensities array of vec3 light source ambient intensities
 * @param specularIntensities array of vec3 light source ambient intensities
 * @param showTexture - true to show textures (if defined for model)
 */
Sphere.prototype.Redraw = function(matrixStack, projectionMatrix, lightPositions,
    diffuseIntensities, ambientIntensities, specularIntensities, showTexture) {
  var gl = this.gl;

  // Bind our shader program
  gl.useProgram(this.shaderProgram);
  
  // Turn on backface culling (save previous setting)
  var prevCull = gl.isEnabled(gl.CULL_FACE);
  if (!prevCull) gl.enable(gl.CULL_FACE);

  // Pack light information into mat4 arrays (we set the matrix attribute as
  // false so that flatten won't transpose).
  var lightPosMat = mat4(0);
  lightPosMat.matrix = false;
  var lightDiffuseMat = mat4(0);
  lightDiffuseMat.matrix = false;
  var lightAmbientMat = mat4(0);
  lightAmbientMat.matrix = false;
  var lightSpecularMat = mat4(0);
  lightSpecularMat.matrix = false;
  var lightOn = vec4(0, 0, 0, 0);
  
  for (var i = 0; i < 4; ++i) {
    if (i < lightPositions.length) {
      lightPosMat[i] = vec4(lightPositions[i]);
      lightAmbientMat[i] = vec4(ambientIntensities[i]);
      lightDiffuseMat[i] = vec4(diffuseIntensities[i]);
      lightSpecularMat[i] = vec4(specularIntensities[i]);
      lightOn[i] = 1;
    }
  }
  
  // Send uniform values to shaders
  gl.uniformMatrix4fv(this.vModelViewMatrix, false, flatten(matrixStack.Top()));
  gl.uniformMatrix4fv(this.vProjectionMatrix, false, flatten(projectionMatrix));
  gl.uniformMatrix4fv(this.vLightPos, false, flatten(lightPosMat));
  gl.uniform4fv(this.vLightOn, flatten(lightOn));

  gl.uniformMatrix4fv(this.fLightDiffuse, false, flatten(lightDiffuseMat));
  gl.uniformMatrix4fv(this.fLightAmbient, false, flatten(lightAmbientMat));
  gl.uniformMatrix4fv(this.fLightSpecular, false, flatten(lightSpecularMat));
  gl.uniform4fv(this.fLightOn, flatten(lightOn));

  // Set up vertex attributes
  gl.bindBuffer( gl.ARRAY_BUFFER, this.vertexCoordBuffer );
  gl.vertexAttribPointer(this.vPosition, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
  gl.vertexAttribPointer(this.vNormal, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexSpecularBuffer);
  gl.vertexAttribPointer(this.vSpecular, 3, gl.FLOAT, false, 0, 0);
  if(this.hasTexCoords)
  {
      console.log("Call 2");
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexTexCoordBuffer);
      gl.vertexAttribPointer(this.vTexCoord, 2, gl.FLOAT, false, 0, 0);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexShininessBuffer);
  gl.vertexAttribPointer(this.vShininess, 1, gl.FLOAT, false, 0, 0);
  
  gl.activeTexture(gl.TEXTURE0);  // which of the multiple texture units to use
  if (showTexture && this.textureLoaded) {
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.fTexSampler, 0);
   // gl.uniform1i(this.fShowTexture, 1);
  } else {
    gl.bindTexture(gl.TEXTURE_2D, null);
   // gl.uniform1i(this.fShowTexture, 0);
  }
  // Draw triangle faces
  gl.drawArrays(gl.TRIANGLES, 0, this.numVertices);
  
  // Restore previous backface cull setting
  if (!prevCull) gl.disable(gl.CULL_FACE);
};
Sphere.prototype.InitTexture = function(textureURL) {
  // Load the texture (with generated mipmaps)
  this.textureLoaded = false;
  var gl = this.gl;
  var texture = this.texture = gl.createTexture();
  var textureImage = new Image();
  var t = this;
  
  // Set up function to run asynchronously after texture image loads
  textureImage.onload = function() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureImage);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    t.textureLoaded = true;  // flag texture load complete    
  };
    textureImage.src = textureURL;
};