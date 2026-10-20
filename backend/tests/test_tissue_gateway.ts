import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app, server, prisma, dbPool } from '../src/server';

import jwt from 'jsonwebtoken';

describe('API Gateway Tests', () => {
  const testSecret = process.env.JWT_SECRET || 'test_secret';
  const validDoctorToken = jwt.sign(
    { sub: 'test-doctor-id', role: 'DOCTOR' },
    testSecret,
    { expiresIn: '1h' }
  );

  after(async () => {
    server.close();
    await prisma.$disconnect();
    await dbPool.end();
  });

  it('unauthorized request without token -> Expect 401', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.strictEqual(res.statusCode, 401);
  });

  it('unauthorized request with invalid token -> Expect 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid_token');
    assert.strictEqual(res.statusCode, 401);
  });

  it('accepts valid token in Authorization header', async () => {
    // When requesting clinical route with valid doctor token in Bearer header, requireAuth passes
    const res = await request(app)
      .get('/api/wounds')
      .set('Authorization', `Bearer ${validDoctorToken}`);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.ok(Array.isArray(res.body.wounds));
  });

  it('accepts valid token in Cookie header', async () => {
    const res = await request(app)
      .get('/api/wounds')
      .set('Cookie', `token=${validDoctorToken}`);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.ok(Array.isArray(res.body.wounds));
  });

  it('GET /api/wounds without patientId returns 200 with wounds list', async () => {
    const res = await request(app)
      .get('/api/wounds')
      .set('Authorization', `Bearer ${validDoctorToken}`);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.ok(Array.isArray(res.body.wounds));
  });

  it('GET /api/wounds with invalid non-numeric patientId returns 400', async () => {
    const res = await request(app)
      .get('/api/wounds?patientId=abc')
      .set('Authorization', `Bearer ${validDoctorToken}`);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.error, 'INVALID_INPUT');
  });

  it('GET /api/wounds with non-existent patientId returns 404', async () => {
    const res = await request(app)
      .get('/api/wounds?patientId=9999999')
      .set('Authorization', `Bearer ${validDoctorToken}`);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.error, 'PATIENT_NOT_FOUND');
  });

  const expiredToken = jwt.sign(
    { sub: 'test-doctor-id', role: 'DOCTOR' },
    testSecret,
    { expiresIn: '-1s' }
  );
  const invalidRoleToken = jwt.sign(
    { sub: 'test-user-id', role: 'PATIENT' },
    testSecret,
    { expiresIn: '1h' }
  );

  it('rejects expired token in Authorization header with 401', async () => {
    const res = await request(app)
      .get('/api/wounds')
      .set('Authorization', `Bearer ${expiredToken}`);
    assert.strictEqual(res.statusCode, 401);
  });

  it('rejects expired token in Cookie header with 401', async () => {
    const res = await request(app)
      .get('/api/wounds')
      .set('Cookie', `token=${expiredToken}`);
    assert.strictEqual(res.statusCode, 401);
  });

  it('handles missing image in POST /api/upload with 400', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${validDoctorToken}`)
      .send();
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.status, 'error');
  });

  it('handles unsupported file type in POST /api/upload with 400 INVALID_IMAGE_TYPE', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${validDoctorToken}`)
      .field('woundId', '1')
      .attach('image', Buffer.from('plain text content'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.error, 'INVALID_IMAGE_TYPE');
  });

  it('rejects unauthorized role on PATCH /api/assessments/:id/verify with 403', async () => {
    const res = await request(app)
      .patch('/api/assessments/1/verify')
      .set('Authorization', `Bearer ${invalidRoleToken}`)
      .send({ verifiedResult: { woundDetected: true } });
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error, 'FORBIDDEN');
  });

  it('returns 404 for non-existent assessment on PATCH /api/assessments/:id/verify', async () => {
    const res = await request(app)
      .patch('/api/assessments/9999999/verify')
      .set('Authorization', `Bearer ${validDoctorToken}`)
      .send({ verifiedResult: { woundDetected: true } });
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.error, 'NOT_FOUND');
  });

  it('returns 404 for non-existent assessment on GET /api/reports/:id', async () => {
    const res = await request(app)
      .get('/api/reports/9999999')
      .set('Authorization', `Bearer ${validDoctorToken}`);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.error, 'ASSESSMENT_NOT_FOUND');
  });

  it('POST /api/upload rejects when neither woundId nor patientId is provided with 400', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${validDoctorToken}`)
      .attach('image', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
        filename: 'sample.jpg',
        contentType: 'image/jpeg',
      });
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.error, 'INVALID_WOUND');
  });

  it('POST /api/upload with non-existent patientId returns 404 PATIENT_NOT_FOUND', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${validDoctorToken}`)
      .field('patientId', '9999999')
      .attach('image', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
        filename: 'sample.jpg',
        contentType: 'image/jpeg',
      });
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.error, 'PATIENT_NOT_FOUND');
  });

  it('GET /api/assessments without woundId or patientId returns 400', async () => {
    const res = await request(app)
      .get('/api/assessments')
      .set('Authorization', `Bearer ${validDoctorToken}`);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.error, 'INVALID_INPUT');
  });

  it('GET /api/assessments with non-existent patientId returns 404', async () => {
    const res = await request(app)
      .get('/api/assessments?patientId=9999999')
      .set('Authorization', `Bearer ${validDoctorToken}`);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.error, 'PATIENT_NOT_FOUND');
  });

  it('POST /api/wounds allows creating a wound without manual location, defaulting safely', async () => {
    // Create a temporary test patient
    const testPatient = await prisma.patient.create({
      data: {
        patientCode: 'TEST-DEFAULT-LOC-' + Date.now(),
        name: 'Default Loc Patient',
      }
    });

    try {
      const res = await request(app)
        .post('/api/wounds')
        .set('Authorization', `Bearer ${validDoctorToken}`)
        .send({ patientId: testPatient.id });
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.status, 'ok');
      assert.strictEqual(res.body.wound.location, 'General Wound Site');
      assert.strictEqual(res.body.wound.patientId, testPatient.id);
    } finally {
      await prisma.wound.deleteMany({ where: { patientId: testPatient.id } });
      await prisma.patient.delete({ where: { id: testPatient.id } });
    }
  });

  it('enforces rate limiting on POST /api/auth/login and responds with 429 when exceeded', async () => {
    // Send repeated login requests to exhaust the 10-request window
    let lastStatus = 0;
    let hitRateLimit = false;
    for (let i = 0; i < 12; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'badpassword' });
      lastStatus = res.statusCode;
      if (res.statusCode === 429) {
        hitRateLimit = true;
        assert.strictEqual(res.body.error, 'TOO_MANY_REQUESTS');
        break;
      }
    }
    assert.strictEqual(hitRateLimit, true, `Expected 429 status code but last was ${lastStatus}`);
  });

  it('POST /api/patients auto-generates unique patientCode when omitted', async () => {
    let createdPatientId: number | undefined;
    try {
      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${validDoctorToken}`)
        .send({ name: 'Auto Generated Patient', age: 48 });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.status, 'ok');
      assert.ok(res.body.patient.id);
      assert.ok(res.body.patient.patientCode);
      assert.match(res.body.patient.patientCode, /^PT-\d{6}$/);
      assert.strictEqual(res.body.patient.name, 'Auto Generated Patient');
      assert.strictEqual(res.body.patient.age, 48);

      createdPatientId = res.body.patient.id;
    } finally {
      if (createdPatientId) {
        await prisma.patient.delete({ where: { id: createdPatientId } });
      }
    }
  });

  it('POST /api/patients generates distinct IDs on multiple registrations', async () => {
    const ids: number[] = [];
    try {
      const res1 = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${validDoctorToken}`)
        .send({ name: 'Patient One' });

      const res2 = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${validDoctorToken}`)
        .send({ name: 'Patient Two' });

      assert.strictEqual(res1.statusCode, 201);
      assert.strictEqual(res2.statusCode, 201);
      assert.notStrictEqual(res1.body.patient.patientCode, res2.body.patient.patientCode);
      assert.match(res1.body.patient.patientCode, /^PT-\d{6}$/);
      assert.match(res2.body.patient.patientCode, /^PT-\d{6}$/);

      ids.push(res1.body.patient.id, res2.body.patient.id);
    } finally {
      for (const id of ids) {
        await prisma.patient.delete({ where: { id } }).catch(() => {});
      }
    }
  });

  it('POST /api/patients rejects registration without name with 400 INVALID_INPUT', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${validDoctorToken}`)
      .send({ age: 30 });

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.error, 'INVALID_INPUT');
  });

  it('POST /api/patients rejects unauthorized request with 401', async () => {
    const res = await request(app)
      .post('/api/patients')
      .send({ name: 'Unauthorized Patient' });

    assert.strictEqual(res.statusCode, 401);
  });

  it('GET /api/health returns 200 lightweight liveness status', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  it('GET /api/health/ready returns readiness check including database health', async () => {
    const res = await request(app).get('/api/health/ready');
    assert.ok(res.statusCode === 200 || res.statusCode === 503);
    assert.ok(res.body.checks);
    assert.strictEqual(res.body.checks.database, 'healthy');
  });

  it('GET /api/health/ready returns 503 degraded when downstream AI service is unreachable', async () => {
    const originalFastApiUrl = process.env.FASTAPI_URL;
    process.env.FASTAPI_URL = 'http://127.0.0.1:59998'; // Unreachable port
    try {
      const res = await request(app).get('/api/health/ready');
      assert.strictEqual(res.statusCode, 503);
      assert.strictEqual(res.body.ready, false);
      assert.strictEqual(res.body.checks.database, 'healthy');
      assert.strictEqual(res.body.checks.ai_service, 'unreachable');
      // Verify no internal secret leaks
      assert.strictEqual(res.body.DATABASE_URL, undefined);
      assert.strictEqual(res.body.JWT_SECRET, undefined);
    } finally {
      process.env.FASTAPI_URL = originalFastApiUrl;
    }
  });

  it('longitudinal reports: suppresses physical area comparison on mixed calibration and honors clinician override', async () => {
    // Setup test patient, wound, and 2 assessments
    const p = await prisma.patient.create({
      data: {
        name: 'Calibration Regression Patient',
        patientCode: `PT-CAL-${Date.now().toString().slice(-5)}`,
      },
    });

    const w = await prisma.wound.create({
      data: {
        patientId: p.id,
        location: 'Right Ankle',
      },
    });

    let ass1Id: number | null = null;
    let ass2Id: number | null = null;

    try {
      // Visit 1: Verified automatic calibration (10.0 cm2)
      const ass1 = await prisma.assessment.create({
        data: {
          woundId: w.id,
          woundDetected: true,
          status: 'COMPLETED',
          assessmentDate: new Date('2026-10-01T10:00:00Z'),
          measurements: {
            total_area_cm2: 10.0,
            total_area_pixels: 6250,
            physical_measurement_available: true,
            calibration: {
              source: 'automatic',
              detected: true,
              confidence: 0.95,
              pixels_per_cm: 25.0,
            },
          },
        },
      });
      ass1Id = ass1.id;

      // Visit 2: Demo fallback unverified calibration
      const ass2 = await prisma.assessment.create({
        data: {
          woundId: w.id,
          woundDetected: true,
          status: 'COMPLETED',
          assessmentDate: new Date('2026-10-08T10:00:00Z'),
          measurements: {
            total_area_cm2: null,
            total_area_pixels: 5000,
            physical_measurement_available: false,
            calibration: {
              source: 'demo',
              detected: false,
              verified: false,
              pixels_per_cm: 25.0,
            },
          },
        },
      });
      ass2Id = ass2.id;

      // Case A: Mixed-calibration visit -> progress comparison MUST be suppressed
      const reportRes1 = await request(app)
        .get(`/api/reports/${ass2Id}`)
        .set('Authorization', `Bearer ${validDoctorToken}`);

      assert.strictEqual(reportRes1.statusCode, 200);
      assert.strictEqual(reportRes1.body.report.progress.status, 'insufficient_data');
      assert.strictEqual(reportRes1.body.report.progress.areaChangePct, null);
      assert.match(
        reportRes1.body.report.progress.calibrationNotice,
        /Physical area comparison suppressed/
      );

      // Case B: Clinician overrides visit 2 with verified measurement (8.0 cm2)
      await prisma.assessment.update({
        where: { id: ass2Id },
        data: {
          verified: true,
          verifiedResult: {
            woundDetected: true,
            measurements: {
              total_area_cm2: 8.0,
            },
            notes: 'Verified by doctor measurement with sterile ruler',
          },
        },
      });

      const reportRes2 = await request(app)
        .get(`/api/reports/${ass2Id}`)
        .set('Authorization', `Bearer ${validDoctorToken}`);

      assert.strictEqual(reportRes2.statusCode, 200);
      // Area decreased from 10.0 to 8.0 (-20.0%)
      assert.strictEqual(reportRes2.body.report.progress.areaChangePct, -20);
      assert.strictEqual(reportRes2.body.report.progress.status, 'improving');
      assert.strictEqual(reportRes2.body.report.progress.calibrationNotice, null);
    } finally {
      if (ass1Id) await prisma.assessment.delete({ where: { id: ass1Id } }).catch(() => {});
      if (ass2Id) await prisma.assessment.delete({ where: { id: ass2Id } }).catch(() => {});
      await prisma.wound.delete({ where: { id: w.id } }).catch(() => {});
      await prisma.patient.delete({ where: { id: p.id } }).catch(() => {});
    }
  });

  it('POST /api/assessments/:id/calibrate enforces auth, authorization, input validation, and recalculates physical measurements', async () => {
    // 1. Auth check
    const unauthRes = await request(app)
      .post('/api/assessments/1/calibrate')
      .send({ pixels_per_cm: 25.0 });
    assert.strictEqual(unauthRes.statusCode, 401);

    // 2. 404 for non-existent
    const notFoundRes = await request(app)
      .post('/api/assessments/99999999/calibrate')
      .set('Authorization', `Bearer ${validDoctorToken}`)
      .send({ pixels_per_cm: 25.0 });
    assert.strictEqual(notFoundRes.statusCode, 404);

    // 3. Validation: reject negative reference distance or non-finite
    const invalidRes1 = await request(app)
      .post('/api/assessments/1/calibrate')
      .set('Authorization', `Bearer ${validDoctorToken}`)
      .send({
        point1: [0, 0],
        point2: [100, 0],
        reference_distance_cm: -2.0
      });
    assert.strictEqual(invalidRes1.statusCode, 400);

    // 4. Validation: reject identical points
    const invalidRes2 = await request(app)
      .post('/api/assessments/1/calibrate')
      .set('Authorization', `Bearer ${validDoctorToken}`)
      .send({
        point1: [50, 50],
        point2: [50, 50],
        reference_distance_cm: 2.0
      });
    assert.strictEqual(invalidRes2.statusCode, 400);

    // 5. Successful two-point calibration and dimensional recalculation
    const p = await prisma.patient.create({
      data: { name: 'Calibration Test Patient', patientCode: `CALIB-${Date.now()}` }
    });
    const w = await prisma.wound.create({
      data: { patientId: p.id, location: 'Right Forearm' }
    });
    const ass = await prisma.assessment.create({
      data: {
        woundId: w.id,
        status: 'COMPLETED',
        woundDetected: true,
        measurements: {
          total_area_pixels: 10000,
          total_perimeter_pixels: 400,
          physical_measurement_available: false,
          calibration: { source: 'demo', verified: false, pixels_per_cm: 25.0 },
          wounds: [
            {
              wound_id: 1,
              area_pixels: 10000,
              perimeter_pixels: 400,
              width_pixels: 100,
              height_pixels: 100
            }
          ]
        }
      }
    });

    try {
      // Calibrate: Point 1 at (100, 100), Point 2 at (200, 100) -> distance = 100 px
      // reference_distance_cm = 2.0 cm -> scale = 50.0 px/cm
      const calibRes = await request(app)
        .post(`/api/assessments/${ass.id}/calibrate`)
        .set('Authorization', `Bearer ${validDoctorToken}`)
        .send({
          point1: [100, 100],
          point2: [200, 100],
          reference_distance_cm: 2.0,
          notes: 'Two-point calibration test'
        });

      assert.strictEqual(calibRes.statusCode, 200);
      assert.strictEqual(calibRes.body.status, 'ok');
      assert.strictEqual(calibRes.body.calibration.source, 'manual');
      assert.strictEqual(calibRes.body.calibration.verified, true);
      assert.strictEqual(calibRes.body.calibration.pixels_per_cm, 50.0);

      // Verify dimensional recalculation:
      // Area: 10,000 px^2 / (50^2) = 10,000 / 2500 = 4.0 cm^2
      // Perimeter: 400 px / 50 = 8.0 cm
      const updatedMeas = calibRes.body.assessment.measurements;
      assert.strictEqual(updatedMeas.physical_measurement_available, true);
      assert.strictEqual(updatedMeas.total_area_cm2, 4.0);
      assert.strictEqual(updatedMeas.total_perimeter_cm, 8.0);
      assert.strictEqual(updatedMeas.wounds[0].area_cm2, 4.0);
      assert.strictEqual(updatedMeas.wounds[0].perimeter_cm, 8.0);
      assert.strictEqual(updatedMeas.wounds[0].width_cm, 2.0);
      assert.strictEqual(updatedMeas.wounds[0].length_cm, 2.0);

      // Verify database record persisted and unrelated fields were preserved
      const dbAss = await prisma.assessment.findUnique({ where: { id: ass.id } });
      assert.strictEqual((dbAss?.measurements as any)?.total_area_cm2, 4.0);
      assert.strictEqual((dbAss?.measurements as any)?.calibration?.verified, true);
      assert.strictEqual(dbAss?.status, 'COMPLETED');
      assert.strictEqual((dbAss?.measurements as any)?.total_area_pixels, 10000); // Raw pixels preserved intact

      // 6. Test role authorization: PATIENT role must receive 403 Forbidden
      const forbiddenRes = await request(app)
        .post(`/api/assessments/${ass.id}/calibrate`)
        .set('Authorization', `Bearer ${invalidRoleToken}`)
        .send({
          pixels_per_cm: 50.0
        });
      assert.strictEqual(forbiddenRes.statusCode, 403);

      // 7. Test invalid direct scale inputs (0, negative, NaN, string)
      const invalidScaleRes1 = await request(app)
        .post(`/api/assessments/${ass.id}/calibrate`)
        .set('Authorization', `Bearer ${validDoctorToken}`)
        .send({ pixels_per_cm: 0 });
      assert.strictEqual(invalidScaleRes1.statusCode, 400);

      const invalidScaleRes2 = await request(app)
        .post(`/api/assessments/${ass.id}/calibrate`)
        .set('Authorization', `Bearer ${validDoctorToken}`)
        .send({ pixels_per_cm: -25.0 });
      assert.strictEqual(invalidScaleRes2.statusCode, 400);

      const invalidScaleRes3 = await request(app)
        .post(`/api/assessments/${ass.id}/calibrate`)
        .set('Authorization', `Bearer ${validDoctorToken}`)
        .send({ pixels_per_cm: 'not-a-number' });
      assert.strictEqual(invalidScaleRes3.statusCode, 400);

      // 8. Longitudinal safety test: compare verified automatic assessment with verified manual assessment
      const assAutomatic = await prisma.assessment.create({
        data: {
          woundId: w.id,
          status: 'COMPLETED',
          woundDetected: true,
          assessmentDate: new Date('2026-10-18T10:00:00Z'),
          measurements: {
            total_area_pixels: 20000,
            total_area_cm2: 8.0,
            physical_measurement_available: true,
            calibration: {
              source: 'automatic',
              detected: true,
              verified: true,
              confidence: 0.95,
              pixels_per_cm: 50.0
            }
          }
        }
      });

      try {
        const reportRes = await request(app)
          .get(`/api/reports/${ass.id}`)
          .set('Authorization', `Bearer ${validDoctorToken}`);
        assert.strictEqual(reportRes.statusCode, 200);
        // Both assessments are verified (one automatic, one manual) -> progress comparison succeeds
        const progress = reportRes.body.report.progress;
        assert.strictEqual(progress.calibrationVerified, true);
        assert.strictEqual(progress.status, 'improving'); // from 8.0 cm2 down to 4.0 cm2
        assert.strictEqual(progress.areaChangePct, -50.0);
      } finally {
        await prisma.assessment.delete({ where: { id: assAutomatic.id } }).catch(() => {});
      }
    } finally {
      await prisma.assessment.delete({ where: { id: ass.id } }).catch(() => {});
      await prisma.wound.delete({ where: { id: w.id } }).catch(() => {});
      await prisma.patient.delete({ where: { id: p.id } }).catch(() => {});
    }
  });
});
