// RAIJIN Camera Lifecycle and MediaStream Manager

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
}

export interface CameraConfig {
  deviceId?: string;
  width: number;
  height: number;
  frameRate: number;
}

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'error';

export class CameraManager {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private status: CameraStatus = 'idle';
  private errorMessage = '';
  private availableDevices: CameraDeviceInfo[] = [];

  public getStatus(): CameraStatus {
    return this.status;
  }

  public getErrorMessage(): string {
    return this.errorMessage;
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  public async getAvailableDevices(): Promise<CameraDeviceInfo[]> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableDevices = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`
        }));
      return this.availableDevices;
    } catch {
      return [];
    }
  }

  /**
   * Initializes and starts webcam video stream
   */
  public async startCamera(
    videoElement: HTMLVideoElement,
    config: CameraConfig = { width: 640, height: 480, frameRate: 30 }
  ): Promise<MediaStream> {
    this.status = 'requesting';
    this.errorMessage = '';
    this.videoElement = videoElement;

    // Clean up previous stream if active
    this.stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.status = 'unavailable';
      this.errorMessage = 'MediaDevices API is not supported in this browser environment.';
      throw new Error(this.errorMessage);
    }

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        deviceId: config.deviceId ? { exact: config.deviceId } : undefined,
        facingMode: config.deviceId ? undefined : 'user',
        width: { ideal: config.width },
        height: { ideal: config.height },
        frameRate: { ideal: config.frameRate, max: 60 }
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream = stream;

      videoElement.srcObject = stream;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('muted', 'true');
      videoElement.muted = true;

      await new Promise<void>((resolve, reject) => {
        videoElement.onloadedmetadata = () => {
          videoElement
            .play()
            .then(() => {
              this.status = 'active';
              resolve();
            })
            .catch(reject);
        };
        videoElement.onerror = () => {
          reject(new Error('Failed to load video element stream'));
        };
      });

      await this.getAvailableDevices();
      return stream;
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        this.status = 'denied';
        this.errorMessage = 'Camera access was denied. Please allow camera permissions to play.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        this.status = 'unavailable';
        this.errorMessage = 'No camera found on this device.';
      } else {
        this.status = 'error';
        this.errorMessage = error.message || 'An error occurred while accessing camera.';
      }
      throw error;
    }
  }

  /**
   * Stops all active video tracks and cleans up resources
   */
  public stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.stop();
      });
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.status = 'idle';
  }
}

export const cameraManager = new CameraManager();
