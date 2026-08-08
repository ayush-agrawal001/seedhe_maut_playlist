import type { MetadataRoute } from "next";

/** Web app manifest — served at /manifest.webmanifest and linked automatically. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Seedhe Maut — Player",
    short_name: "Seedhe Maut",
    description:
      "A full-screen Seedhe Maut listening experience. Random discovery, album-reactive visuals, playback via YouTube's official player.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#050506",
    theme_color: "#050506",
    categories: ["music", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
