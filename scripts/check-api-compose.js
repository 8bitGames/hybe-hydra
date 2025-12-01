const https = require('https');
const http = require('http');

const TOKEN = process.env.TOKEN || process.argv[2];
const url = 'http://localhost:3000/api/v1/campaigns/campaign-carly-hummingbird-tour/generations?page_size=100';

http.get(url, {
  headers: { 'Authorization': `Bearer ${TOKEN}` }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('=== API Response Summary ===');
      console.log('Total:', json.total);
      console.log('Items count:', json.items?.length);
      console.log('');

      const aiVideos = (json.items || []).filter(i => !i.id.startsWith('compose-'));
      const composeVideos = (json.items || []).filter(i => i.id.startsWith('compose-'));

      console.log('AI Generated videos:', aiVideos.length);
      console.log('Compose videos:', composeVideos.length);
      console.log('');

      if (composeVideos.length > 0) {
        console.log('=== Compose Videos Details ===');
        composeVideos.forEach(v => {
          console.log('ID:', v.id);
          console.log('  status:', v.status);
          console.log('  output_url:', v.output_url ? 'YES' : 'null');
          console.log('  composed_output_url:', v.composed_output_url ? v.composed_output_url.substring(0, 70) + '...' : 'null');
          console.log('');
        });
      } else {
        console.log('!! NO COMPOSE VIDEOS RETURNED BY API !!');
        console.log('');
        console.log('First 3 video IDs returned:');
        (json.items || []).slice(0, 3).forEach(v => console.log('  -', v.id));
      }
    } catch (e) {
      console.error('Parse error:', e.message);
      console.log('Raw response:', data.substring(0, 500));
    }
  });
}).on('error', e => console.error('Request error:', e.message));
