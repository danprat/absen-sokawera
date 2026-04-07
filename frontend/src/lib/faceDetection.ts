import { FaceDetector, FilesetResolver, Detection } from '@mediapipe/tasks-vision';

// Face stability tracking state
export interface FaceStability {
  detectionCount: number;
  lastPosition: BoundingBox | null;
  isStable: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Configuration constants
const STABILITY_FRAMES_REQUIRED = 5;
const STABILITY_POSITION_THRESHOLD = 0.05; // 5% of frame
const STABILITY_SIZE_THRESHOLD = 0.1; // 10% size change

let faceDetector: FaceDetector | null = null;
let isInitializing = false;

/**
 * Initialize MediaPipe FaceDetector
 * Loads the model from CDN and creates detector instance
 */
export async function initializeFaceDetector(): Promise<FaceDetector> {
  if (faceDetector) {
    return faceDetector;
  }

  if (isInitializing) {
    // Wait for existing initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    return initializeFaceDetector();
  }

  try {
    isInitializing = true;

    // Load WASM files from CDN
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    // Create FaceDetector
    faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
        delegate: 'GPU', // Use GPU acceleration if available
      },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    });

    isInitializing = false;
    return faceDetector;
  } catch (error) {
    isInitializing = false;
    console.error('Failed to initialize FaceDetector:', error);
    throw new Error('Face detection not available on this device');
  }
}

/**
 * Detect faces in video element
 * Returns array of detected faces with bounding boxes
 */
export async function detectFaces(
  videoElement: HTMLVideoElement,
  timestamp?: number
): Promise<Detection[]> {
  if (!faceDetector) {
    throw new Error('FaceDetector not initialized. Call initializeFaceDetector() first.');
  }

  try {
    const detections = faceDetector.detectForVideo(
      videoElement,
      timestamp || performance.now()
    );
    return detections.detections;
  } catch (error) {
    console.error('Face detection error:', error);
    return [];
  }
}

/**
 * Convert MediaPipe Detection to BoundingBox
 */
export function detectionToBoundingBox(detection: Detection): BoundingBox {
  const bbox = detection.boundingBox;
  return {
    x: bbox?.originX || 0,
    y: bbox?.originY || 0,
    width: bbox?.width || 0,
    height: bbox?.height || 0,
  };
}

/**
 * Calculate position delta between two bounding boxes
 * Returns normalized value (0-1) relative to frame size
 */
function calculatePositionDelta(
  box1: BoundingBox,
  box2: BoundingBox,
  frameWidth: number,
  frameHeight: number
): number {
  const dx = Math.abs(box1.x - box2.x) / frameWidth;
  const dy = Math.abs(box1.y - box2.y) / frameHeight;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate size delta between two bounding boxes
 * Returns normalized value (0-1)
 */
function calculateSizeDelta(box1: BoundingBox, box2: BoundingBox): number {
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  if (area1 === 0 || area2 === 0) return 1;
  return Math.abs(area1 - area2) / Math.max(area1, area2);
}

/**
 * Update face stability tracker
 * Returns updated stability state
 */
export function updateStabilityTracker(
  detection: Detection | null,
  previousState: FaceStability,
  videoElement: HTMLVideoElement
): FaceStability {
  // No face detected - reset
  if (!detection) {
    return {
      detectionCount: 0,
      lastPosition: null,
      isStable: false,
    };
  }

  const currentBox = detectionToBoundingBox(detection);

  // First detection
  if (!previousState.lastPosition) {
    return {
      detectionCount: 1,
      lastPosition: currentBox,
      isStable: false,
    };
  }

  // Check if face is stable (within thresholds)
  const positionDelta = calculatePositionDelta(
    currentBox,
    previousState.lastPosition,
    videoElement.videoWidth,
    videoElement.videoHeight
  );
  const sizeDelta = calculateSizeDelta(currentBox, previousState.lastPosition);

  const isWithinThreshold =
    positionDelta < STABILITY_POSITION_THRESHOLD &&
    sizeDelta < STABILITY_SIZE_THRESHOLD;

  if (isWithinThreshold) {
    const newCount = previousState.detectionCount + 1;
    return {
      detectionCount: newCount,
      lastPosition: currentBox,
      isStable: newCount >= STABILITY_FRAMES_REQUIRED,
    };
  } else {
    // Face moved too much - reset
    return {
      detectionCount: 1,
      lastPosition: currentBox,
      isStable: false,
    };
  }
}

/**
 * Draw face overlay rectangle on canvas
 */
export function drawFaceOverlay(
  ctx: CanvasRenderingContext2D,
  detection: Detection,
  isStable: boolean,
  canvasWidth: number,
  canvasHeight: number,
  videoWidth: number,
  videoHeight: number
): void {
  const bbox = detectionToBoundingBox(detection);

  // Scale bounding box to canvas size
  const scaleX = canvasWidth / videoWidth;
  const scaleY = canvasHeight / videoHeight;

  const x = bbox.x * scaleX;
  const y = bbox.y * scaleY;
  const width = bbox.width * scaleX;
  const height = bbox.height * scaleY;

  // Clear canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Draw rectangle
  ctx.strokeStyle = isStable ? '#10b981' : '#fbbf24'; // Green if stable, yellow if detecting
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);

  // Draw corner markers for better visibility
  const cornerLength = 20;
  ctx.lineWidth = 4;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(x, y + cornerLength);
  ctx.lineTo(x, y);
  ctx.lineTo(x + cornerLength, y);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + width - cornerLength, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + cornerLength);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x, y + height - cornerLength);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + cornerLength, y + height);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + width - cornerLength, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width, y + height - cornerLength);
  ctx.stroke();
}

/**
 * Check if WebAssembly is supported
 */
export function isWebAssemblySupported(): boolean {
  try {
    if (typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function') {
      const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
      if (module instanceof WebAssembly.Module) {
        return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
      }
    }
  } catch (e) {
    return false;
  }
  return false;
}
