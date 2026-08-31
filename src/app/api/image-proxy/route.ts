export const dynamic = "force-dynamic";

// Private and loopback IP checks to prevent SSRF
function isDisallowedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();

  // Block localhost, loopback, and local domain names
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost") ||
    host === "metadata.google.internal" ||
    host === "169.254.169.254"
  ) {
    return true;
  }

  // Block private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
    if (a === 0) return true;
  }

  return false;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get("url");

  if (!imageUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return new Response("Only http/https URLs are allowed", {
      status: 400,
    });
  }

  if (isDisallowedHostname(parsed.hostname)) {
    return new Response("Forbidden target address (private/loopback prohibited)", {
      status: 403,
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const upstream = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MenuVerse-ImageProxy/1.0)",
        Accept: "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,*/*;q=0.8",
      },
    });

    clearTimeout(timeout);

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, {
        status: upstream.status,
      });
    }

    const contentType = upstream.headers.get("content-type") || "";
    // Enforce valid image MIME type
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new Response("Forbidden: Target URL is not an image", {
        status: 400,
      });
    }

    // Limit payload buffer to max 6MB
    const body = await upstream.arrayBuffer();
    if (body.byteLength > 6 * 1024 * 1024) {
      return new Response("Image size exceeds 6MB limit", { status: 413 });
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch (err) {
    return new Response(`Proxy fetch failed: ${String(err)}`, {
      status: 502,
    });
  }
}
