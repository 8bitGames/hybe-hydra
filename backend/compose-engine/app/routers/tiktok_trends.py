"""
TikTok Trends Scraper - Modal Sidecar Service

This runs on Modal with more resources and no timeout limits.
The Vercel cron job calls this Modal function instead of running Playwright directly.
"""

import os
import json
import logging
import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime

import modal
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tiktok-trends", tags=["tiktok-trends"])

# =============================================================================
# Modal App Definition
# =============================================================================

# Create Modal image with Playwright
tiktok_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install([
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
        # Fonts for Korean text
        "fonts-noto-cjk",
    ])
    .pip_install([
        "playwright==1.40.0",
        "httpx>=0.24.0",
    ])
    .run_commands([
        "playwright install chromium",
        "playwright install-deps chromium",
    ])
)

# Reference existing app or create stub
try:
    from modal_app import app as modal_app
except ImportError:
    modal_app = modal.App("hydra-compose")


# =============================================================================
# Pydantic Models
# =============================================================================

class TrendItem(BaseModel):
    rank: int
    keyword: str
    hashtag: Optional[str] = None
    viewCount: Optional[int] = None
    videoCount: Optional[int] = None
    description: Optional[str] = None
    thumbnailUrl: Optional[str] = None
    trendUrl: Optional[str] = None


class TrendCollectionResult(BaseModel):
    success: bool
    method: str = "playwright"
    trends: List[TrendItem]
    collectedAt: datetime
    error: Optional[str] = None


class HashtagVideo(BaseModel):
    id: str
    description: str
    authorId: str
    authorName: str
    playCount: int = 0
    likeCount: int = 0
    commentCount: int = 0
    shareCount: int = 0
    hashtags: List[str] = []


class HashtagResult(BaseModel):
    success: bool
    hashtag: str
    viewCount: Optional[int] = None
    videoCount: Optional[int] = None
    description: Optional[str] = None
    videos: List[HashtagVideo] = []
    error: Optional[str] = None


class CollectRequest(BaseModel):
    keywords: List[str] = []
    hashtags: List[str] = []
    includeExplore: bool = True


# =============================================================================
# Modal Function - Heavy Lifting
# =============================================================================

