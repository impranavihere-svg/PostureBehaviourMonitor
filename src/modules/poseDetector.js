/**
 * Pose Detector module using @mediapipe/tasks-vision PoseLandmarker.
 */
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

let poseLandmarker = null;

const WASM_CDN_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/**
 * Initializes and caches the MediaPipe PoseLandmarker instance.
 * @returns {Promise<PoseLandmarker>}
 */
export async function initPoseLandmarker() {
  if (poseLandmarker) {
    return poseLandmarker;
  }

  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN_PATH);

    // Attempt GPU delegate first, fallback to CPU if GPU is unavailable
    try {
      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_ASSET_PATH,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1
      });
    } catch (gpuError) {
      console.warn('GPU acceleration unavailable for PoseLandmarker, falling back to CPU:', gpuError);
      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_ASSET_PATH,
          delegate: 'CPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1
      });
    }

    return poseLandmarker;
  } catch (err) {
    console.error('Failed to initialize MediaPipe Pose Landmarker:', err);
    throw new Error(
      'Pose model initialization failed. Please ensure an active internet connection and that WebAssembly is supported.'
    );
  }
}

/**
 * Detects pose landmarks for a specific video frame.
 * @param {HTMLVideoElement} videoElement
 * @param {number} timestampMs
 * @returns {import('@mediapipe/tasks-vision').PoseLandmarkerResult | null}
 */
export function detectPose(videoElement, timestampMs) {
  if (!poseLandmarker) {
    return null;
  }
  return poseLandmarker.detectForVideo(videoElement, timestampMs);
}

/**
 * Expose pose connection definitions from PoseLandmarker.
 */
export const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;
