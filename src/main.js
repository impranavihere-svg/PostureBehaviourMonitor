/**
 * Main application coordinator for Posture Behaviour Monitor (Milestone 3).
 * Integrates webcam streaming, MediaPipe pose detection, posture calculations,
 * personalized calibration, temporal persistence tracking, Web Audio alerts,
 * and session event logging.
 */
import { startCamera, stopCamera } from './modules/camera.js';
import { initPoseLandmarker, detectPose } from './modules/poseDetector.js';
import { PoseVisualizer } from './modules/visualizer.js';
import { UIController } from './modules/ui.js';
import { calculatePostureMetrics } from './modules/postureCalculator.js';
import {
  loadStoredBaseline,
  removeStoredBaseline,
  calculateAllDeviations,
  CalibrationSession
} from './modules/calibration.js';
import { audioAlert } from './modules/audioAlert.js';
import { PostureMonitor } from './modules/postureMonitor.js';

const ui = new UIController();
const visualizer = new PoseVisualizer(ui.outputCanvas);
const calibrationSession = new CalibrationSession();
const postureMonitor = new PostureMonitor();

let isMonitoring = false;
let hasPersonDetected = false;
let animationFrameId = null;
let sessionTimerInterval = null;
let lastVideoTime = -1;
let personalBaseline = null;
let sessionStartedAt = null;
let sessionAlreadySaved = true;
let lastSavedSessionId = null;
let cachedSessions = [];
const insightsButton = document.getElementById('generateInsightsBtn');
const insightsStatus = document.getElementById('insightsStatus');
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

/**
 * Initialize application state from localStorage and fetch saved sessions.
 */
function initApp() {
  personalBaseline = loadStoredBaseline();
  ui.renderBaseline(personalBaseline);

  if (!personalBaseline) {
    ui.setPostureStatus(
      'CALIBRATION_REQUIRED',
      'Please calibrate your normal posture before monitoring deviations.'
    );
  } else {
    ui.setPostureStatus('IDLE', 'Ready to monitor. Click "Start Monitoring"');
  }

  ui.setControlsState({
    isMonitoring: false,
    isInitializing: false,
    isCalibrating: false,
    hasBaseline: Boolean(personalBaseline),
    hasPersonDetected: false
  });

  // Load saved session history on initial page load
  loadSessionHistory();
}

/**
 * Initiates webcam access and starts a new monitoring session.
 */
async function startMonitoring() {
  if (isMonitoring) return;

  // Unlock Web Audio API on user interaction
  await audioAlert.ensureAudioContext();

  ui.clearError();
  ui.showWarningAlert(false);
  ui.setControlsState({
    isMonitoring: false,
    isInitializing: true,
    isCalibrating: false,
    hasBaseline: Boolean(personalBaseline),
    hasPersonDetected: false
  });
  ui.setStatus('Initializing', 'initializing', 'Initializing MediaPipe Pose Landmarker model...');

  try {
    // 1. Initialize Pose Landmarker
    await initPoseLandmarker();

    // 2. Request webcam permission and start stream
    ui.setStatus('Initializing', 'initializing', 'Requesting webcam access...');
    await startCamera(ui.webcam);

    // 3. Prepare visualizer resolution to match stream
    const videoWidth = ui.webcam.videoWidth || 640;
    const videoHeight = ui.webcam.videoHeight || 480;
    visualizer.resize(videoWidth, videoHeight);

    // 4. Begin new monitoring session
    isMonitoring = true;
    hasPersonDetected = false;
    lastVideoTime = -1;

    postureMonitor.startSession(performance.now());
    sessionStartedAt = new Date().toISOString();
    sessionAlreadySaved = false;
    ui.updateSessionStats(postureMonitor.getSessionStats());
    ui.renderEventsTable([]);

    // Start 1-second interval to update session duration clock
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    sessionTimerInterval = setInterval(() => {
      if (isMonitoring) {
        ui.updateSessionStats(postureMonitor.getSessionStats());
      }
    }, 1000);

    ui.showVideoPreview(true);
    ui.setControlsState({
      isMonitoring: true,
      isInitializing: false,
      isCalibrating: false,
      hasBaseline: Boolean(personalBaseline),
      hasPersonDetected: false
    });
    ui.setStatus('Active', 'active', 'Monitoring active - Processing video feed...');

    if (!personalBaseline) {
      ui.setPostureStatus(
        'CALIBRATION_REQUIRED',
        'Please calibrate your normal posture before monitoring deviations.'
      );
    } else {
      ui.setPostureStatus('NORMAL', 'Monitoring active — evaluating posture against personal baseline.');
    }

    // 5. Start real-time detection loop
    runDetectionLoop();
  } catch (err) {
    console.error('Error starting monitoring:', err);
    stopMonitoring();
    ui.showError(err.message || 'An unexpected error occurred while starting monitoring.');
    ui.setStatus('Error', 'error', 'Monitoring failed to start');
  }
}

