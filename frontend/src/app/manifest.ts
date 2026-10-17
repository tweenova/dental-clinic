import type { MetadataRoute } from "next";

/**
 * Generates the web application manifest for Progressive Web App (PWA) installation and mobile home screens.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Marlow Dental",
    short_name: "Marlow Dental",
    description: "Independent dental practice providing comprehensive oral healthcare.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF7F2",
    theme_color: "#1F3D34",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
