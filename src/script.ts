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
import { eventBus } from "./voice/eventBus";
import { VoiceNavigationController } from "./voice/navigation";
import { WelcomeNarrator } from "./voice/welcomeNarrator";
import { HandTrackerV2 } from "./hand-tracking/hand-tracker";
import { GestureEngine } from "./hand-tracking/gesture-engine";
import { HandGestureControlsV2 } from "./hand-tracking/hand-gesture-controls-v2";

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
  
  // Hide all tooltips first
  const allTooltips = [
    'space-tooltip', 'mercury-tooltip', 'venus-tooltip', 'earth-tooltip', 'moon-tooltip',
    'mars-tooltip', 'jupiter-tooltip', 'saturn-tooltip', 'uranus-tooltip', 'neptune-tooltip',
    'ganymede-tooltip', 'titan-tooltip', 'callisto-tooltip', 'io-tooltip', 'europa-tooltip', 'triton-tooltip'
  ];
  
  allTooltips.forEach(tooltipId => {
    const tooltip = document.getElementById(tooltipId);
    if (tooltip) {
      tooltip.classList.remove('show');
      tooltip.style.display = 'none';
    }
  });
  
  // Show appropriate tooltip for current focus after a brief delay
  setTimeout(() => {
    const tooltipId = `${newFocus.toLowerCase()}-tooltip`;
    const currentTooltip = document.getElementById(tooltipId);
    if (currentTooltip) {
      currentTooltip.style.display = 'block';
      setTimeout(() => {
        currentTooltip.classList.add('show');
      }, 50);
    }
  }, 100);
};

const setFocus = (focus: string) => {
  if (!solarSystem[focus]) {
    console.warn(`[voice] Unknown focus target: ${focus}`);
    return;
  }
  const previous = options.focus;
  changeFocus(previous, focus);
  options.focus = focus;
  eventBus.emit("focusChanged", {
    current: focus,
    previous,
  });
};

const focusPrevious = () => {
  const index = planetNames.indexOf(options.focus);
  const newIndex = index === 0 ? planetNames.length - 1 : index - 1;
  setFocus(planetNames[newIndex]);
};

const focusNext = () => {
  const index = (planetNames.indexOf(options.focus) + 1) % planetNames.length;
  setFocus(planetNames[index]);
};

document.getElementById("btn-previous")?.addEventListener("click", focusPrevious);

document.getElementById("btn-next")?.addEventListener("click", focusNext);

// Camera
const aspect = sizes.width / sizes.height;
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
camera.position.set(0, 20, 0);
solarSystem["Sun"].mesh.add(camera);

// Show tooltip for Sun on initial load
setTimeout(() => {
  const sunTooltip = document.getElementById('space-tooltip');
  if (sunTooltip && options.focus === 'Sun') {
    sunTooltip.style.display = 'block';
    setTimeout(() => {
      sunTooltip.classList.add('show');
    }, 100);
  }
}, 1000); // Wait for solar system to fully load

// Controls
const fakeCamera = camera.clone();
const controls = new OrbitControls(fakeCamera, canvas);
controls.target = solarSystem["Sun"].mesh.position;
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = solarSystem["Sun"].getMinDistance();
controls.maxDistance = 50;

// Hand tracking system v2 - Professional architecture
const handTracker = new HandTrackerV2();
const gestureEngine = new GestureEngine();
const handControls = new HandGestureControlsV2(controls);

// Hand tracking control buttons
document.getElementById("btn-hand-toggle")?.addEventListener("click", async () => {
  const currentState = handControls.getEnabled();

  if (!currentState) {
    if (!isCameraRequested) {
      showCameraModal();
    } else {
      handControls.setEnabled(true);
      updateHandStatus("Enabled", 0, "Show your hand to camera");
      showHandHelp();
      updateHandToggleButton(true);
    }
  } else {
    handControls.setEnabled(false);
    const statusDiv = document.getElementById("hand-status");
    const helpDiv = document.getElementById("hand-help");
    if (statusDiv) statusDiv.style.display = "none";
    if (helpDiv) helpDiv.style.display = "none";
    updateHandToggleButton(false);
  }
});

function updateHandToggleButton(enabled: boolean) {
  const button = document.getElementById("btn-hand-toggle");
  if (button) {
    button.style.backgroundColor = enabled ? "#4CAF50" : "";
    button.title = enabled ? "Disable Hand Controls" : "Enable Hand Controls";
  }
}

document.getElementById("btn-hand-debug")?.addEventListener("click", () => {
  handTracker.toggleDebugView();
  const button = document.getElementById("btn-hand-debug");
  if (button) {
    const isVisible = document.getElementById("hand-debug-canvas")?.style.display !== "none";
    button.style.backgroundColor = isVisible ? "#2196F3" : "";
    button.title = isVisible ? "Hide Hand Debug View" : "Show Hand Debug View";
  }
});

