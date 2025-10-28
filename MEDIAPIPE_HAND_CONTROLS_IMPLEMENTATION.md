# MediaPipe Hand Controls Implementation Guide

## Overview

This document outlines the comprehensive implementation of MediaPipe hand tracking to add gesture controls to the existing Three.js solar system simulation. The implementation preserves all existing mouse controls while adding intuitive hand gesture alternatives for zoom, rotation, and navigation.

## Project Goals

**Primary Controls to Implement:**
- ✋ **Zoom In/Out**: Pinch gestures for camera distance control
- 🔄 **Rotate Left/Right**: Hand rotation for horizontal camera orbit
- ⬆️⬇️ **Rotate Up/Down**: Hand tilt for vertical camera orbit
- 🎯 **Dual Control System**: Mouse + Hand controls working simultaneously

## Technical Architecture

### Current Control System Analysis

**Existing Mouse Controls (`script.ts:85-92`):**
```typescript
const controls = new OrbitControls(fakeCamera, canvas);
controls.target = solarSystem["Sun"].mesh.position;
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = solarSystem["Sun"].getMinDistance();
controls.maxDistance = 50;
```

**Control Mapping:**
- **Mouse Drag** → Camera orbit rotation
- **Mouse Wheel** → Zoom in/out (distance control)
- **Animation Loop** → `controls.update()` applies changes

### MediaPipe Integration Strategy

**Hybrid Control System:**
```typescript
// Enhanced control system
const controls = new OrbitControls(fakeCamera, canvas);
const handControls = new HandGestureControls(fakeCamera, controls);

// Both systems update the same camera
function tick() {
  controls.update();           // Existing mouse controls
  handControls.update();       // New hand gesture controls
}
```

## MediaPipe Setup and Installation

### Package Installation
```bash
# Install MediaPipe Tasks Vision (2024 standard)
npm install @mediapipe/tasks-vision

# Install camera utilities for video processing
npm install @mediapipe/camera_utils
```

### CDN Alternative
```html
<!-- Add to index.html head -->
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js"></script>
```

### Project Structure
```
src/
├── hand-tracking/
│   ├── hand-tracker.ts           # MediaPipe integration
│   ├── gesture-recognizer.ts     # Gesture detection logic
│   ├── hand-gesture-controls.ts  # Camera control implementation
│   └── gesture-types.ts          # Type definitions
├── script.ts                     # Main integration point
└── index.html                    # Camera permissions setup
```

## Implementation Details

### 1. Hand Tracker Core (`hand-tracking/hand-tracker.ts`)

```typescript
import { HandLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

export interface HandData {
  landmarks: NormalizedLandmark[][];
  worldLandmarks: Landmark[][];
  handedness: Classification[][];
}

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isInitialized = false;
  private onResultsCallback?: (results: HandData) => void;

  constructor() {
    this.setupVideo();
    this.setupCanvas();
  }

  async initialize(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    
    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.isInitialized = true;
    this.startVideoStream();
  }

  private setupVideo(): void {
    this.video = document.createElement('video');
    this.video.style.display = 'none';
    document.body.appendChild(this.video);
  }

  private setupCanvas(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'hand-debug-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '10px';
    this.canvas.style.left = '10px';
    this.canvas.style.width = '320px';
    this.canvas.style.height = '240px';
    this.canvas.style.zIndex = '1000';
    this.canvas.style.display = 'none'; // Hidden by default
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  private async startVideoStream(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 }
    });
    
    this.video.srcObject = stream;
    this.video.addEventListener('loadedmetadata', () => {
      this.video.play();
      this.processVideoFrame();
    });
  }

  private processVideoFrame(): void {
    if (!this.isInitialized || !this.handLandmarker) return;

    const startTimeMs = performance.now();
    const results = this.handLandmarker.detectForVideo(this.video, startTimeMs);

    if (this.onResultsCallback && results.landmarks.length > 0) {
      this.onResultsCallback({
        landmarks: results.landmarks,
        worldLandmarks: results.worldLandmarks,
        handedness: results.handedness
      });
    }

    // Continue processing at ~30fps
    setTimeout(() => this.processVideoFrame(), 33);
  }

  onResults(callback: (results: HandData) => void): void {
    this.onResultsCallback = callback;
  }

  toggleDebugView(): void {
    const display = this.canvas.style.display === 'none' ? 'block' : 'none';
    this.canvas.style.display = display;
  }

  drawDebugLandmarks(results: HandData): void {
    if (this.canvas.style.display === 'none') return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (results.landmarks.length > 0) {
      const drawingUtils = new DrawingUtils(this.ctx);
      for (const landmarks of results.landmarks) {
        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
          color: '#00FF00',
          lineWidth: 2
        });
        drawingUtils.drawLandmarks(landmarks, {
          color: '#FF0000',
          lineWidth: 1
        });
      }
    }
  }
}
```

