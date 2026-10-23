/**
 * Posture Calculator Module
 * Calculates Head/Neck Angle, Torso Inclination, and Shoulder Alignment from MediaPipe pose landmarks.
 */

// Landmark index constants based on MediaPipe Pose topology
export const POSE_LANDMARKS = {
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24
};

const MIN_CONFIDENCE = 0.5;

/**
 * Checks if a landmark is present and meets the minimum visibility/confidence threshold.
 * @param {object} landmark
 * @param {number} minConfidence
 * @returns {boolean}
 */
export function isLandmarkValid(landmark, minConfidence = MIN_CONFIDENCE) {
  if (!landmark || typeof landmark.x !== 'number' || typeof landmark.y !== 'number') {
    return false;
  }
  if (typeof landmark.visibility === 'number' && landmark.visibility < minConfidence) {
    return false;
  }
  return true;
}

/**
 * Calculates the midpoint between two landmarks.
 * @param {{x: number, y: number}} p1
 * @param {{x: number, y: number}} p2
 * @returns {{x: number, y: number}}
 */
export function getMidpoint(p1, p2) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  };
}

/**
 * Calculates angle (in degrees) of a 2D vector relative to the upward vertical vector (0, -1).
 * Returns degrees between 0° and 180°. Upright = 0°.
 * @param {number} dx
 * @param {number} dy
 * @returns {number}
 */
