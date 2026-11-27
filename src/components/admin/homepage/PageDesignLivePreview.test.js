/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { fitPreviewCanvas } from './PageDesignLivePreview.jsx';

describe('fitPreviewCanvas', () => {
  it('keeps a virtual 1280px desktop canvas inside a narrow pane', () => {
    const { canvasWidth, scale } = fitPreviewCanvas(480, 'desktop', 1280);
    expect(canvasWidth).toBe(1280);
    expect(scale).toBeCloseTo(480 / 1280, 5);
  });

  it('lets desktop fill a wide pane without upscaling past 1', () => {
    const { canvasWidth, scale } = fitPreviewCanvas(1440, 'desktop', 1280);
    expect(canvasWidth).toBe(1440);
    expect(scale).toBe(1);
  });

  it('centers a phone canvas without shrinking when the pane is wider', () => {
    const { canvasWidth, scale } = fitPreviewCanvas(500, 'phone', 390);
    expect(canvasWidth).toBe(390);
    expect(scale).toBe(1);
  });

  it('scales a tablet canvas down when the pane is narrower than 768', () => {
    const { canvasWidth, scale } = fitPreviewCanvas(600, 'tablet', 768);
    expect(canvasWidth).toBe(768);
    expect(scale).toBeCloseTo(600 / 768, 5);
  });
});
