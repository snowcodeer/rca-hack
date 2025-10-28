import { HandLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { HandData } from './gesture-types';

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
    try {
      console.log('Initializing MediaPipe...');
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
      console.log('MediaPipe initialized, ready for camera access');
    } catch (error) {
      console.error('Failed to initialize MediaPipe:', error);
      throw error;
    }
  }

  async requestCamera(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MediaPipe not initialized. Call initialize() first.');
    }
    
    try {
      await this.startVideoStream();
      console.log('Camera access granted and tracking started');
    } catch (error) {
      console.error('Camera access failed:', error);
      throw error;
    }
  }

  private setupVideo(): void {
    this.video = document.createElement('video');
    this.video.style.display = 'none';
    this.video.autoplay = true;
    this.video.playsInline = true;
    document.body.appendChild(this.video);
  }

  private setupCanvas(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'hand-debug-canvas';
    this.canvas.width = 320;
    this.canvas.height = 240;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '10px';
    this.canvas.style.left = '10px';
    this.canvas.style.width = '320px';
    this.canvas.style.height = '240px';
    this.canvas.style.zIndex = '1000';
    this.canvas.style.border = '2px solid #00ff00';
    this.canvas.style.display = 'none'; // Hidden by default
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  private async startVideoStream(): Promise<void> {
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }

      console.log('Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: 'user' // Front-facing camera
        }
      });
      
      this.video.srcObject = stream;
      
      return new Promise((resolve, reject) => {
        this.video.addEventListener('loadedmetadata', () => {
          this.video.play().then(() => {
            console.log('Video stream started successfully');
            this.processVideoFrame();
            resolve();
          }).catch(reject);
        });
        
        this.video.addEventListener('error', (e) => {
          console.error('Video error:', e);
          reject(new Error('Video playback failed'));
        });
        
        // Timeout after 10 seconds
        setTimeout(() => {
          reject(new Error('Camera setup timeout'));
        }, 10000);
      });
    } catch (error: any) {
      console.error('Failed to access camera:', error);
      
      // Provide specific error messages
      if (error.name === 'NotAllowedError') {
        throw new Error('Camera access denied. Please allow camera permissions and refresh.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No camera found. Please connect a camera and refresh.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Camera is being used by another application.');
      } else if (error.name === 'OverconstrainedError') {
        throw new Error('Camera does not meet the required specifications.');
      } else {
        throw new Error('Camera access failed: ' + (error.message || 'Unknown error'));
      }
    }
  }

  private processVideoFrame(): void {
    if (!this.isInitialized || !this.handLandmarker) return;

    try {
      const startTimeMs = performance.now();
      const results = this.handLandmarker.detectForVideo(this.video, startTimeMs);

      if (this.onResultsCallback) {
        this.onResultsCallback({
          landmarks: results.landmarks,
          worldLandmarks: results.worldLandmarks,
          handedness: results.handedness
        });
      }

      // Draw debug visualization if enabled
      this.drawDebugLandmarks({
        landmarks: results.landmarks,
        worldLandmarks: results.worldLandmarks,
        handedness: results.handedness
      });

    } catch (error) {
      console.error('Error processing video frame:', error);
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
    console.log('Hand debug view:', display === 'block' ? 'enabled' : 'disabled');
  }

  drawDebugLandmarks(results: HandData): void {
    if (this.canvas.style.display === 'none') return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw video background (scaled down)
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    
    if (results.landmarks.length > 0) {
      try {
        const drawingUtils = new DrawingUtils(this.ctx);
        
        for (let i = 0; i < results.landmarks.length; i++) {
          const landmarks = results.landmarks[i];
          const handedness = results.handedness[i]?.[0]?.categoryName || 'Unknown';
          
          // Scale landmarks to canvas size
          const scaledLandmarks = landmarks.map(landmark => ({
            x: landmark.x * this.canvas.width,
            y: landmark.y * this.canvas.height,
            z: landmark.z
          }));

          // Draw hand connections
          drawingUtils.drawConnectors(scaledLandmarks, HandLandmarker.HAND_CONNECTIONS, {
            color: '#00FF00',
            lineWidth: 2
          });
          
          // Draw landmarks
          drawingUtils.drawLandmarks(scaledLandmarks, {
            color: '#FF0000',
            lineWidth: 1,
            radius: 3
          });

          // Draw hand label
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.font = '16px Arial';
          this.ctx.fillText(`${handedness} Hand`, 10, 30 + (i * 20));
        }
      } catch (error) {
        console.warn('Error drawing debug landmarks:', error);
      }
    }

    // Draw info text
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '12px Arial';
    this.ctx.fillText(`Hands detected: ${results.landmarks.length}`, 10, this.canvas.height - 10);
  }

  destroy(): void {
    if (this.video.srcObject) {
      const stream = this.video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
    if (this.video.parentNode) {
      this.video.parentNode.removeChild(this.video);
    }
    
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}