import cv2
import numpy as np
import os

def create_base_image():
    # Load a known real wound image so YOLO/UNet can detect it for E2E pipeline tests
    img_path = os.path.join(os.path.dirname(__file__), '..', 'test_upload.jpg')
    img = cv2.imread(img_path)
    if img is None:
        raise FileNotFoundError(f"Base image not found at {img_path}")
    # Resize to 512x512 to ensure marker pixel calculations remain exactly the same
    img = cv2.resize(img, (512, 512))
    return img

def generate_fixtures(output_dir):
    os.makedirs(output_dir, exist_ok=True)
    green_color = (0, 255, 0) # BGR, pure green. HSV is [60, 255, 255] which is well inside [35, 50, 50] to [85, 255, 255]

    # Fixture A - Valid Marker
    img = create_base_image()
    # 50x50 square -> 2cm x 2cm -> 25 px/cm
    cv2.rectangle(img, (50, 50), (100, 100), green_color, -1)
    cv2.imwrite(os.path.join(output_dir, 'valid_marker.png'), img)

    # Fixture B - No Marker
    img = create_base_image()
    cv2.imwrite(os.path.join(output_dir, 'no_marker.png'), img)

    # Fixture C - Large Green Background
    img = create_base_image()
    # 300x300 > 20% of 512x512
    cv2.rectangle(img, (0, 0), (300, 300), green_color, -1)
    cv2.imwrite(os.path.join(output_dir, 'large_green_background.png'), img)

    # Fixture D - Tiny Green Noise
    img = create_base_image()
    # add small 5x5 blocks
    cv2.rectangle(img, (20, 20), (25, 25), green_color, -1)
    cv2.rectangle(img, (400, 400), (405, 405), green_color, -1)
    cv2.rectangle(img, (50, 400), (55, 405), green_color, -1)
    cv2.imwrite(os.path.join(output_dir, 'tiny_green_noise.png'), img)

    # Fixture E - Irregular Green Region
    img = create_base_image()
    # circle instead of square
    cv2.circle(img, (80, 80), 25, green_color, -1)
    cv2.imwrite(os.path.join(output_dir, 'irregular_green_region.png'), img)

    # Fixture F - Ambiguous Markers
    img = create_base_image()
    # two valid 50x50 markers
    cv2.rectangle(img, (50, 50), (100, 100), green_color, -1)
    cv2.rectangle(img, (400, 400), (450, 450), green_color, -1)
    cv2.imwrite(os.path.join(output_dir, 'ambiguous_markers.png'), img)

    # Fixture G - Partial Marker
    img = create_base_image()
    # 50x50 marker but partially outside the image right boundary, making it a 22x50 rectangle inside the image
    cv2.rectangle(img, (490, 50), (540, 100), green_color, -1)
    cv2.imwrite(os.path.join(output_dir, 'partial_marker.png'), img)

if __name__ == '__main__':
    generate_fixtures(os.path.join(os.path.dirname(__file__), 'fixtures', 'calibration'))
    print("Synthetic fixtures generated successfully.")
