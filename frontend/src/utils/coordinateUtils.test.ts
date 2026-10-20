import { describe, it, expect } from 'vitest';
import {
  mapRenderedToOriginalCoords,
  calculatePixelsPerCm,
} from './coordinateUtils';

describe('coordinateUtils — mapRenderedToOriginalCoords', () => {
  it('maps 1:1 coordinates directly when natural and rendered dimensions match', () => {
    const result = mapRenderedToOriginalCoords({
      clickX: 150,
      clickY: 200,
      elemWidth: 800,
      elemHeight: 600,
      naturalWidth: 800,
      naturalHeight: 600,
    });
    expect(result).toEqual({ x: 150, y: 200 });
  });

  it('correctly scales coordinates for downscaled images in responsive containers', () => {
    // 4000x3000 high-res image rendered in an 800x600 container (scale factor 5)
    const result = mapRenderedToOriginalCoords({
      clickX: 200,
      clickY: 150,
      elemWidth: 800,
      elemHeight: 600,
      naturalWidth: 4000,
      naturalHeight: 3000,
    });
    expect(result).toEqual({ x: 1000, y: 750 });
  });

  it('correctly handles horizontal letterboxing in wide containers with object-fit: contain', () => {
    // 1000x1000 square image displayed in a 1000x500 container
    // The image fits vertically: height = 500, width = 500, centered horizontally
    // Left letterbox margin = (1000 - 500) / 2 = 250 px
    // A click at clickX = 250 is the left edge of the image (x = 0)
    const leftEdge = mapRenderedToOriginalCoords({
      clickX: 250,
      clickY: 250,
      elemWidth: 1000,
      elemHeight: 500,
      naturalWidth: 1000,
      naturalHeight: 1000,
      objectFit: 'contain',
    });
    expect(leftEdge).toEqual({ x: 0, y: 500 });

    // A click at center: clickX = 500, clickY = 250 -> original (500, 500)
    const center = mapRenderedToOriginalCoords({
      clickX: 500,
      clickY: 250,
      elemWidth: 1000,
      elemHeight: 500,
      naturalWidth: 1000,
      naturalHeight: 1000,
      objectFit: 'contain',
    });
    expect(center).toEqual({ x: 500, y: 500 });

    // A click inside the left letterbox margin (clickX < 250) returns null
    const outsideLeft = mapRenderedToOriginalCoords({
      clickX: 100,
      clickY: 250,
      elemWidth: 1000,
      elemHeight: 500,
      naturalWidth: 1000,
      naturalHeight: 1000,
      objectFit: 'contain',
    });
    expect(outsideLeft).toBeNull();

    // A click inside the right letterbox margin (clickX > 750) returns null
    const outsideRight = mapRenderedToOriginalCoords({
      clickX: 800,
      clickY: 250,
      elemWidth: 1000,
      elemHeight: 500,
      naturalWidth: 1000,
      naturalHeight: 1000,
      objectFit: 'contain',
    });
    expect(outsideRight).toBeNull();
  });

  it('correctly handles vertical letterboxing in tall containers with object-fit: contain', () => {
    // 1000x1000 square image in a 500x1000 container
    // The image fits horizontally: width = 500, height = 500, centered vertically
    // Top letterbox margin = (1000 - 500) / 2 = 250 px
    const topEdge = mapRenderedToOriginalCoords({
      clickX: 250,
      clickY: 250,
      elemWidth: 500,
      elemHeight: 1000,
      naturalWidth: 1000,
      naturalHeight: 1000,
      objectFit: 'contain',
    });
    expect(topEdge).toEqual({ x: 500, y: 0 });

    const outsideTop = mapRenderedToOriginalCoords({
      clickX: 250,
      clickY: 100,
      elemWidth: 500,
      elemHeight: 1000,
      naturalWidth: 1000,
      naturalHeight: 1000,
      objectFit: 'contain',
    });
    expect(outsideTop).toBeNull();
  });

  it('rejects invalid or zero container dimensions safely', () => {
    expect(
      mapRenderedToOriginalCoords({
        clickX: 10,
        clickY: 10,
        elemWidth: 0,
        elemHeight: 500,
        naturalWidth: 1000,
        naturalHeight: 1000,
      })
    ).toBeNull();

    expect(
      mapRenderedToOriginalCoords({
        clickX: 10,
        clickY: 10,
        elemWidth: 500,
        elemHeight: 500,
        naturalWidth: 0,
        naturalHeight: 1000,
      })
    ).toBeNull();
  });
});

describe('coordinateUtils — calculatePixelsPerCm', () => {
  it('calculates exact scale for known 100 px distance at 2.0 cm', () => {
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 200, y: 100 }; // 100 px horizontal
    const scale = calculatePixelsPerCm(p1, p2, 2.0);
    expect(scale).toBe(50.0);
  });

  it('calculates diagonal distance with Pythagorean theorem (3-4-5 triangle * 100)', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 300, y: 400 }; // distance = 500 px
    const scale = calculatePixelsPerCm(p1, p2, 10.0);
    expect(scale).toBe(50.0);
  });

  it('rejects identical or nearly identical points (< 1.0 px distance)', () => {
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 100, y: 100 };
    expect(calculatePixelsPerCm(p1, p2, 2.0)).toBeNull();
  });

  it('rejects zero, negative, NaN, and non-finite reference distances', () => {
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 200, y: 100 };
    expect(calculatePixelsPerCm(p1, p2, 0)).toBeNull();
    expect(calculatePixelsPerCm(p1, p2, -2.0)).toBeNull();
    expect(calculatePixelsPerCm(p1, p2, NaN)).toBeNull();
    expect(calculatePixelsPerCm(p1, p2, Infinity)).toBeNull();
  });
});
