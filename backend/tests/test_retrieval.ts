import fs from 'fs';

async function main() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'adminpass' })
  });
  
  if (!loginRes.ok) throw new Error('Login failed: ' + await loginRes.text());
  const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];

  const getRes = await fetch('http://localhost:5000/api/images/wounds/1790572896513-j4q6pe1ddas.jpg', {
    headers: { 'Cookie': cookie! }
  });
  
  console.log('GET status:', getRes.status);
  console.log('GET content-type:', getRes.headers.get('content-type'));
  const buffer = await getRes.arrayBuffer();
  console.log('GET size:', buffer.byteLength);

  const getFail = await fetch('http://localhost:5000/api/images/wounds/does-not-exist.jpg', {
    headers: { 'Cookie': cookie! }
  });
  console.log('GET nonexistent status:', getFail.status);
}

main().catch(console.error);
