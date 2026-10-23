/**
 * Visualizer module to render pose landmarks and skeletal connectors on the canvas overlay.
 */
import { DrawingUtils } from '@mediapipe/tasks-vision';
import { POSE_CONNECTIONS } from './poseDetector.js';

export class PoseVisualizer {
  /**
   * @param {HTMLCanvasElement} canvasElement
   */
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.drawingUtils = new DrawingUtils(this.ctx);
  }

  /**
   * Synchronizes canvas internal resolution with the source video dimensions.
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  /**
   * Clears the canvas buffer.
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Renders pose landmarks and skeletal connectors over the video frame.
   * @param {Array<Array<{x: number, y: number, z: number, visibility?: number}>>} landmarksList
   */
  draw(landmarksList) {
    this.clear();

    if (!landmarksList || landmarksList.length === 0) {
      return;
    }

    for (const landmarks of landmarksList) {
      // Draw skeleton connectors
      this.drawingUtils.drawConnectors(landmarks, POSE_CONNECTIONS, {
        color: '#00FF7F', // Spring green for high visibility
        lineWidth: 3
      });

      // Draw keypoints / joints
      this.drawingUtils.drawLandmarks(landmarks, {
        color: '#FF3366', // Vibrant coral red
        lineWidth: 1,
        radius: 4
      });
    }
  }
}
