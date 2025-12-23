"""Database client for direct PostgreSQL updates.

This module provides direct database access for updating video generation records
without relying on callback APIs. This is more reliable than callbacks because:
1. No network hops to external APIs
2. Automatic retry on connection failure
3. Transaction safety
"""

import asyncpg
import logging
from typing import Optional
from contextlib import asynccontextmanager

from ..config import get_settings

logger = logging.getLogger(__name__)

# Global connection pool
_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> Optional[asyncpg.Pool]:
    """Get or create the database connection pool."""
    global _pool

    settings = get_settings()
    if not settings.database_url:
        logger.warning("[DB] No DATABASE_URL configured, database updates disabled")
        return None

    if _pool is None:
        try:
            _pool = await asyncpg.create_pool(
                settings.database_url,
                min_size=1,
                max_size=5,
                command_timeout=30,
                # Required for Supabase pgbouncer transaction mode
                statement_cache_size=0,
            )
            logger.info("[DB] Database connection pool created")
        except Exception as e:
            logger.error(f"[DB] Failed to create connection pool: {e}")
            return None

    return _pool


async def close_pool():
    """Close the database connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("[DB] Database connection pool closed")


@asynccontextmanager
async def get_connection():
    """Get a database connection from the pool."""
    pool = await get_pool()
    if pool is None:
        yield None
        return

    async with pool.acquire() as conn:
        yield conn


async def update_video_generation(
    generation_id: str,
    status: str,
    output_url: Optional[str] = None,
    error_message: Optional[str] = None,
    progress: int = 100,
    gcs_uri: Optional[str] = None,
) -> bool:
    """
    Update a video generation record directly in the database.

    Args:
        generation_id: The UUID of the video generation record
        status: New status ('COMPLETED', 'FAILED', 'PROCESSING')
        output_url: S3 URL of the output video (for completed jobs)
        error_message: Error message (for failed jobs)
        progress: Progress percentage (0-100)
        gcs_uri: GCS URI if applicable

    Returns:
        True if update was successful, False otherwise
    """
    async with get_connection() as conn:
        if conn is None:
            logger.warning(f"[DB] Cannot update generation {generation_id}: no database connection")
            return False

        try:
            # Build the update query dynamically based on provided fields
            update_fields = ["status = $2", "progress = $3", "updated_at = NOW()"]
            params = [generation_id, status, progress]
            param_idx = 4

            if output_url:
                # Use composed_output_url for edited videos
                update_fields.append(f"composed_output_url = ${param_idx}")
                params.append(output_url)
                param_idx += 1

            if error_message:
                update_fields.append(f"error_message = ${param_idx}")
                params.append(error_message)
                param_idx += 1

            if gcs_uri:
                update_fields.append(f"gcs_uri = ${param_idx}")
                params.append(gcs_uri)
                param_idx += 1

            query = f"""
                UPDATE video_generations
                SET {', '.join(update_fields)}
                WHERE id = $1
                RETURNING id, status
            """

            result = await conn.fetchrow(query, *params)

            if result:
                logger.info(f"[DB] Updated generation {generation_id}: status={status}, output_url={output_url[:50] if output_url else 'N/A'}...")
                return True
            else:
                logger.warning(f"[DB] Generation {generation_id} not found in database")
                return False

        except Exception as e:
            logger.error(f"[DB] Failed to update generation {generation_id}: {e}")
            return False


async def update_video_generation_progress(
    generation_id: str,
    progress: int,
    current_step: Optional[str] = None,
) -> bool:
    """
    Update just the progress of a video generation record.

    Args:
        generation_id: The UUID of the video generation record
        progress: Progress percentage (0-100)
        current_step: Optional description of current processing step

    Returns:
        True if update was successful, False otherwise
    """
    async with get_connection() as conn:
        if conn is None:
            return False

        try:
            await conn.execute(
                """
                UPDATE video_generations
                SET progress = $2, updated_at = NOW()
                WHERE id = $1
                """,
                generation_id,
                progress,
            )
            logger.debug(f"[DB] Progress update: {generation_id} -> {progress}%")
            return True
        except Exception as e:
            logger.error(f"[DB] Failed to update progress for {generation_id}: {e}")
            return False
