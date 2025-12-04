"""
TikTok Trends Scraper - Modal Deployment

This runs Playwright-based TikTok scraping on Modal with:
- 10 minute timeout (vs Vercel's 60s max)
- 2GB+ RAM
- Dedicated Chromium browser
- No cold start issues

Deploy: modal deploy modal_tiktok.py
Test: modal run modal_tiktok.py::test_scrape
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

import modal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# Modal App Configuration
# =============================================================================

app = modal.App("hydra-tiktok-trends")

# Create image with Playwright
tiktok_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install([
        # Chromium dependencies
        "wget",
        "gnupg",
        "ca-certificates",
        "fonts-liberation",
        "libasound2",
        "libatk-bridge2.0-0",
        "libatk1.0-0",
        "libatspi2.0-0",
        "libcups2",
        "libdbus-1-3",
        "libdrm2",
        "libgbm1",
        "libgtk-3-0",
        "libnspr4",
        "libnss3",
        "libxcomposite1",
        "libxdamage1",
        "libxfixes3",
        "libxkbcommon0",
        "libxrandr2",
        "xdg-utils",
        # Korean fonts for K-pop/country music trends
        "fonts-noto-cjk",
    ])
    .pip_install([
        "playwright==1.40.0",
        "httpx>=0.24.0",
        "fastapi>=0.100.0",
    ])
    .run_commands([
        "playwright install chromium",
        "playwright install-deps chromium",
    ])
)


# =============================================================================
# Main Scraping Function
# =============================================================================

@app.function(
    image=tiktok_image,
    timeout=600,  # 10 minutes
    memory=2048,  # 2GB RAM
    retries=1,
)
def scrape_tiktok_trends(
    keywords: List[str] = None,
    hashtags: List[str] = None,
    include_explore: bool = True,
    limit_per_keyword: int = 20,
) -> Dict[str, Any]:
    """
    Scrape TikTok trends using Playwright.

    Args:
        keywords: List of keywords to search
        hashtags: List of hashtags to scrape
        include_explore: Whether to scrape the explore/discover page
        limit_per_keyword: Max videos per keyword search

    Returns:
        Dictionary with trends data
    """
    import asyncio
    from playwright.async_api import async_playwright

    keywords = keywords or []
    hashtags = hashtags or []

    async def _scrape():
        all_trends = []
        seen_keywords = set()
        all_videos = []
        errors = []

        async with async_playwright() as p:
            logger.info("Launching browser...")
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled',
                    '--window-size=1920,1080',
                    '--disable-gpu',
                    '--single-process',
                ]
            )

            context = await browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                viewport={'width': 1920, 'height': 1080},
                locale='ko-KR',
                timezone_id='Asia/Seoul',
                geolocation={'longitude': 126.9780, 'latitude': 37.5665},
                permissions=['geolocation'],
                extra_http_headers={
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                },
            )

            # Anti-detection
            await context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
                window.chrome = { runtime: {} };
            """)

            page = await context.new_page()

            # Block heavy resources
            await page.route('**/*', lambda route:
                route.abort() if route.request.resource_type in ['media', 'font']
                else route.continue_()
            )

            try:
                # =============================================================
                # 1. Scrape Explore/Discover Page
                # =============================================================
                if include_explore:
                    logger.info("Step 1: Scraping TikTok discover page...")
                    try:
                        await page.goto('https://www.tiktok.com/discover',
                                       wait_until='domcontentloaded', timeout=30000)
                        await page.wait_for_timeout(5000)

                        # Scroll to load content
                        for _ in range(3):
                            await page.evaluate('window.scrollBy(0, 500)')
                            await page.wait_for_timeout(1000)

                        explore_data = await page.evaluate('''() => {
                            const results = [];

                            // Try __UNIVERSAL_DATA_FOR_REHYDRATION__
                            const script = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
                            if (script) {
                                try {
                                    const data = JSON.parse(script.textContent || '{}');
                                    const scope = data['__DEFAULT_SCOPE__'];

                                    // Suggested searches
                                    if (scope?.['webapp.discover']?.suggestedSearches) {
                                        scope['webapp.discover'].suggestedSearches.forEach(item => {
                                            if (item.content) {
                                                results.push({
                                                    keyword: item.content,
                                                    source: 'suggested'
                                                });
                                            }
                                        });
                                    }

                                    // Trending topics
                                    if (scope?.['webapp.trending-topic']?.trendingList) {
                                        scope['webapp.trending-topic'].trendingList.forEach(item => {
                                            results.push({
                                                keyword: item.title || item.desc,
                                                viewCount: item.extraInfo?.views,
                                                source: 'trending'
                                            });
                                        });
                                    }
                                } catch (e) {}
                            }

                            // DOM fallback
                            document.querySelectorAll('a[href*="/tag/"], a[href*="/search"]').forEach(el => {
                                const href = el.getAttribute('href') || '';
                                const tagMatch = href.match(/\\/tag\\/([^/?]+)/);
                                const searchMatch = href.match(/[?&]q=([^&]+)/);
                                const kw = tagMatch?.[1] || (searchMatch ? decodeURIComponent(searchMatch[1]) : null);
                                if (kw && !results.some(r => r.keyword.toLowerCase() === kw.toLowerCase())) {
                                    results.push({ keyword: kw, source: 'dom' });
                                }
                            });

                            return results;
                        }''')

                        for trend in explore_data:
                            key = trend['keyword'].lower().strip()
                            if key and len(key) > 1 and key not in seen_keywords:
                                seen_keywords.add(key)
                                all_trends.append({
                                    'rank': len(all_trends) + 1,
                                    'keyword': trend['keyword'],
                                    'hashtag': f"#{trend['keyword']}",
                                    'viewCount': _parse_count(trend.get('viewCount')),
                                    'source': trend.get('source', 'explore'),
                                })

                        logger.info(f"Found {len(explore_data)} trends from explore page")

                    except Exception as e:
                        error_msg = f"Explore page failed: {str(e)}"
                        errors.append(error_msg)
                        logger.error(error_msg)

                # =============================================================
                # 2. Search Keywords
                # =============================================================
                if keywords:
                    logger.info(f"Step 2: Searching {len(keywords)} keywords...")
                    for keyword in keywords:
                        try:
                            logger.info(f"Searching: {keyword}")
                            encoded = keyword.replace(' ', '%20')
                            await page.goto(f'https://www.tiktok.com/search?q={encoded}',
                                           wait_until='networkidle', timeout=30000)
                            await page.wait_for_timeout(3000)

                            # Scroll for more results
                            for _ in range(5):
                                await page.evaluate('window.scrollBy(0, 800)')
                                await page.wait_for_timeout(600)

                            search_data = await page.evaluate('''() => {
                                const videos = [];
                                const hashtags = new Set();

                                // Parse view counts
                                const parseCount = (text) => {
                                    if (!text) return 0;
                                    const str = text.toString().trim().toUpperCase();
                                    const match = str.match(/([\\d.]+)\\s*([BMK])?/i);
                                    if (!match) return 0;
                                    const num = parseFloat(match[1]);
                                    if (isNaN(num)) return 0;
                                    const suffix = (match[2] || '').toUpperCase();
                                    if (suffix === 'B') return num * 1000000000;
                                    if (suffix === 'M') return num * 1000000;
                                    if (suffix === 'K') return num * 1000;
                                    return num;
                                };

                                // Try JSON data first
                                const script = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
                                if (script) {
                                    try {
                                        const data = JSON.parse(script.textContent || '{}');
                                        const scope = data['__DEFAULT_SCOPE__'];

                                        // Find item list
                                        for (const key of Object.keys(scope || {})) {
                                            const section = scope[key];
                                            if (section?.itemList && Array.isArray(section.itemList)) {
                                                section.itemList.forEach(item => {
                                                    // Extract video with full metadata
                                                    if (item.id) {
                                                        videos.push({
                                                            id: item.id,
                                                            description: item.desc || '',
                                                            authorId: item.author?.uniqueId || '',
                                                            authorNickname: item.author?.nickname || '',
                                                            avatarUrl: item.author?.avatarLarger || '',
                                                            playCount: item.stats?.playCount || 0,
                                                            likeCount: item.stats?.diggCount || 0,
                                                            commentCount: item.stats?.commentCount || 0,
                                                            shareCount: item.stats?.shareCount || 0,
                                                            thumbnailUrl: item.video?.cover || '',
                                                            musicTitle: item.music?.title || '',
                                                            hashtags: (item.challenges || []).map(c => c.title),
                                                            createTime: item.createTime || 0,
                                                        });
                                                    }

                                                    // Extract hashtags
                                                    (item.challenges || []).forEach(c => {
                                                        if (c.title) hashtags.add(c.title);
                                                    });
                                                });
                                                break;
                                            }
                                        }
                                    } catch {}
                                }

                                // DOM fallback if no videos from JSON (matching local tiktok-trends.ts)
                                if (videos.length === 0) {
                                    const videoLinks = document.querySelectorAll('a[href*="/video/"]');
                                    const processedIds = new Set();

                                    videoLinks.forEach(link => {
                                        const href = link.getAttribute('href') || '';
                                        const videoIdMatch = href.match(/\\/video\\/(\\d+)/);
                                        const authorMatch = href.match(/\\/@([^/]+)/);

                                        if (videoIdMatch && !processedIds.has(videoIdMatch[1])) {
                                            processedIds.add(videoIdMatch[1]);

                                            // Find like count in strong element
                                            let likeCount = 0;
                                            const strongElements = link.querySelectorAll('strong');
                                            for (const strong of strongElements) {
                                                const text = strong.textContent?.trim() || '';
                                                if (/^[\\d.]+[KMB]?$/i.test(text)) {
                                                    likeCount = parseCount(text);
                                                    break;
                                                }
                                            }

                                            // Get description from img alt
                                            const img = link.querySelector('img');
                                            let desc = '';
                                            if (img) {
                                                const altText = img.getAttribute('alt') || '';
                                                const madeByMatch = altText.match(/만든\\s*(.+)/);
                                                desc = madeByMatch ? madeByMatch[1].trim() : altText;
                                            }

                                            // Extract hashtags from description
                                            const hashtagMatches = desc.match(/#[\\w\\u3131-\\uD79D]+/g) || [];
                                            hashtagMatches.forEach(h => hashtags.add(h.replace('#', '')));

                                            videos.push({
                                                id: videoIdMatch[1],
                                                description: desc,
                                                authorId: authorMatch?.[1] || '',
                                                authorNickname: authorMatch?.[1] || '',
                                                avatarUrl: '',
                                                playCount: 0,
                                                likeCount: likeCount,
                                                commentCount: 0,
                                                shareCount: 0,
                                                thumbnailUrl: img?.src || '',
                                                musicTitle: '',
                                                hashtags: hashtagMatches.map(h => h.replace('#', '')),
                                                createTime: 0,
                                            });
                                        }
                                    });
                                }

                                // DOM fallback for hashtags
                                document.querySelectorAll('strong').forEach(el => {
                                    const text = el.textContent?.trim();
                                    if (text?.startsWith('#')) {
                                        hashtags.add(text.slice(1));
                                    }
                                });

                                return { videos, hashtags: Array.from(hashtags) };
                            }''')

                            # Add hashtags as trends
                            for tag in search_data.get('hashtags', []):
                                key = tag.lower()
                                if key not in seen_keywords:
                                    seen_keywords.add(key)
                                    all_trends.append({
                                        'rank': len(all_trends) + 1,
                                        'keyword': tag,
                                        'hashtag': f"#{tag}",
                                        'source': f'search:{keyword}',
                                    })

                            # Store videos with full metadata
                            for video in search_data.get('videos', [])[:limit_per_keyword]:
                                video['searchKeyword'] = keyword
                                video['videoUrl'] = f"https://www.tiktok.com/@{video.get('authorId', '')}/video/{video.get('id', '')}"
                                all_videos.append(video)

                            logger.info(f"Found {len(search_data.get('hashtags', []))} hashtags, "
                                       f"{len(search_data.get('videos', []))} videos for '{keyword}'")

                            # Rate limit
                            await page.wait_for_timeout(1500)

                        except Exception as e:
                            error_msg = f"Search failed for '{keyword}': {str(e)}"
                            errors.append(error_msg)
                            logger.error(error_msg)

                # =============================================================
                # 3. Scrape Hashtag Pages (matching local tiktok-trends.ts logic)
                # =============================================================
                if hashtags:
                    logger.info(f"Step 3: Scraping {len(hashtags)} hashtag pages...")
                    for hashtag in hashtags:
                        clean_tag = hashtag.lstrip('#')
                        try:
                            logger.info(f"Scraping hashtag: #{clean_tag}")
                            await page.goto(f'https://www.tiktok.com/tag/{clean_tag}',
                                           wait_until='domcontentloaded', timeout=30000)
                            await page.wait_for_timeout(3000)

                            # Scroll to trigger lazy loading (like local version)
                            await page.evaluate('window.scrollBy(0, 500)')
                            await page.wait_for_timeout(2000)
                            await page.evaluate('window.scrollTo(0, 0)')
                            await page.wait_for_timeout(1000)

                            # Extract data from hashtag page (matching local tiktok-trends.ts)
                            hashtag_data = await page.evaluate('''() => {
                                let viewCount = null;
                                let videoCount = null;
                                let description = null;
                                let thumbnailUrl = null;
                                const videos = [];

                                // Try __UNIVERSAL_DATA_FOR_REHYDRATION__ first (most reliable)
                                const script = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
                                if (script) {
                                    try {
                                        const data = JSON.parse(script.textContent || '{}');
                                        const scope = data['__DEFAULT_SCOPE__'];
                                        const challengeDetail = scope?.['webapp.challenge-detail'];
                                        const challengeInfo = challengeDetail?.challengeInfo?.challenge;

                                        if (challengeInfo) {
                                            viewCount = challengeInfo.stats?.viewCount;
                                            videoCount = challengeInfo.stats?.videoCount;
                                            description = challengeInfo.desc;
                                            thumbnailUrl = challengeInfo.coverLarger || challengeInfo.coverMedium;
                                        }

                                        // Extract videos from itemList
                                        const itemList = challengeDetail?.itemList || [];
                                        itemList.forEach(item => {
                                            if (item.id) {
                                                videos.push({
                                                    id: item.id,
                                                    description: item.desc || '',
                                                    authorId: item.author?.uniqueId || '',
                                                    authorNickname: item.author?.nickname || '',
                                                    avatarUrl: item.author?.avatarLarger || '',
                                                    playCount: item.stats?.playCount || 0,
                                                    likeCount: item.stats?.diggCount || 0,
                                                    commentCount: item.stats?.commentCount || 0,
                                                    shareCount: item.stats?.shareCount || 0,
                                                    thumbnailUrl: item.video?.cover || '',
                                                    musicTitle: item.music?.title || '',
                                                    hashtags: (item.challenges || []).map(c => c.title),
                                                    createTime: item.createTime || 0,
                                                });
                                            }
                                        });
                                    } catch {}
                                }

                                // DOM fallback for videos if JSON didn't work
                                if (videos.length === 0) {
                                    // Method 1: Look for video links
                                    const videoLinks = document.querySelectorAll('a[href*="/video/"]');
                                    const processedIds = new Set();

                                    videoLinks.forEach(link => {
                                        const href = link.getAttribute('href') || '';
                                        const videoIdMatch = href.match(/\\/video\\/(\\d+)/);
                                        const authorMatch = href.match(/\\/@([^/]+)/);

                                        if (videoIdMatch && !processedIds.has(videoIdMatch[1])) {
                                            processedIds.add(videoIdMatch[1]);

                                            // Find like count in strong element
                                            let likeCount = 0;
                                            const strongElements = link.querySelectorAll('strong');
                                            for (const strong of strongElements) {
                                                const text = strong.textContent?.trim() || '';
                                                if (/^[\\d.]+[KMB]?$/i.test(text)) {
                                                    const match = text.match(/([\\d.]+)\\s*([BMK])?/i);
                                                    if (match) {
                                                        const num = parseFloat(match[1]);
                                                        const suffix = (match[2] || '').toUpperCase();
                                                        if (suffix === 'B') likeCount = num * 1000000000;
                                                        else if (suffix === 'M') likeCount = num * 1000000;
                                                        else if (suffix === 'K') likeCount = num * 1000;
                                                        else likeCount = num;
                                                    }
                                                    break;
                                                }
                                            }

                                            // Get description from img alt
                                            const img = link.querySelector('img');
                                            let desc = '';
                                            if (img) {
                                                const altText = img.getAttribute('alt') || '';
                                                const madeByMatch = altText.match(/만든\\s*(.+)/);
                                                desc = madeByMatch ? madeByMatch[1].trim() : altText;
                                            }

                                            // Extract hashtags from description
                                            const hashtagMatches = desc.match(/#[\\w\\u3131-\\uD79D]+/g) || [];

                                            videos.push({
                                                id: videoIdMatch[1],
                                                description: desc,
                                                authorId: authorMatch?.[1] || '',
                                                authorNickname: authorMatch?.[1] || '',
                                                playCount: 0,
                                                likeCount: likeCount,
                                                commentCount: 0,
                                                shareCount: 0,
                                                hashtags: hashtagMatches.map(h => h.replace('#', '')),
                                                createTime: 0,
                                            });
                                        }
                                    });
                                }

                                // DOM fallback for view count
                                if (!viewCount) {
                                    const h2 = document.querySelector('h2');
                                    if (h2) viewCount = h2.textContent?.trim();
                                }

                                // DOM fallback for title/description
                                if (!description) {
                                    const descEl = document.querySelector('[data-e2e="challenge-desc"], p[class*="desc"]');
                                    description = descEl?.textContent?.trim() || '';
                                }

                                return { viewCount, videoCount, description, thumbnailUrl, videos };
                            }''')

                            hashtag_videos = hashtag_data.get('videos', [])
                            logger.info(f"Hashtag #{clean_tag}: {hashtag_data.get('viewCount')} views, "
                                       f"{len(hashtag_videos)} videos from tag page")

                            # If no videos from tag page, use search fallback (like local version)
                            if len(hashtag_videos) == 0:
                                logger.info(f"No videos from tag page, trying search fallback for #{clean_tag}...")
                                try:
                                    await page.goto(f'https://www.tiktok.com/search?q={clean_tag}',
                                                   wait_until='networkidle', timeout=30000)
                                    await page.wait_for_timeout(3000)

                                    # Scroll to load more
                                    for _ in range(5):
                                        await page.evaluate('window.scrollBy(0, 800)')
                                        await page.wait_for_timeout(600)

                                    search_videos = await page.evaluate('''(searchHashtag) => {
                                        const videos = [];
                                        const script = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
                                        if (script) {
                                            try {
                                                const data = JSON.parse(script.textContent || '{}');
                                                const scope = data['__DEFAULT_SCOPE__'];

                                                // Find item list in search results
                                                for (const key of Object.keys(scope || {})) {
                                                    const section = scope[key];
                                                    if (section?.itemList && Array.isArray(section.itemList)) {
                                                        section.itemList.forEach(item => {
                                                            if (item.id) {
                                                                const hashtags = (item.challenges || []).map(c => c.title);
                                                                // Filter: only include if contains our hashtag
                                                                const hashtagLower = searchHashtag.toLowerCase();
                                                                const hasTag = hashtags.some(h => h.toLowerCase() === hashtagLower);
                                                                const inDesc = (item.desc || '').toLowerCase().includes('#' + hashtagLower);

                                                                if (hasTag || inDesc) {
                                                                    videos.push({
                                                                        id: item.id,
                                                                        description: item.desc || '',
                                                                        authorId: item.author?.uniqueId || '',
                                                                        authorNickname: item.author?.nickname || '',
                                                                        avatarUrl: item.author?.avatarLarger || '',
                                                                        playCount: item.stats?.playCount || 0,
                                                                        likeCount: item.stats?.diggCount || 0,
                                                                        commentCount: item.stats?.commentCount || 0,
                                                                        shareCount: item.stats?.shareCount || 0,
                                                                        thumbnailUrl: item.video?.cover || '',
                                                                        musicTitle: item.music?.title || '',
                                                                        hashtags: hashtags,
                                                                        createTime: item.createTime || 0,
                                                                    });
                                                                }
                                                            }
                                                        });
                                                        break;
                                                    }
                                                }
                                            } catch {}
                                        }
                                        return videos;
                                    }''', clean_tag)

                                    hashtag_videos = search_videos or []
                                    logger.info(f"Search fallback found {len(hashtag_videos)} videos for #{clean_tag}")

                                except Exception as search_err:
                                    logger.error(f"Search fallback failed for #{clean_tag}: {search_err}")

                            # Add trend info
                            key = clean_tag.lower()
                            if key not in seen_keywords:
                                seen_keywords.add(key)
                                all_trends.append({
                                    'rank': len(all_trends) + 1,
                                    'keyword': clean_tag,
                                    'hashtag': f"#{clean_tag}",
                                    'viewCount': _parse_count(hashtag_data.get('viewCount')),
                                    'videoCount': hashtag_data.get('videoCount') or len(hashtag_videos),
                                    'description': hashtag_data.get('description'),
                                    'thumbnailUrl': hashtag_data.get('thumbnailUrl'),
                                    'trendUrl': f'https://www.tiktok.com/tag/{clean_tag}',
                                    'source': 'hashtag_page',
                                })

                            # Add videos with full details
                            for video in hashtag_videos[:limit_per_keyword]:
                                video['hashtag'] = clean_tag
                                video['videoUrl'] = f"https://www.tiktok.com/@{video.get('authorId', '')}/video/{video.get('id', '')}"
                                all_videos.append(video)

                            logger.info(f"Hashtag #{clean_tag}: Total {len(hashtag_videos)} videos collected")

                            await page.wait_for_timeout(1500)

                        except Exception as e:
                            error_msg = f"Hashtag scraping failed for #{clean_tag}: {str(e)}"
                            errors.append(error_msg)
                            logger.error(error_msg)

            finally:
                await browser.close()
                logger.info("Browser closed")

        return {
            'success': len(all_trends) > 0 or len(all_videos) > 0,
            'method': 'modal_playwright',
            'trends': all_trends,
            'videos': all_videos,
            'collectedAt': datetime.utcnow().isoformat(),
            'error': '; '.join(errors) if errors else None,
            'stats': {
                'totalTrends': len(all_trends),
                'totalVideos': len(all_videos),
                'keywordsSearched': len(keywords),
                'hashtagsScraped': len(hashtags),
                'errors': len(errors),
            }
        }

    return asyncio.get_event_loop().run_until_complete(_scrape())


