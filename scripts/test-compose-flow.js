/**
 * Test Compose Flow with Carly Pearce Campaign
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

async function testScriptGeneration(token) {
  console.log('\n=== Step 1: Script Generation ===');
  console.log('Testing with user-provided keywords...\n');

  const res = await fetch(`${API_BASE}/compose/script`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      campaignId: 'campaign-carly-hummingbird-tour',
      artistName: 'Carly Pearce',
      trendKeywords: ['Carly Pearce concert', 'Carly Pearce HD photo', 'Carly Pearce 2024'],
      userPrompt: 'Hummingbird tour promo video with emotional backstage moments and fan interactions',
      targetDuration: 15
    })
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Script generation failed: ${error}`);
  }

  const data = await res.json();

  console.log('Vibe:', data.vibe);
  console.log('Vibe Reason:', data.vibeReason);
  console.log('Suggested BPM:', `${data.suggestedBpmRange?.min}-${data.suggestedBpmRange?.max}`);
  console.log('Effect:', data.effectRecommendation);
  console.log('\nScript Lines:');
  data.script?.lines?.forEach((line, i) => {
    console.log(`  ${i+1}. [${line.timing}s] "${line.text}" (${line.duration}s)`);
  });
  console.log('\nSearch Keywords:', data.searchKeywords?.join(', '));

  if (data.groundingInfo) {
    console.log('\nGrounding Info:');
    console.log('  Summary:', data.groundingInfo.summary?.substring(0, 200) + '...');
    console.log('  Sources:', data.groundingInfo.sources?.length || 0);
  }

  return data;
}

async function testImageSearch(token, keywords) {
  console.log('\n=== Step 2: Image Search ===');
  console.log('Keywords:', keywords.slice(0, 5).join(', '), '...\n');

  const res = await fetch(`${API_BASE}/compose/images/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      generationId: `test-${Date.now()}`,
      keywords: keywords.slice(0, 5),
      maxImages: 10,
      minWidth: 720,
      minHeight: 480
    })
  });

  if (!res.ok) {
    const error = await res.text();
    console.log('Image search error:', error);
    return null;
  }

  const data = await res.json();

  console.log('Total Found:', data.totalFound);
  console.log('Filtered (low res):', data.filtered);
  console.log('Candidates returned:', data.candidates?.length || 0);

  if (data.message) {
    console.log('\nMessage:', data.message);
  }

  if (data.candidates?.length > 0) {
    console.log('\nTop 5 Images:');
    data.candidates.slice(0, 5).forEach((img, i) => {
      console.log(`  ${i+1}. ${img.sourceDomain} - ${img.width}x${img.height} (Score: ${(img.qualityScore * 100).toFixed(0)}%)`);
      console.log(`     ${img.sourceUrl.substring(0, 80)}...`);
    });
  }

  return data;
}

async function testMusicMatch(token, vibe, bpmRange) {
  console.log('\n=== Step 3: Music Matching ===');
  console.log(`Looking for ${vibe} music (${bpmRange.min}-${bpmRange.max} BPM)...\n`);

  const res = await fetch(`${API_BASE}/compose/music/match`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      campaignId: 'campaign-carly-hummingbird-tour',
      vibe: vibe,
      bpmRange: bpmRange,
      minDuration: 15
    })
  });

  if (!res.ok) {
    const error = await res.text();
    console.log('Music match error:', error);
    return null;
  }

  const data = await res.json();

  console.log('Total Matches:', data.totalMatches);

  if (data.matches?.length > 0) {
    console.log('\nTop 3 Music Matches:');
    data.matches.slice(0, 3).forEach((match, i) => {
      console.log(`  ${i+1}. ${match.filename}`);
      console.log(`     BPM: ${match.bpm || 'N/A'}, Vibe: ${match.vibe || 'N/A'}, Duration: ${match.duration}s`);
      console.log(`     Match Score: ${(match.matchScore * 100).toFixed(0)}%`);
    });
  } else {
    console.log('No music matches found in Asset Locker. Upload audio assets first.');
  }

  return data;
}

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('Compose Flow Test - Carly Pearce Campaign');
    console.log('='.repeat(60));

    // Login
    console.log('\nLogging in...');
    const token = await login();
    console.log('Login successful!');

    // Step 1: Generate Script
    const scriptData = await testScriptGeneration(token);

    // Step 2: Search Images
    if (scriptData?.searchKeywords?.length > 0) {
      await testImageSearch(token, scriptData.searchKeywords);
    }

    // Step 3: Match Music
    if (scriptData?.vibe && scriptData?.suggestedBpmRange) {
      await testMusicMatch(token, scriptData.vibe, scriptData.suggestedBpmRange);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Test Complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

main();
