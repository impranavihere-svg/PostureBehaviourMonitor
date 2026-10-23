/**
 * Calibration Module
 * Manages personalized baseline sample collection over ~5 seconds,
 * baseline persistence in localStorage, and deviation calculations.
 */

export const BASELINE_STORAGE_KEY = 'posture_monitor_baseline';
export const CALIBRATION_DURATION_MS = 5000;

/**
 * Loads stored baseline from localStorage.
 * @returns {{ headNeckAngle: number|null, torsoInclination: number|null, shoulderAlignment: number|null, calibratedAt?: string } | null}
 */
export function loadStoredBaseline() {
  try {
    const raw = localStorage.getItem(BASELINE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse baseline from localStorage:', err);
    return null;
  }
}

/**
 * Saves baseline object to localStorage.
 * @param {{ headNeckAngle: number|null, torsoInclination: number|null, shoulderAlignment: number|null }} baseline
 */
export function saveBaseline(baseline) {
  try {
    const data = {
      ...baseline,
      calibratedAt: new Date().toISOString()
    };
    localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save baseline to localStorage:', err);
  }
}

/**
 * Removes baseline from localStorage.
 */
export function removeStoredBaseline() {
  try {
    localStorage.removeItem(BASELINE_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to remove baseline from localStorage:', err);
  }
}

/**
 * Calculates absolute difference between current measurement and baseline:
 * Deviation = absolute(Current Measurement - Baseline Measurement)
 * @param {number|null} current
 * @param {number|null} baseline
 * @returns {number|null} Deviation in degrees rounded to 1 decimal place, or null if either value is unavailable.
 */
export function calculateDeviation(current, baseline) {
  if (current === null || baseline === null || typeof current !== 'number' || typeof baseline !== 'number') {
    return null;
  }
  return Number(Math.abs(current - baseline).toFixed(1));
}

/**
 * Computes deviations for all three posture metrics.
 * @param {{ headNeckAngle: number|null, torsoInclination: number|null, shoulderAlignment: number|null }} current
 * @param {{ headNeckAngle: number|null, torsoInclination: number|null, shoulderAlignment: number|null } | null} baseline
 * @returns {{ headNeckAngle: number|null, torsoInclination: number|null, shoulderAlignment: number|null }}
 */
export function calculateAllDeviations(current, baseline) {
  if (!baseline) {
    return {
      headNeckAngle: null,
      torsoInclination: null,
      shoulderAlignment: null
    };
  }

  return {
    headNeckAngle: calculateDeviation(current.headNeckAngle, baseline.headNeckAngle),
    torsoInclination: calculateDeviation(current.torsoInclination, baseline.torsoInclination),
    shoulderAlignment: calculateDeviation(current.shoulderAlignment, baseline.shoulderAlignment)
  };
}

/**
 * Calculates average of an array of numbers.
 * @param {number[]} samples
 * @returns {number|null}
 */
function calculateAverage(samples) {
  if (!samples || samples.length === 0) return null;
  const sum = samples.reduce((acc, val) => acc + val, 0);
  return Number((sum / samples.length).toFixed(1));
}

/**
 * Handles the 5-second calibration sample collection session.
 */
export class CalibrationSession {
  constructor() {
    this.isActive = false;
    this.startTime = 0;
    this.headNeckSamples = [];
    this.torsoSamples = [];
    this.shoulderSamples = [];
    this.timerId = null;
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
  }

  /**
   * Starts a 5-second calibration session.
   * @param {(remainingSec: number, percent: number) => void} onProgress
   * @param {(baseline: object) => void} onComplete
   * @param {(errorMsg: string) => void} onError
   */
  start(onProgress, onComplete, onError) {
    this.isActive = true;
    this.startTime = performance.now();
    this.headNeckSamples = [];
    this.torsoSamples = [];
    this.shoulderSamples = [];
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;

    // Timer interval for updating countdown and progress UI
    this.timerId = setInterval(() => {
      const elapsed = performance.now() - this.startTime;
      const remainingMs = Math.max(0, CALIBRATION_DURATION_MS - elapsed);
      const remainingSec = Math.ceil(remainingMs / 1000);
      const percent = Math.min(100, Math.round((elapsed / CALIBRATION_DURATION_MS) * 100));

      if (this.onProgress) {
        this.onProgress(remainingSec, percent);
      }

      if (elapsed >= CALIBRATION_DURATION_MS) {
        this.finish();
      }
    }, 100);
  }

  /**
   * Ingests a new frame's posture metrics during calibration.
   * Frames where required landmarks are unavailable (null) are ignored for that metric.
   * @param {{ headNeckAngle: number|null, torsoInclination: number|null, shoulderAlignment: number|null }} metrics
   */
  addSample(metrics) {
    if (!this.isActive || !metrics) return;

    if (metrics.headNeckAngle !== null) {
      this.headNeckSamples.push(metrics.headNeckAngle);
    }
    if (metrics.torsoInclination !== null) {
      this.torsoSamples.push(metrics.torsoInclination);
    }
    if (metrics.shoulderAlignment !== null) {
      this.shoulderSamples.push(metrics.shoulderAlignment);
    }
  }

  /**
   * Finalizes the calibration session, calculates sample averages, and saves the baseline.
   */
  finish() {
    this.cancel();

    const headNeckAvg = calculateAverage(this.headNeckSamples);
    const torsoAvg = calculateAverage(this.torsoSamples);
    const shoulderAvg = calculateAverage(this.shoulderSamples);

    // Ensure we collected at least some valid pose samples
    if (headNeckAvg === null && torsoAvg === null && shoulderAvg === null) {
      if (this.onError) {
        this.onError('Calibration failed: No valid pose landmarks detected. Please sit facing the camera and try again.');
      }
      return;
    }

    const baseline = {
      headNeckAngle: headNeckAvg,
      torsoInclination: torsoAvg,
      shoulderAlignment: shoulderAvg
    };

    saveBaseline(baseline);

    if (this.onComplete) {
      this.onComplete(baseline);
    }
  }

  /**
   * Cancels any active calibration session.
   */
  cancel() {
    this.isActive = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
