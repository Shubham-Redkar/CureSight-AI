import cv2
import numpy as np


def analyze_image_quality(image_path, cfg=None):
    """
    Analyze the quality of an image against clinical wound photography thresholds.

    Thresholds are read from cfg.image_quality.* when provided, otherwise falls
    back to the evidence-based defaults derived from analysis of 1880 wound +
    1929 normal training images. See config.yaml for full documentation of each
    threshold and its derivation.

    Checks performed:
        - Resolution (width × height)
        - Brightness (grayscale mean)
        - Contrast (grayscale std)
        - Sharpness (Laplacian variance on pre-blurred image to reduce noise)
        - Glare (fraction of pixels with any channel > 250)
        - Saturation (HSV mean — detects near-grayscale / non-skin images)
        - Aspect ratio (rejects extreme panoramic crops)

    Args:
        image_path: Path to the image file (str or Path).
        cfg: Config object from api.core.config.load_config(). If None, uses
             evidence-based default thresholds.

    Returns:
        dict with keys:
            valid (bool)          — False if the image could not be read at all
            accepted (bool)       — True if all quality checks passed
            image (str)           — path to the image
            width, height (int)   — pixel dimensions
            brightness (float)    — grayscale mean [0–255]
            contrast (float)      — grayscale std
            sharpness_score (float) — Laplacian variance
            saturation (float)    — HSV saturation mean [0–255]
            glare_fraction (float) — fraction of overexposed pixels [0–1]
            aspect_ratio (float)  — width / height
            reasons (list[str])   — rejection reasons (empty if accepted)
    """
    image = cv2.imread(str(image_path))

    if image is None:
        return {"valid": False, "accepted": False, "reason": "Could not read image"}

    height, width = image.shape[:2]

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    brightness = float(gray.mean())
    contrast = float(gray.std())

    # Pre-blur before Laplacian to reduce noise sensitivity (noise can artificially
    # inflate the sharpness score, masking genuinely blurry images)
    blurred_for_sharpness = cv2.GaussianBlur(gray, (3, 3), 0)
    laplacian = cv2.Laplacian(blurred_for_sharpness, cv2.CV_64F)
    sharpness_score = float(laplacian.var())

    # Saturation — wound images should have visible skin/tissue colour
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    saturation = float(hsv[:, :, 1].mean())

    # Glare — fraction of pixels where any channel exceeds 250 (flash overexposure)
    glare_mask = np.any(image > 250, axis=2)
    glare_fraction = float(glare_mask.mean())

    # Aspect ratio
    aspect_ratio = float(width / height)

    # -----------------------------------------------------------------------
    # Thresholds — from cfg when available, otherwise use evidence-based defaults
    # -----------------------------------------------------------------------
    if cfg is not None:
        q = cfg.image_quality
        MIN_WIDTH = int(q.min_width)
        MIN_HEIGHT = int(q.min_height)
        MIN_BRIGHTNESS = float(q.min_brightness)
        MAX_BRIGHTNESS = float(q.max_brightness)
        MIN_CONTRAST = float(q.min_contrast)
        MIN_SHARPNESS = float(q.min_sharpness)
        MAX_GLARE_FRACTION = float(q.max_glare_fraction)
        MIN_SATURATION = float(q.min_saturation)
        MAX_ASPECT_RATIO = float(q.max_aspect_ratio)
    else:
        MIN_WIDTH = 224
        MIN_HEIGHT = 224
        MIN_BRIGHTNESS = 50.0
        MAX_BRIGHTNESS = 210.0
        MIN_CONTRAST = 25.0
        MIN_SHARPNESS = 30.0
        MAX_GLARE_FRACTION = 0.05
        MIN_SATURATION = 15.0
        MAX_ASPECT_RATIO = 3.0

    reasons = []

    # Resolution
    if width < MIN_WIDTH or height < MIN_HEIGHT:
        reasons.append(
            f"Image resolution is too low ({width}×{height}, "
            f"minimum {MIN_WIDTH}×{MIN_HEIGHT})"
        )

    # Brightness
    if brightness < MIN_BRIGHTNESS:
        reasons.append(
            f"Image is too dark (brightness={brightness:.1f}, minimum {MIN_BRIGHTNESS})"
        )
    elif brightness > MAX_BRIGHTNESS:
        reasons.append(
            f"Image is too bright (brightness={brightness:.1f}, maximum {MAX_BRIGHTNESS})"
        )

    # Contrast
    if contrast < MIN_CONTRAST:
        reasons.append(
            f"Image has very low contrast "
            f"(contrast={contrast:.1f}, minimum {MIN_CONTRAST})"
        )

    # Sharpness
    if sharpness_score < MIN_SHARPNESS:
        reasons.append(
            f"Image appears too blurry "
            f"(sharpness={sharpness_score:.1f}, minimum {MIN_SHARPNESS})"
        )

    # Glare
    if glare_fraction > MAX_GLARE_FRACTION:
        reasons.append(
            f"Image has too much glare or overexposure "
            f"({glare_fraction:.1%} of pixels blown out, maximum {MAX_GLARE_FRACTION:.0%})"
        )

    # Saturation (skin-tone check)
    if saturation < MIN_SATURATION:
        reasons.append(
            f"Image has no visible skin tones (saturation={saturation:.1f}, "
            f"minimum {MIN_SATURATION}) — may not be a skin/wound photo"
        )

    # Aspect ratio
    if aspect_ratio > MAX_ASPECT_RATIO or aspect_ratio < (1.0 / MAX_ASPECT_RATIO):
        reasons.append(
            f"Extreme aspect ratio ({aspect_ratio:.2f}:1) — "
            f"expected a close-up wound image"
        )

    accepted = len(reasons) == 0

    return {
        "valid": True,
        "accepted": accepted,
        "image": str(image_path),
        "width": width,
        "height": height,
        "brightness": brightness,
        "contrast": contrast,
        "sharpness_score": sharpness_score,
        "saturation": saturation,
        "glare_fraction": glare_fraction,
        "aspect_ratio": aspect_ratio,
        "reasons": reasons,
    }
