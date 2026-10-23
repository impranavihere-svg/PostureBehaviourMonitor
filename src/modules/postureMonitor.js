/**
 * Posture Monitor Module
 * Evaluates real-time posture deviations against configurable thresholds,
 * enforces 5-second continuous temporal persistence before alerting,
 * handles alert cooldowns, records in-memory session events, and tracks session stats.
 */
import { POSTURE_CONFIG } from '../config/postureConfig.js';
import { audioAlert } from './audioAlert.js';

export class PostureMonitor {
  constructor() {
    this.sessionStartTime = null;
    this.totalAlerts = 0;
    this.events = [];
    this.longestSustainedDurationMs = 0;
    this.lastAlertTime = 0;

    // State tracker for each tracked metric
    this.metricStates = {
      headNeck: {
        key: 'headNeck',
        name: 'Head / Neck Angle',
        deviationStartTime: null,
        isSustained: false,
        peakDeviation: 0,
        activeEvent: null
      },
      torso: {
        key: 'torso',
        name: 'Torso Inclination',
        deviationStartTime: null,
        isSustained: false,
        peakDeviation: 0,
        activeEvent: null
      },
      shoulderAlignment: {
        key: 'shoulderAlignment',
        name: 'Shoulder Alignment',
        deviationStartTime: null,
        isSustained: false,
        peakDeviation: 0,
        activeEvent: null
      }
    };
  }

  /**
   * Resets session counters and starts a new monitoring session.
   * @param {number} timestamp
   */
  startSession(timestamp = performance.now()) {
    this.sessionStartTime = timestamp;
    this.totalAlerts = 0;
    this.events = [];
    this.longestSustainedDurationMs = 0;
    this.lastAlertTime = 0;
    this.resetAllMetricStates();
  }

  /**
   * Stops the active session and closes any ongoing events cleanly.
   * @param {number} timestamp
   */
  stopSession(timestamp = performance.now()) {
    for (const key of Object.keys(this.metricStates)) {
      const state = this.metricStates[key];
      if (state.isSustained && state.activeEvent) {
        state.activeEvent.endTime = timestamp;
        state.activeEvent.durationMs = timestamp - state.deviationStartTime;
        this.longestSustainedDurationMs = Math.max(
          this.longestSustainedDurationMs,
          state.activeEvent.durationMs
        );
      }
    }
    this.resetAllMetricStates();
  }

  /**
   * Resets the temporal deviation tracking state for all metrics.
   */
  resetAllMetricStates() {
    for (const key of Object.keys(this.metricStates)) {
      const state = this.metricStates[key];
      state.deviationStartTime = null;
      state.isSustained = false;
      state.peakDeviation = 0;
      state.activeEvent = null;
    }
  }

  /**
   * Triggers a warning alert: fires Web Audio API warning tone and increments alert count.
   * @param {string} measurementName
   * @param {number} timestamp
   */
  triggerAlert(measurementName, timestamp) {
    this.totalAlerts++;
    this.lastAlertTime = timestamp;
    try {
      audioAlert.playWarningTone();
    } catch (e) {
      // Graceful fallback if Web Audio is suspended or unsupported
    }
  }

