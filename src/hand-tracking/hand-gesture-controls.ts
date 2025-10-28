import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GestureState } from './gesture-types';
import * as THREE from 'three';

export class HandGestureControls {
  private camera: THREE.Camera;
  private orbitControls: OrbitControls;
  private isEnabled = true;
  
  // Gesture control parameters
  private zoomSensitivity = 10;
  private rotationSensitivity = 2;
  private deadZone = 0.1; // Ignore small movements

  // Internal state for smooth control
  private targetRotation = { x: 0, y: 0 };
  private currentRotation = { x: 0, y: 0 };
  private rotationSmoothness = 0.1;

  constructor(camera: THREE.Camera, orbitControls: OrbitControls) {
    this.camera = camera;
    this.orbitControls = orbitControls;
  }

  update(gesture: GestureState): void {
    if (!this.isEnabled || !gesture.isHandVisible) {
      return;
    }

    this.handleZoom(gesture.pinchStrength);
    this.handleRotation(gesture.palmRotation, gesture.palmTilt);
  }

  private handleZoom(pinchStrength: number): void {
    if (pinchStrength < this.deadZone) return;

    // Map pinch strength to zoom speed
    // Higher pinch strength = zoom in faster
    const zoomDirection = pinchStrength > 0.5 ? -1 : 1; // Pinch = zoom in
    const zoomSpeed = Math.abs(pinchStrength - 0.5) * 2; // 0-1 range
    
    const zoomDelta = zoomDirection * zoomSpeed * this.zoomSensitivity * 0.1;
    
    // Get current distance from target
    const currentDistance = this.camera.position.distanceTo(this.orbitControls.target);
    const newDistance = Math.max(
      this.orbitControls.minDistance,
      Math.min(this.orbitControls.maxDistance, currentDistance + zoomDelta)
    );

    // Apply zoom by scaling camera position relative to target
    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, this.orbitControls.target)
      .normalize();
    
    this.camera.position.copy(
      this.orbitControls.target.clone().add(direction.multiplyScalar(newDistance))
    );
  }

  private handleRotation(palmRotation: number, palmTilt: number): void {
    // Apply dead zone
    const rotationX = Math.abs(palmRotation) > this.deadZone ? palmRotation : 0;
    const rotationY = Math.abs(palmTilt) > this.deadZone ? palmTilt : 0;

    if (rotationX === 0 && rotationY === 0) {
      return;
    }

    // Update target rotation
    this.targetRotation.x += rotationX * this.rotationSensitivity * 0.02;
    this.targetRotation.y += rotationY * this.rotationSensitivity * 0.02;

    // Smooth interpolation to target rotation
    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * this.rotationSmoothness;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * this.rotationSmoothness;

    // Get current spherical coordinates relative to target
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.orbitControls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    // Apply rotation
    spherical.theta += this.currentRotation.x;
    spherical.phi += this.currentRotation.y;

    // Clamp phi to prevent camera flipping
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

    // Update camera position
    const newPosition = new THREE.Vector3().setFromSpherical(spherical);
    this.camera.position.copy(this.orbitControls.target.clone().add(newPosition));
    this.camera.lookAt(this.orbitControls.target);

    // Decay the rotation for smooth stopping
    this.targetRotation.x *= 0.95;
    this.targetRotation.y *= 0.95;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log('Hand gesture controls:', enabled ? 'enabled' : 'disabled');
  }

  getEnabled(): boolean {
    return this.isEnabled;
  }

  setSensitivity(zoom?: number, rotation?: number): void {
    if (zoom !== undefined) this.zoomSensitivity = zoom;
    if (rotation !== undefined) this.rotationSensitivity = rotation;
    console.log(`Hand control sensitivity - Zoom: ${this.zoomSensitivity}, Rotation: ${this.rotationSensitivity}`);
  }

  setDeadZone(deadZone: number): void {
    this.deadZone = Math.max(0, Math.min(1, deadZone));
    console.log(`Hand control dead zone: ${this.deadZone}`);
  }

  // Debug method to get current control state
  getDebugInfo(): any {
    return {
      enabled: this.isEnabled,
      zoomSensitivity: this.zoomSensitivity,
      rotationSensitivity: this.rotationSensitivity,
      deadZone: this.deadZone,
      currentRotation: { ...this.currentRotation },
      targetRotation: { ...this.targetRotation },
      cameraDistance: this.camera.position.distanceTo(this.orbitControls.target)
    };
  }
}