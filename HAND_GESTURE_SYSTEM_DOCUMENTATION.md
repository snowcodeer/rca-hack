# Hand Gesture System Documentation

## Overview

This Three.js solar system application features a comprehensive hand gesture control system that allows users to navigate through space using natural hand movements. The system uses Google's MediaPipe for real-time hand tracking and provides an intuitive alternative to traditional mouse controls.

## Technology Stack

### Core Dependencies
- **MediaPipe Tasks Vision** (`@mediapipe/tasks-vision`): Google's machine learning framework for hand landmark detection
- **Three.js**: 3D graphics library for camera manipulation
- **WebRTC getUserMedia API**: Camera access for video input

### Browser Compatibility
- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Supported with good performance
- **Safari**: Limited support, may require fallbacks
- **Mobile**: Works on modern mobile browsers

## System Architecture

### 1. Hand Tracking Pipeline (`hand-tracker.ts`)

**MediaPipe Integration:**
```typescript
// Model Configuration
{
  baseOptions: {
    modelAssetPath: "hand_landmarker.task",
    delegate: "GPU"
  },
  runningMode: "VIDEO",
  numHands: 2,
  minHandDetectionConfidence: 0.5,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5
}
```

**Key Features:**
- **21 Hand Landmarks**: Precise finger and palm joint tracking
- **Real-time Processing**: 30 FPS hand detection
- **GPU Acceleration**: Hardware-accelerated inference
- **Dual Hand Support**: Tracks up to 2 hands simultaneously
- **Debug Visualization**: Optional hand landmark overlay

### 2. Gesture Recognition (`gesture-recognizer.ts`)

**Core Gesture Detection:**

#### Pinch Gesture
```typescript
private calculatePinchStrength(landmarks: NormalizedLandmark[]): number {
  const thumbTip = landmarks[4];   // Thumb tip landmark
  const indexTip = landmarks[8];   // Index finger tip landmark
  
  const distance = Math.sqrt(
    Math.pow(thumbTip.x - indexTip.x, 2) + 
    Math.pow(thumbTip.y - indexTip.y, 2)
  );
  
  // Normalize to 0-1 range for zoom control
  return Math.max(0, Math.min(1, (0.1 - distance) / 0.08));
}
```

#### Palm Orientation
```typescript
private calculatePalmRotation(landmarks: NormalizedLandmark[]): number {
  const wrist = landmarks[0];      // Wrist landmark
  const middleMCP = landmarks[9];  // Middle finger base
  const pinkyMCP = landmarks[17];  // Pinky finger base
  
  // Calculate palm vector for rotation detection
  const palmVector = {
    x: pinkyMCP.x - middleMCP.x,
    y: pinkyMCP.y - middleMCP.y
  };
  
  // Convert to -1 to 1 range for camera control
  return Math.max(-1, Math.min(1, Math.atan2(palmVector.y, palmVector.x) / Math.PI));
}
```

#### Movement Detection
```typescript
private calculateIsMoving(landmarks: NormalizedLandmark[]): boolean {
  const wrist = landmarks[0];
  const currentPosition = { x: wrist.x, y: wrist.y };
  
  // Track wrist movement to detect active gestures
  const distance = Math.sqrt(
    Math.pow(currentPosition.x - this.previousHandPosition.x, 2) +
    Math.pow(currentPosition.y - this.previousHandPosition.y, 2)
  );
  
  return distance > 0.02; // Movement threshold
}
```

### 3. Camera Control (`hand-gesture-controls.ts`)

**Zoom Control:**
```typescript
private handleZoom(pinchStrength: number): void {
  const zoomDirection = pinchStrength > 0.5 ? -1 : 1;
  const zoomSpeed = Math.abs(pinchStrength - 0.5) * 2;
  const zoomDelta = zoomDirection * zoomSpeed * this.zoomSensitivity * 0.1;
  
  // Apply zoom with distance constraints
  const newDistance = Math.max(
    this.orbitControls.minDistance,
    Math.min(this.orbitControls.maxDistance, currentDistance + zoomDelta)
  );
}
```

**Rotation Control:**
```typescript
private handleRotation(palmRotation: number, palmTilt: number): void {
  const rotationSpeed = this.rotationSensitivity * 0.005; // Very slow multiplier
  
  // Convert to spherical coordinates for smooth camera orbit
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta += palmRotation * rotationSpeed;  // Horizontal
  spherical.phi += palmTilt * rotationSpeed;        // Vertical
  
  // Apply position with constraints
  spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
}
```

## Gesture Mapping

### Primary Gestures

| Gesture | Hand Position | Camera Action | Sensitivity |
|---------|---------------|---------------|-------------|
| **🤏 Pinch** | Thumb + index finger together | Zoom in/out | 5x multiplier |
| **✋ Palm Rotation** | Rotate hand left/right | Horizontal orbit | 0.5x multiplier |
| **🫴 Palm Tilt** | Tilt hand up/down | Vertical orbit | 0.5x multiplier |
| **🛑 Keep Still** | No hand movement | Stop all camera motion | N/A |

### Control Parameters

