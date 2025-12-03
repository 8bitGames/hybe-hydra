import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "HYDRA - AI Video Automation Platform";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
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
          background: "linear-gradient(135deg, #F7F91D 0%, #E5E71A 100%)",
        }}
      >
        {/* Subtle grid pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
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
          {/* HYDRA Logo */}
          <div
            style={{
              fontSize: 180,
              fontWeight: 900,
              color: "#000000",
              letterSpacing: "-0.02em",
            }}
          >
            HYDRA
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
