/**
 * Camera module to manage webcam media stream lifecycle and error handling.
 */

let activeStream = null;

/**
 * Requests camera permissions and attaches the video stream to the video element.
 * @param {HTMLVideoElement} videoElement
 * @returns {Promise<MediaStream>}
 */
export async function startCamera(videoElement) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Your browser does not support webcam access via navigator.mediaDevices.getUserMedia.');
  }

  // Stop any existing stream before starting a new one
  stopCamera(videoElement);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false
    });

    activeStream = stream;
    videoElement.srcObject = stream;

    // Wait until video has loaded enough data to play and has valid dimensions
    await new Promise((resolve) => {
      videoElement.onloadeddata = () => {
        videoElement.play().then(resolve).catch(resolve);
      };
    });

    return stream;
  } catch (err) {
    const friendlyError = classifyCameraError(err);
    throw new Error(friendlyError);
  }
}

/**
 * Stops all tracks on the active camera stream and detaches it from the video element.
 * @param {HTMLVideoElement} videoElement
 */
export function stopCamera(videoElement) {
  if (activeStream) {
    activeStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (e) {
        console.warn('Error stopping track:', e);
      }
    });
    activeStream = null;
  }

  if (videoElement) {
    videoElement.pause();
    videoElement.srcObject = null;
  }
}

/**
 * Converts raw browser media errors into clear user-friendly error messages.
 * @param {Error} error
 * @returns {string}
 */
function classifyCameraError(error) {
  switch (error.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera access was denied. Please allow webcam permissions in your browser and try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera device detected. Please connect a webcam and try again.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Camera is currently in use by another application or browser tab.';
    case 'OverconstrainedError':
      return 'Camera requested constraints could not be satisfied by your video device.';
    default:
      return `Camera error: ${error.message || error.name || 'Failed to access webcam.'}`;
  }
}