def _parse_count(value) -> Optional[int]:
    """Parse view count string (e.g., '1.2M', '355.6K') to int."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)

    try:
        s = str(value).strip().upper()
        match = None
        import re
        match = re.search(r'([\d.]+)\s*([BMK])?', s)
        if not match:
            return None

        num = float(match.group(1))
        suffix = match.group(2) or ''

        if suffix == 'B':
            return int(num * 1_000_000_000)
        elif suffix == 'M':
            return int(num * 1_000_000)
        elif suffix == 'K':
            return int(num * 1_000)
        return int(num)
    except:
        return None


# =============================================================================
# Web Endpoint (for Vercel to call)
# =============================================================================

@app.function(
    image=tiktok_image,
    timeout=30,
)
@modal.fastapi_endpoint(method="POST")
def collect_trends_endpoint(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    HTTP endpoint for Vercel cron to call.

    POST body:
    {
        "keywords": ["countrymusic", "nashville"],
        "hashtags": ["carlypearce"],
        "includeExplore": true,
        "secret": "your-api-secret"
    }
    """
    # Verify secret
    expected_secret = os.environ.get("MODAL_API_SECRET", "")
    provided_secret = data.get("secret", "")

    if expected_secret and provided_secret != expected_secret:
        return {"error": "Unauthorized", "success": False}

    # Call the main function
    result = scrape_tiktok_trends.remote(
        keywords=data.get("keywords", []),
        hashtags=data.get("hashtags", []),
        include_explore=data.get("includeExplore", True),
        limit_per_keyword=data.get("limitPerKeyword", 20),
    )

    return result


