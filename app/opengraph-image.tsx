import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Hydra - AI 영상 자동화 플랫폼";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hydra.ai";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: "#000000",
        }}
      >
        {/* Background Image - Vector.png */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${siteUrl}/Vector.png`}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Dark overlay for text readability */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          {/* Logo */}
          <div
            style={{
              fontSize: 120,
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.02em",
              marginBottom: 24,
            }}
          >
            Hydra
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 36,
              color: "rgba(255,255,255,0.9)",
              textAlign: "center",
              maxWidth: 800,
              lineHeight: 1.4,
            }}
          >
            AI 영상 자동화 플랫폼
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 24,
              color: "rgba(255,255,255,0.7)",
              textAlign: "center",
              maxWidth: 700,
              marginTop: 16,
            }}
          >
            브랜드 숏폼 콘텐츠를 몇 분 만에 수천 개 생성
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
