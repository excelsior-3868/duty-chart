const http = require('http');

http.get('http://localhost:8000/api/users/?page_size=200', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const results = parsed.results || parsed;
      const nabin = results.find(u => (u.full_name || '').toLowerCase().includes('nabin'));
      console.log('Nabin Data:', JSON.stringify(nabin, null, 2));
    } catch (e) {
      console.log('Error parsing JSON:', e.message);
    }
  });
}).on('error', err => {
  console.log('HTTP Error:', err.message);
});
