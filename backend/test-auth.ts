import "dotenv/config";

const API_URL = "http://localhost:5000";
const ADMIN_USER = process.env.DEMO_ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.DEMO_ADMIN_PASSWORD || 'adminpass';
const DOCTOR_USER = process.env.DEMO_DOCTOR_USERNAME || 'clinician';
const DOCTOR_PASS = process.env.DEMO_DOCTOR_PASSWORD || 'clinicianpass';

async function runTests() {
  console.log("Starting Authentication Tests...");
  let adminCookie = "";

  // Test 1: Valid Admin Login
  console.log("\nTest 1: Valid Admin Login");
  let res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  });
  if (res.status === 200) {
    const data = await res.json();
    if (data.user.role === "ADMIN") {
      console.log("PASS: Admin login successful");
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        adminCookie = setCookie.split(";")[0];
      }
    } else {
      console.log("FAIL: Incorrect role");
    }
  } else {
    console.log("FAIL: Expected 200, got", res.status);
  }

  // Test 2: Valid Doctor Login
  console.log("\nTest 2: Valid Doctor Login");
  res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: DOCTOR_USER, password: DOCTOR_PASS }),
  });
  if (res.status === 200) {
    const data = await res.json();
    if (data.user.role === "DOCTOR") {
      console.log("PASS: Doctor login successful");
    } else {
      console.log("FAIL: Incorrect role");
    }
  } else {
    console.log("FAIL: Expected 200, got", res.status);
  }

  // Test 3: Invalid Credentials
  console.log("\nTest 3: Invalid Credentials");
  res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: ADMIN_USER, password: "wrongpassword" }),
  });
  if (res.status === 401) {
    console.log("PASS: Invalid credentials rejected with 401");
  } else {
    console.log("FAIL: Expected 401, got", res.status);
  }

  // Test 4: /auth/me Without Authentication
  console.log("\nTest 4: /auth/me Without Authentication");
  res = await fetch(`${API_URL}/api/auth/me`);
  if (res.status === 401) {
    console.log("PASS: Rejected unauthenticated /auth/me");
  } else {
    console.log("FAIL: Expected 401, got", res.status);
  }

  // Test 5: /auth/me After Login
  console.log("\nTest 5: /auth/me After Login");
  res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Cookie: adminCookie },
  });
  if (res.status === 200) {
    const data = await res.json();
    if (data.authenticated && data.user.role === "ADMIN") {
      console.log("PASS: Authenticated /auth/me successful");
    } else {
      console.log("FAIL: Incorrect data from /auth/me");
    }
  } else {
    console.log("FAIL: Expected 200, got", res.status);
  }

  // Test 6: Protected Endpoint Without Auth
  console.log("\nTest 6: Protected Endpoint Without Auth");
  res = await fetch(`${API_URL}/api/patients`);
  if (res.status === 401) {
    console.log("PASS: Protected endpoint rejected correctly");
  } else {
    console.log("FAIL: Expected 401, got", res.status);
  }

  // Test 7: Protected Endpoint After Login
  console.log("\nTest 7: Protected Endpoint After Login");
  res = await fetch(`${API_URL}/api/patients`, {
    headers: { Cookie: adminCookie },
  });
  if (res.status === 200) {
    console.log("PASS: Protected endpoint accessible with cookie");
  } else {
    console.log("FAIL: Expected 200, got", res.status);
  }

  // Test 9: Logout
  console.log("\nTest 9: Logout");
  res = await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: adminCookie },
  });
  if (res.status === 200) {
    console.log("PASS: Logout successful");
  } else {
    console.log("FAIL: Expected 200, got", res.status);
  }
}

runTests().catch(console.error);
