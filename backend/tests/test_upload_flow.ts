import fs from 'fs';
import path from 'path';

async function main() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'adminpass' })
  });
  
  if (!loginRes.ok) throw new Error('Login failed: ' + await loginRes.text());
  const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('No cookie received');

  const patientCode = 'TEST-FLOW-' + Math.floor(Math.random() * 100000);
  const patientRes = await fetch('http://localhost:5000/api/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ patientCode, name: 'Test Flow', age: 30 })
  });
  
  const patient = await patientRes.json();
  const patientId = patient.patient?.id;

  if (!patientId) throw new Error('Patient creation failed: ' + JSON.stringify(patient));

  const woundRes = await fetch('http://localhost:5000/api/wounds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ patientId, location: 'Left Arm' })
  });
  const wound = await woundRes.json();
  const woundId = wound.wound?.id;
  if (!woundId) throw new Error('Wound creation failed: ' + JSON.stringify(wound));

  const formData = new FormData();
  formData.append('woundId', String(woundId));
  
  const testImagePath = path.join(__dirname, '../../ai_services/tests/fixtures/test_valid_marker.jpg');
  const buffer = fs.readFileSync(testImagePath);
  const blob = new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' });
  formData.append('image', blob, 'test_valid.jpg');

  const uploadRes = await fetch('http://localhost:5000/api/upload', {
    method: 'POST',
    headers: { 'Cookie': cookie },
    body: formData
  });

  const uploadResult = await uploadRes.json();
  console.log('Upload Result:', JSON.stringify(uploadResult, null, 2));

  if (uploadResult.assessment?.imageKey) {
    const getRes = await fetch(`http://localhost:5000/api/images/${uploadResult.assessment.imageKey}`, {
      headers: { 'Cookie': cookie }
    });
    console.log(`Original image GET status: ${getRes.status} Content-Type: ${getRes.headers.get('content-type')}`);
  }
  
  if (uploadResult.assessment?.annotatedImageKey) {
    const getRes2 = await fetch(`http://localhost:5000/api/images/${uploadResult.assessment.annotatedImageKey}`, {
      headers: { 'Cookie': cookie }
    });
    console.log(`Annotated image GET status: ${getRes2.status} Content-Type: ${getRes2.headers.get('content-type')}`);
  }
}

main().catch(console.error);
