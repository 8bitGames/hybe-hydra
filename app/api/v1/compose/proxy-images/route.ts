import { NextRequest, NextResponse } from 'next/server';
import { getUserFromHeader } from '@/lib/auth';
import { uploadToS3 } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

interface ProxyRequest {
  images: Array<{
    url: string;
    id: string;
  }>;
  generationId: string;
}

interface ProxyResult {
  originalUrl: string;
  minioUrl: string;
  id: string;
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromHeader(authHeader);

    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body: ProxyRequest = await request.json();
    const { images, generationId } = body;

    if (!images || images.length === 0) {
      return NextResponse.json(
        { detail: 'No images provided' },
        { status: 400 }
      );
    }

    const results: ProxyResult[] = [];

    // Process images in parallel
    await Promise.all(
      images.map(async (image, index) => {
        try {
          // Download image with browser-like headers
          const response = await fetch(image.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': new URL(image.url).origin + '/',
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentType = response.headers.get('content-type') || 'image/jpeg';
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Determine file extension
          let ext = 'jpg';
          if (contentType.includes('png')) ext = 'png';
          else if (contentType.includes('webp')) ext = 'webp';
          else if (contentType.includes('gif')) ext = 'gif';

          // Upload to MinIO using storage.ts helper
          const objectKey = `compose/${generationId}/images/${index}_${uuidv4().slice(0, 8)}.${ext}`;
          const minioUrl = await uploadToS3(buffer, objectKey, contentType);

          results.push({
            originalUrl: image.url,
            minioUrl,
            id: image.id,
            success: true,
          });
        } catch (error) {
          // Log warning instead of error (404s are common for web-scraped images)
          const errMsg = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`[Proxy] Skipped image (${errMsg}): ${image.url.slice(0, 80)}...`);
          results.push({
            originalUrl: image.url,
            minioUrl: '',
            id: image.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })
    );

    // Check if we have enough successful images
    const successfulImages = results.filter(r => r.success);

    return NextResponse.json({
      results,
      successful: successfulImages.length,
      failed: results.length - successfulImages.length,
    });
  } catch (error) {
    console.error('Proxy images error:', error);
    return NextResponse.json(
      { detail: 'Failed to proxy images' },
      { status: 500 }
    );
  }
}
