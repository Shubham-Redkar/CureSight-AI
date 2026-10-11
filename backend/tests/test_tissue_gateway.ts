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
});
