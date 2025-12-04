"""
TikTok Trends Scraper using RapidAPI (ScrapTik).
Fast, reliable API-based scraping without browser automation.
"""

import httpx
from typing import Optional
from dataclasses import dataclass, field

# RapidAPI Configuration - ScrapTik
RAPIDAPI_KEY = "2b748a1b3cmshe05f9ca2282e082p17573ejsn2ad2e7d431ad"
RAPIDAPI_HOST = "scraptik.p.rapidapi.com"
BASE_URL = f"https://{RAPIDAPI_HOST}"


@dataclass
class SearchResult:
    success: bool
    videos: list
    related_hashtags: list
    info: Optional[dict] = None
    error: Optional[str] = None


@dataclass
class HashtagResult:
    success: bool
    hashtag: str
    info: Optional[dict] = None
    videos: list = field(default_factory=list)
    error: Optional[str] = None


@dataclass
class TrendCollectionResult:
    success: bool
    method: str
    trends: list
    error: Optional[str] = None


def get_headers():
    return {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
    }


async def search_tiktok(keyword: str, limit: int = 20) -> SearchResult:
    """Search TikTok for videos using ScrapTik API."""
    print(f'[TIKTOK-API] Searching for: {keyword}')

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{BASE_URL}/search-posts",
                params={
                    "keyword": keyword,
                    "count": str(min(limit, 30)),
                    "offset": "0",
                    "use_filters": "0",
                    "publish_time": "0",
                    "sort_type": "0",
                    "region": "US",
                },
                headers=get_headers(),
            )

            print(f'[TIKTOK-API] Response status: {response.status_code}')

            if response.status_code != 200:
                return SearchResult(
                    success=False, videos=[], related_hashtags=[],
                    error=f"API error: {response.status_code}",
                )

            data = response.json()
            videos = []
            hashtags_set = set()

            # ScrapTik returns data in search_item_list[].aweme_info, not aweme_list
            search_items = data.get("search_item_list", [])
            if search_items:
                items = [si.get("aweme_info") for si in search_items if si.get("aweme_info")]
            else:
                items = data.get("aweme_list", []) or data.get("data", [])
            print(f'[TIKTOK-API] Found {len(items)} items')

            for item in items[:limit]:
                video_id = item.get("aweme_id", "")
                author = item.get("author", {})
                author_id = author.get("unique_id", "")
                stats = item.get("statistics", {})

                # Extract hashtags
                video_hashtags = []
                for extra in item.get("text_extra", []):
                    if extra.get("hashtag_name"):
                        tag = extra["hashtag_name"]
                        video_hashtags.append(tag)
                        hashtags_set.add(f"#{tag}")

                videos.append({
                    'id': str(video_id),
                    'description': item.get("desc", ""),
                    'author': {
                        'uniqueId': author_id,
                        'nickname': author.get("nickname", ""),
                    },
                    'stats': {
                        'playCount': stats.get("play_count", 0),
                        'likeCount': stats.get("digg_count", 0),
                        'commentCount': stats.get("comment_count", 0),
                        'shareCount': stats.get("share_count", 0),
                    },
                    'videoUrl': f"https://www.tiktok.com/@{author_id}/video/{video_id}",
                    'hashtags': video_hashtags,
                    'cover': item.get("video", {}).get("cover", {}).get("url_list", [""])[0],
                })

            print(f'[TIKTOK-API] Processed {len(videos)} videos')
            return SearchResult(success=True, videos=videos, related_hashtags=list(hashtags_set))

    except Exception as e:
        print(f'[TIKTOK-API] Error: {e}')
        return SearchResult(success=False, videos=[], related_hashtags=[], error=str(e))


async def scrape_hashtag_page(hashtag: str) -> HashtagResult:
    """Get videos for a specific hashtag using search endpoint (more reliable)."""
    hashtag = hashtag.lstrip('#')
    print(f'[TIKTOK-API] Getting hashtag: #{hashtag}')

    # Use search endpoint with hashtag as keyword (more reliable than hashtag-posts)
    result = await search_tiktok(f"#{hashtag}", limit=30)

    if result.success and result.videos:
        total_views = sum(v.get('stats', {}).get('playCount', 0) for v in result.videos)
        info = {
            "title": hashtag,
            "view_count": total_views,
            "video_count": len(result.videos),
        }
        return HashtagResult(success=True, hashtag=hashtag, info=info, videos=result.videos)

    return HashtagResult(success=False, hashtag=hashtag, error=result.error or "No videos found")


async def collect_tiktok_trends(keywords: list = None, hashtags: list = None, include_explore: bool = True) -> TrendCollectionResult:
    """Collect TikTok trends."""
    trends = []

    try:
        if keywords:
            for keyword in keywords[:5]:
                result = await search_tiktok(keyword, limit=5)
                if result.success:
                    for video in result.videos:
                        trends.append({"keyword": keyword, "video": video, "source": "search"})

        if hashtags:
            for tag in hashtags[:5]:
                result = await scrape_hashtag_page(tag)
                if result.success:
                    trends.append({"hashtag": tag, "info": result.info, "videos": result.videos[:5], "source": "hashtag"})

        return TrendCollectionResult(success=True, method="scraptik", trends=trends)

    except Exception as e:
        return TrendCollectionResult(success=False, method="scraptik", trends=[], error=str(e))
