// Resolve the canonical site URL for outbound auth links (password reset,
// signup confirmation, etc.). Avoids using the ephemeral lovable preview
// domain (id-preview--*.lovableproject.com) which won't work for the user
// after the email is opened on another device.
//
// Order of precedence:
//   1. VITE_SITE_URL (set in deploy env when a custom domain is connected)
//   2. The current origin, but only if it isn't a sandbox preview origin
//   3. The published lovable.app URL as a safe fallback
const PUBLISHED_FALLBACK = "https://idbjovem-site.lovable.app";

export function getSiteUrl(): string {
  const fromEnv = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const { origin, hostname } = window.location;
    const isSandbox =
      hostname.includes("lovableproject.com") ||
      hostname.startsWith("id-preview--") ||
      hostname === "localhost" ||
      hostname === "127.0.0.1";
    if (!isSandbox) return origin;
  }

  return PUBLISHED_FALLBACK;
}
