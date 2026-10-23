import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePostureMetrics,
  calculateHeadNeckAngle,
  calculateTorsoInclination,
  calculateShoulderAlignment,
  isLandmarkValid,
  POSE_LANDMARKS
} from '../src/modules/postureCalculator.js';

test('isLandmarkValid requires x, y and confidence >= 0.5', () => {
  assert.equal(isLandmarkValid(null), false);
  assert.equal(isLandmarkValid({ x: 0.5 }), false);
  assert.equal(isLandmarkValid({ x: 0.5, y: 0.5, visibility: 0.3 }), false);
  assert.equal(isLandmarkValid({ x: 0.5, y: 0.5, visibility: 0.8 }), true);
});

test('calculatePostureMetrics returns NOT_DETECTED when landmarks are null or empty', () => {
  const result = calculatePostureMetrics(null);
  assert.equal(result.hasAnyValid, false);
  assert.equal(result.headNeckAngle, null);
  assert.equal(result.statuses.headNeck, 'NOT_DETECTED');
  assert.equal(result.statuses.torso, 'NOT_DETECTED');
});

test('calculatePostureMetrics detects DESK_OCCLUDED when shoulders are valid but hips are occluded', () => {
  const mockLandmarks = [];
  // Ears
  mockLandmarks[POSE_LANDMARKS.LEFT_EAR] = { x: 0.45, y: 0.2, visibility: 0.9 };
  mockLandmarks[POSE_LANDMARKS.RIGHT_EAR] = { x: 0.55, y: 0.2, visibility: 0.9 };
  // Shoulders
  mockLandmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.40, y: 0.4, visibility: 0.9 };
  mockLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.60, y: 0.4, visibility: 0.9 };
  // Hips occluded (below table / low confidence)
  mockLandmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.42, y: 0.8, visibility: 0.2 };
  mockLandmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.58, y: 0.8, visibility: 0.1 };

  const result = calculatePostureMetrics(mockLandmarks, { width: 640, height: 480 });

  assert.equal(result.statuses.headNeck, 'AVAILABLE');
  assert.notEqual(result.headNeckAngle, null);
  assert.equal(result.statuses.shoulderAlignment, 'AVAILABLE');
  assert.notEqual(result.shoulderAlignment, null);
  assert.equal(result.statuses.torso, 'DESK_OCCLUDED');
  assert.equal(result.torsoInclination, null);
});

test('calculateShoulderAlignment calculates 0 deg for level shoulders', () => {
  const mockLandmarks = [];
  mockLandmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.40, y: 0.40, visibility: 0.9 };
  mockLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.60, y: 0.40, visibility: 0.9 };

  const angle = calculateShoulderAlignment(mockLandmarks, { width: 640, height: 480 });
  assert.equal(angle, 0.0);
});

test('calculateShoulderAlignment detects tilt when one shoulder is higher', () => {
  const mockLandmarks = [];
  mockLandmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.40, y: 0.35, visibility: 0.9 };
  mockLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.60, y: 0.45, visibility: 0.9 };

  const angle = calculateShoulderAlignment(mockLandmarks, { width: 640, height: 480 });
  assert.ok(angle > 10.0, `Expected shoulder tilt > 10°, got ${angle}`);
});
