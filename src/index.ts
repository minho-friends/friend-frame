import type { Env } from "./env";
import { cacheKeyGenerateAnyway, cacheMatch, cachePut, removeResponseHeadersForCaching } from "./cache";
import { ElementRemover, BaseAdder, KeywordRemoverButInZeroCopy } from './elementContentHandler';

const elementRemover = new ElementRemover();

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (!env.TARGET_HOST) {
      return new Response('TARGET_HOST required', { status: 503 });
    }

    const new_request_url = new URL(request.url);
    if (new_request_url.href.includes("/backpg/")) {
      return new Response('', { status: 501 });
    }
    if (new_request_url.pathname.includes("/robots.txt")) {
      return new Response('User-agent: *\nDisallow: /\n');
    }
    if (new_request_url.pathname.includes("/favicon.ico")) {
      return new Response('', { status: 404 });
    }

    const _cache = await caches.open(`cache:friend-frame:${env.TARGET_HOST}:${env.TARGET_KEYWORD || "_empty_"}`);
    const _forceCachingKey = request.method !== "GET" ? await cacheKeyGenerateAnyway(request) : undefined;
    const cachedResponse = await cacheMatch(_cache, request, _forceCachingKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    // NOTE: Generating the response...
    new_request_url.host = env.TARGET_HOST;

    const new_request_headers = new Headers(request.headers);
    new_request_headers.set('Host', env.TARGET_HOST);
    new_request_headers.set('Origin', new_request_url.origin);
    new_request_headers.set('Referer', new_request_url.origin);

    const _response = await fetch(new_request_url.href, {
        method: request.method,
        body: request.body,
        headers: new_request_headers,
    });
    const new_response_headers = new Headers(_response.headers);
    new_response_headers.delete('x-frame-options');  // NOTE: The ultimate goal of this project.
    removeResponseHeadersForCaching(new_response_headers);

    const new_response = new Response(_response.body, {
      status: _response.status,
      headers: new_response_headers
    });

    if (request.method === "GET" && new_response_headers.get('Content-Type')?.includes('html')) {
      const new_modified_response = new HTMLRewriter()  // NOTE: The unexpected benefit of this project.
        // FIXME: on CORS on XMLHttpRequest
        // .on('head', new BaseAdder(env.TARGET_HOST))
        .on('header', elementRemover)
        .on('footer', elementRemover)
        .on('script', KeywordRemoverButInZeroCopy(env.TARGET_KEYWORD))
        .transform(new_response);
      await cachePut(_cache, ctx, request, new_modified_response, _forceCachingKey);
      return new_modified_response;
    }
    await cachePut(_cache, ctx, request, new_response, _forceCachingKey);
    return new_response;
  }
};
