// FIXME: git-diff friendly, not lint friendly file.

export
class ElementRemover implements HTMLRewriterElementContentHandlers {
  element(element: Element) {
    element.remove();
  }
}

export
class BaseAdder implements HTMLRewriterElementContentHandlers {
  // NOTE: It reduce the huge bill on cloudflare worker. Because we don't handle the assets anymore.

  _baseHref: string;
  constructor(baseHref: string) {
    this._baseHref = baseHref;
  }
  element(element: Element) {
    element.prepend('<base href="//' + this._baseHref + '">', { html: true });
    // NOTE: Bypassing the base on XMLHttpRequest for CORS. (Hack)
    // Everything goes on `this._baseHref` but XMLHttpRequest (Huge thanks for $.ajax) goes on `origin`.
    element.append(`<script>
      $.ajaxSetup({
        xhr: function () {
          this.url = (new URL(this.url, (new URL(location.href)).origin)).href;
          return new XMLHttpRequest();
        },
      });
    </script>`, { html: true });
  }
}

export
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