### 2. Gesture Recognition (`hand-tracking/gesture-recognizer.ts`)

```typescript
import { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface GestureState {
  pinchStrength: number;      // 0-1, for zoom control
  palmRotation: number;       // -1 to 1, for horizontal rotation
  palmTilt: number;          // -1 to 1, for vertical rotation
  isHandVisible: boolean;
  handCount: number;
}

export class GestureRecognizer {
  private previousGesture: GestureState | null = null;
  private smoothingFactor = 0.7; // For gesture smoothing

  recognizeGestures(landmarks: NormalizedLandmark[][]): GestureState {
    if (landmarks.length === 0) {
      return {
        pinchStrength: 0,
        palmRotation: 0,
        palmTilt: 0,
        isHandVisible: false,
        handCount: 0
      };
    }

    const primaryHand = landmarks[0]; // Use first detected hand
    const gesture: GestureState = {
      pinchStrength: this.calculatePinchStrength(primaryHand),
      palmRotation: this.calculatePalmRotation(primaryHand),
      palmTilt: this.calculatePalmTilt(primaryHand),
      isHandVisible: true,
      handCount: landmarks.length
    };

    // Apply smoothing
    if (this.previousGesture) {
      gesture.pinchStrength = this.smooth(gesture.pinchStrength, this.previousGesture.pinchStrength);
      gesture.palmRotation = this.smooth(gesture.palmRotation, this.previousGesture.palmRotation);
      gesture.palmTilt = this.smooth(gesture.palmTilt, this.previousGesture.palmTilt);
    }

    this.previousGesture = gesture;
    return gesture;
  }

  private calculatePinchStrength(landmarks: NormalizedLandmark[]): number {
    // Thumb tip and index finger tip
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    
    const distance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + 
      Math.pow(thumbTip.y - indexTip.y, 2)
    );

    // Normalize distance to 0-1 range (adjust based on testing)
    const normalizedDistance = Math.max(0, Math.min(1, (0.1 - distance) / 0.08));
    return normalizedDistance;
  }

  private calculatePalmRotation(landmarks: NormalizedLandmark[]): number {
    // Use wrist, middle finger MCP, and pinky MCP to determine palm orientation
    const wrist = landmarks[0];
    const middleMCP = landmarks[9];
    const pinkyMCP = landmarks[17];

    // Calculate palm normal vector
    const palmVector = {
      x: pinkyMCP.x - middleMCP.x,
      y: pinkyMCP.y - middleMCP.y
    };

    // Convert to rotation value (-1 to 1)
    const angle = Math.atan2(palmVector.y, palmVector.x);
    return Math.max(-1, Math.min(1, angle / Math.PI));
  }

  private calculatePalmTilt(landmarks: NormalizedLandmark[]): number {
    // Use wrist and middle finger MCP for tilt calculation
    const wrist = landmarks[0];
    const middleMCP = landmarks[9];

    const tiltVector = {
      x: middleMCP.x - wrist.x,
      y: middleMCP.y - wrist.y
    };

    // Convert vertical component to tilt value (-1 to 1)
    return Math.max(-1, Math.min(1, tiltVector.y * 2));
  }

  private smooth(current: number, previous: number): number {
    return previous * this.smoothingFactor + current * (1 - this.smoothingFactor);
  }
}
```

