"""
TikTok Trends Scraper using Playwright.
Runs on Modal with headless Chromium browser.
"""

import asyncio
import re
from typing import Optional
from dataclasses import dataclass, field
from playwright.async_api import async_playwright, Browser, Page


@dataclass
class TikTokTrendItem:
    rank: int
    keyword: str
    hashtag: Optional[str] = None
    view_count: Optional[int] = None
    video_count: Optional[int] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    trend_url: Optional[str] = None


@dataclass
class HashtagVideo:
    id: str
    description: str
    author_id: str
    author_name: str
    play_count: int = 0
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    hashtags: list = field(default_factory=list)
    video_url: Optional[str] = None


@dataclass
class TrendCollectionResult:
    success: bool
    method: str
    trends: list
    error: Optional[str] = None


@dataclass
class SearchResult:
    success: bool
    videos: list
    related_hashtags: list
    info: Optional[dict] = None
    error: Optional[str] = None


def parse_view_count(view_str: Optional[str]) -> int:
    """Parse view count string (e.g., '1.2M', '355.6K') to number."""
    if not view_str:
        return 0

    s = str(view_str).strip().upper()
    match = re.search(r'([\d.]+)\s*([BMK])?', s, re.IGNORECASE)
    if not match:
        return 0

    try:
        num = float(match.group(1))
    except ValueError:
        return 0

    suffix = (match.group(2) or '').upper()
    if suffix == 'B':
        return int(num * 1_000_000_000)
    if suffix == 'M':
        return int(num * 1_000_000)
    if suffix == 'K':
        return int(num * 1_000)
    return int(num)