/**
 * Stops real-time detection, closes camera stream, and preserves session events on page.
 */
function stopMonitoring() {
  isMonitoring = false;
  hasPersonDetected = false;

  // Cancel any active calibration
  if (calibrationSession.isActive) {
    calibrationSession.cancel();
    ui.showCalibrationBanner(false);
  }

  // Stop session in posture monitor and persist its summary when the API is running.
  postureMonitor.stopSession(performance.now());
  if (sessionStartedAt && !sessionAlreadySaved) {
    const endedAt = new Date().toISOString();
    const payload = postureMonitor.getPersistencePayload(sessionStartedAt, endedAt);
    sessionAlreadySaved = true;
    if (insightsStatus) insightsStatus.textContent = 'Saving session to the backend…';
    fetch(`${API_BASE_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(async (response) => {
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const savedSession = await response.json();
      lastSavedSessionId = savedSession.id;
      if (insightsButton) insightsButton.disabled = !lastSavedSessionId;
      if (insightsStatus) insightsStatus.textContent = 'Session saved. Generate insights when ready.';
      console.info('Posture session saved to backend.', lastSavedSessionId);
      // Automatically refresh historical sessions table
      loadSessionHistory();
    }).catch((error) => {
      if (insightsStatus) insightsStatus.textContent = 'Could not save session. Start the backend and check MySQL, then try another session.';
      console.warn('Could not save session to backend. The session remains available in this page only.', error);
    });
    sessionStartedAt = null;
  }

  if (sessionTimerInterval !== null) {
    clearInterval(sessionTimerInterval);
    sessionTimerInterval = null;
  }

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  stopCamera(ui.webcam);
  visualizer.clear();
  ui.clearCurrentMetrics();
  ui.showVideoPreview(false);
  ui.showWarningAlert(false);

  // Preserve session data on page until next session starts
  ui.updateSessionStats(postureMonitor.getSessionStats());
  ui.renderEventsTable(postureMonitor.getRecentEvents());

  ui.setControlsState({
    isMonitoring: false,
    isInitializing: false,
    isCalibrating: false,
    hasBaseline: Boolean(personalBaseline),
    hasPersonDetected: false
  });
  ui.setStatus('Idle', 'idle', 'Monitoring stopped. Click "Start Monitoring" to begin a new session.');
  ui.setPostureStatus('IDLE', 'Monitoring stopped. Session statistics preserved.');
  lastVideoTime = -1;
}

/**
 * Continuous animation frame loop to detect pose landmarks, calculate deviations,
 * and evaluate temporal persistence.
 */
function runDetectionLoop() {
  if (!isMonitoring) return;

  if (ui.webcam.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    if (ui.webcam.currentTime !== lastVideoTime) {
      lastVideoTime = ui.webcam.currentTime;

      if (ui.webcam.videoWidth && ui.webcam.videoHeight) {
        visualizer.resize(ui.webcam.videoWidth, ui.webcam.videoHeight);
      }

      try {
        const results = detectPose(ui.webcam, performance.now());

        if (results && results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          hasPersonDetected = true;
          visualizer.draw(results.landmarks);

          // Calculate raw posture measurements with aspect-ratio-corrected dimensions
          const dimensions = {
            width: ui.webcam.videoWidth || 640,
            height: ui.webcam.videoHeight || 480
          };
          const metrics = calculatePostureMetrics(landmarks, dimensions);

          // Feed samples if calibration is active
          if (calibrationSession.isActive) {
            calibrationSession.addSample(metrics);
          }

          // Calculate deviations against calibrated baseline
          const deviations = calculateAllDeviations(metrics, personalBaseline);
          ui.updateCurrentMetrics(metrics, deviations, metrics.statuses);

          if (!calibrationSession.isActive) {
            ui.setStatus('Active', 'active', 'Monitoring active: Person detected');
            ui.setControlsState({
              isMonitoring: true,
              isInitializing: false,
              isCalibrating: false,
              hasBaseline: Boolean(personalBaseline),
              hasPersonDetected: true
            });

            // Process temporal persistence and deviation events (Milestone 3)
            const evalResult = postureMonitor.processFrame(
              deviations,
              personalBaseline,
              performance.now()
            );

            ui.setPostureStatus(evalResult.postureStatus, evalResult.statusLabel);
            ui.showWarningAlert(
              evalResult.hasWarning,
              'Posture Deviation Detected',
              evalResult.warningMessage
            );
            ui.updateSessionStats(evalResult.stats);
            ui.renderEventsTable(evalResult.recentEvents);
          }
        } else {
          hasPersonDetected = false;
          visualizer.clear();
          ui.clearCurrentMetrics();
          ui.showWarningAlert(false);

          if (!calibrationSession.isActive) {
            ui.setStatus('Searching', 'warning', 'Monitoring active: No person detected');
            ui.setControlsState({
              isMonitoring: true,
              isInitializing: false,
              isCalibrating: false,
              hasBaseline: Boolean(personalBaseline),
              hasPersonDetected: false
            });

            if (!personalBaseline) {
              ui.setPostureStatus(
                'CALIBRATION_REQUIRED',
                'Please calibrate your normal posture before monitoring deviations.'
              );
            } else {
              ui.setPostureStatus('NORMAL', 'Searching for person in frame...');
            }
          }
        }
      } catch (inferenceError) {
        console.warn('Frame detection error:', inferenceError);
      }
    }
  }

  animationFrameId = requestAnimationFrame(runDetectionLoop);
}

/**
 * Starts the 5-second personalized posture calibration session.
 */
function handleStartCalibration() {
  if (!isMonitoring || !hasPersonDetected || calibrationSession.isActive) return;

  ui.clearError();
  ui.showWarningAlert(false);
  ui.showCalibrationBanner(true);
  ui.updateCalibrationProgress(5, 0);
  ui.setStatus('Active', 'active', 'Calibrating: Collecting normal posture baseline...');
  ui.setPostureStatus('MONITORING_DEVIATION', 'Calibrating normal posture...');
  ui.setControlsState({
    isMonitoring: true,
    isInitializing: false,
    isCalibrating: true,
    hasBaseline: Boolean(personalBaseline),
    hasPersonDetected: true
  });

  calibrationSession.start(
    // onProgress
    (remainingSec, percent) => {
      ui.updateCalibrationProgress(remainingSec, percent);
    },
    // onComplete
    (newBaseline) => {
      personalBaseline = newBaseline;
      ui.showCalibrationBanner(false);
      ui.renderBaseline(personalBaseline);
      ui.setControlsState({
        isMonitoring: true,
        isInitializing: false,
        isCalibrating: false,
        hasBaseline: true,
        hasPersonDetected: true
      });
      ui.setStatus('Active', 'active', 'Calibration complete! Baseline saved.');
      ui.setPostureStatus('NORMAL', 'Monitoring active — baseline established.');
    },
    // onError
    (errorMsg) => {
      ui.showCalibrationBanner(false);
      ui.showError(errorMsg);
      ui.setControlsState({
        isMonitoring: true,
        isInitializing: false,
        isCalibrating: false,
        hasBaseline: Boolean(personalBaseline),
        hasPersonDetected: hasPersonDetected
      });
      ui.setStatus('Active', 'active', 'Calibration unsuccessful. Please try again.');
      if (!personalBaseline) {
        ui.setPostureStatus('CALIBRATION_REQUIRED', 'Please calibrate your normal posture.');
      }
    }
  );
}

/**
 * Resets personal calibration baseline from memory and localStorage.
 */
function handleResetCalibration() {
  if (calibrationSession.isActive) {
    calibrationSession.cancel();
    ui.showCalibrationBanner(false);
  }

  removeStoredBaseline();
  personalBaseline = null;
  ui.renderBaseline(null);
  ui.showWarningAlert(false);

  postureMonitor.resetAllMetricStates();

  // If currently monitoring, clear deviations display
  if (isMonitoring) {
    const current = {
      headNeckAngle: ui.currHeadNeck.textContent !== '--' ? parseFloat(ui.currHeadNeck.textContent) : null,
      torsoInclination: ui.currTorso.textContent !== '--' ? parseFloat(ui.currTorso.textContent) : null,
      shoulderAlignment: ui.currShoulder.textContent !== '--' ? parseFloat(ui.currShoulder.textContent) : null
    };
    ui.updateCurrentMetrics(current, null);
  }

  ui.setControlsState({
    isMonitoring,
    isInitializing: false,
    isCalibrating: false,
    hasBaseline: false,
    hasPersonDetected
  });

  ui.setStatus(
    isMonitoring ? 'Active' : 'Idle',
    isMonitoring ? 'active' : 'idle',
    'Personal baseline reset. You can calibrate again anytime.'
  );
  ui.setPostureStatus(
    'CALIBRATION_REQUIRED',
    'Please calibrate your normal posture before monitoring deviations.'
  );
}

// Attach Event Listeners
ui.startBtn.addEventListener('click', startMonitoring);
ui.stopBtn.addEventListener('click', stopMonitoring);
ui.calibrateBtn.addEventListener('click', handleStartCalibration);
ui.resetCalibrateBtn.addEventListener('click', handleResetCalibration);

// Clean up camera stream if user navigates away or closes tab
window.addEventListener('beforeunload', () => {
  if (isMonitoring) {
    stopMonitoring();
  }
});

/**
 * Loads session history from GET /api/sessions and renders table.
 */
async function loadSessionHistory() {
  ui.setHistoryLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/sessions`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const sessions = await response.json();
    cachedSessions = sessions || [];
    ui.renderHistoryTable(cachedSessions, handleSelectHistoricalSession);
    ui.setHistoryError(null);
  } catch (err) {
    console.warn('Could not load session history:', err);
    ui.setHistoryError('Could not connect to backend API. Start Spring Boot and MySQL to view saved history.');
  } finally {
    ui.setHistoryLoading(false);
  }
}

/**
 * Handles selection of a historical session to view its details.
 * @param {number} sessionId
 */
async function handleSelectHistoricalSession(sessionId) {
  let session = cachedSessions.find((s) => s.id === sessionId);
  if (!session) {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
      if (response.ok) {
        session = await response.json();
      }
    } catch (err) {
      console.warn('Error fetching session detail:', err);
    }
  }

  if (session) {
    ui.showHistoryDetail(session);
  }
}