function angleFromVertical(dx, dy) {
  const magnitude = Math.hypot(dx, dy);
  if (magnitude === 0) return 0;
  // Upward vertical vector is (0, -1). Dot product: dx * 0 + dy * (-1) = -dy
  const cosAngle = Math.max(-1, Math.min(1, (-dy) / magnitude));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

/**
 * A. Head/Neck Angle (Lateral Tilt vs. Vertical in frontal webcam view):
 * - Midpoint of left and right ears.
 * - Midpoint of left and right shoulders.
 * - Angle of the head/neck direction relative to vertical.
 * - Scaled by video pixel dimensions to eliminate aspect ratio distortion.
 * NOTE: In front-facing camera view, this measures coronal lateral tilt (ear-to-shoulder lean).
 * Sagittal forward-head posture is not directly measurable without depth or a side profile view.
 * @param {Array<object>} landmarks
 * @param {{ width?: number, height?: number }} [dimensions]
 * @returns {number|null} Angle in degrees rounded to 1 decimal place, or null if landmarks unavailable.
 */
export function calculateHeadNeckAngle(landmarks, dimensions = { width: 640, height: 480 }) {
  if (!landmarks) return null;

  const leftEar = landmarks[POSE_LANDMARKS.LEFT_EAR];
  const rightEar = landmarks[POSE_LANDMARKS.RIGHT_EAR];
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

  if (
    !isLandmarkValid(leftEar) ||
    !isLandmarkValid(rightEar) ||
    !isLandmarkValid(leftShoulder) ||
    !isLandmarkValid(rightShoulder)
  ) {
    return null;
  }

  const w = (dimensions && dimensions.width > 0) ? dimensions.width : 640;
  const h = (dimensions && dimensions.height > 0) ? dimensions.height : 480;

  const earMidpoint = getMidpoint(leftEar, rightEar);
  const shoulderMidpoint = getMidpoint(leftShoulder, rightShoulder);

  // Scaled pixel vector to eliminate aspect ratio distortion
  const dx = (earMidpoint.x - shoulderMidpoint.x) * w;
  const dy = (earMidpoint.y - shoulderMidpoint.y) * h;

  const angle = angleFromVertical(dx, dy);
  return Number(angle.toFixed(1));
}

/**
 * B. Torso Inclination (Lateral Lean vs. Vertical in frontal webcam view):
 * - Midpoint of left and right shoulders.
 * - Midpoint of left and right hips.
 * - Torso direction relative to vertical.
 * - Scaled by video pixel dimensions to eliminate aspect ratio distortion.
 * @param {Array<object>} landmarks
 * @param {{ width?: number, height?: number }} [dimensions]
 * @returns {number|null} Angle in degrees rounded to 1 decimal place, or null if landmarks unavailable.
 */
export function calculateTorsoInclination(landmarks, dimensions = { width: 640, height: 480 }) {
  if (!landmarks) return null;

  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

  if (
    !isLandmarkValid(leftShoulder) ||
    !isLandmarkValid(rightShoulder) ||
    !isLandmarkValid(leftHip) ||
    !isLandmarkValid(rightHip)
  ) {
    return null;
  }

  const w = (dimensions && dimensions.width > 0) ? dimensions.width : 640;
  const h = (dimensions && dimensions.height > 0) ? dimensions.height : 480;

  const shoulderMidpoint = getMidpoint(leftShoulder, rightShoulder);
  const hipMidpoint = getMidpoint(leftHip, rightHip);

  // Scaled pixel vector from hips to shoulders
  const dx = (shoulderMidpoint.x - hipMidpoint.x) * w;
  const dy = (shoulderMidpoint.y - hipMidpoint.y) * h;

  const angle = angleFromVertical(dx, dy);
  return Number(angle.toFixed(1));
}

/**
 * C. Shoulder Alignment (Tilt vs. Horizontal in frontal view):
 * - Angle of shoulder line (between left and right shoulders) relative to horizontal.
 * - Level shoulder line = ~0 degrees.
 * - Scaled by video pixel dimensions to eliminate aspect ratio distortion.
 * @param {Array<object>} landmarks
 * @param {{ width?: number, height?: number }} [dimensions]
 * @returns {number|null} Angle in degrees rounded to 1 decimal place, or null if landmarks unavailable.
 */
export function calculateShoulderAlignment(landmarks, dimensions = { width: 640, height: 480 }) {
  if (!landmarks) return null;

  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

  if (!isLandmarkValid(leftShoulder) || !isLandmarkValid(rightShoulder)) {
    return null;
  }

  const w = (dimensions && dimensions.width > 0) ? dimensions.width : 640;
  const h = (dimensions && dimensions.height > 0) ? dimensions.height : 480;

  const dx = Math.abs(rightShoulder.x - leftShoulder.x) * w;
  const dy = Math.abs(rightShoulder.y - leftShoulder.y) * h;

  if (dx === 0) return 90.0;

  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return Number(angle.toFixed(1));
}

/**
 * Calculates all posture metrics for a detected pose with aspect ratio scaling
 * and detailed visibility/occlusion statuses.
 * @param {Array<object>} landmarks
 * @param {{ width?: number, height?: number }} [dimensions]
 * @returns {{
 *   headNeckAngle: number|null,
 *   torsoInclination: number|null,
 *   shoulderAlignment: number|null,
 *   hasAnyValid: boolean,
 *   statuses: {
 *     headNeck: 'AVAILABLE' | 'LOW_CONFIDENCE' | 'NOT_DETECTED',
 *     torso: 'AVAILABLE' | 'DESK_OCCLUDED' | 'LOW_CONFIDENCE' | 'NOT_DETECTED',
 *     shoulderAlignment: 'AVAILABLE' | 'LOW_CONFIDENCE' | 'NOT_DETECTED'
 *   }
 * }}
 */
export function calculatePostureMetrics(landmarks, dimensions = { width: 640, height: 480 }) {
  if (!landmarks || landmarks.length === 0) {
    return {
      headNeckAngle: null,
      torsoInclination: null,
      shoulderAlignment: null,
      hasAnyValid: false,
      statuses: {
        headNeck: 'NOT_DETECTED',
        torso: 'NOT_DETECTED',
        shoulderAlignment: 'NOT_DETECTED'
      }
    };
  }

  const leftEar = landmarks[POSE_LANDMARKS.LEFT_EAR];
  const rightEar = landmarks[POSE_LANDMARKS.RIGHT_EAR];
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

  const headValid =
    isLandmarkValid(leftEar) &&
    isLandmarkValid(rightEar) &&
    isLandmarkValid(leftShoulder) &&
    isLandmarkValid(rightShoulder);

  const shouldersValid = isLandmarkValid(leftShoulder) && isLandmarkValid(rightShoulder);
  const hipsValid = isLandmarkValid(leftHip) && isLandmarkValid(rightHip);

  const headNeckAngle = headValid ? calculateHeadNeckAngle(landmarks, dimensions) : null;
  const torsoInclination = shouldersValid && hipsValid ? calculateTorsoInclination(landmarks, dimensions) : null;
  const shoulderAlignment = shouldersValid ? calculateShoulderAlignment(landmarks, dimensions) : null;

  // Status classification
  const headNeckStatus = headValid
    ? 'AVAILABLE'
    : (isLandmarkValid(leftShoulder) || isLandmarkValid(rightShoulder))
    ? 'LOW_CONFIDENCE'
    : 'NOT_DETECTED';

  let torsoStatus = 'NOT_DETECTED';
  if (shouldersValid && hipsValid) {
    torsoStatus = 'AVAILABLE';
  } else if (shouldersValid && !hipsValid) {
    // Upper body is tracked, but hips are below frame / occluded by desk
    torsoStatus = 'DESK_OCCLUDED';
  } else if (isLandmarkValid(leftShoulder) || isLandmarkValid(rightShoulder)) {
    torsoStatus = 'LOW_CONFIDENCE';
  }

  const shoulderStatus = shouldersValid
    ? 'AVAILABLE'
    : (isLandmarkValid(leftShoulder) || isLandmarkValid(rightShoulder))
    ? 'LOW_CONFIDENCE'
    : 'NOT_DETECTED';

  const hasAnyValid =
    headNeckAngle !== null || torsoInclination !== null || shoulderAlignment !== null;

  return {
    headNeckAngle,
    torsoInclination,
    shoulderAlignment,
    hasAnyValid,
    statuses: {
      headNeck: headNeckStatus,
      torso: torsoStatus,
      shoulderAlignment: shoulderStatus
    }
  };
}
