/**
 * JSONModel  (ver. 1.2) - draw model loaded from a JSON file
 * 
 * The JSON file should define an object which has a data member named "faces",
 * which is an array of objects. Each object in the "faces" array should have
 * two data members, "vertexCoords" and "vertexColors". These data members are
 * each an array of vec3 elements, containing, respectively, the x, y, z
 * coordinates and RGB colors for each vertex.
 * 
 * This version (L7) adds other model data (such as texture coordinates, 
 * shaders, etc.) to this JSON model format.
 * 
 * Version 1.2 - added normal vectors, reflectivities, and texture coordinates
 * 
 * Version 1.1 - added use of projection matrix in Render (no changes to JSON
 *               file format)
 * 
 * @author Mike Goss (mikegoss@cs.du.edu)
 */

"use strict";

JSONModel.prototype = Object.create(ModelInterface.prototype);

/**
 * Constructor
 * 
 * @param gl - WebGL context
 * @param modelURL - string containing the URL of the model (usually relative
 *                   to the site root of the current HTML page)
 */
function JSONModel(gl, modelURL) {
  ModelInterface.call(this, modelURL, gl);
  this.gl = gl;  // save reference to WebGL context

  // Load JSON file with model
  var model = LoadJSON(modelURL);
  if (model === null) return;  // if error (alert already displayed by LoadJSON)
  this.numFaces = model.faces.length;

  // Compile and link shaders
  this.shaderProgram = initShaders(gl,
                                   model.vertexShader,
                                   model.fragmentShader);
  if (this.shaderProgram === null) return;
  var shaderProgram = this.shaderProgram;
  gl.useProgram(this.shaderProgram);
  
  // Count vertices in each face.  Build a single array each for vertices, 
  // colors, normals, etc., and also build an
  // array with the number of vertices in each face. 
  this.faceVertexCount = [];
  var vertexCoords = [];
  var vertexNormals = [];
  var vertexColors = [];
  var vertexSpecular = [];
  var vertexShininess = [];
  var vertexTexCoords = [];
  
  for (var i = 0; i < this.numFaces; ++i) {
    var face = model.faces[i];
    var numVertices = face.vertexCoords.length;
    if (face.vertexColors.length !== numVertices ||
        face.vertexNormals.length !== numVertices ||
        face.vertexSpecular.length !== numVertices ||
        face.vertexShininess.length !== numVertices) {
      alert('ERROR: Badly formed face[' + i + '] in model "' + modelURL + '"');
      return;
    }
    this.faceVertexCount.push(numVertices);
    
    for (var j = 0; j < numVertices; ++j) {
      vertexCoords.push(face.vertexCoords[j]);
      vertexNormals.push(face.vertexNormals[j]);
      vertexColors.push(face.vertexColors[j]);
      vertexSpecular.push(face.vertexSpecular[j]);
      if (face.vertexTexCoords !== undefined) {
        vertexTexCoords.push(face.vertexTexCoords[j]);
      }
      vertexShininess.push(face.vertexShininess[j]);
    }
  }

  // Load vertex coordinates into WebGL buffer
  this.vertexCoordBuffer = gl.createBuffer();  // get unique buffer ID number
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexCoordBuffer );
  gl.bufferData(gl.ARRAY_BUFFER, flatten(vertexCoords), gl.STATIC_DRAW );
  
  // Associate buffer with shader variable 
  this.vPosition = gl.getAttribLocation(this.shaderProgram, "vPosition");
  gl.enableVertexAttribArray(this.vPosition);

  // Load vertex normals into WebGL buffer
  this.vertexNormalsBuffer = gl.createBuffer();  // get unique buffer ID number
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexNormalsBuffer );
  gl.bufferData(gl.ARRAY_BUFFER, flatten(vertexNormals), gl.STATIC_DRAW );
  
  // Associate buffer with shader variable 
  this.vNormal = gl.getAttribLocation(this.shaderProgram, "vNormal");
  gl.enableVertexAttribArray(this.vNormal);

  // Load vertex colors into WebGL buffer
  this.vertexColorBuffer = gl.createBuffer();  // get unique buffer ID number
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexColorBuffer );
  gl.bufferData(gl.ARRAY_BUFFER, flatten(vertexColors), gl.STATIC_DRAW );
  
  // Associate buffer with shader variable 
  this.vColor = gl.getAttribLocation(this.shaderProgram, "vColor");
  gl.enableVertexAttribArray(this.vColor);
 
  // Load vertex specular reflectance into WebGL buffer
  this.vertexSpecularBuffer = gl.createBuffer();  // get unique buffer ID number
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexSpecularBuffer );
  gl.bufferData(gl.ARRAY_BUFFER, flatten(vertexSpecular), gl.STATIC_DRAW );
  
  // Associate buffer with shader variable
  this.vSpecular = gl.getAttribLocation(this.shaderProgram, "vSpecular");
  gl.enableVertexAttribArray(this.vSpecular);
 
  // Load vertex texture coords into WebGL buffer
  this.hasTexCoords = vertexTexCoords.length > 0;
  if (this.hasTexCoords) {
    this.vertexTexCoordBuffer = gl.createBuffer();  // get unique buffer ID number
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexTexCoordBuffer );
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertexTexCoords), gl.STATIC_DRAW );

    // Associate buffer with shader variable
    this.vTexCoord = gl.getAttribLocation(this.shaderProgram, "vTexCoord");
    gl.enableVertexAttribArray(this.vTexCoord);
  }
  // Vertex Animation Stuff
  this.sOffset = gl.getUniformLocation(shaderProgram, "sOffset");
  this.current_offset = vec2(0.05,0.05);
  
  // Scale stuff
  this.Δscale = gl.getUniformLocation(shaderProgram, "scale");
  
  
 
  // Load vertex shininess into WebGL buffer
  this.vertexShininessBuffer = gl.createBuffer();  // get unique buffer ID number
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexShininessBuffer );
  gl.bufferData(gl.ARRAY_BUFFER, flatten(vertexShininess), gl.STATIC_DRAW );
  
  // Associate buffer with shader variable 
  this.vShininess = gl.getAttribLocation(this.shaderProgram, "vShininess");
  gl.enableVertexAttribArray(this.vShininess);
  
  // Get uniform variable locations for projection and modelview matrices
  this.modelView = gl.getUniformLocation(this.shaderProgram, "modelView");
  this.projection = gl.getUniformLocation(this.shaderProgram, "projection");

  // Vertex shader uniform locations
  this.vLightPos = gl.getUniformLocation(shaderProgram, "vLightPos");
  this.vLightOn = gl.getUniformLocation(shaderProgram, "vLightOn");
  this.vModelViewMatrix = gl.getUniformLocation(shaderProgram, "vModelViewMatrix");
  this.vProjectionMatrix = gl.getUniformLocation(shaderProgram, "vProjectionMatrix");
  
  // Fragment shader uniform locations
  this.fLightDiffuse = gl.getUniformLocation(shaderProgram, "fLightDiffuse");
  console.log("Unform Test: fLightDiffuse: " + this.fLightDiffuse);
  this.fLightAmbient = gl.getUniformLocation(shaderProgram, "fLightAmbient");
  this.fLightSpecular = gl.getUniformLocation(shaderProgram, "fLightSpecular");
  this.fLightOn = gl.getUniformLocation(shaderProgram, "fLightOn");
  this.fShowTexture = gl.getUniformLocation(shaderProgram, "fShowTexture");
  this.fTexSampler = gl.getUniformLocation(shaderProgram, "fTexSampler");
  
  // Load texture if specified
  if (vertexTexCoords.length > 0  &&  model.textureURL !== undefined) {
    this.InitTexture(model.textureURL);
  } else {
    this.textureLoaded = false;
  }
  
  // Copy backface cull setting from model
  this.useBackfaceCull = model.useBackfaceCull !== undefined 
                          && model.useBackfaceCull;
};

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
JSONModel.prototype.Redraw = function(matrixStack, projectionMatrix, lightPositions,
    diffuseIntensities, ambientIntensities, specularIntensities, showTexture) {
  var gl = this.gl;

  // Bind our shader program
  gl.useProgram(this.shaderProgram);
  
  // Set backface culling (save previous setting). If our desired setting is
  // not the same as the current setting, change it.
  var prevCull = gl.isEnabled(gl.CULL_FACE);
  if (this.useBackfaceCull && !prevCull) {  // if not already enabled
    gl.enable(gl.CULL_FACE);
  } else if (!this.useBackfaceCull && prevCull) {  // if not already disabled
    gl.disable(gl.CULL_FACE);
  }

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
  //gl.uniform4fv(this.sOffset, flatten(this.current_offset));

  gl.uniformMatrix4fv(this.fLightDiffuse, false, flatten(lightDiffuseMat));
  gl.uniformMatrix4fv(this.fLightAmbient, false, flatten(lightAmbientMat));
  gl.uniformMatrix4fv(this.fLightSpecular, false, flatten(lightSpecularMat));
  gl.uniform4fv(this.fLightOn, flatten(lightOn));

  // Set buffers for this model's attributes
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexCoordBuffer );
  gl.vertexAttribPointer(this.vPosition, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexNormalsBuffer);
  gl.vertexAttribPointer(this.vNormal, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexColorBuffer );
  gl.vertexAttribPointer(this.vColor, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexSpecularBuffer );
  gl.vertexAttribPointer(this.vSpecular, 3, gl.FLOAT, false, 0, 0);
  if (this.hasTexCoords) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexTexCoordBuffer );
    gl.vertexAttribPointer(this.vTexCoord, 2, gl.FLOAT, false, 0, 0);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexShininessBuffer);
  gl.vertexAttribPointer(this.vShininess, 1, gl.FLOAT, false, 0, 0);
  
  // Set up texture
  gl.activeTexture(gl.TEXTURE0);  // which of the multiple texture units to use
  if (showTexture && this.textureLoaded) {
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.fTexSampler, 0);
    gl.uniform1i(this.fShowTexture, 1);
  } else {
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.uniform1i(this.fShowTexture, 0);
  }

  // Draw each face as a triangle strip
  var start = 0;
  for (var face = 0; face < this.numFaces; ++face) {
    gl.drawArrays(gl.TRIANGLE_STRIP, start, this.faceVertexCount[face]);
    start += this.faceVertexCount[face];
  }
  
  //Texture animation stuff

  //    console.log("Test: " + this.sOffset + ", " + this.current_offset);
 
  gl.uniform2fv(this.sOffset, this.current_offset);
  this.current_offset[0] += 0.01;
  this.current_offset[1] += 0.01;
  var s_Val = document.getElementById('gl-canvas-scale-slider-output').value;
  console.log("S_VAL: " + s_Val);
  gl.uniform2fv(this.Δscale, vec2(s_Val, s_Val));

  
  // If different from our setting, restore previous backface cull setting
  if (this.useBackfaceCull && !prevCull) {  // if not already enabled
    gl.disable(gl.CULL_FACE);
  } else if (!this.useBackfaceCull && prevCull) {  // if not already disabled
    gl.enable(gl.CULL_FACE);
  }
 };