### 3. Hand Gesture Controls (`hand-tracking/hand-gesture-controls.ts`)

```typescript
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GestureState } from './gesture-recognizer';
import * as THREE from 'three';

export class HandGestureControls {
  private camera: THREE.Camera;
  private orbitControls: OrbitControls;
  private isEnabled = true;
  
  // Gesture control parameters
  private zoomSensitivity = 10;
  private rotationSensitivity = 2;
  private deadZone = 0.1; // Ignore small movements

  constructor(camera: THREE.Camera, orbitControls: OrbitControls) {
    this.camera = camera;
    this.orbitControls = orbitControls;
  }

  update(gesture: GestureState): void {
    if (!this.isEnabled || !gesture.isHandVisible) return;

    this.handleZoom(gesture.pinchStrength);
    this.handleRotation(gesture.palmRotation, gesture.palmTilt);
  }

  private handleZoom(pinchStrength: number): void {
    if (pinchStrength < this.deadZone) return;

    // Map pinch strength to zoom distance
    const zoomDelta = (pinchStrength - 0.5) * this.zoomSensitivity;
    const currentDistance = this.camera.position.length();
    const newDistance = Math.max(
      this.orbitControls.minDistance,
      Math.min(this.orbitControls.maxDistance, currentDistance - zoomDelta)
    );

    // Apply zoom by scaling camera position
    const direction = this.camera.position.clone().normalize();
    this.camera.position.copy(direction.multiplyScalar(newDistance));
  }

  private handleRotation(palmRotation: number, palmTilt: number): void {
    // Apply dead zone
    const rotationX = Math.abs(palmRotation) > this.deadZone ? palmRotation : 0;
    const rotationY = Math.abs(palmTilt) > this.deadZone ? palmTilt : 0;

    if (rotationX === 0 && rotationY === 0) return;

    // Get current spherical coordinates
    const spherical = new THREE.Spherical();
    spherical.setFromVector3(this.camera.position);

    // Apply rotation
    spherical.theta += rotationX * this.rotationSensitivity * 0.01;
    spherical.phi += rotationY * this.rotationSensitivity * 0.01;

    // Clamp phi to prevent camera flipping
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

    // Update camera position
    this.camera.position.setFromSpherical(spherical);
    this.camera.lookAt(this.orbitControls.target);
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  setSensitivity(zoom: number, rotation: number): void {
    this.zoomSensitivity = zoom;
    this.rotationSensitivity = rotation;
  }
}
```

### 4. Main Integration (`script.ts` modifications)

```typescript
// Add imports
import { HandTracker } from './hand-tracking/hand-tracker';
import { GestureRecognizer } from './hand-tracking/gesture-recognizer';
import { HandGestureControls } from './hand-tracking/hand-gesture-controls';

// After existing controls setup
const controls = new OrbitControls(fakeCamera, canvas);
// ... existing control configuration ...

// Add hand tracking system
const handTracker = new HandTracker();
const gestureRecognizer = new GestureRecognizer();
const handControls = new HandGestureControls(fakeCamera, controls);

// Initialize hand tracking
handTracker.initialize().then(() => {
  console.log('Hand tracking initialized');
});

handTracker.onResults((results) => {
  const gesture = gestureRecognizer.recognizeGestures(results.landmarks);
  handControls.update(gesture);
  
  // Optional: Draw debug landmarks
  handTracker.drawDebugLandmarks(results);
});

// Add hand control toggle to GUI
document.getElementById("btn-hand-toggle")?.addEventListener("click", () => {
  const isEnabled = handControls.setEnabled(!handControls.isEnabled);
  console.log('Hand controls:', isEnabled ? 'enabled' : 'disabled');
});

// Add debug view toggle
document.getElementById("btn-hand-debug")?.addEventListener("click", () => {
  handTracker.toggleDebugView();
});

// Enhanced animation loop
function tick() {
  elapsedTime += clock.getDelta() * options.speed;

  // Update solar system
  for (const object of Object.values(solarSystem)) {
    object.tick(elapsedTime);
  }

  // Update both control systems
  controls.update();        // Mouse controls
  // Hand controls are updated via callback

  // ... rest of existing animation loop
}
```

