/**
 * Debug Image Search API
 */

const API_BASE = 'http://localhost:3000/api/v1';

async function login() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@hydra.com',
      password: 'admin123'
    })
  });
  const data = await res.json();
  return data.access_token;
}

async function testImageSearch(token) {
  const keywords = ['Carly Pearce concert', 'Carly Pearce HD'];

  console.log('Testing image search with keywords:', keywords);

  const res = await fetch(`${API_BASE}/compose/images/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      generationId: `debug-${Date.now()}`,
      keywords: keywords,
      maxImages: 5,
      minWidth: 400,
      minHeight: 300
    })
  });

  const data = await res.json();
  console.log('\nFull API Response:');
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  try {
    console.log('Logging in...');
    const token = await login();
    console.log('Login OK\n');
    await testImageSearch(token);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