  /**
   * Evaluates current frame deviations against thresholds and temporal persistence.
   * @param {{ headNeckAngle: number|null, torsoInclination: number|null, shoulderAlignment: number|null } | null} deviations
   * @param {{ headNeckAngle: number|null, torsoInclination: number|null, shoulderAlignment: number|null } | null} baseline
   * @param {number} timestamp
   * @returns {{
   *   postureStatus: 'NORMAL' | 'MONITORING_DEVIATION' | 'SUSTAINED_DEVIATION' | 'CALIBRATION_REQUIRED',
   *   statusLabel: string,
   *   hasWarning: boolean,
   *   warningMessage: string | null,
   *   sustainedMeasurements: string[],
   *   stats: object,
   *   recentEvents: object[]
   * }}
   */
  processFrame(deviations, baseline, timestamp = performance.now()) {
    // 1. Verify that personal baseline exists
    if (!baseline || (baseline.headNeckAngle === null && baseline.torsoInclination === null && baseline.shoulderAlignment === null)) {
      return {
        postureStatus: 'CALIBRATION_REQUIRED',
        statusLabel: 'Calibration Required',
        hasWarning: false,
        warningMessage: null,
        sustainedMeasurements: [],
        stats: this.getSessionStats(timestamp),
        recentEvents: this.getRecentEvents()
      };
    }

    // If frame tracking is unavailable, do not treat tracking loss as deviation
    if (!deviations) {
      return {
        postureStatus: 'NORMAL',
        statusLabel: 'Normal',
        hasWarning: false,
        warningMessage: null,
        sustainedMeasurements: [],
        stats: this.getSessionStats(timestamp),
        recentEvents: this.getRecentEvents()
      };
    }

    const metricKeys = [
      { key: 'headNeck', devKey: 'headNeckAngle', threshold: POSTURE_CONFIG.thresholds.headNeck },
      { key: 'torso', devKey: 'torsoInclination', threshold: POSTURE_CONFIG.thresholds.torso },
      { key: 'shoulderAlignment', devKey: 'shoulderAlignment', threshold: POSTURE_CONFIG.thresholds.shoulderAlignment }
    ];

    // 2. Evaluate each metric against threshold and persistence
    for (const { key, devKey, threshold } of metricKeys) {
      const dev = deviations[devKey];
      const state = this.metricStates[key];

      // Safe landmark handling: if landmark is unavailable, do not treat as deviation and clear active tracking
      if (dev === null || typeof dev !== 'number') {
        if (state.isSustained && state.activeEvent) {
          state.activeEvent.endTime = timestamp;
          state.activeEvent.durationMs = timestamp - state.deviationStartTime;
          this.longestSustainedDurationMs = Math.max(
            this.longestSustainedDurationMs,
            state.activeEvent.durationMs
          );
        }
        state.deviationStartTime = null;
        state.isSustained = false;
        state.activeEvent = null;
        state.peakDeviation = 0;
        continue;
      }

      if (dev >= threshold) {
        // Deviation detected
        if (state.deviationStartTime === null) {
          // Start of new deviation episode
          state.deviationStartTime = timestamp;
          state.peakDeviation = dev;
        } else {
          // Continued deviation
          state.peakDeviation = Math.max(state.peakDeviation, dev);
          const elapsed = timestamp - state.deviationStartTime;

          // Check if continuous deviation duration satisfies persistence threshold (approx 5s)
          if (elapsed >= POSTURE_CONFIG.persistenceDurationMs) {
            if (!state.isSustained) {
              // Elevate to sustained posture event!
              state.isSustained = true;

              const event = {
                id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                type: 'Sustained Deviation',
                measurement: state.name,
                baselineValue: baseline[devKey],
                peakDeviation: state.peakDeviation,
                startTime: state.deviationStartTime,
                endTime: null,
                durationMs: elapsed,
                timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              };

              state.activeEvent = event;
              this.events.unshift(event);
              this.longestSustainedDurationMs = Math.max(this.longestSustainedDurationMs, elapsed);

              // Trigger warning alert (tone + notification)
              this.triggerAlert(state.name, timestamp);
            } else {
              // Ongoing sustained event: update duration and peak
              if (state.activeEvent) {
                state.activeEvent.durationMs = elapsed;
                state.activeEvent.peakDeviation = state.peakDeviation;
                this.longestSustainedDurationMs = Math.max(this.longestSustainedDurationMs, elapsed);
              }

              // Re-trigger alert after cooldown period if sustained deviation persists
              if (timestamp - this.lastAlertTime >= POSTURE_CONFIG.alertCooldownMs) {
                this.triggerAlert(state.name, timestamp);
              }
            }
          }
        }
      } else {
        // Posture has returned within threshold (recovery)
        if (state.isSustained && state.activeEvent) {
          state.activeEvent.endTime = timestamp;
          state.activeEvent.durationMs = timestamp - state.deviationStartTime;
          this.longestSustainedDurationMs = Math.max(
            this.longestSustainedDurationMs,
            state.activeEvent.durationMs
          );
        }
        // Reset deviation tracking for this metric
        state.deviationStartTime = null;
        state.isSustained = false;
        state.activeEvent = null;
        state.peakDeviation = 0;
      }
    }

    // 3. Determine overall posture status & active warnings
    const sustainedList = Object.values(this.metricStates)
      .filter((s) => s.isSustained)
      .map((s) => s.name);

    const hasPendingDeviation = Object.values(this.metricStates).some(
      (s) => s.deviationStartTime !== null && !s.isSustained
    );

    let postureStatus = 'NORMAL';
    let statusLabel = 'Normal';
    let hasWarning = false;
    let warningMessage = null;

    if (sustainedList.length > 0) {
      postureStatus = 'SUSTAINED_DEVIATION';
      statusLabel = 'Sustained deviation detected';
      hasWarning = true;
      warningMessage = `Posture deviation detected — ${sustainedList.join(', ')}`;
    } else if (hasPendingDeviation) {
      postureStatus = 'MONITORING_DEVIATION';
      statusLabel = 'Monitoring deviation';
    }

    return {
      postureStatus,
      statusLabel,
      hasWarning,
      warningMessage,
      sustainedMeasurements: sustainedList,
      stats: this.getSessionStats(timestamp),
      recentEvents: this.getRecentEvents()
    };
  }

  /**
   * Returns current session statistics.
   * @param {number} timestamp
   * @returns {{ totalAlerts: number, totalEvents: number, longestSustainedStr: string, sessionDurationStr: string }}
   */
  getSessionStats(timestamp = performance.now()) {
    let sessionSeconds = 0;
    if (this.sessionStartTime !== null) {
      sessionSeconds = Math.max(0, Math.floor((timestamp - this.sessionStartTime) / 1000));
    }

    const mins = Math.floor(sessionSeconds / 60);
    const secs = sessionSeconds % 60;
    const sessionDurationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const longestSec = (this.longestSustainedDurationMs / 1000).toFixed(1);
    const longestSustainedStr = this.longestSustainedDurationMs > 0 ? `${longestSec}s` : '--';

    return {
      totalAlerts: this.totalAlerts,
      totalEvents: this.events.length,
      longestSustainedStr,
      sessionDurationStr
    };
  }

  /** Returns a JSON-safe payload for persisting the completed session. */
  getPersistencePayload(startedAt, endedAt) {
    const stats = this.getSessionStats();
    const longest = Number.parseFloat(stats.longestSustainedStr) || 0;
    return {
      startedAt,
      endedAt,
      durationSeconds: Math.max(0, Math.round((performance.now() - (this.sessionStartTime ?? performance.now())) / 1000)),
      totalAlerts: this.totalAlerts,
      totalEvents: this.events.length,
      longestSustainedSeconds: longest,
      events: this.events.map((event) => ({
        measurement: event.measurement,
        type: event.type,
        peakDeviation: event.peakDeviation,
        durationSeconds: Math.max(0, Math.round((event.durationMs || 0) / 1000)),
        baselineValue: event.baselineValue ?? null,
        time: event.timeStr
      }))
    };
  }

  /**
   * Returns recent events capped by maxRecentEvents.
   * @returns {object[]}
   */
  getRecentEvents() {
    return this.events.slice(0, POSTURE_CONFIG.maxRecentEvents);
  }
}
