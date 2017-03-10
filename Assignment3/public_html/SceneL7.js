/*
 * COMP3801 Winter 2017 Lab 7
 *  
 * Scene object - define model placement in world coordinates
 */

"use strict";

// Array of internally defined model types.  This is copied from the
// prototype when the Scene is instantiated, and JSON models loaded from
// URLs are added to the list.
Scene.prototype.predefinedModels = [
  { "name" : "Moon", "prototype" : Sphere, "constructorParams" : [ 2 ]},
  { "name" : "Sun", "prototype" : Sphere, "constructorParams" : [ 3 ]},
  { "name" : "Earth", "prototype" : Sphere, "constructorParams" : [ 4 ]},
  { "name" : "mars", "prototype" : Sphere, "constructorParams" : [ 4 ]},
  { "name" : "neptune", "prototype" : Sphere, "constructorParams" : [ 4 ]},
  { "name" : "saturn", "prototype" : Sphere, "constructorParams" : [ 4 ]},
  { "name" : "mercury", "prototype" : Sphere, "constructorParams" : [ 4 ]},
  { "name" : "uranus", "prototype" : Sphere, "constructorParams" : [ 4 ]},
  { "name" : "venus", "prototype" : Sphere, "constructorParams" : [ 4 ]},
  { "name" : "jupiter", "prototype" : Sphere, "constructorParams" : [ 4 ]}
//    { "name" : "encladus", "prototype" : Sphere, "constructorParams" : [ 3 ]},
//  { "name" : "europa", "prototype" : Sphere, "constructorParams" : [ 4 ]},
//  { "name" : "ganymede", "prototype" : Sphere, "constructorParams" : [ 4 ]},
//  { "name" : "iapetus", "prototype" : Sphere, "constructorParams" : [ 4 ]},
];

/*
 * Constructor for Scene object. This object holds a list of models to render,
 * and a transform for each one.  The list is defined in a JSON file.  The
 * field named "models" in the JSON file defines the list.  This field is an
 * array of objects. Each object contains the "modelURL", a scale factor,
 * and the placement of the model frame in world frame as vec3 values for the
 * "location" point and "xBasis", "yBasis", and "zBasis" vectors for the frame.
 * The scale factor should be applied to the points before applying the frame
 * transform.
 * 
 * @param canvasID - string ID of canvas in which to render
 * @param sceneURL - URL of JSON file containing scene definition
 */

