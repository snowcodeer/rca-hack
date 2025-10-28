import { NormalizedLandmark, GestureState } from './gesture-types';

export class GestureRecognizer {
  private previousGesture: GestureState | null = null;
  private smoothingFactor = 0.7; // For gesture smoothing

  recognizeGestures(landmarks: any[][]): GestureState {
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
    
    if (!thumbTip || !indexTip) return 0;

    const distance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + 
      Math.pow(thumbTip.y - indexTip.y, 2)
    );

    // Normalize distance to 0-1 range (adjust based on testing)
    // Closer fingers = higher pinch strength
    const maxDistance = 0.15; // Maximum realistic pinch distance
    const minDistance = 0.02; // Minimum distance for full pinch
    
    const normalizedDistance = Math.max(0, Math.min(1, 
      (maxDistance - distance) / (maxDistance - minDistance)
    ));
    
    return normalizedDistance;
  }

  private calculatePalmRotation(landmarks: NormalizedLandmark[]): number {
    // Use wrist, middle finger MCP, and pinky MCP to determine palm orientation
    const wrist = landmarks[0];
    const middleMCP = landmarks[9];
    const pinkyMCP = landmarks[17];

    if (!wrist || !middleMCP || !pinkyMCP) return 0;

    // Calculate palm vector (from middle to pinky)
    const palmVector = {
      x: pinkyMCP.x - middleMCP.x,
      y: pinkyMCP.y - middleMCP.y
    };

    // Convert to rotation value (-1 to 1)
    // Positive values = hand rotated clockwise (right)
    // Negative values = hand rotated counter-clockwise (left)
    const angle = Math.atan2(palmVector.y, palmVector.x);
    return Math.max(-1, Math.min(1, angle / Math.PI));
  }

  private calculatePalmTilt(landmarks: NormalizedLandmark[]): number {
    // Use wrist and middle finger MCP for tilt calculation
    const wrist = landmarks[0];
    const middleMCP = landmarks[9];

    if (!wrist || !middleMCP) return 0;

    const tiltVector = {
      x: middleMCP.x - wrist.x,
      y: middleMCP.y - wrist.y
    };

    // Convert vertical component to tilt value (-1 to 1)
    // Positive values = hand tilted up
    // Negative values = hand tilted down
    return Math.max(-1, Math.min(1, -tiltVector.y * 3)); // Negative for intuitive up/down
  }

  private smooth(current: number, previous: number): number {
    return previous * this.smoothingFactor + current * (1 - this.smoothingFactor);
  }

  // Debug method to get detailed gesture info
  getGestureDebugInfo(landmarks: any[][]): any {
    if (landmarks.length === 0) return null;

    const primaryHand = landmarks[0];
    const thumbTip = primaryHand[4];
    const indexTip = primaryHand[8];
    const wrist = primaryHand[0];
    const middleMCP = primaryHand[9];

    return {
      thumbTip: { x: thumbTip?.x, y: thumbTip?.y },
      indexTip: { x: indexTip?.x, y: indexTip?.y },
      pinchDistance: thumbTip && indexTip ? Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) + 
        Math.pow(thumbTip.y - indexTip.y, 2)
      ) : 0,
      wrist: { x: wrist?.x, y: wrist?.y },
      middleMCP: { x: middleMCP?.x, y: middleMCP?.y }
    };
  }
}