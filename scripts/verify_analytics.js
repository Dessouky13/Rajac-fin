const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: 'localhost', port: 3000, path, timeout: 5000 }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  try {
    const analytics = await get('/api/analytics');
    console.log('Analytics:');
    console.log(JSON.stringify(analytics, null, 2));

    const deposits = await get('/api/bank/deposits');
    console.log('\nBank Deposits:');
    console.log(JSON.stringify(deposits, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(2);
  }
})();
