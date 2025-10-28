import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { createEnvironmentMap } from "./setup/environment-map";
import { createLights } from "./setup/lights";
import { createSolarSystem } from "./setup/solar-system";
import { createGUI, options } from "./setup/gui";
import { LAYERS } from "./constants";
import { HandTracker } from "./hand-tracking/hand-tracker";
import { GestureRecognizer } from "./hand-tracking/gesture-recognizer";
import { HandGestureControls } from "./hand-tracking/hand-gesture-controls";

THREE.ColorManagement.enabled = false;

// Canvas
const canvas = document.querySelector("canvas.webgl") as HTMLElement;

// Scene
const scene = new THREE.Scene();

// Environment map
scene.background = createEnvironmentMap("./textures/environment");

// Lights
const [ambientLight, pointLight] = createLights();
scene.add(ambientLight, pointLight);

// Sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderers
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  bloomComposer.setSize(sizes.width, sizes.height);
  labelRenderer.setSize(sizes.width, sizes.height);
});

document.getElementById("btn-previous")?.addEventListener("click", () => {
  const index = planetNames.indexOf(options.focus);
  const newIndex = index === 0 ? planetNames.length - 1 : index - 1;
  const focus = planetNames[newIndex];
  changeFocus(options.focus, focus);
  options.focus = focus;
});

document.getElementById("btn-next")?.addEventListener("click", () => {
  const index = (planetNames.indexOf(options.focus) + 1) % planetNames.length;
  const focus = planetNames[index];
  changeFocus(options.focus, focus);
  options.focus = focus;
});

// Hand tracking control buttons
document.getElementById("btn-hand-toggle")?.addEventListener("click", async () => {
  const currentState = handControls.getEnabled();
  
  if (!currentState) {
    // Enabling hand controls
    if (!isCameraRequested) {
      // Show camera permission modal
      showCameraModal();
    } else {
      // Camera already granted, just enable controls
      handControls.setEnabled(true);
      updateHandStatus('Enabled', 0, 'Show your hand to camera');
      showHandHelp();
      updateHandToggleButton(true);
    }
  } else {
    // Disabling hand controls
    handControls.setEnabled(false);
    const statusDiv = document.getElementById('hand-status');
    const helpDiv = document.getElementById('hand-help');
    if (statusDiv) statusDiv.style.display = 'none';
    if (helpDiv) helpDiv.style.display = 'none';
    updateHandToggleButton(false);
  }
});

function updateHandToggleButton(enabled: boolean) {
  const button = document.getElementById("btn-hand-toggle");
  if (button) {
    button.style.backgroundColor = enabled ? '#4CAF50' : '';
    button.title = enabled ? 'Disable Hand Controls' : 'Enable Hand Controls';
  }
}

document.getElementById("btn-hand-debug")?.addEventListener("click", () => {
  handTracker.toggleDebugView();
  const button = document.getElementById("btn-hand-debug");
  if (button) {
    const isVisible = document.getElementById('hand-debug-canvas')?.style.display !== 'none';
    button.style.backgroundColor = isVisible ? '#2196F3' : '';
    button.title = isVisible ? 'Hide Hand Debug View' : 'Show Hand Debug View';
  }
});

// Solar system
const [solarSystem, planetNames] = createSolarSystem(scene);

const changeFocus = (oldFocus: string, newFocus: string) => {
  solarSystem[oldFocus].mesh.remove(camera);
  solarSystem[newFocus].mesh.add(camera);
  const minDistance = solarSystem[newFocus].getMinDistance();
  controls.minDistance = minDistance;
  fakeCamera.position.set(minDistance, minDistance / 3, 0);
  solarSystem[oldFocus].labels.hidePOI();
  solarSystem[newFocus].labels.showPOI();
  (document.querySelector(".caption p") as HTMLElement).innerHTML = newFocus;
};

// Camera
const aspect = sizes.width / sizes.height;
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
camera.position.set(0, 20, 0);
solarSystem["Sun"].mesh.add(camera);

// Controls
const fakeCamera = camera.clone();
const controls = new OrbitControls(fakeCamera, canvas);
controls.target = solarSystem["Sun"].mesh.position;
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = solarSystem["Sun"].getMinDistance();
controls.maxDistance = 50;

// Hand tracking system
const handTracker = new HandTracker();
const gestureRecognizer = new GestureRecognizer();
const handControls = new HandGestureControls(fakeCamera, controls);

// Initialize MediaPipe (without camera access yet)
let isCameraRequested = false;

handTracker.initialize().then(() => {
  console.log('✋ MediaPipe initialized successfully');
  updateHandStatus('Ready', 0, 'Click hand button to enable');
}).catch((error) => {
  console.warn('⚠️ MediaPipe initialization failed:', error.message);
  updateHandStatus('MediaPipe Failed', 0, 'Refresh to retry');
});

