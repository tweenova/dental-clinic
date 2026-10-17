import { ImageResponse } from "next/og";

export const alt = "Marlow Dental | Comprehensive, Ethical Dental Care";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

/**
 * Generates a dynamic Open Graph social preview image (1200x630 PNG) at the edge.
 * It renders the practice's brand typography and core messaging for social cards.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 80px",
          backgroundColor: "#FAF7F2",
          fontFamily: "serif",
          border: "16px solid #1F3D34",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "#1F3D34",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FAF7F2",
              fontSize: "24px",
            }}
          >
            M
          </div>
          <span
            style={{
              fontSize: "28px",
              letterSpacing: "-0.02em",
              color: "#151613",
            }}
          >
            Marlow <span style={{ color: "#1F3D34" }}>Dental</span>
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <span
            style={{
              fontSize: "16px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#C4704F",
              fontWeight: 600,
            }}
          >
            Modern, Ethical Dental Care
          </span>
          <h1
            style={{
              fontSize: "64px",
              lineHeight: 1.05,
              color: "#151613",
              margin: 0,
              fontWeight: 400,
            }}
          >
            Dentistry without the dread.
          </h1>
          <p
            style={{
              fontSize: "24px",
              color: "#4F5047",
              margin: 0,
              maxWidth: "850px",
              lineHeight: 1.4,
            }}
          >
            One dentist, start to finish. Same-week openings. Written estimates before treatment.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "2px solid #E2DACB",
            paddingTop: "24px",
            fontSize: "18px",
            color: "#4F5047",
          }}
        >
          <span>Marlow Dental Practice Facility</span>
          <span style={{ color: "#1F3D34", fontWeight: 600 }}>Ethical Patient Care</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
