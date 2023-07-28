// FIXME: git-diff friendly, not lint friendly file.

export
class ElementRemover implements HTMLRewriterElementContentHandlers {
  element(element: Element) {
    element.remove();
  }
}

export
class BaseAdder implements HTMLRewriterElementContentHandlers {
  _baseHref: string;
  constructor(baseHref: string) {
    this._baseHref = baseHref;
  }
  element(element: Element) {
    element.prepend('<base href="//' + this._baseHref + '">', { html: true });
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
