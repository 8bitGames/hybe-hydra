const http = require('http');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmZjM5ZTAxOS05ZjBmLTQ5MmItOTM2ZC0wZTJlMzE3ZDQ2ZTIiLCJlbWFpbCI6ImFkbWluQGh5ZHJhLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc2NDU4MTMyNywiZXhwIjoxNzY0NTg4NTI3fQ.usD-cALc2Y-ygdsMyYC29dzT2nv0M6ukEerPdjNmwGw';

http.get('http://localhost:3000/api/v1/dashboard/stats', {
  headers: { 'Authorization': 'Bearer ' + TOKEN }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const gens = json.recent_activity?.generations || [];
      console.log('Total videos returned:', gens.length);
      console.log('');

      const aiVideos = gens.filter(v => !v.id.startsWith('compose-'));
      const composeVideos = gens.filter(v => v.id.startsWith('compose-'));

      console.log('AI videos:', aiVideos.length);
      console.log('Compose videos:', composeVideos.length);
      console.log('');

      if (composeVideos.length > 0) {
        console.log('=== Compose Videos ===');
        composeVideos.forEach(v => {
          console.log('ID:', v.id);
          console.log('  output_url:', v.output_url ? 'YES' : 'null');
          console.log('  composed_output_url:', v.composed_output_url ? v.composed_output_url.substring(0, 60) + '...' : 'null');
          console.log('');
        });
      }
    } catch(e) {
      console.error('Error:', e.message);
      console.log('Response:', data.substring(0, 500));
    }
  });
}).on('error', e => console.error('Request error:', e.message));
