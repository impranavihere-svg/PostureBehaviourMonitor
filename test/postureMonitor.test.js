import test from 'node:test';
import assert from 'node:assert/strict';
import { PostureMonitor } from '../src/modules/postureMonitor.js';

test('PostureMonitor requires personal baseline to monitor', () => {
  const monitor = new PostureMonitor();
  monitor.startSession(1000);

  const result = monitor.processFrame(
    { headNeckAngle: 15.0, torsoInclination: null, shoulderAlignment: 2.0 },
    null,
    1100
  );

  assert.equal(result.postureStatus, 'CALIBRATION_REQUIRED');
  assert.equal(result.hasWarning, false);
});

test('PostureMonitor: deviation under threshold remains NORMAL', () => {
  const monitor = new PostureMonitor();
  monitor.startSession(1000);
  const baseline = { headNeckAngle: 5.0, torsoInclination: 2.0, shoulderAlignment: 1.0 };

  // Deviation is 3.0° (threshold is 10.0°)
  const deviations = { headNeckAngle: 3.0, torsoInclination: null, shoulderAlignment: 2.0 };
  const result = monitor.processFrame(deviations, baseline, 1100);

  assert.equal(result.postureStatus, 'NORMAL');
  assert.equal(result.hasWarning, false);
  assert.equal(result.stats.totalEvents, 0);
  assert.equal(result.stats.totalAlerts, 0);
});

test('PostureMonitor: transient deviation (<5s) shows MONITORING_DEVIATION and recovers without alert', () => {
  const monitor = new PostureMonitor();
  monitor.startSession(1000);
  const baseline = { headNeckAngle: 5.0, torsoInclination: 2.0, shoulderAlignment: 1.0 };

  // Frame 1: deviation detected at t=2000ms (12.0° > 10.0°)
  const dev1 = { headNeckAngle: 12.0, torsoInclination: null, shoulderAlignment: 0.5 };
  const res1 = monitor.processFrame(dev1, baseline, 2000);
  assert.equal(res1.postureStatus, 'MONITORING_DEVIATION');
  assert.equal(res1.hasWarning, false);

  // Frame 2: deviation continues at t=4000ms (2s elapsed < 5s persistence requirement)
  const res2 = monitor.processFrame(dev1, baseline, 4000);
  assert.equal(res2.postureStatus, 'MONITORING_DEVIATION');
  assert.equal(res2.hasWarning, false);

  // Frame 3: posture recovers at t=5500ms (deviation 2.0° < 10.0°)
  const devRecovered = { headNeckAngle: 2.0, torsoInclination: null, shoulderAlignment: 0.5 };
  const res3 = monitor.processFrame(devRecovered, baseline, 5500);
  assert.equal(res3.postureStatus, 'NORMAL');
  assert.equal(res3.hasWarning, false);
  assert.equal(res3.stats.totalEvents, 0);
  assert.equal(res3.stats.totalAlerts, 0);
});

test('PostureMonitor: sustained deviation (>=5s) triggers alert and records event', () => {
  const monitor = new PostureMonitor();
  monitor.startSession(1000);
  const baseline = { headNeckAngle: 5.0, torsoInclination: 2.0, shoulderAlignment: 1.0 };

  const devHigh = { headNeckAngle: 14.5, torsoInclination: null, shoulderAlignment: 1.0 };

  // Starts deviation at t=2000ms
  monitor.processFrame(devHigh, baseline, 2000);

  // Reaches persistence at t=7100ms (5100ms >= 5000ms)
  const resSustained = monitor.processFrame(devHigh, baseline, 7100);
  assert.equal(resSustained.postureStatus, 'SUSTAINED_DEVIATION');
  assert.equal(resSustained.hasWarning, true);
  assert.equal(resSustained.stats.totalEvents, 1);
  assert.equal(resSustained.stats.totalAlerts, 1);
  assert.equal(resSustained.recentEvents.length, 1);
  assert.equal(resSustained.recentEvents[0].measurement, 'Head / Neck Angle');

  // Cooldown test: at t=9000ms (only 1.9s after alert, cooldown is 10s)
  const resCooldown = monitor.processFrame(devHigh, baseline, 9000);
  assert.equal(resCooldown.stats.totalAlerts, 1, 'Alert count should not increase within 10s cooldown');

  // After cooldown: at t=18000ms (10.9s after alert > 10s cooldown)
  const resPostCooldown = monitor.processFrame(devHigh, baseline, 18000);
  assert.equal(resPostCooldown.stats.totalAlerts, 2, 'Alert count should increment after cooldown window');
});

test('PostureMonitor: getPersistencePayload returns valid Spring Boot DTO structure', () => {
  const monitor = new PostureMonitor();
  monitor.startSession(1000);
  const baseline = { headNeckAngle: 5.0, torsoInclination: 2.0, shoulderAlignment: 1.0 };
  const devHigh = { headNeckAngle: 15.0, torsoInclination: null, shoulderAlignment: 1.0 };

  monitor.processFrame(devHigh, baseline, 2000);
  monitor.processFrame(devHigh, baseline, 7200);

  const payload = monitor.getPersistencePayload('2026-10-24T00:00:00Z', '2026-10-24T00:01:00Z');

  assert.equal(payload.startedAt, '2026-10-24T00:00:00Z');
  assert.equal(payload.endedAt, '2026-10-24T00:01:00Z');
  assert.equal(payload.totalAlerts, 1);
  assert.equal(payload.totalEvents, 1);
  assert.ok(payload.events.length === 1);
  assert.equal(payload.events[0].measurement, 'Head / Neck Angle');
  assert.equal(typeof payload.durationSeconds, 'number');
});
