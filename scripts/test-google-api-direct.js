/**
 * Direct test of Google Custom Search API
 */
require('dotenv').config();

const API_KEY = process.env.GOOGLE_CSE_API_KEY;
const CX = process.env.GOOGLE_SEARCH_ENGINE_ID || process.env.GOOGLE_SEARCH_CX;

console.log('Environment Variables Check:');
console.log('  GOOGLE_CSE_API_KEY:', API_KEY ? `${API_KEY.substring(0, 15)}...` : 'NOT SET');
console.log('  GOOGLE_SEARCH_ENGINE_ID:', CX || 'NOT SET');
console.log('  GOOGLE_AI_API_KEY:', process.env.GOOGLE_AI_API_KEY ? 'SET' : 'NOT SET');
console.log('');

async function testGoogleSearch() {
  if (!API_KEY || !CX) {
    console.log('ERROR: Google Search API not configured');
    return;
  }

  const query = 'Carly Pearce concert';
  const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodeURIComponent(query)}&searchType=image&num=5&imgSize=large`;

  console.log('Testing Google Custom Search API...');
  console.log('Query:', query);
  console.log('URL:', url.replace(API_KEY, 'API_KEY_HIDDEN'));
  console.log('');

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.log('API Error:', JSON.stringify(data.error, null, 2));
      return;
    }

    console.log('Search Information:');
    console.log('  Total Results:', data.searchInformation?.totalResults);
    console.log('  Search Time:', data.searchInformation?.searchTime, 'seconds');
    console.log('');

    if (data.items && data.items.length > 0) {
      console.log('Results:');
      data.items.forEach((item, i) => {
        console.log(`\n${i + 1}. ${item.title}`);
        console.log(`   Link: ${item.link.substring(0, 80)}...`);
        console.log(`   Domain: ${item.displayLink}`);
        console.log(`   Size: ${item.image?.width}x${item.image?.height}`);
      });
    } else {
      console.log('No results found');
      console.log('Full response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('Fetch Error:', error.message);
  }
}

testGoogleSearch();
