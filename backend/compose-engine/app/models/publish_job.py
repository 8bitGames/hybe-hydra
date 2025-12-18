"""Pydantic models for social media publishing job requests."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from enum import Enum


class PublishPlatform(str, Enum):
    """Supported publishing platforms."""
    TIKTOK = "tiktok"
    YOUTUBE = "youtube"
    INSTAGRAM = "instagram"


class PublishJobStatus(str, Enum):
    """Status of a publishing job."""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# ============================================================
# TikTok Publishing Models
# ============================================================

class TikTokPrivacyLevel(str, Enum):
    """TikTok video privacy levels."""
    PUBLIC_TO_EVERYONE = "PUBLIC_TO_EVERYONE"
    MUTUAL_FOLLOW_FRIENDS = "MUTUAL_FOLLOW_FRIENDS"
    FOLLOWER_OF_CREATOR = "FOLLOWER_OF_CREATOR"
    SELF_ONLY = "SELF_ONLY"


class TikTokPostSettings(BaseModel):
    """Settings for TikTok video posting."""
    privacy_level: TikTokPrivacyLevel = Field(
        default=TikTokPrivacyLevel.PUBLIC_TO_EVERYONE,
        description="Video privacy level"
    )
    disable_duet: bool = Field(default=False, description="Disable duet feature")
    disable_comment: bool = Field(default=False, description="Disable comments")
    disable_stitch: bool = Field(default=False, description="Disable stitch feature")
    video_cover_timestamp_ms: Optional[int] = Field(
        default=None,
        description="Timestamp for video cover in milliseconds"
    )


# ============================================================
# YouTube Publishing Models
# ============================================================

class YouTubePrivacyStatus(str, Enum):
    """YouTube video privacy status."""
    PUBLIC = "public"
    PRIVATE = "private"
    UNLISTED = "unlisted"


class YouTubeShortSettings(BaseModel):
    """Settings for YouTube Shorts posting."""
    title: str = Field(default="Untitled Short", description="Video title (max 100 chars)")
    privacy_status: YouTubePrivacyStatus = Field(
        default=YouTubePrivacyStatus.PUBLIC,
        description="Video privacy status"
    )
    category_id: str = Field(default="22", description="YouTube category ID (22 = People & Blogs)")
    made_for_kids: bool = Field(default=False, description="Is this video made for kids?")
    tags: List[str] = Field(default_factory=list, description="Video tags")


# ============================================================
# Instagram Publishing Models
# ============================================================

class InstagramReelSettings(BaseModel):
    """Settings for Instagram Reels posting."""
    share_to_feed: bool = Field(default=True, description="Share to main feed")
    cover_url: Optional[str] = Field(default=None, description="Custom cover image URL")
    thumb_offset: Optional[int] = Field(
        default=None,
        description="Cover frame offset in milliseconds"
    )
    location_id: Optional[str] = Field(default=None, description="Location tag ID")
    collaborator_usernames: List[str] = Field(
        default_factory=list,
        description="Collaborator usernames"
    )


# ============================================================
# Account Credentials Models
# ============================================================

class TikTokCredentials(BaseModel):
    """TikTok OAuth credentials."""
    access_token: str = Field(..., description="TikTok access token")
    refresh_token: str = Field(..., description="TikTok refresh token")
    open_id: str = Field(..., description="TikTok Open ID")


class YouTubeCredentials(BaseModel):
    """YouTube/Google OAuth credentials."""
    access_token: str = Field(..., description="YouTube access token")
    refresh_token: str = Field(..., description="YouTube refresh token")


class InstagramCredentials(BaseModel):
    """Instagram/Facebook OAuth credentials."""
    access_token: str = Field(..., description="Instagram/Facebook access token")
    instagram_account_id: str = Field(..., description="Instagram Business Account ID")


# ============================================================
# Publishing Request Models
# ============================================================

class TikTokPublishRequest(BaseModel):
    """Request model for TikTok publishing."""
    job_id: str = Field(..., description="Unique job identifier")
    credentials: TikTokCredentials = Field(..., description="TikTok OAuth credentials")
    video_url: str = Field(..., description="URL of the video to upload")
    caption: str = Field(default="", description="Video caption/description")
    hashtags: List[str] = Field(default_factory=list, description="List of hashtags")
    settings: TikTokPostSettings = Field(
        default_factory=TikTokPostSettings,
        description="TikTok post settings"
    )
    use_sandbox: bool = Field(
        default=False,
        description="Use sandbox mode (inbox upload) vs production (direct post)"
    )
    callback_url: Optional[str] = Field(
        default=None,
        description="URL to call when job completes"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional metadata"
    )


class YouTubePublishRequest(BaseModel):
    """Request model for YouTube publishing."""
    job_id: str = Field(..., description="Unique job identifier")
    credentials: YouTubeCredentials = Field(..., description="YouTube OAuth credentials")
    video_url: str = Field(..., description="URL of the video to upload")
    caption: str = Field(default="", description="Video description")
    hashtags: List[str] = Field(default_factory=list, description="List of hashtags")
    settings: YouTubeShortSettings = Field(
        default_factory=YouTubeShortSettings,
        description="YouTube Short settings"
    )
    callback_url: Optional[str] = Field(
        default=None,
        description="URL to call when job completes"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional metadata"
    )


class InstagramPublishRequest(BaseModel):
    """Request model for Instagram publishing."""
    job_id: str = Field(..., description="Unique job identifier")
    credentials: InstagramCredentials = Field(..., description="Instagram OAuth credentials")
    video_url: str = Field(..., description="URL of the video to upload")
    caption: str = Field(default="", description="Reel caption")
    hashtags: List[str] = Field(default_factory=list, description="List of hashtags")
    settings: InstagramReelSettings = Field(
        default_factory=InstagramReelSettings,
        description="Instagram Reel settings"
    )
    callback_url: Optional[str] = Field(
        default=None,
        description="URL to call when job completes"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional metadata"
    )


# ============================================================
# Publishing Response Models
# ============================================================

class PublishJobResponse(BaseModel):
    """Response model for publishing job submission."""
    job_id: str = Field(..., description="Job identifier")
    platform: PublishPlatform = Field(..., description="Target platform")
    status: PublishJobStatus = Field(..., description="Current job status")
    message: Optional[str] = Field(default=None, description="Status message")


class TikTokPublishResult(BaseModel):
    """Result of TikTok publishing."""
    success: bool = Field(..., description="Whether publishing succeeded")
    publish_id: Optional[str] = Field(default=None, description="TikTok publish ID")
    video_id: Optional[str] = Field(default=None, description="TikTok video ID (if available)")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    status: Optional[str] = Field(default=None, description="Upload status")


class YouTubePublishResult(BaseModel):
    """Result of YouTube publishing."""
    success: bool = Field(..., description="Whether publishing succeeded")
    video_id: Optional[str] = Field(default=None, description="YouTube video ID")
    video_url: Optional[str] = Field(default=None, description="YouTube video URL")
    channel_id: Optional[str] = Field(default=None, description="Channel ID")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    status: Optional[str] = Field(default=None, description="Upload status")


class InstagramPublishResult(BaseModel):
    """Result of Instagram publishing."""
    success: bool = Field(..., description="Whether publishing succeeded")
    media_id: Optional[str] = Field(default=None, description="Instagram media ID")
    permalink: Optional[str] = Field(default=None, description="Instagram post URL")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    error_code: Optional[int] = Field(default=None, description="Error code if failed")


# ============================================================
# Token Refresh Models
# ============================================================

class TokenRefreshRequest(BaseModel):
    """Request model for token refresh."""
    platform: PublishPlatform = Field(..., description="Platform to refresh token for")
    refresh_token: str = Field(..., description="Refresh token")
    # Platform-specific fields
    client_key: Optional[str] = Field(default=None, description="TikTok client key")
    client_secret: Optional[str] = Field(default=None, description="TikTok client secret")


class TokenRefreshResponse(BaseModel):
    """Response model for token refresh."""
    success: bool = Field(..., description="Whether refresh succeeded")
    access_token: Optional[str] = Field(default=None, description="New access token")
    refresh_token: Optional[str] = Field(default=None, description="New refresh token (if rotated)")
    expires_in: Optional[int] = Field(default=None, description="Token expiry in seconds")
    error: Optional[str] = Field(default=None, description="Error message if failed")


# ============================================================
# Callback Models
# ============================================================

class PublishCallback(BaseModel):
    """Callback payload sent when publishing job completes."""
    job_id: str = Field(..., description="Job identifier")
    platform: PublishPlatform = Field(..., description="Target platform")
    status: PublishJobStatus = Field(..., description="Final job status")

    # Platform-specific results
    tiktok_result: Optional[TikTokPublishResult] = None
    youtube_result: Optional[YouTubePublishResult] = None
    instagram_result: Optional[InstagramPublishResult] = None

    duration_ms: Optional[int] = Field(
        default=None,
        description="Total processing time in milliseconds"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional metadata"
    )