async def create_stealth_page(browser: Browser) -> Page:
    """Create a stealth page with anti-detection measures."""
    context = await browser.new_context(
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport={'width': 1920, 'height': 1080},
        locale='ko-KR',
        timezone_id='Asia/Seoul',
        geolocation={'longitude': 126.9780, 'latitude': 37.5665},
        permissions=['geolocation'],
        extra_http_headers={
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
        },
    )

    page = await context.new_page()

    # Anti-detection scripts
    await page.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'] });
        window.chrome = { runtime: {} };
    """)

    # Block heavy media to improve speed
    await page.route('**/*', lambda route: (
        route.abort() if route.request.resource_type in ['media', 'font'] else route.continue_()
    ))

    return page


async def scrape_tiktok_explore() -> TrendCollectionResult:
    """Scrape TikTok Explore/Discover page for trending content."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
            ]
        )

        try:
            page = await create_stealth_page(browser)
            print('[TIKTOK] Navigating to TikTok discover page...')

            await page.goto('https://www.tiktok.com/discover', wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(5000)

            # Scroll to trigger lazy loading
            for _ in range(3):
                await page.evaluate('window.scrollBy(0, 500)')
                await page.wait_for_timeout(1000)

            # Extract trending data
            trends_data = await page.evaluate('''() => {
                const results = [];

                // Try __UNIVERSAL_DATA_FOR_REHYDRATION__
                const rehydrationScript = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
                if (rehydrationScript) {
                    try {
                        const data = JSON.parse(rehydrationScript.textContent || '{}');
                        const defaultScope = data['__DEFAULT_SCOPE__'];

                        if (defaultScope?.['webapp.discover']?.suggestedSearches) {
                            defaultScope['webapp.discover'].suggestedSearches.forEach(item => {
                                if (item.content) {
                                    results.push({
                                        keyword: item.content,
                                        trendUrl: `https://www.tiktok.com/search?q=${encodeURIComponent(item.content)}`,
                                    });
                                }
                            });
                        }

                        if (defaultScope?.['webapp.trending-topic']?.trendingList) {
                            defaultScope['webapp.trending-topic'].trendingList.forEach(item => {
                                results.push({
                                    keyword: item.title || item.desc,
                                    viewCount: item.extraInfo?.views,
                                });
                            });
                        }
                    } catch (e) {}
                }

                // Also extract from visible elements
                document.querySelectorAll('a[href*="/tag/"], a[href*="/search"]').forEach(el => {
                    const href = el.getAttribute('href') || '';
                    const tagMatch = href.match(/\\/tag\\/([^/?]+)/);
                    const searchMatch = href.match(/[?&]q=([^&]+)/);

                    const keyword = tagMatch?.[1] ||
                                   (searchMatch ? decodeURIComponent(searchMatch[1]) : null);

                    if (keyword && !results.some(r => r.keyword?.toLowerCase() === keyword.toLowerCase())) {
                        results.push({ keyword, trendUrl: el.href });
                    }
                });

                return results;
            }''')

            await page.close()

            # Deduplicate and format results
            seen = set()
            trends = []
            for i, t in enumerate(trends_data):
                keyword = (t.get('keyword') or '').strip().lower()
                if keyword and len(keyword) > 1 and keyword not in seen:
                    seen.add(keyword)
                    trends.append(TikTokTrendItem(
                        rank=len(trends) + 1,
                        keyword=t.get('keyword', ''),
                        hashtag=f"#{t.get('keyword', '')}",
                        view_count=parse_view_count(t.get('viewCount')),
                        trend_url=t.get('trendUrl'),
                    ))

            print(f'[TIKTOK] Found {len(trends)} trends from discover page')

            return TrendCollectionResult(
                success=len(trends) > 0,
                method='playwright',
                trends=[t.__dict__ for t in trends],
            )

        except Exception as e:
            print(f'[TIKTOK] Discover page scraping failed: {e}')
            return TrendCollectionResult(
                success=False,
                method='playwright',
                trends=[],
                error=str(e),
            )
        finally:
            await browser.close()


async def search_tiktok(keyword: str, limit: int = 20) -> SearchResult:
    """Search TikTok for a keyword and extract trends."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
            ]
        )

        try:
            page = await create_stealth_page(browser)
            print(f'[TIKTOK] Searching for: {keyword}')

            encoded_keyword = keyword.replace(' ', '%20')
            await page.goto(
                f'https://www.tiktok.com/search?q={encoded_keyword}',
                wait_until='networkidle',
                timeout=30000
            )
            await page.wait_for_timeout(3000)

            # Scroll to load more content
            scroll_iterations = min(limit // 5, 10)
            for _ in range(scroll_iterations):
                await page.evaluate('window.scrollBy(0, 1000)')
                await page.wait_for_timeout(800)

            # Extract search results
            results = await page.evaluate('''() => {
                const videos = [];
                const hashtags = new Set();

                // Try __UNIVERSAL_DATA_FOR_REHYDRATION__
                const rehydrationScript = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
                if (rehydrationScript) {
                    try {
                        const data = JSON.parse(rehydrationScript.textContent || '{}');
                        const defaultScope = data['__DEFAULT_SCOPE__'];

                        let itemList = [];
                        for (const key of Object.keys(defaultScope || {})) {
                            const section = defaultScope[key];
                            if (section?.itemList && Array.isArray(section.itemList)) {
                                itemList = section.itemList;
                                break;
                            }
                        }

                        itemList.forEach(item => {
                            if (item.id) {
                                const itemHashtags = (item.challenges || []).map(c => c.title).filter(Boolean);
                                itemHashtags.forEach(tag => hashtags.add('#' + tag));

                                videos.push({
                                    id: item.id,
                                    description: item.desc || '',
                                    authorId: item.author?.uniqueId || '',
                                    authorName: item.author?.nickname || '',
                                    playCount: item.stats?.playCount || 0,
                                    likeCount: item.stats?.diggCount || 0,
                                    commentCount: item.stats?.commentCount || 0,
                                    shareCount: item.stats?.shareCount || 0,
                                    hashtags: itemHashtags,
                                });
                            }
                        });
                    } catch (e) {}
                }

                // Fallback: DOM extraction
                if (videos.length === 0) {
                    const videoLinks = document.querySelectorAll('a[href*="/video/"]');
                    const processedIds = new Set();

                    videoLinks.forEach(link => {
                        const href = link.getAttribute('href') || '';
                        const videoIdMatch = href.match(/\\/video\\/(\\d+)/);
                        const authorMatch = href.match(/\\/@([^/]+)/);

                        if (videoIdMatch && !processedIds.has(videoIdMatch[1])) {
                            processedIds.add(videoIdMatch[1]);

                            const img = link.querySelector('img');
                            let description = '';
                            if (img) {
                                const altText = img.getAttribute('alt') || '';
                                const match = altText.match(/만든\\s*(.+)/);
                                description = match ? match[1].trim() : altText;
                            }

                            const hashtagMatches = description.match(/#[\\w\\u3131-\\uD79D]+/g) || [];
                            hashtagMatches.forEach(tag => hashtags.add(tag));

                            videos.push({
                                id: videoIdMatch[1],
                                description,
                                authorId: authorMatch?.[1] || '',
                                authorName: authorMatch?.[1] || '',
                                playCount: 0,
                                likeCount: 0,
                                commentCount: 0,
                                shareCount: 0,
                                hashtags: hashtagMatches.map(h => h.replace('#', '')),
                            });
                        }
                    });
                }

                return { videos, hashtags: Array.from(hashtags) };
            }''')

            await page.close()

            # Deduplicate and format
            seen_ids = set()
            videos = []
            for v in results.get('videos', []):
                vid = v.get('id')
                if not vid or vid in seen_ids:
                    continue
                seen_ids.add(vid)

                author_id = v.get('authorId', '')
                video_url = f"https://www.tiktok.com/@{author_id}/video/{vid}" if author_id else f"https://www.tiktok.com/video/{vid}"

                videos.append({
                    'id': vid,
                    'description': v.get('description', ''),
                    'author': {
                        'uniqueId': author_id,
                        'nickname': v.get('authorName', ''),
                    },
                    'stats': {
                        'playCount': v.get('playCount', 0),
                        'likeCount': v.get('likeCount', 0),
                        'commentCount': v.get('commentCount', 0),
                        'shareCount': v.get('shareCount', 0),
                    },
                    'videoUrl': video_url,
                    'hashtags': v.get('hashtags', []),
                })

            videos = videos[:limit]
            print(f'[TIKTOK] Search found {len(videos)} videos, {len(results.get("hashtags", []))} hashtags')

            return SearchResult(
                success=True,
                videos=videos,
                related_hashtags=results.get('hashtags', []),
            )

        except Exception as e:
            print(f'[TIKTOK] Search failed: {e}')
            return SearchResult(
                success=False,
                videos=[],
                related_hashtags=[],
                error=str(e),
            )
        finally:
            await browser.close()


async def scrape_hashtag_page(hashtag: str) -> SearchResult:
    """Scrape hashtag page for detailed information."""
    clean_hashtag = hashtag.lstrip('#')

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
            ]
        )

        try:
            page = await create_stealth_page(browser)
            print(f'[TIKTOK] Scraping hashtag: {clean_hashtag}')

            await page.goto(
                f'https://www.tiktok.com/tag/{clean_hashtag}',
                wait_until='domcontentloaded',
                timeout=30000
            )
            await page.wait_for_timeout(3000)

            # Scroll to load content
            await page.evaluate('window.scrollBy(0, 500)')
            await page.wait_for_timeout(2000)

            # Extract data
            data = await page.evaluate('''() => {
                // Try __UNIVERSAL_DATA_FOR_REHYDRATION__
                const rehydrationScript = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
                if (rehydrationScript) {
                    try {
                        const parsed = JSON.parse(rehydrationScript.textContent || '{}');
                        const defaultScope = parsed['__DEFAULT_SCOPE__'];
                        if (defaultScope?.['webapp.challenge-detail']?.itemList?.length > 0) {
                            return { ...parsed, source: 'rehydration' };
                        }
                    } catch (e) {}
                }

                // Fallback: DOM extraction
                const h1 = document.querySelector('h1');
                const title = h1?.textContent?.trim()?.replace(/^#/, '') || '';

                const h2 = document.querySelector('h2');
                const countText = h2?.textContent?.trim() || '';

                const videos = [];
                const videoLinks = document.querySelectorAll('a[href*="/video/"]');
                const processedIds = new Set();

                videoLinks.forEach(link => {
                    const href = link.getAttribute('href') || '';
                    const videoIdMatch = href.match(/\\/video\\/(\\d+)/);
                    const authorMatch = href.match(/\\/@([^/]+)/);

                    if (videoIdMatch && !processedIds.has(videoIdMatch[1])) {
                        processedIds.add(videoIdMatch[1]);

                        const container = link.closest('div');
                        const hashtagElements = container?.querySelectorAll('strong') || [];
                        const hashtags = [];
                        hashtagElements.forEach(el => {
                            const text = el.textContent?.trim() || '';
                            if (text.startsWith('#')) {
                                hashtags.push(text.replace('#', ''));
                            }
                        });

                        videos.push({
                            id: videoIdMatch[1],
                            author: authorMatch?.[1] || '',
                            hashtags,
                        });
                    }
                });

                return { fallback: true, title, viewCount: countText, videos };
            }''')

            await page.close()

            info = None
            videos = []

            if data.get('source') == 'rehydration':
                # Parse from rehydration data
                default_scope = data.get('__DEFAULT_SCOPE__', {})
                challenge_info = default_scope.get('webapp.challenge-detail', {}).get('challengeInfo', {})
                item_list = default_scope.get('webapp.challenge-detail', {}).get('itemList', [])

                if challenge_info.get('challenge'):
                    c = challenge_info['challenge']
                    info = {
                        'title': c.get('title', clean_hashtag),
                        'viewCount': c.get('stats', {}).get('viewCount', 0),
                        'videoCount': c.get('stats', {}).get('videoCount', 0),
                    }

                for item in item_list:
                    author = item.get('author', {})
                    stats = item.get('stats', {})
                    videos.append({
                        'id': item.get('id'),
                        'description': item.get('desc', ''),
                        'author': {
                            'uniqueId': author.get('uniqueId', ''),
                            'nickname': author.get('nickname', ''),
                        },
                        'stats': {
                            'playCount': stats.get('playCount', 0),
                            'likeCount': stats.get('diggCount', 0),
                            'commentCount': stats.get('commentCount', 0),
                            'shareCount': stats.get('shareCount', 0),
                        },
                        'hashtags': [c.get('title') for c in item.get('challenges', [])],
                    })
            else:
                # Fallback data
                info = {
                    'title': data.get('title', clean_hashtag),
                    'viewCount': parse_view_count(data.get('viewCount')),
                    'videoCount': len(data.get('videos', [])),
                }

                for v in data.get('videos', []):
                    author_id = v.get('author', '')
                    videos.append({
                        'id': v.get('id'),
                        'description': '',
                        'author': {
                            'uniqueId': author_id,
                            'nickname': author_id,
                        },
                        'stats': {
                            'playCount': 0,
                            'likeCount': 0,
                            'commentCount': 0,
                            'shareCount': 0,
                        },
                        'hashtags': v.get('hashtags', []),
                    })

            # If no videos, try search fallback
            if not videos:
                print(f'[TIKTOK] No videos from tag page, trying search fallback for #{clean_hashtag}')
                search_result = await search_tiktok(clean_hashtag, 40)
                if search_result.success:
                    # Filter for matching hashtag
                    for v in search_result.videos:
                        has_hashtag = clean_hashtag.lower() in [h.lower() for h in v.get('hashtags', [])]
                        in_desc = f'#{clean_hashtag.lower()}' in v.get('description', '').lower()
                        if has_hashtag or in_desc:
                            videos.append(v)

            print(f'[TIKTOK] Hashtag {clean_hashtag}: {len(videos)} videos found')

            return SearchResult(
                success=True,
                videos=videos,
                related_hashtags=[],
                info=info,
            )

        except Exception as e:
            print(f'[TIKTOK] Hashtag scraping failed: {e}')
            return SearchResult(
                success=False,
                videos=[],
                related_hashtags=[],
                error=str(e),
            )
        finally:
            await browser.close()


async def collect_tiktok_trends(
    keywords: list = None,
    hashtags: list = None,
    include_explore: bool = True
) -> TrendCollectionResult:
    """Collect trends from multiple sources."""
    keywords = keywords or []
    hashtags = hashtags or []

    all_trends = []
    seen_keywords = set()

    try:
        # 1. Scrape explore page
        if include_explore:
            print('[TIKTOK] Step 1: Collecting from explore page...')
            explore_result = await scrape_tiktok_explore()
            if explore_result.success:
                for trend in explore_result.trends:
                    key = trend.get('keyword', '').lower()
                    if key and key not in seen_keywords:
                        seen_keywords.add(key)
                        all_trends.append(trend)

        # 2. Search for provided keywords
        if keywords:
            print('[TIKTOK] Step 2: Searching keywords...')
            for keyword in keywords:
                search_result = await search_tiktok(keyword)
                if search_result.success:
                    # Add related hashtags as trends
                    for tag in search_result.related_hashtags:
                        clean_tag = tag.lstrip('#').lower()
                        if clean_tag not in seen_keywords:
                            seen_keywords.add(clean_tag)
                            all_trends.append({
                                'rank': len(all_trends) + 1,
                                'keyword': clean_tag,
                                'hashtag': f'#{clean_tag}',
                            })

                    # Extract popular hashtags from videos
                    hashtag_counts = {}
                    for video in search_result.videos:
                        for tag in video.get('hashtags', []):
                            hashtag_counts[tag] = hashtag_counts.get(tag, 0) + 1

                    for tag, count in sorted(hashtag_counts.items(), key=lambda x: -x[1])[:10]:
                        key = tag.lower()
                        if key not in seen_keywords:
                            seen_keywords.add(key)
                            all_trends.append({
                                'rank': len(all_trends) + 1,
                                'keyword': tag,
                                'hashtag': f'#{tag}',
                                'video_count': count,
                            })

                await asyncio.sleep(1)  # Rate limiting

        # 3. Get details for specific hashtags
        if hashtags:
            print('[TIKTOK] Step 3: Collecting hashtag details...')
            for hashtag in hashtags:
                result = await scrape_hashtag_page(hashtag)
                if result.success and result.info:
                    key = result.info.get('title', '').lower()
                    if key not in seen_keywords:
                        seen_keywords.add(key)
                        all_trends.append({
                            'rank': len(all_trends) + 1,
                            'keyword': result.info.get('title', ''),
                            'hashtag': f"#{result.info.get('title', '')}",
                            'view_count': result.info.get('viewCount', 0),
                            'video_count': result.info.get('videoCount', 0),
                            'trend_url': f"https://www.tiktok.com/tag/{result.info.get('title', '')}",
                        })

                await asyncio.sleep(1)  # Rate limiting

        # Re-rank
        for i, trend in enumerate(all_trends):
            trend['rank'] = i + 1

        print(f'[TIKTOK] Total trends collected: {len(all_trends)}')

        return TrendCollectionResult(
            success=len(all_trends) > 0,
            method='playwright',
            trends=all_trends,
        )

    except Exception as e:
        print(f'[TIKTOK] Collection failed: {e}')
        return TrendCollectionResult(
            success=False,
            method='playwright',
            trends=all_trends,
            error=str(e),
        )
