/**
 * Centralized Posture Monitor Configuration
 * 
 * NOTE: These are development defaults only to enable software testing
 * and baseline deviation detection. They are NOT medically validated thresholds.
 */
export const POSTURE_CONFIG = {
  // Deviation thresholds in degrees from personal baseline
  thresholds: {
    headNeck: 10.0,          // Head / Neck angle deviation threshold (degrees)
    torso: 10.0,             // Torso inclination deviation threshold (degrees)
    shoulderAlignment: 8.0   // Shoulder alignment deviation threshold (degrees)
  },

  // Required duration (ms) of continuous deviation before elevating to a sustained event
  persistenceDurationMs: 5000, // 5 seconds

  // Cooldown period (ms) to suppress repeated sound alerts for the same continuous deviation
  alertCooldownMs: 10000,      // 10 seconds

  // Maximum number of recent events to display in the session history list
  maxRecentEvents: 10
};
