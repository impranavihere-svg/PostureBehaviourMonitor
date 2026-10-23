/**
 * Audio Alert Module using native browser Web Audio API.
 * Generates a short, non-jarring warning tone without requiring external audio files.
 */
import { POSTURE_CONFIG } from '../config/postureConfig.js';

class AudioAlertManager {
  constructor() {
    this.audioCtx = null;
    this.lastToneTime = 0;
    this.isAudioUnlocked = false;
  }

  /**
   * Initializes or resumes the AudioContext on user interaction (e.g. clicking Start Monitoring)
   * to satisfy browser autoplay policy requirements.
   */
  async ensureAudioContext() {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }

      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      this.isAudioUnlocked = true;
    } catch (err) {
      console.warn('Could not initialize AudioContext:', err);
    }
  }

  /**
   * Plays a pleasant dual-frequency warning tone if not in cooldown.
   * @param {boolean} force Bypass cooldown if true
   * @returns {boolean} Whether the tone was successfully played
   */
  playWarningTone(force = false) {
    const now = performance.now();
    if (!force && (now - this.lastToneTime < POSTURE_CONFIG.alertCooldownMs)) {
      return false; // Still within cooldown window
    }

    if (!this.audioCtx) {
      this.ensureAudioContext();
    }

    if (!this.audioCtx) return false;

    try {
      // Resume if needed
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const currentTime = this.audioCtx.currentTime;

      // Create oscillator and gain node for envelope control
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      osc.type = 'sine';
      // First note: 520 Hz (approx C5)
      osc.frequency.setValueAtTime(520, currentTime);
      // Second note: 660 Hz (approx E5) after 120ms
      osc.frequency.setValueAtTime(660, currentTime + 0.12);

      // Volume envelope: smooth attack & decay to prevent audio pops/clicks
      gainNode.gain.setValueAtTime(0.0001, currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.18, currentTime + 0.02);
      gainNode.gain.setValueAtTime(0.18, currentTime + 0.20);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, currentTime + 0.32);

      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      osc.start(currentTime);
      osc.stop(currentTime + 0.33);

      this.lastToneTime = now;
      return true;
    } catch (err) {
      console.warn('Audio playback encountered an error:', err);
      return false;
    }
  }

  /**
   * Resets the tone cooldown timer.
   */
  resetCooldown() {
    this.lastToneTime = 0;
  }
}

export const audioAlert = new AudioAlertManager();