document.getElementById("btn-hand-calibrate")?.addEventListener("click", () => {
  if (!isCameraRequested) {
    alert("Please enable hand tracking first by clicking the hand button.");
    return;
  }

  const snapshot = gestureEngine.read();
  if (snapshot.hands === 0) {
    alert("Please show your hand to the camera and try again.");
    return;
  }

  const instruction = document.createElement("div");
  instruction.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.9); color: white; padding: 30px; border-radius: 10px;
    text-align: center; z-index: 3000; max-width: 400px;
  `;
  instruction.innerHTML = `
    <h3>🖐️ Calibrating Neutral Position</h3>
    <p>Hold your hand in a comfortable, relaxed position.<br>
    Palm facing camera, fingers naturally positioned.</p>
    <p style="color: #4CAF50; font-size: 18px; margin: 20px 0;">
    Calibrating in <span id="calibrate-countdown">3</span>...
    </p>
  `;
  document.body.appendChild(instruction);

  let countdown = 3;
  const countdownEl = document.getElementById("calibrate-countdown");

  const timer = setInterval(() => {
    countdown--;
    if (countdownEl) countdownEl.textContent = countdown.toString();

    if (countdown <= 0) {
      clearInterval(timer);

      const currentSnapshot = gestureEngine.read();
      if (currentSnapshot.hands > 0) {
        const rawLandmarks = handTracker.getLatestLandmarks();
        const success = gestureEngine.calibrateNeutral(rawLandmarks);

        if (success) {
          instruction.innerHTML = `
            <h3 style="color: #4CAF50;">✅ Calibration Complete!</h3>
            <p>Your neutral hand position has been saved.<br>
            Hand gestures are now personalized for you.</p>
          `;
        } else {
          instruction.innerHTML = `
            <h3 style="color: #f44336;">❌ Calibration Failed</h3>
            <p>Unable to read hand landmarks. Please try again.</p>
          `;
        }

        setTimeout(() => {
          document.body.removeChild(instruction);
        }, 2000);

        console.log("Hand calibration completed");
      } else {
        instruction.innerHTML = `
          <h3 style="color: #f44336;">❌ Calibration Failed</h3>
          <p>No hand detected. Please try again.</p>
        `;

        setTimeout(() => {
          document.body.removeChild(instruction);
        }, 2000);
      }
    }
  }, 1000);
});

// Gesture mode button removed - now using finger gestures only

// Initialize MediaPipe (without camera access yet)
let isCameraRequested = false;

handTracker.initialize().then(() => {
  console.log('✋ MediaPipe v2 initialized successfully');
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

// Process hand tracking results through the gesture engine
handTracker.onResults((results, timestamp) => {
  gestureEngine.ingest(results.landmarks, timestamp);
  
  // Update status display
  const snapshot = gestureEngine.read();
  updateHandStatus('Active', results.landmarks.length, getGestureDescription(snapshot));
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

function getGestureDescription(snapshot: any): string {
  if (snapshot.hands === 0) return 'No hands detected';
  
  // Finger gesture system only
  const fingerGesture = gestureEngine.getLastFingerGesture();
  const gestureEmojis = {
    'open_palm': '🖐️ Open Palm → Zoom Out',
    'closed_fist': '✊ Closed Fist → Zoom In',
    'one_finger': '☝️ One Finger → Rotate Left',
    'two_fingers': '✌️ Two Fingers → Rotate Right',
    'unknown': '❓ Show gesture to camera'
  };
  
  const gestureText = gestureEmojis[fingerGesture.gesture] || '❓ Unknown';
  const confidence = fingerGesture.confidence ? ` (${(fingerGesture.confidence * 100).toFixed(0)}%)` : '';
  const fingerCount = fingerGesture.fingerCount >= 0 ? ` [${fingerGesture.fingerCount} fingers]` : '';
  
  return gestureText + confidence + fingerCount;
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

const voiceNavigation = new VoiceNavigationController(planetNames);
voiceNavigation.attachUI({
  button: document.getElementById("btn-voice") as HTMLButtonElement | null,
  status: document.getElementById("voice-status"),
  transcript: document.getElementById("voice-transcript"),
  container: document.getElementById("voice-feedback"),
});

new WelcomeNarrator(planetNames, options.narrationEnabled, options.focus);

eventBus.on("voiceCommand", (intent) => {
  switch (intent.type) {
    case "open":
      setFocus(intent.target);
      break;
    case "next":
      focusNext();
      break;
    case "previous":
      focusPrevious();
      break;
    case "repeat":
      eventBus.emit("focusChanged", {
        current: options.focus,
        previous: options.focus,
      });
      break;
    case "stop":
      // Future: pause narration or other behaviours.
      break;
    default:
      break;
  }
});

eventBus.emit("focusChanged", {
  current: options.focus,
  previous: null,
});

(function tick() {
  const deltaTime = clock.getDelta();
  elapsedTime += deltaTime * options.speed;

  // Update the solar system objects
  for (const object of Object.values(solarSystem)) {
    object.tick(elapsedTime);
  }

  // Apply hand gesture deltas to OrbitControls (v2 architecture)
  const gestureSnapshot = gestureEngine.read();
  handControls.apply(gestureSnapshot, deltaTime);

  // Update camera
  camera.copy(fakeCamera);

  // Update controls (OrbitControls handles all the camera math)
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
