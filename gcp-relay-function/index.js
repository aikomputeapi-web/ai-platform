const functions = require("@google-cloud/functions-framework");

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const FETCH_TIMEOUT = 120_000; // 120s

/**
 * Resolve a hostname to its canonical decimal IPv4 or IPv6 address,
 * handling hex, octal, and integer encodings used in SSRF bypass attempts.
 */
function resolveIP(host) {
  // If already a valid decimal-dotted IPv4, return as-is
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) return host;

  // Try to detect non-standard IP formats — Node's URL parser may convert some
  // but not all. Block any host that contains hex (0x), octal (leading 0 with > 1 digits),
  // or is a pure integer.
  if (/^0x/i.test(host)) return "reserved-hex";
  if (/^\d+$/.test(host) && host.length >= 5) return "reserved-integer";
  if (/^0/.test(host) && host.length > 1 && /^[0-7.]+$/.test(host)) return "reserved-octal";

  return host;
}

/**
 * SSRF guard — blocks requests to private/loopback/link-local hosts.
 * Also blocks non-standard IP encodings (hex, octal, integer) used in bypass attempts.
 */
function isPrivateHostname(h) {
  if (!h) return true;
  const host = h.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const resolved = resolveIP(host);

  // Block non-standard IP encodings used in SSRF bypass
  if (resolved.startsWith("reserved-")) return true;

  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.startsWith("::ffff:")
  )
    return true;

  // IPv4 private ranges
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = +v4[1],
      b = +v4[2];
    if (a === 0 || a === 10 || a === 127) return true; // 0.0.0.0/8, 10/8, 127/8
    if (a === 169 && b === 254) return true; // link-local 169.254/16
    if (a === 192 && b === 168) return true; // 192.168/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
    return false;
  }

  // IPv6 private ranges
  if (host.includes(":")) {
    return (
      host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80:")
    );
  }

  return false;
}

/**
 * GCP Cloud Function — HTTP relay proxy for OmniRoute.
 *
 * Reads the upstream target from x-relay-target and x-relay-path headers,
 * validates against SSRF, and forwards the request. The response is streamed
 * back to the caller.
 *
 * Authentication: Requires IAM-based invocation (--no-allow-unauthenticated).
 * Only the Compute Engine VM's service account should have cloudfunctions.invoker.
 */
functions.http("relay", async (req, res) => {
  // --- Validate relay headers ---
  const target = req.headers["x-relay-target"];
  if (!target) {
    res.status(400).send("missing x-relay-target");
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    res.status(400).send("invalid x-relay-target");
    return;
  }

  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    res.status(403).send("forbidden x-relay-target protocol");
    return;
  }

  if (targetUrl.username || targetUrl.password) {
    res.status(403).send("forbidden x-relay-target (embedded credentials)");
    return;
  }

  if (isPrivateHostname(targetUrl.hostname)) {
    res.status(403).send("forbidden x-relay-target (private/loopback host)");
    return;
  }

  const relayPath = req.headers["x-relay-path"] || "/";

  // --- Build upstream request ---
  const upstreamUrl = target.replace(/\/$/, "") + relayPath;

  // Clone headers, removing relay-specific and hop-by-hop headers
  const forwardHeaders = { ...req.headers };
  const originalAuth = req.headers["x-relay-auth"];

  const stripHeaders = [
    "x-relay-target",
    "x-relay-path",
    "x-relay-auth",
    "host",
    "authorization",
    "x-forwarded-for",
    "x-forwarded-proto",
    "x-cloud-trace-context",
    "traceparent",
    "function-execution-id",
    "x-appengine-timeout-ms",
  ];
  for (const h of stripHeaders) {
    delete forwardHeaders[h];
  }

  if (originalAuth) {
    forwardHeaders["authorization"] = originalAuth;
  }

  // --- Validate request body size ---
  if (
    req.method !== "GET" &&
    req.method !== "HEAD" &&
    req.headers["content-length"]
  ) {
    const contentLength = parseInt(req.headers["content-length"], 10);
    if (contentLength > MAX_BODY_SIZE) {
      res.status(413).send("request body too large");
      return;
    }
  }

  // --- Forward request upstream ---
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: forwardHeaders,
      body:
        req.method !== "GET" && req.method !== "HEAD" ? (req.rawBody || JSON.stringify(req.body)) : undefined,
      signal: controller.signal,
      // Cloud Functions gen2 uses Node.js undici fetch which supports duplex
    });
    clearTimeout(timeoutId);

    // --- Stream response back ---
    res.status(upstreamResponse.status);

    // Forward selected response headers
    const passthroughHeaders = [
      "content-type",
      "cache-control",
      "x-request-id",
      "openai-organization",
      "openai-processing-ms",
      "x-ratelimit-limit-requests",
      "x-ratelimit-remaining-requests",
      "x-ratelimit-limit-tokens",
      "x-ratelimit-remaining-tokens",
      "x-ratelimit-reset-requests",
      "x-ratelimit-reset-tokens",
      "retry-after",
    ];

    for (const header of passthroughHeaders) {
      const value = upstreamResponse.headers.get(header);
      if (value) {
        res.set(header, value);
      }
    }

    // Check if response is streaming (SSE)
    const contentType = upstreamResponse.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      res.set("content-type", "text/event-stream");
      res.set("cache-control", "no-cache");
      res.set("connection", "keep-alive");
      res.set("transfer-encoding", "chunked");

      // Stream chunks
      const reader = upstreamResponse.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } catch (streamErr) {
        console.error("Stream error:", streamErr.message);
      } finally {
        res.end();
      }
    } else {
      // Non-streaming: send body as buffer
      const body = await upstreamResponse.arrayBuffer();
      res.send(Buffer.from(body));
    }
  } catch (fetchErr) {
    if (fetchErr.name === "AbortError") {
      console.error("Upstream fetch timed out");
      res.status(504).send("upstream request timed out");
    } else {
      console.error("Upstream fetch error:", fetchErr.message);
      res.status(502).send("upstream request failed");
    }
  }
});