# =============================================================================
# Health Check
# =============================================================================

@app.function(image=tiktok_image, timeout=10)
@modal.fastapi_endpoint(method="GET")
def health() -> Dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "hydra-tiktok-trends",
        "timestamp": datetime.utcnow().isoformat(),
    }


# =============================================================================
# Local Testing
# =============================================================================

@app.local_entrypoint()
def test_scrape():
    """Test the scraping function locally."""
    print("Testing TikTok trends scraping...")

    result = scrape_tiktok_trends.remote(
        keywords=["countrymusic", "nashville"],
        hashtags=["carlypearce"],
        include_explore=True,
        limit_per_keyword=10,
    )

    print(f"\n{'='*60}")
    print(f"Success: {result['success']}")
    print(f"Method: {result['method']}")
    print(f"Stats: {result['stats']}")
    print(f"\nTrends ({len(result['trends'])}):")
    for t in result['trends'][:10]:
        print(f"  - #{t['keyword']} (views: {t.get('viewCount', 'N/A')})")
    print(f"\nVideos ({len(result['videos'])}):")
    for v in result['videos'][:5]:
        print(f"  - {v['id']}: {v['description'][:50]}...")
    if result.get('error'):
        print(f"\nErrors: {result['error']}")


if __name__ == "__main__":
    # For local testing without Modal
    print("Run with: modal run modal_tiktok.py::test_scrape")