```typescript
// Sensitivity Settings
private zoomSensitivity = 5;        // Moderate zoom speed
private rotationSensitivity = 0.5;  // Slow rotation speed
private deadZone = 0.1;             // Minimum gesture threshold
private movementThreshold = 0.02;   // Hand movement detection
```

### Gesture Smoothing

```typescript
// Applied to reduce jitter and create smooth motion
private smoothingFactor = 0.7;

// Smoothing function
private smooth(current: number, previous: number): number {
  return previous * this.smoothingFactor + current * (1 - this.smoothingFactor);
}
```

## Performance Optimization

### Frame Rate Management
- **Hand Tracking**: 30 FPS processing
- **Rendering**: 60 FPS scene updates
- **Gesture Processing**: Real-time with smoothing

### Hardware Acceleration
- **GPU Delegate**: MediaPipe uses GPU when available
- **WebGL Rendering**: Hardware-accelerated 3D graphics
- **Efficient Landmark Processing**: Optimized coordinate transformations

### Memory Management
```typescript
// Cleanup on component destruction
destroy(): void {
  if (this.video.srcObject) {
    const stream = this.video.srcObject as MediaStream;
    stream.getTracks().forEach(track => track.stop());
  }
}
```

## User Interface Integration

### Camera Permission Flow
1. **Initial Load**: MediaPipe initializes without camera access
2. **User Activation**: Click hand button triggers permission modal
3. **Permission Grant**: Browser prompts for camera access
4. **Tracking Start**: Hand detection begins automatically

### Status Indicators
```typescript
// Real-time gesture feedback
updateHandStatus(cameraStatus, handCount, gestureStatus) {
  // Updates: Camera state, Hand count, Active gestures
}
```

### Debug Features
- **Hand Landmark Overlay**: Visual debugging of hand detection
- **Gesture State Display**: Real-time gesture values
- **Performance Monitoring**: FPS and processing metrics

## Configuration Options

### MediaPipe Settings
```typescript
// Hand detection parameters
numHands: 2,                           // Maximum hands to track
minHandDetectionConfidence: 0.5,       // Detection threshold
minHandPresenceConfidence: 0.5,        // Presence threshold  
minTrackingConfidence: 0.5             // Tracking threshold
```

### Camera Configuration
```typescript
// Video stream settings
video: { 
  width: { ideal: 640 }, 
  height: { ideal: 480 },
  facingMode: 'user'  // Front-facing camera
}
```

### Control Sensitivity
```typescript
// Adjustable via GUI
setSensitivity(zoom?: number, rotation?: number): void {
  if (zoom !== undefined) this.zoomSensitivity = zoom;
  if (rotation !== undefined) this.rotationSensitivity = rotation;
}
```

## Error Handling

### Camera Access Errors
```typescript
// Specific error handling for different failure modes
if (error.name === 'NotAllowedError') {
  throw new Error('Camera access denied. Please allow camera permissions and refresh.');
} else if (error.name === 'NotFoundError') {
  throw new Error('No camera found. Please connect a camera and refresh.');
} else if (error.name === 'NotReadableError') {
  throw new Error('Camera is being used by another application.');
}
```

### MediaPipe Initialization
```typescript
// Graceful fallback for MediaPipe failures
handTracker.initialize().catch((error) => {
  console.warn('⚠️ MediaPipe initialization failed:', error.message);
  updateHandStatus('MediaPipe Failed', 0, 'Refresh to retry');
});
```

## Integration with Solar System

### Dual Control System
- **Mouse Controls**: Always available via OrbitControls
- **Hand Controls**: Additive gesture control system
- **Seamless Switching**: Both systems update the same camera

### Focus System Integration
```typescript
// Hand controls respect current planetary focus
controls.target = solarSystem[options.focus].mesh.position;
controls.minDistance = solarSystem[options.focus].getMinDistance();
```

## Development Notes

### File Structure
```
src/hand-tracking/
├── gesture-types.ts          # TypeScript interfaces
├── hand-tracker.ts           # MediaPipe integration
├── gesture-recognizer.ts     # Gesture detection logic
└── hand-gesture-controls.ts  # Camera control implementation
```

### Dependencies
```json
{
  "@mediapipe/tasks-vision": "^0.10.22-rc.20250304",
  "three": "^0.153.0"
}
```

### Browser Requirements
- **Camera Access**: Required for hand tracking
- **WebGL Support**: Required for Three.js rendering
- **ES6 Modules**: Modern JavaScript support
- **getUserMedia API**: Camera access capability

## Future Enhancements

### Potential Improvements
1. **Additional Gestures**: Peace sign, OK sign for specific actions
2. **Voice Integration**: Combine with voice commands
3. **Multi-hand Actions**: Two-hand gestures for advanced control
4. **Gesture Customization**: User-defined gesture mappings
5. **Performance Optimization**: Further reduce latency

### Accessibility Considerations
- **Alternative Input**: Mouse controls always available
- **Visual Feedback**: Clear gesture state indicators
- **Error Recovery**: Graceful fallbacks for technical issues
- **User Choice**: Optional hand tracking activation

This hand gesture system provides an innovative and intuitive way to explore the solar system, making space navigation feel natural and immersive while maintaining accessibility through dual control options.