// Camera permission modal handlers
document.getElementById("btn-request-camera")?.addEventListener("click", async () => {
  hideModal();
  await requestCameraAccess();
});

document.getElementById("btn-skip-camera")?.addEventListener("click", () => {
  hideModal();
  updateHandStatus('Disabled', 0, 'Camera access skipped');
});

function showCameraModal() {
  const modal = document.getElementById('camera-permission-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function hideModal() {
  const modal = document.getElementById('camera-permission-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function requestCameraAccess() {
  try {
    updateHandStatus('Requesting...', 0, 'Allow camera access in browser');
    await handTracker.requestCamera();
    updateHandStatus('Active', 0, 'Ready to track hands');
    showHandHelp(3000);
    isCameraRequested = true;
    
    // Enable hand controls after successful camera access
    handControls.setEnabled(true);
    updateHandToggleButton(true);
  } catch (error: any) {
    console.error('Camera access failed:', error.message);
    updateHandStatus('Camera Failed', 0, error.message);
    
    // Show retry option
    setTimeout(() => {
      if (confirm('Camera access failed. Would you like to try again?\n\n' + error.message)) {
        requestCameraAccess();
      } else {
        handControls.setEnabled(false);
        updateHandStatus('Disabled', 0, 'Camera access denied');
        updateHandToggleButton(false);
      }
    }, 1000);
  }
}

handTracker.onResults((results) => {
  const gesture = gestureRecognizer.recognizeGestures(results.landmarks);
  handControls.update(gesture);
  
  // Update status display
  updateHandStatus('Active', results.landmarks.length, getGestureDescription(gesture));
});

// Status and help functions
function updateHandStatus(cameraStatus: string, handCount: number, gestureStatus: string) {
  const statusDiv = document.getElementById('hand-status');
  if (statusDiv && handControls.getEnabled()) {
    statusDiv.style.display = 'block';
    
    const cameraSpan = document.getElementById('camera-status');
    const handsSpan = document.getElementById('hands-count');
    const gestureSpan = document.getElementById('gesture-status');
    
    if (cameraSpan) cameraSpan.textContent = cameraStatus;
    if (handsSpan) handsSpan.textContent = handCount.toString();
    if (gestureSpan) gestureSpan.textContent = gestureStatus;
    
    // Color coding
    if (cameraSpan) {
      cameraSpan.style.color = cameraStatus === 'Active' ? '#4CAF50' : 
                               cameraStatus.includes('Failed') ? '#f44336' : '#ff9800';
    }
    if (handsSpan) {
      handsSpan.style.color = handCount > 0 ? '#4CAF50' : '#ccc';
    }
  } else if (statusDiv) {
    statusDiv.style.display = 'none';
  }
}

function getGestureDescription(gesture: any): string {
  if (!gesture.isHandVisible) return 'No hands detected';
  
  const descriptions = [];
  if (gesture.pinchStrength > 0.3) descriptions.push(`Pinch (${(gesture.pinchStrength * 100).toFixed(0)}%)`);
  if (Math.abs(gesture.palmRotation) > 0.2) descriptions.push(`Rotate ${gesture.palmRotation > 0 ? 'Right' : 'Left'}`);
  if (Math.abs(gesture.palmTilt) > 0.2) descriptions.push(`Tilt ${gesture.palmTilt > 0 ? 'Up' : 'Down'}`);
  
  return descriptions.length > 0 ? descriptions.join(', ') : 'Hand visible';
}

function showHandHelp(duration?: number) {
  const helpDiv = document.getElementById('hand-help');
  if (helpDiv) {
    helpDiv.style.display = 'block';
    if (duration) {
      setTimeout(() => {
        helpDiv.style.display = 'none';
      }, duration);
    }
  }
}

// Label renderer
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(sizes.width, sizes.height);
document.body.appendChild(labelRenderer.domElement);

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});

renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(sizes.width, sizes.height),
  0.75,
  0,
  1
);

const bloomComposer = new EffectComposer(renderer);
bloomComposer.setSize(sizes.width, sizes.height);
bloomComposer.renderToScreen = true;
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);

// Animate
const clock = new THREE.Clock();
let elapsedTime = 0;

fakeCamera.layers.enable(LAYERS.POILabel);

// GUI
createGUI(ambientLight, solarSystem, clock, fakeCamera, handControls);

(function tick() {
  elapsedTime += clock.getDelta() * options.speed;

  // Update the solar system objects
  for (const object of Object.values(solarSystem)) {
    object.tick(elapsedTime);
  }

  // Update camera
  camera.copy(fakeCamera);

  // Update controls
  controls.update();

  // Update labels
  const currentBody = solarSystem[options.focus];
  currentBody.labels.update(fakeCamera);

  // Render
  bloomComposer.render();
  labelRenderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
})();