## UI Integration

### Camera Permission Setup (`index.html`)

```html
<!-- Add camera permission request -->
<div id="camera-permission" style="display: none;">
  <p>This app needs camera access for hand tracking.</p>
  <button onclick="requestCameraPermission()">Enable Camera</button>
</div>

<!-- Add control buttons -->
<div class="hand-controls">
  <button id="btn-hand-toggle">Toggle Hand Controls</button>
  <button id="btn-hand-debug">Show Hand Debug</button>
</div>
```

### Enhanced GUI Controls

```typescript
// Add to gui.ts
gui.add({ handEnabled: true }, 'handEnabled')
  .name('Hand Controls')
  .onChange((value: boolean) => {
    handControls.setEnabled(value);
  });

gui.add({ zoomSensitivity: 10 }, 'zoomSensitivity', 1, 20)
  .name('Hand Zoom Speed')
  .onChange((value: number) => {
    handControls.setSensitivity(value, rotationSensitivity);
  });

gui.add({ rotationSensitivity: 2 }, 'rotationSensitivity', 0.5, 5)
  .name('Hand Rotation Speed')
  .onChange((value: number) => {
    handControls.setSensitivity(zoomSensitivity, value);
  });
```

## Gesture Control Mapping

### Zoom Control
- **Pinch Gesture**: Thumb and index finger distance
- **Zoom In**: Pinch fingers together (distance < 0.05)
- **Zoom Out**: Spread fingers apart (distance > 0.1)
- **Sensitivity**: Configurable via GUI (1-20 range)

### Rotation Control
- **Palm Rotation**: Hand rotation around Y-axis for horizontal camera orbit
- **Palm Tilt**: Hand tilt for vertical camera orbit
- **Dead Zone**: 0.1 threshold to prevent jittery movement
- **Smoothing**: 70% previous + 30% current for fluid motion

### Fallback Strategy
- **Mouse Always Works**: Hand tracking is additive, not replacement
- **Automatic Disable**: Hand controls pause if no hands detected
- **Error Handling**: Graceful fallback if camera/MediaPipe fails
- **Performance**: Hand tracking runs at 30fps, rendering at 60fps

## Performance Optimization

### Frame Rate Management
```typescript
// Separate hand tracking from rendering
const HAND_TRACKING_FPS = 30;
const handTrackingInterval = 1000 / HAND_TRACKING_FPS;

let lastHandUpdate = 0;
function tick() {
  const now = performance.now();
  
  // Update hand tracking at reduced rate
  if (now - lastHandUpdate > handTrackingInterval) {
    // Process hand tracking
    lastHandUpdate = now;
  }
  
  // Render at full 60fps
  render();
}
```

### Web Worker Implementation (Optional)
```typescript
// For CPU-intensive hand processing
const handWorker = new Worker('./hand-worker.js');
handWorker.postMessage({ videoFrame: canvas.getImageData() });
handWorker.onmessage = (event) => {
  const gesture = event.data;
  handControls.update(gesture);
};
```

## Testing and Debugging

### Debug Features
- **Hand Landmark Visualization**: Overlay showing detected hand points
- **Gesture Value Display**: Real-time gesture strength indicators
- **Performance Monitor**: FPS counter for hand tracking vs rendering
- **Error Console**: MediaPipe initialization and runtime errors

### Browser Compatibility
- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Supported with performance considerations
- **Safari**: Limited support, may require polyfills
- **Mobile**: Works on modern mobile browsers

## Implementation Timeline

**Phase 1 (Week 1)**: Core MediaPipe integration and hand detection
**Phase 2 (Week 2)**: Pinch zoom gesture implementation
**Phase 3 (Week 3)**: Palm rotation controls for camera orbit
**Phase 4 (Week 4)**: Polish, optimization, and UI integration

This implementation maintains full backward compatibility while adding intuitive hand gesture controls that complement the existing mouse interface.