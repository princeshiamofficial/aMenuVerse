export const dynamic = "force-dynamic";

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

  try {
    const upstream = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MenuVerse-ImageProxy/1.0)",
        Accept: "image/*,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, {
        status: upstream.status,
      });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const body = await upstream.arrayBuffer();

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