// Session History Event Listeners
if (ui.refreshHistoryBtn) {
  ui.refreshHistoryBtn.addEventListener('click', () => {
    loadSessionHistory();
  });
}

if (ui.closeHistoryDetailBtn) {
  ui.closeHistoryDetailBtn.addEventListener('click', () => {
    ui.hideHistoryDetail();
  });
}

if (ui.hdFetchInsightsBtn) {
  ui.hdFetchInsightsBtn.addEventListener('click', async () => {
    const sessionId = ui.hdFetchInsightsBtn.getAttribute('data-session-id');
    if (!sessionId) return;

    ui.hdFetchInsightsBtn.disabled = true;
    ui.hdFetchInsightsBtn.textContent = 'Generating insights…';
    if (ui.hdInsightsStatus) ui.hdInsightsStatus.textContent = 'Analyzing historical session…';

    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/insights`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json();
      ui.renderHistoryInsights(data);
      if (ui.hdInsightsStatus) ui.hdInsightsStatus.textContent = 'Insights loaded.';
    } catch (error) {
      if (ui.hdInsightsStatus) ui.hdInsightsStatus.textContent = 'Unable to generate insights. Check Spring Boot service.';
      console.error('Could not generate historical posture insights:', error);
    } finally {
      ui.hdFetchInsightsBtn.disabled = false;
      ui.hdFetchInsightsBtn.textContent = 'Load AI Posture Insights';
    }
  });
}

if (insightsButton) {
  insightsButton.addEventListener('click', async () => {
    if (!lastSavedSessionId) return;
    const panel = document.getElementById('insightsPanel');
    insightsButton.disabled = true;
    insightsButton.textContent = 'Generating insights…';
    if (insightsStatus) insightsStatus.textContent = 'Analyzing saved session data…';
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${lastSavedSessionId}/insights`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json();
      document.getElementById('insightsRisk').textContent = data.riskLevel || 'Unavailable';
      document.getElementById('insightsDuration').textContent = `${data.durationMinutes ?? 0} min`;
      document.getElementById('insightsEvents').textContent = data.deviationEvents ?? 0;
      document.getElementById('insightsSummary').textContent = data.summary || 'No summary returned.';
      document.getElementById('insightsRecommendation').textContent = data.recommendation ? `Recommendation: ${data.recommendation}` : '';
      document.getElementById('insightsProvider').textContent = data.provider || 'Rule-based';
      document.getElementById('insightsNote').textContent = data.note || data.method || 'Not a medical assessment.';
      panel.hidden = false;
      if (insightsStatus) insightsStatus.textContent = 'Insights ready.';
    } catch (error) {
      if (insightsStatus) insightsStatus.textContent = 'Unable to generate insights. Check that Spring Boot and MySQL are running.';
      console.error('Could not generate posture insights:', error);
    } finally {
      insightsButton.disabled = !lastSavedSessionId;
      insightsButton.textContent = 'Generate AI Posture Insights';
    }
  });
}

// Initialize on page load
initApp();
