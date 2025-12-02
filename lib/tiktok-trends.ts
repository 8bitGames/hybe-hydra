/**
 * TikTok Trends Scraper
 * Combines @tobyg74/tiktok-api-dl + Playwright for robust trend collection
 */

import { chromium, Browser, Page } from 'playwright';

// Types
export interface TikTokTrendItem {
  rank: number;
  keyword: string;
  hashtag?: string;
  viewCount?: number;
  videoCount?: number;
  description?: string;
  thumbnailUrl?: string;
  trendUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface HashtagInfo {
  id: string;
  title: string;
  description?: string;
  viewCount: number;
  videoCount: number;
  thumbnailUrl?: string;
}

export interface HashtagVideo {
  id: string;
  description: string;
  author: {
    uniqueId: string;
    nickname: string;
    avatarUrl?: string;
  };
  stats: {
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
  };
  videoUrl?: string;
  thumbnailUrl?: string;
  musicTitle?: string;
  hashtags: string[];
  createTime: number;
}

export interface TrendCollectionResult {
  success: boolean;
  method: 'playwright' | 'api' | 'fallback';
  trends: TikTokTrendItem[];
  collectedAt: Date;
  error?: string;
}

// Browser singleton for reuse
let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true, // Using new headless - should look more like real browser
      channel: 'chrome', // Use actual Chrome if available
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=site-per-process',
        '--window-size=1920,1080',
        '--disable-gpu',
      ],
    });
  }
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Create a stealth page with anti-detection measures
 */