function Scene(canvasID, sceneURL) {
  // Set up WebGL context
  var t = this;
  this.canvasID = canvasID;
  var canvas = this.canvas = document.getElementById(canvasID);
  if (!canvas) {
      alert("Canvas ID '" + canvasID + "' not found.");
      return;
  }
  var gl = this.gl = WebGLUtils.setupWebGL(this.canvas);
  if (!gl) {
      alert("WebGL isn't available in this browser");
      return;
  }
  
  // Initialize the list of models that have been defined in the Scene
  this.definedModels = {};
  for (var i = 0; i < this.predefinedModels.length; ++i) {
    var model = this.predefinedModels[i];
    var instance = new model.prototype(model.name, gl, model.constructorParams);
    this.definedModels[model.name] = instance; 
  }
  
  // Add key press event handler
  canvas.addEventListener("keypress", function(event) { t.KeyInput(event); });
  
  // Load the scene definition
  var jScene = this.jScene = LoadJSON(sceneURL);
  if (jScene === null) return;  // scene load failed (LoadJSON alerts on error)

  // Set up WebGL rendering settings
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.DEPTH_TEST);
  var bgColor = [ 0, 0, 0, 1 ];
  if ("bgColor" in jScene) {
    bgColor = jScene["bgColor"];
  }
  gl.clearColor(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);
  
  // Set up User Interface elements
  this.fovSliderID = canvasID + "-fov-slider";
  this.fovSlider = document.getElementById(this.fovSliderID);
  
  this.nearSliderID = canvasID + "-near-slider";
  this.nearSlider = document.getElementById(this.nearSliderID);
  
  this.farSliderID = canvasID + "-far-slider";
  this.farSlider = document.getElementById(this.farSliderID);
  
  this.scaleSliderID = canvasID + "-scale-slider";
  this.scaleSlider = document.getElementById(this.scaleSliderID);
  this.scaleSlider.value = 1.0;
  
  this.perspectiveCheckBoxID = canvasID + "-projection";
  this.perspectiveCheckBox = document.getElementById(this.perspectiveCheckBoxID);
  
  this.showTextureCheckBoxID = canvasID + "-show-texture";
  this.showTextureCheckBox = document.getElementById(this.showTextureCheckBoxID);
  
  this.fog_redSliderID = canvasID + "-fog_red-slider";
  this.fog_redSlider = document.getElementById(this.fog_redSliderID);
  this.fog_greenSliderID = canvasID + "-fog_green-slider";
  this.fog_greenSlider = document.getElementById(this.fog_greenSliderID);
  this.fog_blueSliderID = canvasID + "-fog_blue-slider";
  this.fog_blueSlider = document.getElementById(this.fog_blueSliderID);
  // Get the initial camera parameters (copy values so we can change them
  // without modifying the jScene object, we might want the original values
  // to do a reset.
  this.ResetCamera();
  
  // Load each model in the scene
  var loadedModels = this.loadedModels = [];  // array of models
  for (var i = 0; i < jScene.models.length; ++i) {
    this.LoadModel(i);
  }
  this.about = [];
  for (var i = 0; i < jScene.models.length; ++i) {
      if(this.jScene.models[i].parent != null){
        this.about.push(mult(subtract(this.jScene.models[i].location, this.jScene.models[this.jScene.models[i].parent].location), this.camera.approxUp));
      }
      else{
        this.about.push(null);
      }
  }
  // Get lights from JSON scene
  var sceneLights = jScene.lights;
  this.lightLocations = [];
  this.lightDiffuse = [];
  this.lightAmbient = [];
  this.lightSpecular = [];
  for (var i = 0; i < sceneLights.length; ++i) {
    this.lightLocations.push(vec4(sceneLights[i].location));
    this.lightDiffuse.push(vec4(sceneLights[i].diffuse, 0.0));
    this.lightAmbient.push(vec4(sceneLights[i].ambient, 0.0));
    this.lightSpecular.push(vec4(sceneLights[i].specular, 0.0));
  }
   
  // Add mouse event handlers
  canvas.addEventListener("mousedown", function(e) {
    // IE handles button ID different from everyone else. We'll just assume
    // that any button press is the left button.
    
    // Capture current mouse position and rotation
    t.mouseDown = true;
    t.mouseDownX = e.pageX - e.target.offsetLeft;
    t.mouseDownY = e.pageY - e.target.offsetTop;
    t.mouseDownRX = t.mouseRX
    t.mouseDownRY = t.mouseRY;
  });
  
  canvas.addEventListener("mouseup", function(e) {
    // IE handles button ID different from everyone else. We'll just assume
    // that any button press is the left button.
    t.mouseDown = false;
  });
  
  canvas.addEventListener("mousemove", function(e) {
    // Calculate mouse rotation relative to position when button initially
    // pressed.
    if (t.mouseDown) {
      var x = e.pageX - e.target.offsetLeft;
      var deltaX = t.mouseDownX - x;
      var y = e.pageY - e.target.offsetTop;
      var deltaY = t.mouseDownY - y;
      t.mouseRX = deltaX * 0.5 + t.mouseDownRX;
      t.mouseRY = deltaY * 0.5 + t.mouseDownRY;
    }
  });

  // Start rendering
  requestAnimationFrame(function() { t.Redraw(); } );
};

Scene.prototype.LoadModel = function(modelIndex) {
    // Load model from JSON and add to loadedModels array
    var jModel = this.jScene.models[modelIndex];
    var model = undefined;
    
    // If model already defined, just add a reference to it
    var definedModel = this.definedModels[jModel.modelURL];
    if (definedModel !== undefined) {
      model = definedModel;
    } else {
      var model = new JSONModel(this.gl, jModel.modelURL);
      if (model === null) return;  // failed to load a model
      this.definedModels[jModel.modelURL] = model;  // save for repeat use
    }
    
    // Add the model instance to the array of loaded models
    this.loadedModels.push(model);
};

