import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Hydra - AI Video Automation Platform";
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
          background: "#000000",
        }}
      >
        {/* Grid pattern background - Aceternity style */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Radial gradient glow in center */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 800,
            height: 800,
            background: "radial-gradient(circle, rgba(247,249,29,0.08) 0%, transparent 60%)",
            borderRadius: "50%",
          }}
        />

        {/* Top fade */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 200,
            background: "linear-gradient(to bottom, #000000, transparent)",
          }}
        />

        {/* Bottom fade */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 200,
            background: "linear-gradient(to top, #000000, transparent)",
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
              fontSize: 140,
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.03em",
              marginBottom: 20,
            }}
          >
            Hydra
          </div>

          {/* Yellow accent line */}
          <div
            style={{
              width: 80,
              height: 4,
              background: "#F7F91D",
              marginBottom: 28,
              borderRadius: 2,
            }}
          />

          {/* Tagline */}
          <div
            style={{
              fontSize: 32,
              color: "rgba(255,255,255,0.8)",
              textAlign: "center",
              letterSpacing: "0.05em",
            }}
          >
            AI Video Automation Platform
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
