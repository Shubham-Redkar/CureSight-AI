export interface RenderedToOriginalOptions {
  clickX: number; // e.clientX - rect.left
  clickY: number; // e.clientY - rect.top
  elemWidth: number; // rect.width
  elemHeight: number; // rect.height
  naturalWidth: number;
  naturalHeight: number;
  objectFit?: 'contain' | 'fill' | 'none';
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Maps rendered-image coordinates (from a mouse/touch event on an HTMLImageElement)
 * back to original natural image pixel coordinates.
 *
 * Correctly accounts for:
 * - Natural vs rendered dimensions
 * - Responsive containers
 * - CSS object-fit: contain letterboxing (horizontal or vertical bars)
 * - Viewport scrolling and modal positioning
 *
 * Returns null if the click fell inside the letterbox padding outside the actual image bitmap.
 */
export function mapRenderedToOriginalCoords(options: RenderedToOriginalOptions): Point | null {
  const {
    clickX,
    clickY,
    elemWidth,
    elemHeight,
    naturalWidth,
    naturalHeight,
    objectFit = 'contain',
  } = options;

  if (elemWidth <= 0 || elemHeight <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
    return null;
  }

  if (objectFit === 'fill') {
    const origX = Math.round((clickX / elemWidth) * naturalWidth);
    const origY = Math.round((clickY / elemHeight) * naturalHeight);
    return {
      x: Math.max(0, Math.min(naturalWidth, origX)),
      y: Math.max(0, Math.min(naturalHeight, origY)),
    };
  }

  // object-fit: contain
  const imgAspect = naturalWidth / naturalHeight;
  const elemAspect = elemWidth / elemHeight;

  let renderedWidth = elemWidth;
  let renderedHeight = elemHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (elemAspect > imgAspect) {
    // Container is wider than image aspect -> horizontal letterboxing (left/right)
    renderedWidth = elemHeight * imgAspect;
    offsetX = (elemWidth - renderedWidth) / 2;
  } else {
    // Container is taller than image aspect -> vertical letterboxing (top/bottom)
    renderedHeight = elemWidth / imgAspect;
    offsetY = (elemHeight - renderedHeight) / 2;
  }

  const relativeX = clickX - offsetX;
  const relativeY = clickY - offsetY;

  // Click fell inside letterbox padding outside the image content
  if (relativeX < 0 || relativeX > renderedWidth || relativeY < 0 || relativeY > renderedHeight) {
    return null;
  }

  const origX = Math.round((relativeX / renderedWidth) * naturalWidth);
  const origY = Math.round((relativeY / renderedHeight) * naturalHeight);

  return {
    x: Math.max(0, Math.min(naturalWidth, origX)),
    y: Math.max(0, Math.min(naturalHeight, origY)),
  };
}

/**
 * Calculates pixels per centimeter given two points in original-image coordinates
 * and a known reference distance in centimeters.
 */
export function calculatePixelsPerCm(
  p1: Point,
  p2: Point,
  referenceDistanceCm: number
): number | null {
  if (
    !isFinite(referenceDistanceCm) ||
    isNaN(referenceDistanceCm) ||
    referenceDistanceCm <= 0
  ) {
    return null;
  }
  const pixelDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (!isFinite(pixelDist) || pixelDist < 1.0) {
    return null;
  }
  return Number((pixelDist / referenceDistanceCm).toFixed(3));
}