Scene.prototype.Redraw = function() {
  var gl = this.gl;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  var camera = this.camera;
  
  // Compute aspect ratio of canvas
  var aspect = this.canvas.width / this.canvas.height;
  
  // Build projection matrix
  var projection = [];
  camera.FOVdeg = parseFloat(this.fovSlider.value);
  camera.near = parseFloat(this.nearSlider.value);
  camera.far = parseFloat(this.farSlider.value);
  camera.perspective = this.perspectiveCheckBox.checked;

  if (camera.perspective) {
    projection = perspective(camera.FOVdeg, aspect, 
                             camera.near, camera.far);
  } else {
    var distance = length(subtract(camera.location, camera.lookAt));
    var orthoFOV = distance * Math.tan(radians(0.5 * camera.FOVdeg));
    projection = ortho(-aspect * orthoFOV, aspect * orthoFOV, -orthoFOV, orthoFOV, 
                       camera.near, camera.far);
  }
  
  // Initialize matrix stack
  var matrixStack = new MatrixStack;

  // Build mouse rotation matrix
  var lookAtDist = length(subtract(camera.location, camera.lookAt));
  matrixStack.MultMatrix(translate(0, 0, -lookAtDist));
  matrixStack.MultMatrix(rotate(this.mouseRY, 1, 0, 0));
  matrixStack.MultMatrix(rotate(this.mouseRX, 0, 1, 0));
  matrixStack.MultMatrix(translate(0, 0, lookAtDist));
  
  // Build view transform
  var viewMat = lookAt(camera.location, camera.lookAt, camera.approxUp);
  matrixStack.MultMatrix(viewMat);
 
  // Transform light sources from world to view coordinates
  var lightsViewCoords = [];
  for (var i = 0; i < this.lightLocations.length; ++i) {
    lightsViewCoords.push(mult(viewMat, this.lightLocations[i]));
  }
  
  var showTexture = this.showTextureCheckBox.checked;
  
  // Render each loaded object with its transform
  for (var i = 0; i < this.loadedModels.length; ++i) {
    matrixStack.PushMatrix();  // preserve matrix state

    // Build transform from JSON and add to transforms array
    var jModel = this.jScene.models[i];
    var ms = scalem(jModel.scale);
    var child = jModel;
    while(child.parent != null)
    {
        var pLocation = vec3(this.jScene.models[child.parent].location);
//        var secondHalf = mat4(mult(mult(translate(pLocation), rotateZ(0.1)),translate(negate(pLocation))));
//        printm(secondHalf);
        var temp = mult(mult(mult(translate(pLocation), rotate(child.speed,this.about[child.id])),translate(negate(pLocation))), vec4(jModel.location, 1));
        jModel.location = vec3(temp[0],temp[1],temp[2]);
        child = child.parent;
       // console.log(jModel.location);
    }
    var mt = translate(jModel.location);
    var mf = mat4(jModel.xBasis[0], jModel.yBasis[0], jModel.zBasis[0], 0.0,
                  jModel.xBasis[1], jModel.yBasis[1], jModel.zBasis[1], 0.0,
                  jModel.xBasis[2], jModel.yBasis[2], jModel.zBasis[2], 0.0,
                  0.0,              0.0,              0.0,              1.0);
    var transform = mult(mt, mult(mf, ms));
 
    matrixStack.MultMatrix(transform);
    this.loadedModels[i].Redraw(matrixStack, projection, lightsViewCoords,
                                this.lightDiffuse, this.lightAmbient,
                                this.lightSpecular, showTexture);
    matrixStack.PopMatrix();  // restore matrix state
  }
  
  var t = this;
  requestAnimationFrame(function() { t.Redraw(); } );
};

Scene.prototype.ResetCamera = function() {
  // Copy the camera parameters from the jScene object.  The copy's values
  // are independent of the originals, so changes won't affect the originals.
  this.camera = {};
  this.camera.location = this.jScene.camera.location.slice();
  this.camera.lookAt = this.jScene.camera.lookAt.slice();
  this.camera.approxUp = this.jScene.camera.approxUp.slice();
  this.camera.FOVdeg = this.jScene.camera.FOVdeg;
  this.camera.near = this.jScene.camera.near;
  this.camera.far = this.jScene.camera.far;
  this.camera.perspective = this.jScene.camera.perspective;

  // Set UI elements to the values defined in the scene files
  this.fovSlider.value = this.camera.FOVdeg;
  SliderUpdate(this.fovSliderID + "-output", this.camera.FOVdeg);

  this.nearSlider.max = this.camera.far;
  this.nearSlider.value = this.camera.near;
  SliderUpdate(this.nearSliderID + "-output", this.camera.near);

  this.farSlider.max = this.camera.far;
  this.farSlider.value = this.camera.far;
  SliderUpdate(this.farSliderID + "-output", this.camera.far);
  
  //console.log("CURRENT VAL:  " + this.scaleSlider.value)
  SliderUpdate(this.scaleSliderID + "-output", this.scaleSlider.value);
  
  this.fog_redSlider.max = 0.1;
  this.fog_redSlider.value = 0.002;
  SliderUpdate(this.fog_redSliderID + "-output", this.fog_redSlider.value);
    this.fog_greenSlider.max = 0.1;
  this.fog_greenSlider.value = 0.001;
  SliderUpdate(this.fog_greenSliderID + "-output", this.fog_greenSlider.value);
  this.fog_blueSlider.max = 0.1;
  this.fog_blueSlider.value = 0.001;
  SliderUpdate(this.fog_blueSliderID + "-output", this.fog_blueSlider.value);
  
  

  this.perspectiveCheckBox.checked = this.camera.perspective;
  this.showTextureCheckBox.checked = true;
  
  // Reset state of mouse in Scene
  this.mouseDown = false;
  this.mouseRX = 0.0;
  this.mouseRY = 0.0;
  this.mouseDownRX = 0.0;
  this.mouseDownRY = 0.0;
  this.mouseDownX = 0;
  this.mouseDownY = 0;
};

Scene.prototype.KeyInput = function(event) {
  // Get character from event
  var c = String.fromCharCode(event.which);
  
  // If numeric, switch view to selected object
  var atModel = parseInt(c);
  if (!isNaN(atModel) && atModel <= this.loadedModels.length) {
    if (atModel === 0) {
      this.camera.lookAt = [ 0, 0, 0 ];
    } else {
      this.camera.lookAt = this.jScene.models[atModel-1].location.slice();
    }
  }
};