@modal_app.function(
    image=tiktok_image,
    timeout=600,  # 10 minutes - plenty of time
    memory=2048,  # 2GB RAM for browser
    retries=1,
)
async def scrape_tiktok_trends(
    keywords: List[str],
    hashtags: List[str],
    include_explore: bool = True
) -> Dict[str, Any]:
    """
    Scrape TikTok trends using Playwright on Modal.

    This function has:
    - 10 minute timeout
    - 2GB RAM
    - Dedicated Chromium browser
    - No cold start issues
    """
    from playwright.async_api import async_playwright

    all_trends: List[Dict] = []
    seen_keywords = set()
    errors: List[str] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1920,1080',
                '--disable-gpu',
            ]
        )

        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
            viewport={'width': 1920, 'height': 1080},
            locale='ko-KR',
            timezone_id='Asia/Seoul',
        )

        # Add anti-detection
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        """)

        page = await context.new_page()

        # Block heavy resources
        await page.route('**/*', lambda route: route.abort() if route.request.resource_type in ['media', 'font'] else route.continue_())

        try:
            # 1. Scrape explore page
            if include_explore:
                logger.info("Scraping TikTok explore page...")
                try:
                    await page.goto('https://www.tiktok.com/discover', timeout=30000)
                    await page.wait_for_timeout(5000)

                    for _ in range(3):
                        await page.evaluate('window.scrollBy(0, 500)')
                        await page.wait_for_timeout(1000)

                    explore_trends = await page.evaluate('''() => {
                        const results = [];
                        const script = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
                        if (script) {
                            try {
                                const data = JSON.parse(script.textContent);
                                const scope = data['__DEFAULT_SCOPE__'];
                                if (scope?.['webapp.discover']?.suggestedSearches) {
                                    scope['webapp.discover'].suggestedSearches.forEach(item => {
                                        if (item.content) results.push({ keyword: item.content });
                                    });
                                }
                            } catch {}
                        }
                        document.querySelectorAll('a[href*="/tag/"], a[href*="/search"]').forEach(el => {
                            const href = el.href || '';
                            const tagMatch = href.match(/\\/tag\\/([^/?]+)/);
                            if (tagMatch) results.push({ keyword: tagMatch[1] });
                        });
                        return results;
                    }''')

                    for trend in explore_trends:
                        key = trend['keyword'].lower()
                        if key not in seen_keywords:
                            seen_keywords.add(key)
                            all_trends.append({
                                'rank': len(all_trends) + 1,
                                'keyword': trend['keyword'],
                                'hashtag': f"#{trend['keyword']}",
                            })

                    logger.info(f"Found {len(explore_trends)} trends from explore")

                except Exception as e:
                    errors.append(f"Explore scraping failed: {str(e)}")
                    logger.error(f"Explore scraping failed: {e}")

            # 2. Search keywords
            for keyword in keywords:
                try:
                    logger.info(f"Searching keyword: {keyword}")
                    await page.goto(f'https://www.tiktok.com/search?q={keyword}', timeout=30000)
                    await page.wait_for_timeout(3000)

                    for _ in range(3):
                        await page.evaluate('window.scrollBy(0, 500)')
                        await page.wait_for_timeout(800)

                    search_data = await page.evaluate('''() => {
                        const hashtags = new Set();
                        document.querySelectorAll('strong').forEach(el => {
                            const text = el.textContent?.trim();
                            if (text?.startsWith('#')) hashtags.add(text.slice(1));
                        });
                        return Array.from(hashtags);
                    }''')

                    for tag in search_data:
                        key = tag.lower()
                        if key not in seen_keywords:
                            seen_keywords.add(key)
                            all_trends.append({
                                'rank': len(all_trends) + 1,
                                'keyword': tag,
                                'hashtag': f"#{tag}",
                            })

                    logger.info(f"Found {len(search_data)} hashtags for {keyword}")

                except Exception as e:
                    errors.append(f"Search failed for {keyword}: {str(e)}")
                    logger.error(f"Search failed for {keyword}: {e}")

            # 3. Get hashtag details
            for hashtag in hashtags:
                clean_tag = hashtag.lstrip('#')
                try:
                    logger.info(f"Scraping hashtag: {clean_tag}")
                    await page.goto(f'https://www.tiktok.com/tag/{clean_tag}', timeout=30000)
                    await page.wait_for_timeout(3000)

                    hashtag_data = await page.evaluate('''() => {
                        const h2 = document.querySelector('h2');
                        const viewCount = h2?.textContent?.trim() || '';
                        return { viewCount };
                    }''')

                    if clean_tag.lower() not in seen_keywords:
                        seen_keywords.add(clean_tag.lower())
                        all_trends.append({
                            'rank': len(all_trends) + 1,
                            'keyword': clean_tag,
                            'hashtag': f"#{clean_tag}",
                            'trendUrl': f'https://www.tiktok.com/tag/{clean_tag}',
                        })

                except Exception as e:
                    errors.append(f"Hashtag scraping failed for {clean_tag}: {str(e)}")
                    logger.error(f"Hashtag scraping failed for {clean_tag}: {e}")

        finally:
            await browser.close()

    return {
        'success': len(all_trends) > 0,
        'method': 'modal_playwright',
        'trends': all_trends,
        'collectedAt': datetime.utcnow().isoformat(),
        'error': '; '.join(errors) if errors else None,
        'stats': {
            'totalTrends': len(all_trends),
            'keywords': len(keywords),
            'hashtags': len(hashtags),
            'errors': len(errors),
        }
    }


# =============================================================================
# FastAPI Endpoints (for local testing)
# =============================================================================

@router.post("/collect", response_model=TrendCollectionResult)
async def collect_trends(request: CollectRequest):
    """
    Trigger TikTok trend collection.

    In production, this calls the Modal function.
    Locally, it can run Playwright directly.
    """
    # Check if Modal is available
    use_modal = os.environ.get("COMPOSE_ENGINE_MODE") == "modal"

    if use_modal:
        try:
            # Call Modal function
            result = scrape_tiktok_trends.remote(
                keywords=request.keywords,
                hashtags=request.hashtags,
                include_explore=request.includeExplore,
            )
            return TrendCollectionResult(**result)
        except Exception as e:
            logger.error(f"Modal function failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    else:
        # Local fallback
        raise HTTPException(
            status_code=501,
            detail="Local scraping not implemented. Use Modal mode."
        )


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "tiktok-trends"}
