/**
 * UI controller module for updating status badges, controls, error alerts,
 * video display states, calibration progress, posture metrics,
 * warning overlay, session statistics, and event log table.
 */

export class UIController {
  constructor() {
    // Action Buttons
    this.startBtn = document.getElementById('startBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.calibrateBtn = document.getElementById('calibrateBtn');
    this.resetCalibrateBtn = document.getElementById('resetCalibrateBtn');

    // System Status & Alerts
    this.statusBadge = document.getElementById('statusBadge');
    this.statusMessage = document.getElementById('statusMessage');
    this.errorAlert = document.getElementById('errorAlert');
    this.errorMessage = document.getElementById('errorMessage');

    // Posture Status (Milestone 3)
    this.postureBadge = document.getElementById('postureBadge');
    this.postureMessage = document.getElementById('postureMessage');

    // Warning Banner (Milestone 3)
    this.warningAlert = document.getElementById('warningAlert');
    this.warningTitle = document.getElementById('warningTitle');
    this.warningMessage = document.getElementById('warningMessage');

    // Calibration Banner
    this.calibrationBanner = document.getElementById('calibrationBanner');
    this.calibrationProgressBar = document.getElementById('calibrationProgressBar');
    this.calibrationCountdown = document.getElementById('calibrationCountdown');

    // Metrics Elements
    this.baselineTimestamp = document.getElementById('baselineTimestamp');

    this.currHeadNeck = document.getElementById('currHeadNeck');
    this.baseHeadNeck = document.getElementById('baseHeadNeck');
    this.devHeadNeck = document.getElementById('devHeadNeck');

    this.currTorso = document.getElementById('currTorso');
    this.baseTorso = document.getElementById('baseTorso');
    this.devTorso = document.getElementById('devTorso');

    this.currShoulder = document.getElementById('currShoulder');
    this.baseShoulder = document.getElementById('baseShoulder');
    this.devShoulder = document.getElementById('devShoulder');

    // Session Statistics (Milestone 3)
    this.statAlerts = document.getElementById('statAlerts');
    this.statEvents = document.getElementById('statEvents');
    this.statLongest = document.getElementById('statLongest');
    this.statDuration = document.getElementById('statDuration');

    // Event Table Body (Milestone 3)
    this.eventsTableBody = document.getElementById('eventsTableBody');

    // Video Elements
    this.cameraPlaceholder = document.getElementById('cameraPlaceholder');
    this.webcam = document.getElementById('webcam');
    this.outputCanvas = document.getElementById('outputCanvas');

    // Session History Elements (Phase 6)
    this.sessionHistorySection = document.getElementById('sessionHistorySection');
    this.refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
    this.historyLoading = document.getElementById('historyLoading');
    this.historyError = document.getElementById('historyError');
    this.historyErrorMsg = document.getElementById('historyErrorMsg');
    this.historyTableBody = document.getElementById('historyTableBody');
    this.historyDetailCard = document.getElementById('historyDetailCard');
    this.closeHistoryDetailBtn = document.getElementById('closeHistoryDetailBtn');
    this.historyDetailTitle = document.getElementById('historyDetailTitle');
    this.hdStarted = document.getElementById('hdStarted');
    this.hdEnded = document.getElementById('hdEnded');
    this.hdDuration = document.getElementById('hdDuration');
    this.hdAlerts = document.getElementById('hdAlerts');
    this.hdEventsCount = document.getElementById('hdEventsCount');
    this.hdLongest = document.getElementById('hdLongest');
    this.hdEventsTableBody = document.getElementById('hdEventsTableBody');
    this.hdFetchInsightsBtn = document.getElementById('hdFetchInsightsBtn');
    this.hdInsightsStatus = document.getElementById('hdInsightsStatus');
    this.hdInsightsPanel = document.getElementById('hdInsightsPanel');
    this.hdInsightsProvider = document.getElementById('hdInsightsProvider');
    this.hdInsightsRisk = document.getElementById('hdInsightsRisk');
    this.hdInsightsDuration = document.getElementById('hdInsightsDuration');
    this.hdInsightsEvents = document.getElementById('hdInsightsEvents');
    this.hdInsightsSummary = document.getElementById('hdInsightsSummary');
    this.hdInsightsRecommendation = document.getElementById('hdInsightsRecommendation');
    this.hdInsightsNote = document.getElementById('hdInsightsNote');
  }

  /**
   * Formats an angle value in degrees or returns fallback '--'.
   * @param {number|null} value
   * @returns {string}
   */
  formatDegree(value) {
    if (value === null || typeof value !== 'number' || isNaN(value)) {
      return '--';
    }
    return `${value.toFixed(1)}°`;
  }

  /**
   * Updates disabled states for action buttons.
   * @param {{ isMonitoring: boolean, isInitializing: boolean, isCalibrating: boolean, hasBaseline: boolean, hasPersonDetected: boolean }} state
   */
  setControlsState({ isMonitoring, isInitializing, isCalibrating = false, hasBaseline = false, hasPersonDetected = false }) {
    if (isInitializing) {
      this.startBtn.disabled = true;
      this.stopBtn.disabled = true;
      this.calibrateBtn.disabled = true;
      this.resetCalibrateBtn.disabled = true;
    } else if (isCalibrating) {
      this.startBtn.disabled = true;
      this.stopBtn.disabled = true;
      this.calibrateBtn.disabled = true;
      this.resetCalibrateBtn.disabled = true;
    } else if (isMonitoring) {
      this.startBtn.disabled = true;
      this.stopBtn.disabled = false;
      this.calibrateBtn.disabled = !hasPersonDetected;
      this.resetCalibrateBtn.disabled = !hasBaseline;
    } else {
      this.startBtn.disabled = false;
      this.stopBtn.disabled = true;
      this.calibrateBtn.disabled = true;
      this.resetCalibrateBtn.disabled = !hasBaseline;
    }
  }

  /**
   * Updates system camera/hardware status.
   * @param {string} badgeText
   * @param {'idle' | 'initializing' | 'active' | 'warning' | 'error'} type
   * @param {string} message
   */
  setStatus(badgeText, type, message) {
    this.statusBadge.textContent = badgeText;
    this.statusBadge.className = `status-badge status-${type}`;
    this.statusMessage.textContent = message;
  }

  /**
   * Updates posture evaluation status badge and description (Milestone 3).
   * @param {'NORMAL' | 'MONITORING_DEVIATION' | 'SUSTAINED_DEVIATION' | 'CALIBRATION_REQUIRED' | 'IDLE'} status
   * @param {string} message
   */
  setPostureStatus(status, message) {
    switch (status) {
      case 'NORMAL':
        this.postureBadge.textContent = 'Normal';
        this.postureBadge.className = 'posture-badge posture-normal';
        this.postureMessage.textContent = message || 'Posture is within calibrated baseline limits.';
        break;
      case 'MONITORING_DEVIATION':
        this.postureBadge.textContent = 'Monitoring';
        this.postureBadge.className = 'posture-badge posture-monitoring';
        this.postureMessage.textContent = message || 'Deviation observed — evaluating persistence...';
        break;
      case 'SUSTAINED_DEVIATION':
        this.postureBadge.textContent = 'Sustained Deviation';
        this.postureBadge.className = 'posture-badge posture-sustained';
        this.postureMessage.textContent = message || 'Sustained posture deviation detected.';
        break;
      case 'CALIBRATION_REQUIRED':
        this.postureBadge.textContent = 'Calibration Required';
        this.postureBadge.className = 'posture-badge posture-calibration';
        this.postureMessage.textContent = message || 'Please calibrate your normal posture before monitoring deviations.';
        break;
      case 'IDLE':
      default:
        this.postureBadge.textContent = 'Posture';
        this.postureBadge.className = 'posture-badge posture-idle';
        this.postureMessage.textContent = message || 'Not monitoring';
        break;
    }
  }

  /**
   * Shows or hides the prominent warning alert banner.
   * @param {boolean} show
   * @param {string} [title]
   * @param {string} [message]
   */
  showWarningAlert(show, title = 'Posture Deviation Detected', message = '') {
    if (show) {
      this.warningTitle.textContent = title;
      this.warningMessage.textContent = message;
      this.warningAlert.classList.remove('hidden');
    } else {
      this.warningAlert.classList.add('hidden');
    }
  }

  /**
   * Updates numerical session statistics.
   * @param {{ totalAlerts: number, totalEvents: number, longestSustainedStr: string, sessionDurationStr: string }} stats
   */
  updateSessionStats(stats) {
    if (!stats) return;
    this.statAlerts.textContent = stats.totalAlerts ?? 0;
    this.statEvents.textContent = stats.totalEvents ?? 0;
    this.statLongest.textContent = stats.longestSustainedStr ?? '--';
    this.statDuration.textContent = stats.sessionDurationStr ?? '00:00';
  }

  /**
   * Renders recent sustained posture events in the session table.
   * @param {Array<{ timeStr: string, measurement: string, peakDeviation: number, durationMs: number, type: string }>} events
   */
  renderEventsTable(events) {
    if (!events || events.length === 0) {
      this.eventsTableBody.innerHTML = `
        <tr id="emptyEventsRow">
          <td colspan="5" class="empty-events-cell">No sustained posture events in this session.</td>
        </tr>
      `;
      return;
    }

    const rowsHtml = events
      .map((evt) => {
        const durationSec = Math.round(evt.durationMs / 1000);
        return `
          <tr>
            <td>${evt.timeStr || '--'}</td>
            <td><strong>${evt.measurement}</strong></td>
            <td>+${evt.peakDeviation ? evt.peakDeviation.toFixed(1) : '0.0'}°</td>
            <td>${durationSec}s</td>
            <td><span class="event-type-badge">${evt.type || 'Sustained'}</span></td>
          </tr>
        `;
      })
      .join('');

    this.eventsTableBody.innerHTML = rowsHtml;
  }

  /**
   * Displays an error alert box.
   * @param {string} message
   */
  showError(message) {
    this.errorMessage.textContent = message;
    this.errorAlert.classList.remove('hidden');
  }

  /**
   * Clears and hides the error alert.
   */
  clearError() {
    this.errorMessage.textContent = '';
    this.errorAlert.classList.add('hidden');
  }

  /**
   * Shows or hides the active webcam and canvas preview elements.
   * @param {boolean} show
   */
  showVideoPreview(show) {
    if (show) {
      this.cameraPlaceholder.style.display = 'none';
      this.webcam.style.display = 'block';
      this.outputCanvas.style.display = 'block';
    } else {
      this.cameraPlaceholder.style.display = 'flex';
      this.webcam.style.display = 'none';
      this.outputCanvas.style.display = 'none';
    }
  }

  /**
   * Toggles the calibration progress banner.
   * @param {boolean} show
   */
  showCalibrationBanner(show) {
    if (show) {
      this.calibrationBanner.classList.remove('hidden');
    } else {
      this.calibrationBanner.classList.add('hidden');
    }
  }

  /**
   * Updates the progress bar and countdown text during calibration.
   * @param {number} remainingSec
   * @param {number} percent
   */
  updateCalibrationProgress(remainingSec, percent) {
    this.calibrationProgressBar.style.width = `${percent}%`;
    this.calibrationCountdown.textContent = `${remainingSec}s`;
  }

  /**
   * Updates real-time current posture measurements and calculated deviations,
   * taking into account landmark visibility and desk occlusion statuses.
   * @param {{ headNeckAngle: number|null, torsoInclination: number|null, shoulderAlignment: number|null }} current
   * @param {{ headNeckAngle: number|null, torsoInclination: number|null, shoulderAlignment: number|null }} deviations
   * @param {{ headNeck?: string, torso?: string, shoulderAlignment?: string }|null} [statuses]
   */
  updateCurrentMetrics(current, deviations, statuses = null) {
    if (statuses?.headNeck === 'LOW_CONFIDENCE') {
      this.currHeadNeck.textContent = 'Low Visibility';
    } else {
      this.currHeadNeck.textContent = this.formatDegree(current?.headNeckAngle);
    }
    this.devHeadNeck.textContent = this.formatDegree(deviations?.headNeckAngle);

    if (statuses?.torso === 'DESK_OCCLUDED') {
      this.currTorso.textContent = 'Desk Occluded';
      this.devTorso.textContent = '--';
    } else if (statuses?.torso === 'LOW_CONFIDENCE') {
      this.currTorso.textContent = 'Low Visibility';
      this.devTorso.textContent = '--';
    } else {
      this.currTorso.textContent = this.formatDegree(current?.torsoInclination);
      this.devTorso.textContent = this.formatDegree(deviations?.torsoInclination);
    }

    if (statuses?.shoulderAlignment === 'LOW_CONFIDENCE') {
      this.currShoulder.textContent = 'Low Visibility';
    } else {
      this.currShoulder.textContent = this.formatDegree(current?.shoulderAlignment);
    }
    this.devShoulder.textContent = this.formatDegree(deviations?.shoulderAlignment);
  }

  /**
   * Clears current and deviation metrics display.
   */
  clearCurrentMetrics() {
    this.currHeadNeck.textContent = '--';
    this.devHeadNeck.textContent = '--';
    this.currTorso.textContent = '--';
    this.devTorso.textContent = '--';
    this.currShoulder.textContent = '--';
    this.devShoulder.textContent = '--';
  }

  /**
   * Renders the calibrated personal baseline values.
   * @param {{ headNeckAngle: number|null, torsoInclination: number|null, shoulderAlignment: number|null, calibratedAt?: string } | null} baseline
   */
  renderBaseline(baseline) {
    if (baseline) {
      this.baseHeadNeck.textContent = this.formatDegree(baseline.headNeckAngle);
      this.baseTorso.textContent = this.formatDegree(baseline.torsoInclination);
      this.baseShoulder.textContent = this.formatDegree(baseline.shoulderAlignment);

      if (baseline.calibratedAt) {
        const timeStr = new Date(baseline.calibratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.baselineTimestamp.textContent = `Baseline: Calibrated at ${timeStr}`;
      } else {
        this.baselineTimestamp.textContent = 'Baseline: Calibrated';
      }
    } else {
      this.baseHeadNeck.textContent = '--';
      this.baseTorso.textContent = '--';
      this.baseShoulder.textContent = '--';
      this.baselineTimestamp.textContent = 'Baseline: Not calibrated';
    }
  }

  /**
   * Toggles session history loading indicator.
   * @param {boolean} isLoading
   */
  setHistoryLoading(isLoading) {
    if (!this.historyLoading) return;
    if (isLoading) {
      this.historyLoading.classList.remove('hidden');
      if (this.historyError) this.historyError.classList.add('hidden');
    } else {
      this.historyLoading.classList.add('hidden');
    }
  }

  /**
   * Displays an error alert for session history operations.
   * @param {string|null} message
   */
  setHistoryError(message) {
    if (!this.historyError) return;
    if (message) {
      if (this.historyErrorMsg) this.historyErrorMsg.textContent = message;
      this.historyError.classList.remove('hidden');
      if (this.historyLoading) this.historyLoading.classList.add('hidden');
    } else {
      this.historyError.classList.add('hidden');
    }
  }

  /**
   * Renders the list of historical sessions retrieved from GET /api/sessions.
   * @param {Array<object>} sessions
   * @param {(sessionId: number) => void} onSelectSession
   */
  renderHistoryTable(sessions, onSelectSession) {
    if (!this.historyTableBody) return;

    if (!sessions || sessions.length === 0) {
      this.historyTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-events-cell">No saved sessions found in database. Complete a monitoring session to save one.</td>
        </tr>
      `;
      return;
    }

    const rowsHtml = sessions.map((s, index) => {
      const dateStr = s.startedAt
        ? new Date(s.startedAt).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : '--';

      const mins = Math.floor((s.durationSeconds || 0) / 60);
      const secs = (s.durationSeconds || 0) % 60;
      const durationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      const longestStr = s.longestSustainedSeconds ? `${s.longestSustainedSeconds.toFixed(1)}s` : '--';

      return `
        <tr>
          <td>#${s.id || index + 1}</td>
          <td>${dateStr}</td>
          <td>${durationStr}</td>
          <td><span class="stat-badge">${s.totalAlerts ?? 0}</span></td>
          <td><strong>${s.totalEvents ?? (s.events ? s.events.length : 0)}</strong></td>
          <td>${longestStr}</td>
          <td>
            <button class="btn btn-outline btn-sm history-view-btn" data-session-id="${s.id}" type="button">
              View Details
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this.historyTableBody.innerHTML = rowsHtml;

    // Attach click listeners to "View Details" buttons
    const buttons = this.historyTableBody.querySelectorAll('.history-view-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-session-id'));
        if (onSelectSession) onSelectSession(id);
      });
    });
  }

  /**
   * Displays the details card for a specific historical session.
   * @param {object} session
   */
  showHistoryDetail(session) {
    if (!this.historyDetailCard) return;

    this.historyDetailTitle.textContent = `Session #${session.id} Details`;
    this.hdStarted.textContent = session.startedAt ? new Date(session.startedAt).toLocaleString() : '--';
    this.hdEnded.textContent = session.endedAt ? new Date(session.endedAt).toLocaleString() : '--';

    const mins = Math.floor((session.durationSeconds || 0) / 60);
    const secs = (session.durationSeconds || 0) % 60;
    this.hdDuration.textContent = `${mins}m ${secs}s`;

    this.hdAlerts.textContent = session.totalAlerts ?? 0;
    this.hdEventsCount.textContent = session.totalEvents ?? (session.events ? session.events.length : 0);
    this.hdLongest.textContent = session.longestSustainedSeconds ? `${session.longestSustainedSeconds.toFixed(1)}s` : '--';

    // Render events table for this session
    const events = session.events || [];
    if (events.length === 0) {
      this.hdEventsTableBody.innerHTML = `<tr><td colspan="5" class="empty-events-cell">No sustained deviation events recorded in this session.</td></tr>`;
    } else {
      this.hdEventsTableBody.innerHTML = events.map((e) => `
        <tr>
          <td>${e.occurredAt || '--'}</td>
          <td><strong>${e.measurement}</strong></td>
          <td><span class="event-type-badge">${e.eventType || 'Sustained'}</span></td>
          <td>+${e.peakDeviation ? Number(e.peakDeviation).toFixed(1) : '0.0'}°</td>
          <td>${e.durationSeconds || 0}s</td>
        </tr>
      `).join('');
    }

    // Reset insights panel
    if (this.hdInsightsPanel) this.hdInsightsPanel.classList.add('hidden');
    if (this.hdInsightsStatus) this.hdInsightsStatus.textContent = '';
    if (this.hdFetchInsightsBtn) {
      this.hdFetchInsightsBtn.disabled = false;
      this.hdFetchInsightsBtn.setAttribute('data-session-id', session.id);
    }

    this.historyDetailCard.classList.remove('hidden');
    this.historyDetailCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Hides the historical session details card.
   */
  hideHistoryDetail() {
    if (this.historyDetailCard) {
      this.historyDetailCard.classList.add('hidden');
    }
  }

  /**
   * Renders AI insights for a selected historical session.
   * @param {object} data
   */
  renderHistoryInsights(data) {
    if (!this.hdInsightsPanel) return;

    this.hdInsightsRisk.textContent = data.riskLevel || 'Unavailable';
    this.hdInsightsDuration.textContent = `${data.durationMinutes ?? 0} min`;
    this.hdInsightsEvents.textContent = data.deviationEvents ?? 0;
    this.hdInsightsSummary.textContent = data.summary || 'No summary returned.';
    this.hdInsightsRecommendation.textContent = data.recommendation ? `Recommendation: ${data.recommendation}` : '';
    this.hdInsightsProvider.textContent = data.provider || 'Rule-based';
    this.hdInsightsNote.textContent = data.note || data.method || 'Not a medical assessment.';

    this.hdInsightsPanel.classList.remove('hidden');
  }
}