/**
 * InitTexture - load and initialize texture
 * 
 * @param {string} textureURL location of texture file
 */
var minFilterChanged = false;
var magFilterChanged = false;
var changedWrapS = 0;
var changedWrapT = 0;
JSONModel.prototype.InitTexture = function(textureURL) {
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
  Scene.prototype.change_min_filter = function(){
      if(minFilterChanged == false) 
      {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          minFilterChanged = true;
          document.getElementById("min_filter_txt").textContent = "TEXTURE_MIN_FILTER: LINEAR";
          console.log("Min Filter: Set to LINEAR");
      } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          document.getElementById("min_filter_txt").textContent = "TEXTURE_MIN_FILTER: LINEAR_MIPMAP_LINEAR";
          minFilterChanged = false;
          console.log("Min Filter: Set to LINEAR_MIPMAP_LINEAR");
      }
  };
    Scene.prototype.change_mag_filter = function(){
      if(magFilterChanged == false) 
      {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          magFilterChanged = true;
          document.getElementById("max_filter_txt").textContent = "TEXTURE_MAX_FILTER: LINEAR";
          console.log("Mag Filter: Set to LINEAR");
      } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          document.getElementById("max_filter_txt").textContent = "TEXTURE_MAX_FILTER: LINEAR_MIPMAP_LINEAR";
          magFilterChanged = false;
          console.log("Mag Filter: Set to LINEAR_MIPMAP_LINEAR");
      }
  };
  
  Scene.prototype.change_wrap_s = function() {
      switch(changedWrapS)
      {
        case 0:
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          changedWrapS = 1;
          document.getElementById("wrap_s_txt").textContent = "TEXTURE_WRAP_S: CLAM_TO_EDGE";
          console.log("change_wrap_s: changed to CLAMP_TO_EDGE");
          break;
        case 1:
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
          document.getElementById("wrap_s_txt").textContent = "TEXTURE_WRAP_S: MIRRORED_REPEAT";
          changedWrapS = 2;
          console.log("change_wrap_s: changed to MIRRORED_REPEAT");
          break;
        case 2:
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
          changedWrapS = 0;
          document.getElementById("wrap_s_txt").textContent = "TEXTURE_WRAP_S: REPEAT";
          console.log("change_wrap_s: changed to MIRRORED_REPEAT");
          break;
      }
  };
  Scene.prototype.change_wrap_t = function() {
      switch(changedWrapT)
      {
        case 0:
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          changedWrapT = 1;
         document.getElementById("wrap_t_txt").textContent = "TEXTURE_WRAP_T: CLAMP_TO_EDGE ";

          console.log("change_wrap_t: changed to CLAMP_TO_EDGE");
          break;
        case 1:
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
          changedWrapT = 2;
        document.getElementById("wrap_t_txt").textContent = "TEXTURE_WRAP_T: MIRRORED_REPEAT";
          console.log("change_wrap_t: changed to MIRRORED_REPEAT");
          break;
        case 2:
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
          changedWrapT = 0;
          document.getElementById("wrap_t_txt").textContent = "TEXTURE_WRAP_T: REPEAT";

          console.log("change_wrap_t: changed to MIRRORED_REPEAT");
          break;
      }
  };
 

  
  textureImage.src = textureURL;  // start load of texture image
};