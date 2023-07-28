import type { Env } from "./env";
import { cacheKeyGenerateAnyway, cacheMatch, cachePut, removeResponseHeadersForCaching } from "./cache";

class ElementRemover implements HTMLRewriterElementContentHandlers {
  element(element: Element) {
    element.remove();
  }
}
const elementRemover = new ElementRemover();

class BaseAdder implements HTMLRewriterElementContentHandlers {
  _baseHref: string;
  constructor(baseHref: string) {
    this._baseHref = baseHref;
  }
  element(element: Element) {
    element.prepend('<base href="//' + this._baseHref + '">', { html: true });
  }
}

const KeywordRemoverButInZeroCopy = (keyword /* FIXME: keywordHopelyInFirstChunkSoNotCorruptingElement */: string): HTMLRewriterElementContentHandlers => {
  // NOTE: https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/#text-chunks
  // NOTE: beware in future use (FIXMEs)

  let _foundPreviously = false;
  class _KeywordRemoverButInZeroCopy implements HTMLRewriterElementContentHandlers {
    text(element: Text) {
      if (!keyword) return;
      if (_foundPreviously || element.text.includes(keyword) /* FIXME: what-if the keyword splitted in first chunk? */) {
        element.remove();
        if (element.lastInTextNode /* NOTE: search done? */) {
          _foundPreviously = false;
        } else {
          _foundPreviously = true;
        }
      }
    }
  }
  return new _KeywordRemoverButInZeroCopy();
};

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
    new_response_headers.delete('x-frame-options');
    removeResponseHeadersForCaching(new_response_headers);

    const new_response = new Response(_response.body, {
      status: _response.status,
      headers: new_response_headers
    });

    if (request.method === "GET" && new_response_headers.get('Content-Type')?.includes('html')) {
      const new_modified_response = new HTMLRewriter()
        // FIXME: on CORS
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
