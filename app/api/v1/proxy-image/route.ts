import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const startTime = Date.now();

  console.log("[PROXY-IMAGE] 📥 Request received");
  console.log(`[PROXY-IMAGE]    URL: ${url?.slice(0, 100)}...`);

  if (!url) {
    console.log("[PROXY-IMAGE] ❌ Missing URL parameter");
    return NextResponse.json({ error: "URL parameter required" }, { status: 400 });
  }

  try {
    console.log("[PROXY-IMAGE] 🌐 Fetching from S3...");
    const fetchStart = Date.now();

    const response = await fetch(url);

    console.log(`[PROXY-IMAGE] 📡 S3 response: ${response.status} (${Date.now() - fetchStart}ms)`);

    if (!response.ok) {
      console.log(`[PROXY-IMAGE] ❌ S3 fetch failed: ${response.status}`);
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }

    console.log("[PROXY-IMAGE] 🔄 Converting to base64...");
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";

    console.log(`[PROXY-IMAGE] ✅ Complete!`);
    console.log(`[PROXY-IMAGE]    Size: ${arrayBuffer.byteLength} bytes`);
    console.log(`[PROXY-IMAGE]    Base64 length: ${base64.length} chars`);
    console.log(`[PROXY-IMAGE]    MIME type: ${contentType}`);
    console.log(`[PROXY-IMAGE] ⏱️ Total time: ${Date.now() - startTime}ms`);

    return NextResponse.json({
      base64,
      mimeType: contentType,
    });
  } catch (error) {
    console.error("[PROXY-IMAGE] ❌ Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 500 }
    );
  }
}
