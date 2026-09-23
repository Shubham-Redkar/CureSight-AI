const http = require('http');

const loginData = JSON.stringify({
  username: 'admin',
  password: 'adminpass'
});

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
}, (res) => {
  let cookies = res.headers['set-cookie'];
  console.log('Login status:', res.statusCode);
  
  if (cookies) {
    const reportReq = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports',
      method: 'GET',
      headers: {
        'Cookie': cookies[0]
      }
    }, (reportRes) => {
      let data = '';
      reportRes.on('data', chunk => data += chunk);
      reportRes.on('end', () => {
        const json = JSON.parse(data);
        console.log('Reports fetched:', json.reports ? json.reports.length : 0);
      });
    });
    reportReq.end();
  }
});

req.write(loginData);
req.end();
