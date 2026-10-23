import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDeviation,
  calculateAllDeviations
} from '../src/modules/calibration.js';

test('calculateDeviation computes absolute difference rounded to 1 decimal place', () => {
  assert.equal(calculateDeviation(15.42, 10.0), 5.4);
  assert.equal(calculateDeviation(8.2, 12.5), 4.3);
  assert.equal(calculateDeviation(null, 10.0), null);
  assert.equal(calculateDeviation(15.0, null), null);
});

test('calculateAllDeviations returns nulls when baseline is null', () => {
  const current = { headNeckAngle: 12.0, torsoInclination: 5.0, shoulderAlignment: 1.0 };
  const deviations = calculateAllDeviations(current, null);

  assert.equal(deviations.headNeckAngle, null);
  assert.equal(deviations.torsoInclination, null);
  assert.equal(deviations.shoulderAlignment, null);
});

test('calculateAllDeviations computes deviations for all present metrics', () => {
  const current = { headNeckAngle: 25.0, torsoInclination: null, shoulderAlignment: 6.5 };
  const baseline = { headNeckAngle: 10.0, torsoInclination: 3.0, shoulderAlignment: 1.5 };
  const deviations = calculateAllDeviations(current, baseline);

  assert.equal(deviations.headNeckAngle, 15.0);
  assert.equal(deviations.torsoInclination, null);
  assert.equal(deviations.shoulderAlignment, 5.0);
});