async function createStealthPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    geolocation: { longitude: 126.9780, latitude: 37.5665 },
    permissions: ['geolocation'],
    extraHTTPHeaders: {
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    },
  });

  const page = await context.newPage();

  // Add anti-detection scripts
  await page.addInitScript(() => {
    // Override webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Add fake plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Add fake languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ko-KR', 'ko', 'en-US', 'en'],
    });

    // Override chrome property
    (window as unknown as Record<string, unknown>).chrome = {
      runtime: {},
    };
  });

  // Only block heavy media to improve speed, keep images
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    if (['media', 'font'].includes(resourceType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  return page;
}

/**
 * Parse view count string (e.g., "1.2M", "355.6K") to number
 */
function parseViewCount(viewStr: string | undefined | null): number {
  if (!viewStr) return 0;

  const str = viewStr.toString().trim().toUpperCase();

  // Extract number with potential suffix (handles "게시물 5M개", "5M videos", "5.2K", etc.)
  const match = str.match(/([\d.]+)\s*([BMK])?/i);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  if (isNaN(num)) return 0;

  const suffix = (match[2] || '').toUpperCase();
  if (suffix === 'B') return num * 1_000_000_000;
  if (suffix === 'M') return num * 1_000_000;
  if (suffix === 'K') return num * 1_000;
  return num;
}

/**
 * Scrape TikTok Explore/Discover page for trending content
 */
export async function scrapeTikTokExplorePage(): Promise<TrendCollectionResult> {
  const browser = await getBrowser();
  const page = await createStealthPage(browser);

  try {
    console.log('[TIKTOK-TRENDS] Navigating to TikTok discover page...');

    // Try the discover page with more categories
    await page.goto('https://www.tiktok.com/discover', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for content to load
    await page.waitForTimeout(5000);

    // Scroll to trigger lazy loading
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(1000);
    }

    // Extract trending data from the page
    const trends = await page.evaluate(() => {
      const results: Array<{
        keyword: string;
        viewCount?: string;
        thumbnailUrl?: string;
        trendUrl?: string;
      }> = [];

      // Try __UNIVERSAL_DATA_FOR_REHYDRATION__ first (most reliable)
      const rehydrationScript = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
      if (rehydrationScript) {
        try {
          const data = JSON.parse(rehydrationScript.textContent || '{}');
          const defaultScope = data['__DEFAULT_SCOPE__'];

          // Try to extract from webapp.discover
          if (defaultScope?.['webapp.discover']) {
            const discoverData = defaultScope['webapp.discover'];

            // Extract suggested searches
            if (discoverData.suggestedSearches) {
              discoverData.suggestedSearches.forEach((item: Record<string, unknown>) => {
                if (item.content) {
                  results.push({
                    keyword: item.content as string,
                    trendUrl: `https://www.tiktok.com/search?q=${encodeURIComponent(item.content as string)}`,
                  });
                }
              });
            }

            // Extract category data
            if (discoverData.categoryList) {
              discoverData.categoryList.forEach((cat: Record<string, unknown>) => {
                if (cat.title || cat.desc) {
                  results.push({
                    keyword: (cat.title || cat.desc) as string,
                  });
                }
              });
            }
          }

          // Try trending data
          if (defaultScope?.['webapp.trending-topic']) {
            const trendingData = defaultScope['webapp.trending-topic'];
            if (trendingData.trendingList) {
              trendingData.trendingList.forEach((item: Record<string, unknown>) => {
                const extraInfo = item.extraInfo as Record<string, unknown> | undefined;
                results.push({
                  keyword: (item.title || item.desc) as string,
                  viewCount: extraInfo?.views as string | undefined,
                });
              });
            }
          }
        } catch {
          // Ignore JSON parse errors
        }
      }

      // Also try to extract from visible elements
      const trendingElements = document.querySelectorAll(
        '[data-e2e="discover-item"], [data-e2e="search-card"], ' +
        '[class*="DivSearchCardContainer"], [class*="DivDiscoverCard"], ' +
        'a[href*="/tag/"], a[href*="/search"]'
      );

      trendingElements.forEach((el) => {
        const link = el.closest('a') || el.querySelector('a');
        const text = el.textContent?.trim();

        if (text && text.length > 1 && text.length < 100) {
          // Extract hashtag from href
          const href = link?.getAttribute('href') || '';
          const tagMatch = href.match(/\/tag\/([^/?]+)/);
          const searchMatch = href.match(/[?&]q=([^&]+)/);

          const keyword = tagMatch?.[1] ||
                         (searchMatch ? decodeURIComponent(searchMatch[1]) : null) ||
                         text.replace(/^#/, '');

          if (keyword && !results.some(r => r.keyword.toLowerCase() === keyword.toLowerCase())) {
            results.push({
              keyword,
              trendUrl: link?.href,
            });
          }
        }
      });

      return results;
    });

    await page.close();

    // Deduplicate and format results
    const uniqueTrends = new Map<string, TikTokTrendItem>();

    trends.forEach((trend) => {
      const keyword = trend.keyword.toLowerCase().trim();
      if (keyword && keyword.length > 1 && !uniqueTrends.has(keyword)) {
        uniqueTrends.set(keyword, {
          rank: uniqueTrends.size + 1,
          keyword: trend.keyword,
          hashtag: trend.keyword.startsWith('#') ? trend.keyword : `#${trend.keyword}`,
          viewCount: parseViewCount(trend.viewCount),
          thumbnailUrl: trend.thumbnailUrl,
          trendUrl: trend.trendUrl,
        });
      }
    });

    const trendList = Array.from(uniqueTrends.values());
    console.log(`[TIKTOK-TRENDS] Found ${trendList.length} trends from discover page`);

    return {
      success: trendList.length > 0,
      method: 'playwright',
      trends: trendList,
      collectedAt: new Date(),
    };
  } catch (error) {
    console.error('[TIKTOK-TRENDS] Discover page scraping failed:', error);
    await page.close();
    return {
      success: false,
      method: 'playwright',
      trends: [],
      collectedAt: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Scrape hashtag page for detailed information
 * Uses hybrid approach: hashtag page for metadata + search for videos
 */
export async function scrapeHashtagPage(hashtag: string): Promise<{
  success: boolean;
  info?: HashtagInfo;
  videos?: HashtagVideo[];
  error?: string;
}> {
  const browser = await getBrowser();
  const page = await createStealthPage(browser);
  const cleanHashtag = hashtag.replace(/^#/, '');

  try {
    console.log(`[TIKTOK-TRENDS] Scraping hashtag: ${cleanHashtag}`);

    // Step 1: Get hashtag metadata from the tag page
    await page.goto(`https://www.tiktok.com/tag/${cleanHashtag}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for initial content
    await page.waitForTimeout(3000);

    // Scroll to trigger lazy loading of video cards
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });
    await page.waitForTimeout(2000);

    // Scroll back up
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1000);

    // Extract data from the page
    const data = await page.evaluate(() => {
      // Try to get data from __UNIVERSAL_DATA_FOR_REHYDRATION__
      const rehydrationScript = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
      if (rehydrationScript) {
        try {
          const parsed = JSON.parse(rehydrationScript.textContent || '{}');
          const defaultScope = parsed['__DEFAULT_SCOPE__'];
          if (defaultScope?.['webapp.challenge-detail']?.itemList?.length > 0) {
            return parsed;
          }
        } catch {
          // Continue to next method
        }
      }

      // Try SIGI_STATE
      const sigiScript = document.getElementById('SIGI_STATE');
      if (sigiScript) {
        try {
          const parsed = JSON.parse(sigiScript.textContent || '{}');
          if (parsed.ItemModule && Object.keys(parsed.ItemModule).length > 0) {
            return parsed;
          }
        } catch {
          // Continue to fallback
        }
      }

      // Fallback: extract from visible DOM elements
      // Get title from h1
      const h1 = document.querySelector('h1');
      const title = h1?.textContent?.trim()?.replace(/^#/, '') || '';

      // Get video/view count from h2 (format: "게시물 5M개" or "5M videos")
      const h2 = document.querySelector('h2');
      const countText = h2?.textContent?.trim() || '';

      // Get description
      const descEl = document.querySelector('[data-e2e="challenge-desc"], p[class*="desc"]');
      const description = descEl?.textContent?.trim() || '';

      // Extract videos from video cards
      const videos: Array<{
        id: string;
        description: string;
        author: string;
        authorNickname: string;
        hashtags: string[];
      }> = [];

      // Method 1: Look for video item containers with data-e2e
      const videoItems = document.querySelectorAll('[data-e2e="challenge-item"], [data-e2e="search-card-video"]');

      videoItems.forEach((item, index) => {
        const authorLink = item.querySelector('a[href*="/@"]');
        const authorId = authorLink?.getAttribute('href')?.match(/\/@([^/?]+)/)?.[1] || '';
        const descEl = item.querySelector('[data-e2e="video-desc"], [class*="video-desc"], [class*="caption"]');
        const desc = descEl?.textContent?.trim() || '';

        // Extract hashtags from description
        const hashtagMatches = desc.match(/#[\w\u3131-\uD79D]+/g) || [];

        videos.push({
          id: `video-${index}`,
          description: desc,
          author: authorId,
          authorNickname: authorLink?.textContent?.trim() || authorId,
          hashtags: hashtagMatches.map(h => h.replace('#', '')),
        });
      });

      // Method 2: If no videos found, try alternative selectors
      if (videos.length === 0) {
        // Look for any video card containers
        const cardContainers = document.querySelectorAll('[class*="DivItemContainer"], [class*="video-card"], [class*="ItemCard"]');

        cardContainers.forEach((card, index) => {
          const links = Array.from(card.querySelectorAll('a[href*="/@"]'));
          let authorId = '';
          for (let i = 0; i < links.length; i++) {
            const link = links[i];
            const match = link.getAttribute('href')?.match(/\/@([^/?]+)/);
            if (match) {
              authorId = match[1];
              break;
            }
          }

          const textContent = card.textContent || '';
          const hashtagMatches = textContent.match(/#[\w\u3131-\uD79D]+/g) || [];

          if (authorId || hashtagMatches.length > 0) {
            videos.push({
              id: `card-${index}`,
              description: textContent.slice(0, 200),
              author: authorId,
              authorNickname: authorId,
              hashtags: hashtagMatches.map(h => h.replace('#', '')),
            });
          }
        });
      }

      // Method 3: Look for anchor elements linking to videos (most reliable)
      if (videos.length === 0) {
        const videoLinks = document.querySelectorAll('a[href*="/video/"]');
        const processedIds = new Set<string>();

        videoLinks.forEach((link) => {
          const href = link.getAttribute('href') || '';
          const videoIdMatch = href.match(/\/video\/(\d+)/);
          const authorMatch = href.match(/\/@([^/]+)/);

          if (videoIdMatch && !processedIds.has(videoIdMatch[1])) {
            processedIds.add(videoIdMatch[1]);

            // Get the video card container (go up to find the wrapper)
            let container = link.parentElement;
            for (let i = 0; i < 5 && container; i++) {
              if (container.querySelector('a[href*="/video/"]') && container.querySelector('strong')) {
                break;
              }
              container = container.parentElement;
            }

            // Extract hashtags from strong elements within the container
            const hashtagElements = container?.querySelectorAll('strong') || [];
            const hashtags: string[] = [];
            hashtagElements.forEach((el) => {
              const text = el.textContent?.trim() || '';
              if (text.startsWith('#')) {
                hashtags.push(text.replace('#', ''));
              }
            });

            // Get description text - look for text content in the link or nearby
            const linkText = link.textContent || '';
            const descMatch = linkText.match(/님의.*?로 만든\s*(.+?)(?:\s+\w+,\w+\s+\w+)?$/);
            const description = descMatch ? descMatch[1].trim() : linkText.slice(0, 200);

            videos.push({
              id: videoIdMatch[1],
              description: description,
              author: authorMatch?.[1] || '',
              authorNickname: authorMatch?.[1] || '',
              hashtags: hashtags.length > 0 ? hashtags : [],
            });
          }
        });
      }

      return {
        fallback: true,
        title,
        viewCount: countText,
        description,
        videos,
      };
    });

    // NOTE: Don't close page here - we may need it for search fallback

    if (!data) {
      await page.close();
      return {
        success: false,
        error: 'Failed to extract data from hashtag page',
      };
    }

    // Parse the data based on structure
    let hashtagInfo: HashtagInfo | undefined;
    const videos: HashtagVideo[] = [];

    if (data.fallback) {
      // Fallback data from DOM extraction
      hashtagInfo = {
        id: cleanHashtag,
        title: data.title || cleanHashtag,
        description: data.description,
        viewCount: parseViewCount(data.viewCount),
        videoCount: data.videos?.length || 0,
      };

      // Process videos from DOM extraction
      if (data.videos && Array.isArray(data.videos)) {
        data.videos.forEach((video: { id: string; description: string; author: string; authorNickname: string; hashtags: string[] }) => {
          videos.push({
            id: video.id,
            description: video.description,
            author: {
              uniqueId: video.author,
              nickname: video.authorNickname,
            },
            stats: {
              playCount: 0,
              likeCount: 0,
              commentCount: 0,
              shareCount: 0,
            },
            hashtags: video.hashtags,
            createTime: 0,
          });
        });
      }
    } else {
      // Try to extract from __UNIVERSAL_DATA_FOR_REHYDRATION__ structure
      const defaultScope = data['__DEFAULT_SCOPE__'];
      if (defaultScope) {
        const challengeInfo = defaultScope['webapp.challenge-detail']?.challengeInfo;
        const itemList = defaultScope['webapp.challenge-detail']?.itemList;

        if (challengeInfo?.challenge) {
          const challenge = challengeInfo.challenge;
          hashtagInfo = {
            id: challenge.id || cleanHashtag,
            title: challenge.title || cleanHashtag,
            description: challenge.desc,
            viewCount: challenge.stats?.viewCount || 0,
            videoCount: challenge.stats?.videoCount || 0,
            thumbnailUrl: challenge.coverLarger || challenge.coverMedium,
          };
        }

        if (itemList && Array.isArray(itemList)) {
          itemList.forEach((item: Record<string, unknown>) => {
            videos.push({
              id: item.id as string,
              description: (item.desc || '') as string,
              author: {
                uniqueId: (item.author as Record<string, string>)?.uniqueId || '',
                nickname: (item.author as Record<string, string>)?.nickname || '',
                avatarUrl: (item.author as Record<string, string>)?.avatarLarger,
              },
              stats: {
                playCount: ((item.stats as Record<string, number>)?.playCount) || 0,
                likeCount: ((item.stats as Record<string, number>)?.diggCount) || 0,
                commentCount: ((item.stats as Record<string, number>)?.commentCount) || 0,
                shareCount: ((item.stats as Record<string, number>)?.shareCount) || 0,
              },
              thumbnailUrl: (item.video as Record<string, string>)?.cover,
              musicTitle: (item.music as Record<string, string>)?.title,
              hashtags: ((item.challenges as Array<Record<string, string>>) || []).map(c => c.title),
              createTime: (item.createTime as number) || 0,
            });
          });
        }
      }
    }

    console.log(`[TIKTOK-TRENDS] Hashtag ${cleanHashtag}: ${videos.length} videos found from tag page`);

    // Close the page as we're done with tag page
    await page.close();

    // Step 2: If no videos found, use searchTikTok as fallback
    if (videos.length === 0) {
      console.log(`[TIKTOK-TRENDS] No videos from tag page, trying searchTikTok fallback for #${cleanHashtag}`);

      try {
        // Use the existing searchTikTok function which works well
        // Request more videos since we'll filter them
        // Search without # - TikTok URLs don't use # symbol
        const searchResult = await searchTikTok(cleanHashtag, 60);

        if (searchResult.success && searchResult.videos.length > 0) {
          console.log(`[TIKTOK-TRENDS] searchTikTok found ${searchResult.videos.length} videos, filtering for #${cleanHashtag}...`);

          // Filter to only include videos that contain the searched hashtag
          const hashtagLower = cleanHashtag.toLowerCase();
          const filteredVideos = searchResult.videos.filter((v) => {
            // Check if hashtag is in the hashtags array
            const hasHashtag = v.hashtags.some(h => h.toLowerCase() === hashtagLower);
            // Also check if hashtag appears in description
            const inDescription = v.description.toLowerCase().includes(`#${hashtagLower}`);
            return hasHashtag || inDescription;
          });

          console.log(`[TIKTOK-TRENDS] Filtered to ${filteredVideos.length} videos containing #${cleanHashtag}`);

          // Add filtered videos from search result
          filteredVideos.forEach((v) => {
            videos.push(v);
          });

          // Update video count in info if we got videos
          if (hashtagInfo && videos.length > 0 && hashtagInfo.videoCount === 0) {
            hashtagInfo.videoCount = videos.length;
          }
        }
      } catch (searchError) {
        console.error(`[TIKTOK-TRENDS] searchTikTok fallback failed:`, searchError);
      }
    }

    console.log(`[TIKTOK-TRENDS] Hashtag ${cleanHashtag}: Total ${videos.length} videos found`);

    return {
      success: true,
      info: hashtagInfo,
      videos,
    };
  } catch (error) {
    console.error(`[TIKTOK-TRENDS] Hashtag scraping failed for ${cleanHashtag}:`, error);
    await page.close();
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Search TikTok for a keyword and extract trends
 */
export async function searchTikTok(keyword: string, limit = 20): Promise<{
  success: boolean;
  videos: HashtagVideo[];
  relatedHashtags: string[];
  error?: string;
}> {
  const browser = await getBrowser();
  const page = await createStealthPage(browser);

  try {
    console.log(`[TIKTOK-TRENDS] Searching TikTok for: ${keyword}`);

    const encodedKeyword = encodeURIComponent(keyword);
    await page.goto(`https://www.tiktok.com/search?q=${encodedKeyword}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    // Scroll to load more content (more iterations = more videos)
    const scrollIterations = Math.min(Math.ceil(limit / 5), 10); // ~5 videos per scroll, max 10 scrolls
    console.log(`[TIKTOK-TRENDS] Scrolling ${scrollIterations} times to load more videos...`);

    for (let i = 0; i < scrollIterations; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(800);
    }

    // Extract search results
    const results = await page.evaluate(() => {
      const videos: Array<{
        id: string;
        description: string;
        authorId: string;
        authorName: string;
        playCount: number;
        likeCount: number;
        commentCount: number;
        shareCount: number;
        hashtags: string[];
      }> = [];
      const hashtags = new Set<string>();

      // Try to get data from __UNIVERSAL_DATA_FOR_REHYDRATION__ first (most accurate)
      const rehydrationScript = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
      if (rehydrationScript) {
        try {
          const data = JSON.parse(rehydrationScript.textContent || '{}');
          const defaultScope = data['__DEFAULT_SCOPE__'];

          // Try different possible locations for search results
          const searchData = defaultScope?.['webapp.search'] ||
                            defaultScope?.['webapp.search-detail'] ||
                            defaultScope?.['seo.abtest'];

          // Extract item list from search data
          let itemList: Array<Record<string, unknown>> = [];
          if (searchData?.itemList) {
            itemList = searchData.itemList;
          } else if (searchData?.data) {
            itemList = searchData.data;
          }

          // Also check for video list in different structures
          if (itemList.length === 0) {
            // Try to find videos in any property that looks like an array
            for (const key of Object.keys(defaultScope || {})) {
              const section = defaultScope[key];
              if (section?.itemList && Array.isArray(section.itemList)) {
                itemList = section.itemList;
                break;
              }
            }
          }

          itemList.forEach((item: Record<string, unknown>) => {
            const itemId = item.id as string;
            const author = item.author as Record<string, string> | undefined;
            const stats = item.stats as Record<string, number> | undefined;
            const challenges = item.challenges as Array<Record<string, string>> | undefined;

            if (itemId) {
              // Extract hashtags
              const itemHashtags = (challenges || []).map(c => c.title).filter(Boolean);
              itemHashtags.forEach(tag => hashtags.add(`#${tag}`));

              videos.push({
                id: itemId,
                description: (item.desc || '') as string,
                authorId: author?.uniqueId || '',
                authorName: author?.nickname || author?.uniqueId || '',
                playCount: stats?.playCount || 0,
                likeCount: stats?.diggCount || 0,  // TikTok uses diggCount for likes
                commentCount: stats?.commentCount || 0,
                shareCount: stats?.shareCount || 0,
                hashtags: itemHashtags,
              });
            }
          });
        } catch {
          // JSON parse failed, continue to DOM extraction
        }
      }

      // If no videos from JSON, fall back to DOM extraction
      if (videos.length === 0) {
        // Parse counts from text (e.g., "57.9K", "1.2M", "452.4K")
        const parseCount = (text: string | undefined | null): number => {
          if (!text) return 0;
          const str = text.trim().toUpperCase();
          const match = str.match(/([\d.]+)\s*([BMK])?/i);
          if (!match) return 0;
          const num = parseFloat(match[1]);
          if (isNaN(num)) return 0;
          const suffix = (match[2] || '').toUpperCase();
          if (suffix === 'B') return num * 1_000_000_000;
          if (suffix === 'M') return num * 1_000_000;
          if (suffix === 'K') return num * 1_000;
          return num;
        };

        // TikTok search results structure:
        // - button > link[href*="/video/"] > (img + strong with like count)
        // - sibling div contains description text and author info
        const videoLinks = document.querySelectorAll('a[href*="/video/"]');
        const processedIds = new Set<string>();

        videoLinks.forEach((link) => {
          const href = link.getAttribute('href') || '';
          const videoIdMatch = href.match(/\/video\/(\d+)/);
          const authorMatch = href.match(/\/@([^/]+)/);

          if (videoIdMatch && !processedIds.has(videoIdMatch[1])) {
            processedIds.add(videoIdMatch[1]);

            // Find the like count in <strong> element within the link
            const strongElements = link.querySelectorAll('strong');
            let likeCount = 0;
            for (const strong of strongElements) {
              const text = strong.textContent?.trim() || '';
              if (/^[\d.]+[KMB]?$/i.test(text)) {
                likeCount = parseCount(text);
                break;
              }
            }

            // Get description from img alt attribute (contains full description)
            const img = link.querySelector('img');
            let description = '';

            if (img) {
              const altText = img.getAttribute('alt') || '';
              // Alt format: "Author 님이 ... 만든 Description #hashtags"
              const madeByMatch = altText.match(/만든\s*(.+)/);
              if (madeByMatch) {
                description = madeByMatch[1].trim();
              } else {
                description = altText;
              }
            }

            // If no description from img, try to find in parent container's sibling
            if (!description) {
              // Go up to find the card container (usually 2-3 levels up from button)
              let cardContainer = link.closest('button')?.parentElement;
              if (cardContainer) {
                // Find sibling elements that contain text (description div)
                const siblings = cardContainer.querySelectorAll('div, span, p');
                for (const el of siblings) {
                  const text = el.textContent?.trim() || '';
                  // Skip if it's just numbers (like count) or author name
                  if (text && text.length > 20 && !(/^[\d.]+[KMB]?$/i.test(text))) {
                    // Check if it contains hashtags (good indicator of description)
                    if (text.includes('#') || text.length > 50) {
                      description = text;
                      break;
                    }
                  }
                }
              }
            }

            // Extract hashtags from description
            const hashtagMatches = description.match(/#[\w\u3131-\uD79D]+/g) || [];
            hashtagMatches.forEach(tag => hashtags.add(tag));

            // Get author info
            const authorId = authorMatch?.[1] || '';

            if (authorId || description || likeCount > 0) {
              videos.push({
                id: videoIdMatch[1],
                description,
                authorId,
                authorName: authorId,
                playCount: 0,
                likeCount,
                commentCount: 0,
                shareCount: 0,
                hashtags: hashtagMatches.map(h => h.replace('#', '')),
              });
            }
          }
        });
      }

      // Get suggested/related hashtags
      const relatedTags = document.querySelectorAll('[data-e2e="search-hashtag-item"], [class*="HashtagLink"]');
      relatedTags.forEach(tag => {
        const text = tag.textContent?.trim();
        if (text) hashtags.add(text.startsWith('#') ? text : `#${text}`);
      });

      return {
        videos, // Return all found videos, filtering happens outside
        hashtags: Array.from(hashtags),
      };
    });

    await page.close();

    // Deduplicate videos by ID and filter out empty entries
    const seenIds = new Set<string>();
    const videos: HashtagVideo[] = [];

    results.videos.forEach(v => {
      // Skip if already seen or if empty/invalid entry
      if (!v.id || seenIds.has(v.id) || (!v.authorId && !v.description)) {
        return;
      }
      seenIds.add(v.id);

      // Build video URL
      const videoUrl = v.authorId
        ? `https://www.tiktok.com/@${v.authorId}/video/${v.id}`
        : `https://www.tiktok.com/video/${v.id}`;

      videos.push({
        id: v.id,
        description: v.description,
        author: {
          uniqueId: v.authorId,
          nickname: v.authorName,
        },
        stats: {
          playCount: v.playCount,
          likeCount: v.likeCount,
          commentCount: v.commentCount,
          shareCount: v.shareCount,
        },
        videoUrl,
        hashtags: v.hashtags,
        createTime: 0,
      });
    });

    // Apply limit after deduplication
    const limitedVideos = videos.slice(0, limit);

    console.log(`[TIKTOK-TRENDS] Search found ${videos.length} unique videos, returning ${limitedVideos.length} (limit: ${limit}), ${results.hashtags.length} hashtags`);

    return {
      success: true,
      videos: limitedVideos,
      relatedHashtags: results.hashtags,
    };
  } catch (error) {
    console.error(`[TIKTOK-TRENDS] Search failed for ${keyword}:`, error);
    await page.close();
    return {
      success: false,
      videos: [],
      relatedHashtags: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Collect trends from multiple sources
 */
export async function collectTikTokTrends(options?: {
  keywords?: string[];
  hashtags?: string[];
  includeExplore?: boolean;
}): Promise<TrendCollectionResult> {
  const {
    keywords = [],
    hashtags = [],
    includeExplore = true,
  } = options || {};

  const allTrends: TikTokTrendItem[] = [];
  const seenKeywords = new Set<string>();
  let method: 'playwright' | 'api' | 'fallback' = 'playwright';

  try {
    // 1. Scrape explore page for trending content
    if (includeExplore) {
      console.log('[TIKTOK-TRENDS] Step 1: Collecting from explore page...');
      const exploreResult = await scrapeTikTokExplorePage();
      if (exploreResult.success) {
        exploreResult.trends.forEach(trend => {
          const key = trend.keyword.toLowerCase();
          if (!seenKeywords.has(key)) {
            seenKeywords.add(key);
            allTrends.push(trend);
          }
        });
      }
    }

    // 2. Search for provided keywords
    if (keywords.length > 0) {
      console.log('[TIKTOK-TRENDS] Step 2: Searching keywords...');
      for (const keyword of keywords) {
        const searchResult = await searchTikTok(keyword);
        if (searchResult.success) {
          // Add related hashtags as trends
          searchResult.relatedHashtags.forEach(tag => {
            const cleanTag = tag.replace(/^#/, '').toLowerCase();
            if (!seenKeywords.has(cleanTag)) {
              seenKeywords.add(cleanTag);
              allTrends.push({
                rank: allTrends.length + 1,
                keyword: cleanTag,
                hashtag: `#${cleanTag}`,
              });
            }
          });

          // Extract popular hashtags from videos
          const hashtagCounts = new Map<string, number>();
          searchResult.videos.forEach(video => {
            video.hashtags.forEach(tag => {
              hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
            });
          });

          // Add top hashtags
          Array.from(hashtagCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([tag, count]) => {
              const key = tag.toLowerCase();
              if (!seenKeywords.has(key)) {
                seenKeywords.add(key);
                allTrends.push({
                  rank: allTrends.length + 1,
                  keyword: tag,
                  hashtag: `#${tag}`,
                  videoCount: count,
                });
              }
            });
        }

        // Small delay between searches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 3. Get details for specific hashtags
    if (hashtags.length > 0) {
      console.log('[TIKTOK-TRENDS] Step 3: Collecting hashtag details...');
      for (const hashtag of hashtags) {
        const hashtagResult = await scrapeHashtagPage(hashtag);
        if (hashtagResult.success && hashtagResult.info) {
          const key = hashtagResult.info.title.toLowerCase();
          if (!seenKeywords.has(key)) {
            seenKeywords.add(key);
            allTrends.push({
              rank: allTrends.length + 1,
              keyword: hashtagResult.info.title,
              hashtag: `#${hashtagResult.info.title}`,
              viewCount: hashtagResult.info.viewCount,
              videoCount: hashtagResult.info.videoCount,
              description: hashtagResult.info.description,
              thumbnailUrl: hashtagResult.info.thumbnailUrl,
              trendUrl: `https://www.tiktok.com/tag/${hashtagResult.info.title}`,
            });
          }
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Re-rank all trends
    allTrends.forEach((trend, index) => {
      trend.rank = index + 1;
    });

    console.log(`[TIKTOK-TRENDS] Total trends collected: ${allTrends.length}`);

    return {
      success: allTrends.length > 0,
      method,
      trends: allTrends,
      collectedAt: new Date(),
    };
  } catch (error) {
    console.error('[TIKTOK-TRENDS] Collection failed:', error);
    return {
      success: false,
      method: 'fallback',
      trends: allTrends,
      collectedAt: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get popular country music related trends (convenience function)
 */
export async function getCountryMusicTrends(): Promise<TrendCollectionResult> {
  return collectTikTokTrends({
    keywords: ['countrymusic', 'nashville', 'country song', 'country cover'],
    hashtags: ['countrymusic', 'countrysong', 'nashville', 'countrytiktok'],
    includeExplore: true,
  });
}

// Alias for backward compatibility
export const getKpopTrends = getCountryMusicTrends;
