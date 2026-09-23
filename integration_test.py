import requests
import cv2
import numpy as np
import os
import json

def test_integration():
    print("Generating synthetic image...")
    import shutil
    image_path = "/home/shubham/.gemini/antigravity-ide/brain/7aaaecc3-10d9-4308-b744-609398a25f7c/.user_uploaded/media_1790090363905.jpg"
    shutil.copy(image_path, "test_upload.jpg")

    print("Uploading to Node backend...")
    # First, create a patient and a wound to get a woundId
    import random
    code = f"INT-{random.randint(1000, 9999)}"
    res = requests.post("http://localhost:5000/api/patients", json={
        "name": "Integration Test",
        "patientCode": code,
        "age": 40
    })
    patient_id = res.json()["patient"]["id"]
    
    res = requests.post("http://localhost:5000/api/wounds", json={
        "patientId": patient_id,
        "location": "Test Location",
        "description": "Test Wound"
    })
    wound_id = res.json()["wound"]["id"]
    
    with open("test_upload.jpg", "rb") as f:
        files = {"image": ("test_upload.jpg", f, "image/jpeg")}
        data = {"woundId": wound_id, "pixels_per_cm": ""}
        res = requests.post("http://localhost:5000/api/upload", files=files, data=data)
        
    print("Response Status:", res.status_code)
    try:
        print(json.dumps(res.json(), indent=2))
    except Exception:
        print(res.text)

if __name__ == "__main__":
    test_integration()
