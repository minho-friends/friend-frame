// NOTE: cache.ts won't worked on `wrangler dev` and `*.workers.dev`.
// READS:
// - https://developers.cloudflare.com/workers/runtime-apis/cache/
// - https://developers.cloudflare.com/workers/learning/how-the-cache-works/#cache-api

async function sha256(message: string) {
  // NOTE: https://developers.cloudflare.com/workers/examples/cache-post-request/

  // encode as UTF-8
  const msgBuffer = await new TextEncoder().encode(message);
  // hash the message
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  // convert bytes to hex string
  return [...new Uint8Array(hashBuffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateCacheKeyAnyway(request: Request): Promise<Request> {
  // NOTE: This function requires to run before `request` was sent & spent to TARGET_HOST because of the `.clone()`.
  const body = await request.clone().text();
  const hash = body ? await sha256(body) : '';
  const cacheUrl = new URL(request.url);
  cacheUrl.pathname = `/.well-known/cache-other-methods/${request.method}${cacheUrl.pathname}&&${hash}`;  // NOTE: meaningless.
  const cacheKey = new Request(cacheUrl.toString(), {
    headers: request.headers,
    method: "GET", // NOTE: https://developers.cloudflare.com/workers/examples/cache-post-request/
  });
  return cacheKey;
}

export function removeResponseHeadersForCaching(mutable_response_headers: Headers) {
  // NOTE: https://developers.cloudflare.com/workers/runtime-apis/cache/#headers
  mutable_response_headers.set('Cache-Control', `max-age=${60}`);
  mutable_response_headers.delete('Pragma');
  mutable_response_headers.delete('Expires');
  // NOTE: `Responses with Set-Cookie headers are never cached`.
  for (let i = 0; i < mutable_response_headers.getAll('Set-Cookie').length; i++) {
    mutable_response_headers.delete('Set-Cookie');
  }
}
