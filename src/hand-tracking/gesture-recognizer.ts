import { NormalizedLandmark, GestureState, FingerGestureState, FingerGesture } from './gesture-types';

export class GestureRecognizer {
  private previousGesture: GestureState | null = null;
  private smoothingFactor = 0.8; // Stronger smoothing for stability
  private previousHandPosition: { x: number, y: number } | null = null;
  private movementThreshold = 0.015; // More sensitive movement detection
  
  // Pinch gesture improvements
  private pinchHistory: number[] = [];
  private pinchHistorySize = 5;
  private pinchThresholds = { open: 0.25, closed: 0.7 }; // Hysteresis thresholds
  private lastPinchState = false;
  
  // Hand scale normalization
  private handScale: number | null = null;
  
  // Finger gesture detection
  private gestureHistory: FingerGesture[] = [];
  private gestureHistorySize = 8;
  private lastStableGesture: FingerGesture = 'unknown';

  recognizeGestures(landmarks: any[][]): GestureState {
    if (landmarks.length === 0) {
      return {
        pinchStrength: 0,
        palmRotation: 0,
        palmTilt: 0,
        isHandVisible: false,
        handCount: 0,
        isMoving: false
      };
    }

    const primaryHand = landmarks[0]; // Use first detected hand
    const gesture: GestureState = {
      pinchStrength: this.calculatePinchStrength(primaryHand),
      palmRotation: this.calculatePalmRotation(primaryHand),
      palmTilt: this.calculatePalmTilt(primaryHand),
      isHandVisible: true,
      handCount: landmarks.length,
      isMoving: this.calculateIsMoving(primaryHand)
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

  private calculateIsMoving(landmarks: NormalizedLandmark[]): boolean {
    // Use wrist position to detect hand movement
    const wrist = landmarks[0];
    if (!wrist) return false;

    const currentPosition = { x: wrist.x, y: wrist.y };
    
    if (this.previousHandPosition) {
      const distance = Math.sqrt(
        Math.pow(currentPosition.x - this.previousHandPosition.x, 2) +
        Math.pow(currentPosition.y - this.previousHandPosition.y, 2)
      );
      
      this.previousHandPosition = currentPosition;
      return distance > this.movementThreshold;
    }
    
    this.previousHandPosition = currentPosition;
    return false;
  }


  private calculatePinchStrength(landmarks: NormalizedLandmark[]): number {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const wrist = landmarks[0];
    const indexMCP = landmarks[5];
    
    if (!thumbTip || !indexTip || !wrist || !indexMCP) return 0;

    // Calculate hand scale if not set (wrist to index MCP distance)
    if (this.handScale === null) {
      this.handScale = Math.sqrt(
        Math.pow(wrist.x - indexMCP.x, 2) + 
        Math.pow(wrist.y - indexMCP.y, 2)
      );
    }

    // Calculate pinch distance
    const pinchDistance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + 
      Math.pow(thumbTip.y - indexTip.y, 2)
    );

    // Normalize by hand scale for consistent behavior across hand sizes
    const normalizedDistance = pinchDistance / this.handScale;
    
    // Convert to pinch strength (0 = far apart, 1 = touching)
    let rawPinchStrength = Math.max(0, Math.min(1, 
      (0.8 - normalizedDistance) / 0.6 // Adjusted range for better sensitivity
    ));

    // Add to history for smoothing
    this.pinchHistory.push(rawPinchStrength);
    if (this.pinchHistory.length > this.pinchHistorySize) {
      this.pinchHistory.shift();
    }

    // Use median for stability
    const sortedHistory = [...this.pinchHistory].sort((a, b) => a - b);
    const medianPinch = sortedHistory[Math.floor(sortedHistory.length / 2)];

    // Apply hysteresis to prevent rapid switching
    if (this.lastPinchState) {
      // Currently pinching - require it to go below open threshold to release
      if (medianPinch < this.pinchThresholds.open) {
        this.lastPinchState = false;
      }
    } else {
      // Not pinching - require it to go above closed threshold to activate
      if (medianPinch > this.pinchThresholds.closed) {
        this.lastPinchState = true;
      }
    }

    // Return smooth pinch strength with binary state influence
    return this.lastPinchState ? Math.max(0.6, medianPinch) : Math.min(0.4, medianPinch);
  }

  private calculatePalmRotation(landmarks: NormalizedLandmark[]): number {
    // Use wrist and index MCP for more stable rotation detection
    const wrist = landmarks[0];
    const indexMCP = landmarks[5];
    const pinkyMCP = landmarks[17];

    if (!wrist || !indexMCP || !pinkyMCP) return 0;

    // Calculate two vectors for more stable rotation
    const handVector = {
      x: indexMCP.x - wrist.x,
      y: indexMCP.y - wrist.y
    };
    
    const palmVector = {
      x: pinkyMCP.x - indexMCP.x,
      y: pinkyMCP.y - indexMCP.y
    };

    // Use the cross product to determine rotation direction more reliably
    const crossProduct = handVector.x * palmVector.y - handVector.y * palmVector.x;
    
    // Calculate angle from hand vector to horizontal
    const handAngle = Math.atan2(handVector.y, handVector.x);
    
    // Normalize to -1 to 1 range, with better sensitivity
    let rotation = Math.sin(handAngle) * 1.5; // Amplify sensitivity
    
    // Apply cross product influence for direction stability
    rotation *= Math.sign(crossProduct) || 1;
    
    return Math.max(-1, Math.min(1, rotation));
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

  /**
   * Recognize finger-based gestures
   */
  recognizeFingerGestures(landmarks: any[][]): FingerGestureState {
    if (landmarks.length === 0) {
      return {
        gesture: 'unknown',
        fingerCount: 0,
        confidence: 0,
        isHandVisible: false
      };
    }

    const primaryHand = landmarks[0];
    const fingerCount = this.countExtendedFingers(primaryHand);
    const gesture = this.classifyGesture(fingerCount, primaryHand);
    
    // Add to history for stability
    this.gestureHistory.push(gesture);
    if (this.gestureHistory.length > this.gestureHistorySize) {
      this.gestureHistory.shift();
    }
    
    // Find most common gesture in recent history
    const gestureFreq = this.gestureHistory.reduce((acc, g) => {
      acc[g] = (acc[g] || 0) + 1;
      return acc;
    }, {} as Record<FingerGesture, number>);
    
    const stableGesture = Object.entries(gestureFreq)
      .sort(([,a], [,b]) => b - a)[0]?.[0] as FingerGesture || 'unknown';
    
    // Only update if gesture is stable (appears in >60% of recent history)
    const confidence = (gestureFreq[stableGesture] || 0) / this.gestureHistory.length;
    if (confidence > 0.6) {
      this.lastStableGesture = stableGesture;
    }

    return {
      gesture: this.lastStableGesture,
      fingerCount,
      confidence,
      isHandVisible: true
    };
  }

  /**
   * Count extended fingers using landmark positions
   */
  private countExtendedFingers(landmarks: NormalizedLandmark[]): number {
    if (!landmarks || landmarks.length < 21) return 0;

    let extendedCount = 0;
    
    // Finger tip and joint indices with improved detection
    const fingerData = [
      { tip: 4, pip: 3, mcp: 2, name: 'thumb' },   // Thumb
      { tip: 8, pip: 6, mcp: 5, name: 'index' },   // Index
      { tip: 12, pip: 10, mcp: 9, name: 'middle' }, // Middle
      { tip: 16, pip: 14, mcp: 13, name: 'ring' }, // Ring
      { tip: 20, pip: 18, mcp: 17, name: 'pinky' }  // Pinky
    ];

    fingerData.forEach((finger, index) => {
      const tip = landmarks[finger.tip];
      const pip = landmarks[finger.pip];
      const mcp = landmarks[finger.mcp];
      const wrist = landmarks[0];
      
      if (!tip || !pip || !mcp || !wrist) return;

      let isExtended = false;

      if (index === 0) {
        // Thumb: more sophisticated detection
        // Check if thumb tip is significantly away from palm center
        const palmCenter = {
          x: (landmarks[5].x + landmarks[17].x) / 2, // Index MCP to Pinky MCP
          y: (landmarks[5].y + landmarks[17].y) / 2
        };
        
        const thumbToPalm = Math.sqrt((tip.x - palmCenter.x) ** 2 + (tip.y - palmCenter.y) ** 2);
        const mcpToPalm = Math.sqrt((mcp.x - palmCenter.x) ** 2 + (mcp.y - palmCenter.y) ** 2);
        
        // Thumb is extended if tip is farther from palm center than MCP
        isExtended = thumbToPalm > mcpToPalm * 1.2;
      } else {
        // Other fingers: improved curl detection
        // Calculate vectors for better angle detection
        const mcpToPip = {
          x: pip.x - mcp.x,
          y: pip.y - mcp.y
        };
        
        const pipToTip = {
          x: tip.x - pip.x,
          y: tip.y - pip.y
        };
        
        // Calculate angle between segments (dot product)
        const dotProduct = mcpToPip.x * pipToTip.x + mcpToPip.y * pipToTip.y;
        const mcpPipLength = Math.sqrt(mcpToPip.x ** 2 + mcpToPip.y ** 2);
        const pipTipLength = Math.sqrt(pipToTip.x ** 2 + pipToTip.y ** 2);
        
        if (mcpPipLength > 0 && pipTipLength > 0) {
          const cosAngle = dotProduct / (mcpPipLength * pipTipLength);
          
          // If angle is close to straight (cosAngle close to 1), finger is extended
          // Also check that tip is above MCP (extended upward)
          const heightExtended = tip.y < mcp.y * 1.05; // Small tolerance
          const angleExtended = cosAngle > 0.5; // Angle threshold for extension
          
          isExtended = heightExtended && angleExtended;
        }
        
        // Additional check: ensure tip is significantly above PIP
        if (!isExtended) {
          const tipAbovePip = (pip.y - tip.y) > Math.abs(pip.y - mcp.y) * 0.3;
          isExtended = tipAbovePip;
        }
      }

      if (isExtended) {
        extendedCount++;
      }
    });

    return extendedCount;
  }

  /**
   * Classify gesture based on finger count and hand shape
   */
  private classifyGesture(fingerCount: number, landmarks: NormalizedLandmark[]): FingerGesture {
    switch (fingerCount) {
      case 0:
        return 'closed_fist';
      case 1:
        return 'one_finger';
      case 2:
        return 'two_fingers';
      case 5:
        return 'open_palm';
      default:
        return 'unknown';
    }
  }

  // Debug method to get detailed gesture info
  getGestureDebugInfo(landmarks: any[][]): any {
    if (landmarks.length === 0) return null;

    const primaryHand = landmarks[0];
    const thumbTip = primaryHand[4];
    const indexTip = primaryHand[8];
    const wrist = primaryHand[0];
    const middleMCP = primaryHand[9];
    
    const fingerGesture = this.recognizeFingerGestures(landmarks);

    return {
      thumbTip: { x: thumbTip?.x, y: thumbTip?.y },
      indexTip: { x: indexTip?.x, y: indexTip?.y },
      pinchDistance: thumbTip && indexTip ? Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) + 
        Math.pow(thumbTip.y - indexTip.y, 2)
      ) : 0,
      wrist: { x: wrist?.x, y: wrist?.y },
      middleMCP: { x: middleMCP?.x, y: middleMCP?.y },
      isMoving: this.calculateIsMoving(primaryHand),
      fingerGesture: fingerGesture,
      fingerCount: this.countExtendedFingers(primaryHand)
    };
  }
}