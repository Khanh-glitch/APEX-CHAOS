// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function apexTextHygiene(){
  try {
    const replacements = new Map([
      ['Ä‚â€”', 'Ă—'], ['Ä‚Â·', 'Ă·'], ['Ä‚Â', 'Ă'], ['Ä‚â‚¬', 'Ă€'], ['Ä‚â€°', 'Ă‰'], ['Ä‚Â', 'Ă'], ['Ä‚â€', 'Ă”'],
      ['Ă‚Â·', 'Â·'], ['Ă‚Â°C', 'Â°C'], ['Ă‚Â²', 'Â²'], ['Ă‚Â³', 'Â³'], ['Ă‚Â±', 'Â±'],
      ['Ă¢â‚¬â€', 'â€”'], ['Ă¢â‚¬â€œ', 'â€“'], ['Ă¢â€ â€™', 'â†’'], ['Ă¢Ë†â€™', 'âˆ’'], ['Ă¢Ë†â€˜', 'Î£'], ['Ă¢Ë†Å¡', 'âˆ'],
      ['Ă¢Å’Â', 'âŒ'], ['Ă¢Å’â€¹', 'âŒ‹'], ['Ăâ‚¬', 'Ï€'], ['ĂÅ¸', 'ÏŸ'], ['Ă†â€™', 'Æ’'],
      ['Ă¢â„¢Â ', 'â™ '], ['Ă¢â„¢Â¥', 'â™¥'], ['Ă¢â„¢Â¦', 'â™¦'], ['Ă¢â„¢Â£', 'â™£'], ['Ă¢â„¢Âª', 'â™ª'], ['Ă¢â„¢Â«', 'â™«'],
      ['Ă¢â„¢Â¡', 'â™¡'], ['Ă¢â„¢â€ ', 'â™¦'], ['Ă¢â„¢Â', 'â™'], ['Ă¢â„¢Â¨', 'â™¨'], ['Ă¢â„¢Â°', 'â™°'],
      ['Ă¢Ëœâ€¦', 'â˜…'], ['Ă¢Ëœâ€ ', 'â˜†'], ['Ă¢ËœÂ ', 'â˜ '], ['Ă¢ËœÂ¾', 'â˜¾'], ['Ă¢ËœÂ£', 'â˜£'], ['Ă¢ËœÂ', 'â˜'],
      ['Ă¢Å“Â¦', 'âœ¦'], ['Ă¢Å“Â³', 'âœ³'], ['Ă¢Å“Â¹', 'âœ¹'], ['Ă¢Å“Âº', 'âœº'], ['Ă¢Å“Â£', 'âœ£'],
      ['Ă¢â€”Â', 'â—'], ['Ă¢â€”â€ ', 'â—†'], ['Ă¢â€”Ë†', 'â—ˆ'], ['Ă¢â€”â€¡', 'â—‡'], ['Ă¢â€”â€°', 'â—‰'], ['Ă¢â€”Â', 'â—'], ['Ă¢â€”Â·', 'â–·'],
      ['Ă¢â€“Â²', 'â–²'], ['Ă¢â€“Â°', 'â–°'], ['Ă¢â€“Â£', 'â–£'], ['Ă¢â€°Ë†', 'â‰ˆ'], ['Ă¢ÂÂ¡', 'â¡'], ['Ă¢Ââ€œ', 'â“'],
      ['Ä‘Å¸Ââ€ ', 'đŸ†'], ['Ä‘Å¸â€”Â¡', 'đŸ—¡'], ['Ă¦â€¹Â³', 'æ‹³'], ['Ă¦ÂÅ’', 'æŒ'], ['Ă¥Â°Â', 'å°'], ['Ă§Â¬Â¦', 'ç¬¦'],
      ['Ă¥Â°ÂĂ¦Â­Â¦', 'å°æ­¦']
    ]);
    const brokenPattern = /[\u0080-\u00ff\uFFFD]/;
    const suspiciousCodes = new Set([0x0102,0x0103,0x0110,0x0111,0x0178,0x0192,0x0152,0x0153]);
    const byteOverrides = new Map([
      [0x0102, 0xc3], [0x0103, 0xe3], [0x0110, 0xd0], [0x0111, 0xf0],
      [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
      [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
      [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
      [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
      [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
      [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
      [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f]
    ]);

    function looksBroken(text) {
      if (brokenPattern.test(text)) return true;
      for (let i = 0; i < text.length; i++) {
        if (suspiciousCodes.has(text.charCodeAt(i))) return true;
      }
      return false;
    }

    function decodeLatin1Utf8(text) {
      if (!looksBroken(text)) return text;
      try {
        let encoded = '';
        for (let i = 0; i < text.length; i++) {
          const code = text.charCodeAt(i);
          const mappedByte = byteOverrides.get(code);
          if (mappedByte !== undefined) encoded += '%' + mappedByte.toString(16).padStart(2, '0');
          else if (code <= 255) encoded += '%' + code.toString(16).padStart(2, '0');
          else encoded += encodeURIComponent(text[i]);
        }
        return decodeURIComponent(encoded);
      } catch (err) {
        return text;
      }
    }

    function applyKnownReplacements(text) {
      let out = text;
      for (const [bad, good] of replacements) {
        if (out.includes(bad)) out = out.split(bad).join(good);
      }
      return out;
    }

    function cleanText(value) {
      if (typeof value !== 'string' || !value) return value;
      let out = value;
      out = applyKnownReplacements(out);
      if (looksBroken(out)) out = decodeLatin1Utf8(out);
      out = applyKnownReplacements(out);
      out = out
        .replace(/\s+Â·\s+/g, ' Â· ')
        .replace(/\s{2,}/g, ' ')
        .replace(/GIáº¢I Äáº¤U/gi, 'TOURNAMENT')
        .replace(/Cáº¶P Sáº´N SĂ€NG/gi, 'READY MATCHES')
        .replace(/NHĂNH/gi, 'BRACKET')
        .replace(/VĂ’NG NGOĂ€I/gi, 'OUTER ROUND')
        .replace(/VĂ’NG/g, 'ROUND')
        .replace(/CHUNG Káº¾T Tá»”NG/gi, 'GRAND FINAL')
        .replace(/VĂ” Äá»CH/gi, 'CHAMPION')
        .replace(/NHáº¬T KĂ GIáº¢I Äáº¤U/gi, 'TOURNAMENT LOG')
        .replace(/Chá»n Ä‘áº¥u thÆ°á»ng/gi, 'Normal Match')
        .replace(/Vá» Menu/gi, 'Menu')
        .replace(/Tiáº¿p tá»¥c giáº£i Ä‘áº¥u/gi, 'Continue Tournament')
        .replace(/Xáº¿p láº¡i giáº£i/gi, 'Reset Bracket');
      return out;
    }

    function cleanTextNode(node) {
      if (!node || node.nodeType !== Node.TEXT_NODE) return;
      const next = cleanText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }

    function cleanDom(root) {
      if (!root) return;
      if (root.nodeType === Node.TEXT_NODE) { cleanTextNode(root); return; }
      if (root.nodeType !== Node.ELEMENT_NODE && root !== document) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) cleanTextNode(node);
      const title = cleanText(document.title);
      if (title !== document.title) document.title = title;
    }

    function patchCanvasText() {
      const proto = CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
      if (!proto || proto.__apexTextHygienePatched) return;
      proto.__apexTextHygienePatched = true;
      const oldFillText = proto.fillText;
      const oldStrokeText = proto.strokeText;
      const oldMeasureText = proto.measureText;
      proto.fillText = function(text, ...args) { return oldFillText.call(this, cleanText(text), ...args); };
      proto.strokeText = function(text, ...args) { return oldStrokeText.call(this, cleanText(text), ...args); };
      proto.measureText = function(text, ...args) { return oldMeasureText.call(this, cleanText(text), ...args); };
    }

    patchCanvasText();
    cleanDom(document.body);
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'characterData') cleanTextNode(m.target);
        for (const node of m.addedNodes || []) cleanDom(node);
      }
    });
    observer.observe(document.body, { childList:true, subtree:true, characterData:true });
    window.apexCleanText = cleanText;
    window.apexTextHygieneObserver = observer;
    console.info('[Apex Chaos] text hygiene enabled');
  } catch (err) {
    window.apexTextHygieneError = {message: err && err.message, stack: err && err.stack};
    console.error('[Apex Chaos] text hygiene failed', err);
  }
})();
