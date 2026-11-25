/* Reduan Typing Master — shared JavaScript (no libraries). Version 2.1.
 *
 * v2.1 fix (see README.md): Ctrl+V paste of Unicode Bangla text now
 * works. Pasted/typed text is normalised to NFC before comparison, so
 * decomposed forms (ড় = ড + ়, য় = য + ়) copied from websites, Word or
 * Google Docs score correctly instead of going all red. An explicit
 * 'paste' handler cleans the pasted text (zero-width space / BOM and
 * line breaks removed, runs of whitespace collapsed) and works the
 * same in Unicode mode, Bijoy mode and English. Ctrl shortcuts
 * (Ctrl+V / Ctrl+A / Ctrl+C / Ctrl+X) pass through the Bijoy keydown
 * handler untouched.
 *
 * v2 fixes (see README.md for the full report):
 * 1. Bangla grapheme segmentation: passages and typed text are split into
 *    GRAPHEME CLUSTERS (Intl.Segmenter 'bn', with a manual fallback), so a
 *    conjunct such as ক্ষ or স্ত and a letter+kar such as কি are ONE typing
 *    unit, ONE span and ONE scoring unit — never split into separate tiny
 *    code points. WPM and accuracy are counted per grapheme.
 * 2. Bijoy keyboard mode (Bangla page): a Bijoy Bayanno layout mapper.
 *    In Bijoy mode, Latin keys are mapped to Bengali Unicode graphemes
 *    (j->ক, k->ত, d->ি typed BEFORE the consonant, g->্, etc.) and
 *    inserted into the typing box, so a Bijoy user can type the passages.
 * 3. SutonnyMJ display mode (Bangla page): the passage can be shown as
 *    Bijoy ANSI codes (Unicode -> Bijoy ANSI converter, display only;
 *    scoring always stays in Unicode underneath). SutonnyMJ itself is NOT
 *    embedded — it is used only when installed on the user's device, with
 *    Hind Siliguri as fallback. See README.md for the converter's coverage
 *    and the mappings flagged as unverified.
 * 4. Overflow guards in CSS (see style.css): passages and typing inputs
 *    wrap inside their containers on desktop and mobile.
 *
 * Typing rules (also documented in README.md):
 * - The score is always computed from the CURRENT text in the typing box,
 *   compared grapheme by grapheme with the passage.
 * - correct = graphemes that match the passage at the same position.
 * - wrong = graphemes that do NOT match at the same position.
 * - accuracy = correct / (correct + wrong) * 100.
 * - If you press Backspace and fix a wrong grapheme, that mistake
 *   disappears from the count: it is NOT counted twice, and it is not
 *   kept forever. This is deliberate — the score reflects what is on
 *   screen now.
 * - WPM = (correct graphemes / 5) / minutes elapsed.
 * - Results are saved only when the user clicks "Save Result" on the
 *   Speed Test page. Practice pages never save automatically.
 */

/* === PURE HELPERS (also tested in Node — no DOM access in this block) === */

(function () {
  'use strict';

  /* ---------- Grapheme segmentation ---------- */
  var _segmenter = null;
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      _segmenter = new Intl.Segmenter('bn', { granularity: 'grapheme' });
    }
  } catch (e) { _segmenter = null; }

  function _isCombiningMark(cp) {
    return cp === 0x0981 || cp === 0x0982 || cp === 0x0983 || cp === 0x09BC ||
      (cp >= 0x09BE && cp <= 0x09CC) || cp === 0x09CD || cp === 0x09D7 ||
      cp === 0x09E2 || cp === 0x09E3 || cp === 0x200C || cp === 0x200D;
  }

  /* Manual fallback: keep a base character together with its combining
   * marks, and keep a hasant (্) together with the consonant that follows
   * it, so conjuncts never split. Used only when Intl.Segmenter is
   * unavailable. */
  function segmentGraphemesFallback(text) {
    var clusters = [];
    var cur = '';
    var prevHasant = false;
    for (var ch of text) {
      var cp = ch.codePointAt(0);
      if (cur === '') {
        cur = ch;
        prevHasant = (cp === 0x09CD);
        continue;
      }
      if (_isCombiningMark(cp) || prevHasant) {
        cur += ch;
        prevHasant = (cp === 0x09CD);
      } else {
        clusters.push(cur);
        cur = ch;
        prevHasant = (cp === 0x09CD);
      }
    }
    if (cur !== '') clusters.push(cur);
    return clusters;
  }

  function segmentGraphemes(text) {
    if (_segmenter) {
      var out = [];
      var it = _segmenter.segment(text);
      for (var seg of it) out.push(seg.segment);
      return out;
    }
    return segmentGraphemesFallback(text);
  }

  /* ---------- Unicode normalisation (v2.1 — paste fix) ----------
   * Bangla text copied from websites, Word or Google Docs often arrives
   * DECOMPOSED (ড় as ড + ় U+09BC, য় as য + ়), while the passages are
   * stored PRECOMPOSED (ড় U+09DC, য় U+09DF). NFC composes them back,
   * so a pasted or IME-typed grapheme compares equal to the passage.
   * Applied in BOTH directions: to the passage in setPassage() and to
   * the typed text in currentTyped()/handleInput(). */
  function normalizeUnicode(text) {
    if (text == null) return '';
    var s = String(text);
    try {
      if (s.normalize) s = s.normalize('NFC');
    } catch (e) { /* String.normalize unavailable: use text as-is */ }
    return s;
  }

  /* Paste-only cleaning: strip zero-width space (U+200B) and BOM
   * (U+FEFF) that often hitch a ride in copied text, turn line breaks
   * and tabs into a single space each (passages are single-line), and
   * collapse runs of 2+ spaces to one. Legitimate single spaces are
   * kept. U+200D (ZWJ) and U+200C (ZWNJ) are NOT stripped — they can
   * be meaningful inside Bangla conjuncts. */
  function cleanPastedText(text) {
    var s = normalizeUnicode(text);
    s = s.replace(/[\u200B\uFEFF]/g, '');
    s = s.replace(/[\r\n\t]+/g, ' ');
    s = s.replace(/ {2,}/g, ' ');
    return s;
  }

  /* ---------- Bijoy keyboard layout (Bijoy Bayanno) ----------
   * Source: LearnType "Bijoy Keyboard Layout" guide
   * (learntype.app — Bijoy Bayanno layout, cross-checked against the
   * conjunct key sequences in the Bijoy 52 guide). Each entry is
   * [unshifted, shifted]. Vowel signs ি/ী/ে/ৈ are typed BEFORE the
   * consonant, the way they are written. Full vowels are hasant (g)
   * + vowel-sign key, except অ = Shift+F and ও = x. */
  var BIJOY_MAP = {
    'q': ['ঙ', 'ং'], 'w': ['য', 'য়'], 'e': ['ড', 'ঢ'], 'r': ['প', 'ফ'],
    't': ['ট', 'ঠ'], 'y': ['চ', 'ছ'], 'u': ['জ', 'ঝ'], 'i': ['হ', 'ঞ'],
    'o': ['গ', 'ঘ'], 'p': ['ড়', 'ঢ়'],
    'a': ['ৃ', 'র্'], 's': ['ু', 'ূ'], 'd': ['ি', 'ী'], 'f': ['া', 'অ'],
    'g': ['্', '।'], 'h': ['ব', 'ভ'], 'j': ['ক', 'খ'], 'k': ['ত', 'থ'],
    'l': ['দ', 'ধ'],
    'z': ['্র', '্য'], 'x': ['ও', 'ৗ'], 'c': ['ে', 'ৈ'], 'v': ['র', 'ল'],
    'b': ['ন', 'ণ'], 'n': ['স', 'ষ'], 'm': ['ম', 'শ'], '\\': ['ৎ', 'ঃ']
  };
  var BIJOY_ROWS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm']
  ];
  /* Vowel signs typed BEFORE their consonant in Bijoy. */
  var PRE_KAR = { 'ি': true, 'ী': true, 'ে': true, 'ৈ': true };

  /* Reverse map: Bengali char -> {key, shift}. Built from BIJOY_MAP. */
  var REVERSE_BIJOY = {};
  Object.keys(BIJOY_MAP).forEach(function (base) {
    var pair = BIJOY_MAP[base];
    if (pair[0] && !REVERSE_BIJOY[pair[0]]) REVERSE_BIJOY[pair[0]] = { key: base, shift: false };
    if (pair[1] && !REVERSE_BIJOY[pair[1]]) REVERSE_BIJOY[pair[1]] = { key: base, shift: true };
  });

  function _isBijoyConsonant(ch) {
    if (!ch) return false;
    var cp = ch.codePointAt(0);
    return (cp >= 0x0995 && cp <= 0x09B9) || (cp >= 0x09DC && cp <= 0x09DF);
  }

  /* Which Bijoy key (if any) starts typing a given grapheme? Used to
   * highlight the next key on the on-screen Bijoy keyboard. */
  function nextBijoyKeyFor(g) {
    if (!g) return null;
    var first = g[0];
    if (first === 'অ') return { key: 'f', shift: true };
    if (first === 'ও') return { key: 'x', shift: false };
    if ('আইঈউঊঋএঐঔ'.indexOf(first) !== -1) return { key: 'g', shift: false };
    if (g.indexOf('ি') !== -1) return { key: 'd', shift: false };
    if (g.indexOf('ী') !== -1) return { key: 'd', shift: true };
    if (g.indexOf('ো') !== -1) return { key: 'c', shift: false };
    if (g.indexOf('ৌ') !== -1) return { key: 'c', shift: true };
    if (g.indexOf('ে') !== -1) return { key: 'c', shift: false };
    if (g.indexOf('ৈ') !== -1) return { key: 'c', shift: true };
    if (g.indexOf('র্') === 0) return { key: 'a', shift: true };
    var rev = REVERSE_BIJOY[first];
    return rev || null;
  }

  /* ---------- Unicode -> Bijoy ANSI (SutonnyMJ) converter (display only)
   * Sources: BanglaTools "Unicode to Bijoy Conversion Chart" (221 entries)
   * cross-checked against full-word examples from teamzlab
   * (আমি -> Avwg, কে -> ‡K, কো -> ‡Kv, ধর্ম -> ag©, প্রকাশ -> cÖKvk,
   *  কিন্তু -> wKš, ক্ষমা -> ¶gv, বাংলা -> evsjv, কর্ম -> Kg©).
   * Visual-order rules: pre-base kars (ি/ে/ৈ) move BEFORE their
   * consonant, ো/ৌ split around it (‡ before, v/Š after), and reph (র্)
   * moves AFTER the consonant it sits on. Scoring always stays Unicode.
   * UNVERIFIED mappings (see README): ৈ -> ‡ (same slot as ে, not
   * independently confirmed), ৃ -> { (inferred from the chart's ASCII
   * sequence), ্র -> Ö (teamzlab) vs « (BanglaTools chart) — Ö used. */
  var ANSI_VOWEL = {
    'অ': 'A', 'আ': 'Av', 'ই': 'B', 'ঈ': 'C', 'উ': 'D', 'ঊ': 'E',
    'ঋ': 'F', 'এ': 'G', 'ঐ': 'H', 'ও': 'I', 'ঔ': 'J'
  };
  var ANSI_CONS = {
    'ক': 'K', 'খ': 'L', 'গ': 'M', 'ঘ': 'N', 'ঙ': 'O', 'চ': 'P',
    'ছ': 'Q', 'জ': 'R', 'ঝ': 'S', 'ঞ': 'T', 'ট': 'U', 'ঠ': 'V',
    'ড': 'W', 'ঢ': 'X', 'ণ': 'Y', 'ত': 'Z', 'থ': '_', 'দ': '`',
    'ধ': 'a', 'ন': 'b', 'প': 'c', 'ফ': 'd', 'ব': 'e', 'ভ': 'f',
    'ম': 'g', 'য': 'h', 'র': 'i', 'ল': 'j', 'শ': 'k', 'ষ': 'l',
    'স': 'm', 'হ': 'n', 'ড়': 'o', 'ঢ়': 'p', 'য়': 'q', 'ৎ': 'r'
  };
  var ANSI_KAR_POST = { 'া': 'v', 'ু': 'y', 'ূ': 'z', 'ৃ': '{' };
  var ANSI_PRE = { 'ি': 'w', 'ী': 'x', 'ে': '‡', 'ৈ': '‡' }; /* ৈ UNVERIFIED */
  var ANSI_MARK = { 'ং': 's', 'ঃ': 't', 'ঁ': 'u', '্': '&' };
  var ANSI_CONJUNCT = {
    'ক্ষ': '¶', 'জ্ঞ': 'Á', 'ঞ্চ': 'Â', 'ঞ্জ': 'Ä', 'ঙ্ক': '¼', 'ঙ্গ': '½',
    'ষ্ঠ': 'ô', 'ষ্ণ': 'ò', 'ণ্ড': 'Ê', 'ণ্ট': 'È', 'দ্ধ': '×',
    'ন্ত্ৰ': 'š¿', 'হ্ম': 'þ', 'হ্ন': 'ý', 'ক্ক': '°', 'ক্ট': '±',
    'ক্ত': '³', 'ন্ত': 'š'
  };
  var ANSI_PUNCT = { '।': '|', '—': '-', '–': '-' };

  /* Convert one grapheme to Bijoy ANSI tokens. Each token is
   * {ansi, gi} — gi is the grapheme index, so scoring colours can be
   * applied per grapheme even though the ANSI order differs. */
  function ansiTokensForGrapheme(g, gi, uncovered) {
    var out = [];
    function push(s) {
      for (var i = 0; i < s.length; i++) out.push({ ansi: s[i], gi: gi });
    }
    if (g === ' ') { push(' '); return out; }
    if (g.length === 1 && g.charCodeAt(0) < 128) { push(g); return out; }
    if (ANSI_PUNCT[g]) { push(ANSI_PUNCT[g]); return out; }

    var hasReph = g.indexOf('র্') === 0;
    var rest = hasReph ? g.slice(2) : g;
    var pre = null, baseCode = null, post = '';

    /* Conjunct prefix (longest match first). */
    var conjKeys = Object.keys(ANSI_CONJUNCT).sort(function (a, b) { return b.length - a.length; });
    var matched = null;
    for (var ci = 0; ci < conjKeys.length; ci++) {
      if (rest.indexOf(conjKeys[ci]) === 0) { matched = conjKeys[ci]; break; }
    }
    if (matched) {
      baseCode = ANSI_CONJUNCT[matched];
      rest = rest.slice(matched.length);
      /* A pre-base kar may follow the conjunct (e.g. ক্ষি -> w¶). */
      for (var ri = 0; ri < rest.length; ri++) {
        if (ANSI_PRE[rest[ri]]) pre = ANSI_PRE[rest[ri]];
        else if (rest[ri] === 'ো') { pre = '‡'; post += 'v'; }
        else if (rest[ri] === 'ৌ') { pre = '‡'; post += 'Š'; }
        else if (ANSI_KAR_POST[rest[ri]]) post += ANSI_KAR_POST[rest[ri]];
        else if (ANSI_MARK[rest[ri]]) post += ANSI_MARK[rest[ri]];
        else { post += rest[ri]; uncovered.push(rest[ri]); }
      }
    } else if (ANSI_VOWEL[rest[0]] && rest.length === 1) {
      baseCode = ANSI_VOWEL[rest];
      rest = '';
    } else if (ANSI_VOWEL[rest[0]]) {
      /* Independent vowel + trailing marks (e.g. আঁ). */
      baseCode = ANSI_VOWEL[rest[0]];
      for (var vi = 1; vi < rest.length; vi++) {
        if (ANSI_MARK[rest[vi]]) post += ANSI_MARK[rest[vi]];
        else { post += rest[vi]; uncovered.push(rest[vi]); }
      }
      rest = '';
    } else {
      /* Base consonant + following marks / second consonant. */
      var base = rest[0];
      if (!ANSI_CONS[base]) { push(g); uncovered.push(g); return out; }
      baseCode = ANSI_CONS[base];
      var i = 1;
      while (i < rest.length) {
        var ch = rest[i];
        if (ANSI_PRE[ch]) { pre = ANSI_PRE[ch]; i++; }
        else if (ch === 'ো') { pre = '‡'; post += 'v'; i++; }
        else if (ch === 'ৌ') { pre = '‡'; post += 'Š'; i++; }
        else if (ANSI_KAR_POST[ch]) { post += ANSI_KAR_POST[ch]; i++; }
        else if (ch === '়') {
          /* Nukta form (ড+় = ড় etc.) — kept for robustness even though
           * the passages now use precomposed letters. */
          if (base === 'ড') baseCode = 'o';
          else if (base === 'ঢ') baseCode = 'p';
          else if (base === 'য') baseCode = 'q';
          else { post += ch; uncovered.push(ch); }
          i++;
        }
        else if (ANSI_MARK[ch]) {
          if (ch === '্' && i + 1 < rest.length) {
            var nxt = rest[i + 1];
            if (nxt === 'র') { post += 'Ö'; i += 2; }
            else if (nxt === 'য') { post += '¨'; i += 2; }
            else if (ANSI_CONS[nxt]) { post += '&' + ANSI_CONS[nxt]; i += 2; }
            else { post += '&'; i++; }
          } else { post += ANSI_MARK[ch]; i++; }
        } else { post += ch; uncovered.push(ch); i++; }
      }
    }

    if (pre) push(pre);
    if (baseCode) push(baseCode);
    if (post) push(post);
    if (hasReph) push('©');
    return out;
  }

  /* Convert a whole passage. Returns {tokens, uncovered} where tokens
   * is an array of {ansi, gi} in Bijoy visual order and uncovered is
   * the list of characters that had no ANSI mapping (passed through). */
  function unicodeToBijoyTokens(text) {
    var graphemes = segmentGraphemes(text);
    var tokens = [];
    var uncovered = [];
    graphemes.forEach(function (g, gi) {
      var t = ansiTokensForGrapheme(g, gi, uncovered);
      tokens.push.apply(tokens, t);
    });
    return { tokens: tokens, uncovered: uncovered };
  }

  function unicodeToBijoyAnsi(text) {
    return unicodeToBijoyTokens(text).tokens.map(function (t) { return t.ansi; }).join('');
  }

  /* Expose the pure helpers for the Node test harness (and debugging). */
  if (typeof window !== 'undefined') {
    window.RTM = {
      segmentGraphemes: segmentGraphemes,
      segmentGraphemesFallback: segmentGraphemesFallback,
      normalizeUnicode: normalizeUnicode,
      cleanPastedText: cleanPastedText,
      unicodeToBijoyTokens: unicodeToBijoyTokens,
      unicodeToBijoyAnsi: unicodeToBijoyAnsi,
      nextBijoyKeyFor: nextBijoyKeyFor,
      BIJOY_MAP: BIJOY_MAP
    };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      segmentGraphemes: segmentGraphemes,
      segmentGraphemesFallback: segmentGraphemesFallback,
      normalizeUnicode: normalizeUnicode,
      cleanPastedText: cleanPastedText,
      unicodeToBijoyTokens: unicodeToBijoyTokens,
      unicodeToBijoyAnsi: unicodeToBijoyAnsi,
      nextBijoyKeyFor: nextBijoyKeyFor,
      BIJOY_MAP: BIJOY_MAP
    };
  }

  /* === END PURE HELPERS === */

  var STORAGE_KEY = 'reduan-typing-results';

  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  /* ---------- Mobile menu + active nav ---------- */
  var menuBtn = $('menuBtn');
  var nav = $('siteNav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }
  (function markActiveNav() {
    if (!nav) return;
    var file = (window.location.pathname.split('/').pop() || 'index.html').split('?')[0];
    if (!file) file = 'index.html';
    nav.querySelectorAll('a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href === file || (file === 'index.html' && href === 'index.html')) {
        a.classList.add('active');
      }
    });
  })();

  /* ---------- localStorage: saved test results ---------- */
  function loadResults() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveResults(arr) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); return true; }
    catch (e) { return false; }
  }
  function addResult(result) {
    var arr = loadResults();
    arr.push(result);
    if (arr.length > 100) arr = arr.slice(arr.length - 100);
    return saveResults(arr);
  }
  function bestStats() {
    var arr = loadResults();
    if (!arr.length) {
      return { total: 0, bestWpm: 0, bestAccuracy: 0, avgWpm: 0 };
    }
    var bestWpm = 0, bestAcc = 0, sum = 0;
    arr.forEach(function (r) {
      if (r.wpm > bestWpm) bestWpm = r.wpm;
      if (r.accuracy > bestAcc) bestAcc = r.accuracy;
      sum += r.wpm;
    });
    return {
      total: arr.length,
      bestWpm: bestWpm,
      bestAccuracy: bestAcc,
      avgWpm: Math.round(sum / arr.length)
    };
  }

  /* ---------- Home page best-stats summary ---------- */
  (function homeStats() {
    var totalEl = $('homeTotalTests');
    if (!totalEl) return;
    var s = bestStats();
    var setText = function (id, val) { var el = $(id); if (el) el.textContent = val; };
    setText('homeBestWpm', s.total ? String(s.bestWpm) : '0');
    setText('homeBestAccuracy', s.total ? s.bestAccuracy + '%' : '—');
    setText('homeTotalTests', String(s.total));
    setText('homeAvgWpm', s.total ? String(s.avgWpm) : '0');
  })();

  /* ---------- Passages ---------- */
  var ENGLISH_PASSAGES = {
    easy: [
      'The sun is up and the day is new. I sit at my desk and turn on the computer. I open a book and read a short page. Then I write my name and learn one new word.',
      'A cat sits on the mat and looks at the sun. The dog runs in the yard and plays with a ball. We eat rice and fish for lunch. Then we rest and read a book.',
      'My school is near my home. I go there on foot each day. My teacher is kind and helps me learn. I like to read, write and draw in class.'
    ],
    medium: [
      'Learning to type well takes time and daily practice. Start slow and focus on the right keys. Do not look at the keyboard all the time. Soon your fingers will find the keys on their own, and your speed will grow.',
      'A computer is a tool that helps us learn, work and talk with people far away. We use it to write letters, make tables, watch lessons and send email. To use it well, we must learn the keyboard first.',
      'The rain fell soft on the green fields of Bangladesh. Farmers worked in the wet soil, and boats moved slow on the wide river. In the evening, lamps lit the small homes, and families sat down to eat together.'
    ],
    hard: [
      'Good typing is not only about speed; it is about rhythm, accuracy, and patience. When you rush, mistakes grow, and fixing them costs more time than typing slowly in the first place. Practice short sessions every day, keep your wrists relaxed, and let steady progress, not sudden effort, build your skill.',
      'In 1971, the people of Bangladesh fought for freedom, and on 16 December that year, victory came. Today, students across the country use computers and the internet to learn new skills, build small businesses, and share their work with the world — a change their grandparents could hardly have imagined.',
      'The quick brown fox jumps over the lazy dog near the quiet river bank. Meanwhile, 12 students packed 36 boxes of books, pencils, and paper for the new library. Their teacher smiled and said, "Practice every day, and your hands will learn what your eyes now forget."'
    ]
  };

  /* Bangla passages — audited v2: exactly one normal space between
   * words, never a space inside a word, conjunct or kar. */
  var BANGLA_PASSAGES = {
    easy: [
      'আমি প্রতিদিন কম্পিউটার শিখি। কম্পিউটার আমাদের জীবনকে সহজ করে। আমি বাংলা টাইপ করতে শিখছি।',
      'বাংলাদেশ আমার দেশ। আমি বাংলায় কথা বলি। আমার বাড়ির পাশে একটি স্কুল আছে। আমি সেখানে পড়ি।',
      'সকালে আমি ভাত খাই। তারপর স্কুলে যাই। শিক্ষক আমাকে পড়া শেখান। আমি মন দিয়ে পড়ি।'
    ],
    medium: [
      'কম্পিউটার শেখা এখন খুব দরকারি। আমরা কম্পিউটারে লিখতে পারি, ছবি আঁকতে পারি, আর ইন্টারনেটে পড়তে পারি। প্রতিদিন একটু একটু করে চর্চা করলে টাইপ করা সহজ হয়ে যায়।',
      'বাংলাদেশের মানুষ খুব পরিশ্রমী। তারা মাঠে কাজ করে, নদীতে মাছ ধরে, আর শহরে নানা কাজ করে। আমাদের দেশের ভাষা বাংলা, আর আমরা এই ভাষাকে খুব ভালোবাসি।',
      'ইন্টারনেট আমাদের অনেক কিছু শেখায়। আমরা ইমেইল পাঠাতে পারি, খবর পড়তে পারি, আর অনলাইনে ক্লাস করতে পারি। তবে ইন্টারনেট ব্যবহার করার সময় সাবধানে থাকতে হবে।'
    ],
    hard: [
      'ভালো টাইপিস্ট হতে হলে শুধু দ্রুত লেখা নয়, সঠিকভাবে লেখা শিখতে হয়। ভুল বেশি হলে সময় নষ্ট হয়। তাই ধীরে ধীরে সঠিক কী চাপা শিখুন, প্রতিদিন অল্প সময় চর্চা করুন, আর ধৈর্য ধরে এগিয়ে যান।',
      'কম্পিউটার শিক্ষা এখন প্রতিটি ছাত্রের জন্য জরুরি। মাইক্রোসফট ওয়ার্ডে চিঠি লেখা, এক্সেলে হিসাব রাখা, আর পাওয়ারপয়েন্টে উপস্থাপনা তৈরি করা — এই দক্ষতাগুলো চাকরি আর পড়াশোনায় অনেক কাজে লাগে।'
    ]
  };

  function pickPassage(list, previous) {
    if (!list.length) return '';
    if (list.length === 1) return list[0];
    var p;
    do { p = list[Math.floor(Math.random() * list.length)]; } while (p === previous);
    return p;
  }

  /* ---------- On-screen QWERTY keyboard ---------- */
  var KB_ROWS = [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], ['z', 'x', 'c', 'v', 'b', 'n', 'm']];
  function buildKeyboard(container) {
    if (!container) return;
    container.innerHTML = '';
    KB_ROWS.forEach(function (row) {
      var rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      row.forEach(function (letter) {
        var key = document.createElement('div');
        key.className = 'key';
        key.setAttribute('data-key', letter);
        key.textContent = letter.toUpperCase();
        rowEl.appendChild(key);
      });
      container.appendChild(rowEl);
    });
    var spaceRow = document.createElement('div');
    spaceRow.className = 'kb-row';
    var space = document.createElement('div');
    space.className = 'key space';
    space.setAttribute('data-key', ' ');
    space.textContent = 'Space';
    spaceRow.appendChild(space);
    container.appendChild(spaceRow);
  }

  /* ---------- On-screen Bijoy keyboard ----------
   * Each key shows the Bangla character (lower), the Latin key, and the
   * Shift character. Clicking inserts through the same Bijoy mapper as a
   * physical keypress. The Shift key is one-shot for clicks. */
  function buildBijoyKeyboard(container, insertFn) {
    if (!container) return;
    container.innerHTML = '';
    var shiftState = { on: false };
    BIJOY_ROWS.forEach(function (row) {
      var rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      row.forEach(function (base) {
        var pair = BIJOY_MAP[base];
        var key = document.createElement('button');
        key.type = 'button';
        key.className = 'key bijoy-key';
        key.setAttribute('data-key', base);
        key.setAttribute('data-shift-char', pair[1]);
        key.innerHTML = '<span class="bk-bn">' + pair[0] + '</span>' +
          '<span class="bk-lat">' + base.toUpperCase() + '</span>' +
          '<span class="bk-sh">' + pair[1] + '</span>';
        key.addEventListener('click', function () {
          var shifted = shiftState.on;
          insertFn(base, shifted);
          if (shiftState.on) {
            shiftState.on = false;
            var sh = container.querySelector('#bijoyShiftBtn');
            if (sh) sh.classList.remove('next');
          }
        });
        rowEl.appendChild(key);
      });
      container.appendChild(rowEl);
    });
    var bottomRow = document.createElement('div');
    bottomRow.className = 'kb-row';
    var shiftBtn = document.createElement('button');
    shiftBtn.type = 'button';
    shiftBtn.className = 'key wide';
    shiftBtn.id = 'bijoyShiftBtn';
    shiftBtn.textContent = 'Shift';
    shiftBtn.addEventListener('click', function () {
      shiftState.on = !shiftState.on;
      shiftBtn.classList.toggle('next', shiftState.on);
    });
    bottomRow.appendChild(shiftBtn);
    var space = document.createElement('button');
    space.type = 'button';
    space.className = 'key space';
    space.setAttribute('data-key', ' ');
    space.textContent = 'Space';
    space.addEventListener('click', function () { insertFn(' ', false); });
    bottomRow.appendChild(space);
    container.appendChild(bottomRow);
  }

  function clearKeyHighlights(container) {
    if (!container) return;
    container.querySelectorAll('.key').forEach(function (k) { k.classList.remove('next'); });
  }

  /* Highlight the next key to press. kbMode: 'qwerty' or 'bijoy'. */
  function highlightNextKey(container, nextGrapheme, kbMode) {
    if (!container) return;
    clearKeyHighlights(container);
    if (nextGrapheme === undefined || nextGrapheme === null) return;
    if (kbMode === 'bijoy') {
      var nk = nextBijoyKeyFor(nextGrapheme);
      if (!nk) return;
      var key = container.querySelector('[data-key="' + nk.key + '"]');
      if (key) key.classList.add('next');
      if (nk.shift) {
        var sh = container.querySelector('#bijoyShiftBtn');
        if (sh) sh.classList.add('next');
      }
      return;
    }
    var target = null;
    if (nextGrapheme === ' ') target = ' ';
    else if (nextGrapheme.length === 1) target = nextGrapheme.toLowerCase();
    if (!target) return;
    var el = container.querySelector('[data-key="' + target + '"]');
    if (el) el.classList.add('next');
  }

  /* ---------- Typing engine (shared by practice + test) ----------
   * All splitting, comparison and scoring is per GRAPHEME, never per
   * code point. In SutonnyMJ display mode the passage is rendered from
   * ANSI tokens, but every token still carries its grapheme index, so
   * colours stay aligned with the Unicode text being typed. */
  function createTypingEngine(opts) {
    var passageEl = opts.passageEl;
    var inputEl = opts.inputEl;
    var stats = opts.stats || {};
    var onFirstKey = opts.onFirstKey || function () {};
    var onComplete = opts.onComplete || function () {};
    var onInput = opts.onInput || function () {};
    var testMode = !!opts.testMode;
    var unitLabel = opts.unitLabel || 'characters';
    var getKeyboardMode = opts.getKeyboardMode || function () { return 'qwerty'; };

    var targetGraphemes = [];
    var passageText = '';
    var displayMode = 'unicode'; /* 'unicode' | 'sutonny' */
    var spansByGi = [];
    var started = false;
    var startTime = 0;
    var finished = false;

    function renderPassageSpans() {
      passageEl.innerHTML = '';
      spansByGi = [];
      if (displayMode === 'sutonny') {
        passageEl.classList.add('bijoy-display');
        var conv = unicodeToBijoyTokens(passageText);
        conv.tokens.forEach(function (tok) {
          var span = document.createElement('span');
          span.className = 'ch' + (tok.ansi === ' ' ? ' space-ch' : '');
          span.textContent = tok.ansi === ' ' ? '\u00a0' : tok.ansi;
          span.setAttribute('data-gi', String(tok.gi));
          passageEl.appendChild(span);
          (spansByGi[tok.gi] = spansByGi[tok.gi] || []).push(span);
        });
      } else {
        passageEl.classList.remove('bijoy-display');
        targetGraphemes.forEach(function (g, i) {
          var span = document.createElement('span');
          span.className = 'ch' + (g === ' ' ? ' space-ch' : '');
          span.textContent = g === ' ' ? '\u00a0' : g;
          passageEl.appendChild(span);
          spansByGi[i] = [span];
        });
      }
    }

    function setPassage(text) {
      passageText = normalizeUnicode(text);
      targetGraphemes = segmentGraphemes(passageText);
      renderPassageSpans();
      reset();
    }

    function setDisplayMode(mode) {
      if (mode !== 'unicode' && mode !== 'sutonny') mode = 'unicode';
      displayMode = mode;
      renderPassageSpans();
      render();
    }

    function currentTyped() { return segmentGraphemes(normalizeUnicode(inputEl.value)); }

    function compute() {
      var typed = currentTyped();
      var correct = 0, wrong = 0;
      for (var i = 0; i < typed.length && i < targetGraphemes.length; i++) {
        if (typed[i] === targetGraphemes[i]) correct++; else wrong++;
      }
      if (typed.length > targetGraphemes.length) wrong += typed.length - targetGraphemes.length;
      var elapsedSec = started ? (Date.now() - startTime) / 1000 : 0;
      var minutes = elapsedSec / 60;
      var wpm = minutes > 0 ? Math.round((correct / 5) / minutes) : 0;
      var total = correct + wrong;
      var accuracy = total > 0 ? Math.round((correct / total) * 100) : 100;
      return {
        typed: typed.length, correct: correct, wrong: wrong,
        elapsedSec: elapsedSec, wpm: wpm, accuracy: accuracy,
        totalGraphemes: targetGraphemes.length
      };
    }

    function render() {
      var typed = currentTyped();
      for (var gi = 0; gi < targetGraphemes.length; gi++) {
        var spans = spansByGi[gi] || [];
        spans.forEach(function (span) {
          span.classList.remove('correct', 'wrong', 'current', 'space-wrong');
          if (gi < typed.length) {
            if (typed[gi] === targetGraphemes[gi]) {
              span.classList.add('correct');
            } else {
              span.classList.add('wrong');
              if (targetGraphemes[gi] === ' ') span.classList.add('space-wrong');
            }
          } else if (gi === typed.length && !finished) {
            span.classList.add('current');
          }
        });
      }
      var s = compute();
      if (stats.wpm) stats.wpm.textContent = String(s.wpm);
      if (stats.accuracy) stats.accuracy.textContent = typed.length ? s.accuracy + '%' : '—';
      if (stats.mistakes) stats.mistakes.textContent = String(s.wrong);
      if (stats.time) stats.time.textContent = formatTime(s.elapsedSec);
      if (stats.progress) stats.progress.textContent = Math.min(typed.length, targetGraphemes.length) + ' / ' + targetGraphemes.length + ' ' + unitLabel;
      if (stats.progressBar) stats.progressBar.style.width = targetGraphemes.length ? Math.min(100, (typed.length / targetGraphemes.length) * 100) + '%' : '0%';
      if (opts.keyboardEl) {
        var next = null;
        if (!finished && typed.length < targetGraphemes.length) {
          next = targetGraphemes[typed.length];
        }
        highlightNextKey(opts.keyboardEl, next, getKeyboardMode());
      }
      onInput(s);
      return s;
    }

    function formatTime(sec) {
      var s = Math.floor(sec);
      var m = Math.floor(s / 60);
      var r = s % 60;
      return m + ':' + (r < 10 ? '0' : '') + r;
    }

    function reset() {
      inputEl.value = '';
      started = false;
      finished = false;
      startTime = 0;
      render();
    }

    function handleInput() {
      if (finished) return;
      /* v2.1: normalise what is in the box BEFORE scoring/trimming, so
       * decomposed input from paste or an IME (ড় as ড + ়) is fixed in
       * place. Caret position is preserved as best as possible — NFC
       * can only shrink the text, so the caret is clamped to the new
       * length. Programmatic assignment does not re-fire 'input'. */
      var rawValue = inputEl.value;
      var normValue = normalizeUnicode(rawValue);
      if (normValue !== rawValue) {
        var cs = inputEl.selectionStart, ce = inputEl.selectionEnd;
        inputEl.value = normValue;
        if (typeof cs === 'number') {
          inputEl.selectionStart = Math.min(cs, normValue.length);
          inputEl.selectionEnd = Math.min(ce, normValue.length);
        }
      }
      /* Trim AFTER normalisation, so the +20 allowance counts real
       * graphemes, not decomposed code points. */
      if (currentTyped().length > targetGraphemes.length + 20) {
        inputEl.value = currentTyped().slice(0, targetGraphemes.length + 20).join('');
      }
      if (!started && inputEl.value.length > 0) {
        started = true;
        startTime = Date.now();
        onFirstKey();
      }
      var s = render();
      if (testMode) return;
      if (currentTyped().length >= targetGraphemes.length) {
        finished = true;
        inputEl.disabled = true;
        onComplete(s);
      }
    }

    inputEl.addEventListener('input', handleInput);
    /* v2.1: explicit paste handler — Ctrl+V (and long-press / menu
     * paste on mobile) works the same in Unicode mode, Bijoy mode and
     * English. The pasted text is cleaned (NFC + zero-width space /
     * BOM stripped + line breaks/tabs to space + runs of whitespace
     * collapsed) and inserted at the cursor, replacing any selection.
     * A buffered Bijoy pre-base kar is cleared first, so it cannot
     * corrupt the next keystroke after a paste. Ctrl+V itself is
     * never blocked by the Bijoy keydown handler — handleKeydown
     * returns early whenever ctrlKey/metaKey/altKey is held, so
     * Ctrl+V / Ctrl+A / Ctrl+C / Ctrl+X all pass through untouched. */
    inputEl.addEventListener('paste', function (e) {
      if (finished) return;
      var dt = (e.clipboardData || window.clipboardData);
      var text = dt ? dt.getData('text/plain') : '';
      if (!text) return;
      e.preventDefault();
      if (opts.clearPending) opts.clearPending();
      var cleaned = cleanPastedText(text);
      if (!cleaned) return;
      var start = inputEl.selectionStart;
      var end = inputEl.selectionEnd;
      if (typeof start === 'number' && inputEl.setRangeText) {
        inputEl.setRangeText(cleaned, start, end, 'end');
      } else if (typeof start === 'number') {
        inputEl.value = inputEl.value.slice(0, start) + cleaned + inputEl.value.slice(end);
        inputEl.selectionStart = inputEl.selectionEnd = start + cleaned.length;
      } else {
        inputEl.value += cleaned;
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    });
    passageEl.addEventListener('click', function () { inputEl.focus(); });

    return {
      setPassage: setPassage,
      setDisplayMode: setDisplayMode,
      reset: reset,
      render: render,
      compute: compute,
      finish: function () { finished = true; inputEl.disabled = true; return compute(); },
      isFinished: function () { return finished; },
      isStarted: function () { return started; },
      getPassage: function () { return passageText; },
      getTypedText: function () { return inputEl.value; },
      focus: function () { inputEl.focus(); },
      enable: function () { inputEl.disabled = false; },
      formatTime: formatTime
    };
  }

  /* ---------- Bijoy typing handler (Bangla page, Bijoy mode) ----------
   * Maps Latin keypresses to Bengali Unicode graphemes and inserts them
   * at the cursor. Pre-base kars (ি/ী/ে/ৈ) are buffered and inserted
   * AFTER the next consonant, matching Unicode order. ো/ৌ are formed
   * when া / ৗ follows a consonant+ে/ৈ. */
  function createBijoyHandler(inputEl, onPendingChange) {
    var pendingPreKar = null; /* a buffered pre-base kar, e.g. 'ি' */

    function insertAtCursor(text) {
      var start = inputEl.selectionStart;
      var end = inputEl.selectionEnd;
      if (typeof start !== 'number') {
        inputEl.value += text;
      } else if (inputEl.setRangeText) {
        inputEl.setRangeText(text, start, end, 'end');
      } else {
        inputEl.value = inputEl.value.slice(0, start) + text + inputEl.value.slice(end);
        inputEl.selectionStart = inputEl.selectionEnd = start + text.length;
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function setPending(kar) {
      pendingPreKar = kar;
      if (onPendingChange) onPendingChange(kar);
    }

    function flushPending() {
      if (pendingPreKar) {
        var kar = pendingPreKar;
        setPending(null);
        insertAtCursor(kar);
      }
    }

    /* Insert one mapped Bijoy key. base = lowercase Latin key ('j'),
     * shifted = whether Shift was held. Returns true if handled. */
    function insertMapped(base, shifted) {
      if (base === ' ') { flushPending(); return false; } /* let space type normally */
      var pair = BIJOY_MAP[base];
      if (!pair) return false;
      var ch = shifted ? pair[1] : pair[0];

      /* Pre-base kar: buffer it, insert after the next consonant. */
      if (PRE_KAR[ch]) { setPending(ch); return true; }

      /* ো / ৌ formation: া after consonant+ে -> ো; ৗ after consonant+ৈ -> ৌ. */
      if (ch === 'া' || ch === 'ৗ') {
        var val = inputEl.value;
        var lastCp = val.length ? val[val.length - 1] : '';
        if (lastCp === 'ে' && ch === 'া') {
          inputEl.value = val.slice(0, -1) + 'ো';
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
        if (lastCp === 'ৈ' && ch === 'ৗ') {
          inputEl.value = val.slice(0, -1) + 'ৌ';
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
        if (pendingPreKar) flushPending();
        insertAtCursor(ch);
        return true;
      }

      if (pendingPreKar) {
        if (_isBijoyConsonant(ch)) {
          var kar = pendingPreKar;
          setPending(null);
          insertAtCursor(ch + kar);
          return true;
        }
        flushPending();
      }
      insertAtCursor(ch);
      return true;
    }

    function handleKeydown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      var key = e.key;
      if (!key || key.length !== 1) {
        if (key === 'Backspace' && pendingPreKar) setPending(null);
        return false; /* arrows, Tab, Enter, etc. pass through */
      }
      if (key === ' ') { flushPending(); return false; }
      if (/[0-9]/.test(key) && !e.shiftKey) return false; /* ASCII digits pass through */
      if (key === '7' && e.shiftKey) { insertAtCursor('ঁ'); e.preventDefault(); return true; }
      var base = key.toLowerCase();
      if (!BIJOY_MAP[base] && base !== '\\') return false;
      if (insertMapped(base === '\\' ? '\\' : base, e.shiftKey)) {
        e.preventDefault();
        return true;
      }
      return false;
    }

    return {
      handleKeydown: handleKeydown,
      insertMapped: insertMapped,
      clearPending: function () { setPending(null); },
      getPending: function () { return pendingPreKar; }
    };
  }

  /* ---------- Practice pages: english.html / bangla.html ---------- */
  (function initPractice() {
    var passageEl = $('passage');
    var inputEl = $('typingInput');
    var modeEl = $('practiceMode');
    if (!passageEl || !inputEl || !modeEl) return;
    var mode = modeEl.value;
    var isBangla = mode === 'bangla';
    var passages = isBangla ? BANGLA_PASSAGES : ENGLISH_PASSAGES;
    var difficultyEl = $('difficulty');
    var newBtn = $('newPassageBtn');
    var restartBtn = $('restartBtn');
    var statusEl = $('statusLine');
    var keyboardEl = $('keyboard');
    var pendingEl = $('pendingKar');

    var kbMode = 'qwerty'; /* Bangla only: 'unicode' (system keyboard, QWERTY board) or 'bijoy' */
    var displayMode = 'unicode';
    if (isBangla) {
      try {
        kbMode = localStorage.getItem('rtm-bangla-kb-mode') === 'bijoy' ? 'bijoy' : 'unicode';
        displayMode = localStorage.getItem('rtm-bangla-display') === 'sutonny' ? 'sutonny' : 'unicode';
      } catch (e) { /* storage unavailable: defaults */ }
    }

    var bijoyHandler = null;
    if (isBangla) {
      bijoyHandler = createBijoyHandler(inputEl, function (kar) {
        if (pendingEl) {
          if (kar) {
            pendingEl.hidden = false;
            pendingEl.textContent = 'অপেক্ষমাণ কার: ' + kar + ' — এবার ব্যঞ্জনবর্ণ চাপুন (পরের অক্ষরের আগে বসবে)।';
          } else {
            pendingEl.hidden = true;
            pendingEl.textContent = '';
          }
        }
      });
      inputEl.addEventListener('keydown', function (e) {
        if (kbMode === 'bijoy' && bijoyHandler) bijoyHandler.handleKeydown(e);
      });
    }

    function rebuildKeyboard() {
      if (!keyboardEl) return;
      if (isBangla && kbMode === 'bijoy') {
        buildBijoyKeyboard(keyboardEl, function (base, shifted) {
          if (base === ' ') { inputEl.focus(); return; }
          if (bijoyHandler) bijoyHandler.insertMapped(base, shifted);
          inputEl.focus();
        });
      } else {
        buildKeyboard(keyboardEl);
      }
      var cap = $('kbCaption');
      if (cap) {
        cap.textContent = isBangla && kbMode === 'bijoy'
          ? 'বিজয় কীবোর্ড: হাইলাইট করা কী-টি পরের অক্ষর। নিচের কীবোর্ডে ক্লিক করলেও টাইপ হবে।'
          : isBangla
            ? 'হাইলাইট করা কী পরের অক্ষর (ইংরেজি QWERTY রেফারেন্স)। বাংলা টাইপের জন্য আপনার সিস্টেমের বাংলা কীবোর্ড ব্যবহার করুন, অথবা বিজয় মোড চালু করুন।'
            : 'The highlighted key is the next letter to type. Click the passage to focus the typing box again.';
      }
    }
    rebuildKeyboard();

    var engine = createTypingEngine({
      passageEl: passageEl,
      inputEl: inputEl,
      keyboardEl: keyboardEl,
      unitLabel: isBangla ? 'graphemes' : 'characters',
      getKeyboardMode: function () { return isBangla && kbMode === 'bijoy' ? 'bijoy' : 'qwerty'; },
      clearPending: function () { if (bijoyHandler) bijoyHandler.clearPending(); },
      stats: {
        wpm: $('statWpm'), accuracy: $('statAccuracy'),
        mistakes: $('statMistakes'), time: $('statTime'),
        progress: $('statProgress'), progressBar: $('progressFill')
      },
      onComplete: function (s) {
        if (statusEl) {
          statusEl.textContent = 'Passage complete! ' + s.wpm + ' WPM, ' + s.accuracy + '% accuracy, ' + s.wrong + ' mistake' + (s.wrong === 1 ? '' : 's') + '. Try a new passage or take the Speed Test to save a result.';
        }
      }
    });

    /* Bangla mode toggles: keyboard (Unicode / Bijoy) and display
     * (Unicode / SutonnyMJ). Switching keyboard mode rebuilds the
     * on-screen board; switching display re-renders the passage. */
    function wireToggle(btnId, value, current, onChange) {
      var btn = $(btnId);
      if (!btn) return;
      btn.setAttribute('aria-pressed', current === value ? 'true' : 'false');
      btn.addEventListener('click', function () { onChange(value); });
    }
    function refreshToggles() {
      [['kbModeUnicode', 'unicode'], ['kbModeBijoy', 'bijoy']].forEach(function (pair) {
        var b = $(pair[0]);
        if (b) b.setAttribute('aria-pressed', kbMode === pair[1] ? 'true' : 'false');
      });
      [['dispUnicode', 'unicode'], ['dispSutonny', 'sutonny']].forEach(function (pair) {
        var b = $(pair[0]);
        if (b) b.setAttribute('aria-pressed', displayMode === pair[1] ? 'true' : 'false');
      });
    }
    if (isBangla) {
      wireToggle('kbModeUnicode', 'unicode', kbMode, function () {
        kbMode = 'unicode';
        if (bijoyHandler) bijoyHandler.clearPending();
        try { localStorage.setItem('rtm-bangla-kb-mode', 'unicode'); } catch (e) {}
        rebuildKeyboard(); refreshToggles(); engine.render(); inputEl.focus();
      });
      wireToggle('kbModeBijoy', 'bijoy', kbMode, function () {
        kbMode = 'bijoy';
        try { localStorage.setItem('rtm-bangla-kb-mode', 'bijoy'); } catch (e) {}
        rebuildKeyboard(); refreshToggles(); engine.render(); inputEl.focus();
      });
      wireToggle('dispUnicode', 'unicode', displayMode, function () {
        displayMode = 'unicode';
        try { localStorage.setItem('rtm-bangla-display', 'unicode'); } catch (e) {}
        engine.setDisplayMode('unicode'); refreshToggles(); inputEl.focus();
      });
      wireToggle('dispSutonny', 'sutonny', displayMode, function () {
        displayMode = 'sutonny';
        try { localStorage.setItem('rtm-bangla-display', 'sutonny'); } catch (e) {}
        engine.setDisplayMode('sutonny'); refreshToggles(); inputEl.focus();
      });
      refreshToggles();
      if (displayMode === 'sutonny') engine.setDisplayMode('sutonny');
    }

    var currentPassage = '';
    function loadNewPassage() {
      var diff = difficultyEl ? difficultyEl.value : 'easy';
      var list = passages[diff] || passages.easy;
      currentPassage = pickPassage(list, currentPassage);
      inputEl.disabled = false;
      engine.setPassage(currentPassage);
      if (bijoyHandler) bijoyHandler.clearPending();
      if (statusEl) statusEl.textContent = 'Start typing in the box below. The timer starts on your first keystroke.';
      inputEl.focus();
    }
    on(difficultyEl, 'change', loadNewPassage);
    on(newBtn, 'click', loadNewPassage);
    on(restartBtn, 'click', function () {
      inputEl.disabled = false;
      engine.setPassage(currentPassage);
      if (bijoyHandler) bijoyHandler.clearPending();
      if (statusEl) statusEl.textContent = 'Restarted. Start typing when you are ready.';
      inputEl.focus();
    });

    setInterval(function () {
      if (engine.isStarted() && !engine.isFinished()) engine.render();
    }, 1000);

    loadNewPassage();
  })();

  /* ---------- Speed Test page: test.html (English only) ---------- */
  (function initTest() {
    var passageEl = $('testPassage');
    var inputEl = $('testInput');
    if (!passageEl || !inputEl) return;
    var timeEl = $('testTime');
    var difficultyEl = $('testDifficulty');
    var startBtn = $('startTestBtn');
    var againBtn = $('tryAgainBtn');
    var saveBtn = $('saveResultBtn');
    var countdownEl = $('countdown');
    var statusEl = $('testStatus');
    var resultsEl = $('resultsPanel');
    var keyboardEl = $('testKeyboard');

    if (keyboardEl) buildKeyboard(keyboardEl);

    var durationSec = 60;
    var remainingSec = 60;
    var timerId = null;
    var lastResult = null;
    var savedThisTest = false;

    var engine = createTypingEngine({
      passageEl: passageEl,
      inputEl: inputEl,
      keyboardEl: keyboardEl,
      testMode: true,
      unitLabel: 'characters',
      stats: {
        wpm: $('testWpm'), accuracy: $('testAccuracy'),
        mistakes: $('testMistakes'), time: $('testElapsed'),
        progress: $('testProgress'), progressBar: $('testProgressFill')
      },
      onFirstKey: function () {
        startCountdown();
        if (statusEl) statusEl.textContent = 'Test running — keep typing!';
      }
    });

    function loadTestPassage() {
      var diff = difficultyEl ? difficultyEl.value : 'medium';
      var list = ENGLISH_PASSAGES[diff] || ENGLISH_PASSAGES.medium;
      engine.setPassage(pickPassage(list, engine.getPassage()));
    }

    function stopCountdown() {
      if (timerId) { clearInterval(timerId); timerId = null; }
    }
    function startCountdown() {
      stopCountdown();
      timerId = setInterval(function () {
        remainingSec -= 1;
        if (countdownEl) {
          countdownEl.textContent = engine.formatTime(remainingSec);
          countdownEl.classList.toggle('urgent', remainingSec <= 10);
        }
        engine.render();
        if (remainingSec <= 0) finishTest();
      }, 1000);
    }

    function finishTest() {
      stopCountdown();
      var s = engine.finish();
      var typedText = engine.getTypedText().trim();
      var totalWords = typedText ? typedText.split(/\s+/).length : 0;
      lastResult = {
        date: new Date().toISOString(),
        mode: 'Speed Test',
        timeSeconds: durationSec,
        wpm: s.wpm,
        accuracy: s.accuracy,
        correct: s.correct,
        wrong: s.wrong,
        words: totalWords
      };
      savedThisTest = false;
      var setText = function (id, val) { var el = $(id); if (el) el.textContent = val; };
      setText('resultWpm', String(s.wpm));
      setText('resultAccuracy', s.accuracy + '%');
      setText('resultCorrect', String(s.correct));
      setText('resultWrong', String(s.wrong));
      setText('resultWords', String(totalWords));
      if (resultsEl) resultsEl.classList.add('show');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Result'; }
      var savedMsg = $('savedMsg');
      if (savedMsg) savedMsg.textContent = '';
      if (statusEl) statusEl.textContent = 'Time up! Your result is ready below. Save it to track your progress.';
      if (againBtn) againBtn.focus();
    }

    function armTest() {
      stopCountdown();
      durationSec = timeEl ? parseInt(timeEl.value, 10) : 60;
      remainingSec = durationSec;
      if (countdownEl) {
        countdownEl.textContent = engine.formatTime(remainingSec);
        countdownEl.classList.remove('urgent');
      }
      if (resultsEl) resultsEl.classList.remove('show');
      lastResult = null;
      savedThisTest = false;
      loadTestPassage();
      inputEl.disabled = false;
      engine.enable();
      inputEl.focus();
      if (statusEl) statusEl.textContent = 'Ready. Type the first character to start the ' + durationSec + '-second countdown.';
    }

    on(startBtn, 'click', armTest);
    on(againBtn, 'click', armTest);
    on(timeEl, 'change', armTest);
    on(difficultyEl, 'change', armTest);
    on(saveBtn, 'click', function () {
      if (!lastResult || savedThisTest) return;
      var ok = addResult(lastResult);
      var savedMsg = $('savedMsg');
      if (ok) {
        savedThisTest = true;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saved ✓';
        if (savedMsg) savedMsg.textContent = 'Saved! See it on the Progress page.';
      } else if (savedMsg) {
        savedMsg.textContent = 'Could not save — your browser storage may be full or blocked.';
      }
    });

    loadTestPassage();
    inputEl.disabled = true;
    if (countdownEl) countdownEl.textContent = engine.formatTime(60);
    if (statusEl) statusEl.textContent = 'Choose a time and difficulty, then click Start Test.';
  })();

  /* ---------- Progress page: progress.html ---------- */
  (function initProgress() {
    var totalEl = $('progTotal');
    if (!totalEl) return;
    var tbody = $('historyBody');
    var emptyEl = $('emptyState');
    var tableWrap = $('historyTableWrap');
    var clearBtn = $('clearHistoryBtn');

    function renderProgress() {
      var arr = loadResults();
      var s = bestStats();
      var setText = function (id, val) { var el = $(id); if (el) el.textContent = val; };
      setText('progBestWpm', arr.length ? String(s.bestWpm) : '0');
      setText('progBestAccuracy', arr.length ? s.bestAccuracy + '%' : '—');
      setText('progTotal', String(s.total));
      setText('progAvgWpm', arr.length ? String(s.avgWpm) : '0');

      if (!arr.length) {
        if (emptyEl) emptyEl.style.display = 'block';
        if (tableWrap) tableWrap.style.display = 'none';
        return;
      }
      if (emptyEl) emptyEl.style.display = 'none';
      if (tableWrap) tableWrap.style.display = 'block';
      if (tbody) {
        tbody.innerHTML = '';
        var sorted = arr.slice().reverse();
        sorted.forEach(function (r) {
          var tr = document.createElement('tr');
          var d = new Date(r.date);
          var dateText = isNaN(d.getTime()) ? String(r.date || '') : d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          var cells = [dateText, r.mode || 'Speed Test', (r.timeSeconds || 0) + 's', String(r.wpm), (r.accuracy || 0) + '%'];
          cells.forEach(function (c) {
            var td = document.createElement('td');
            td.textContent = c;
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
      }
    }

    on(clearBtn, 'click', function () {
      if (!loadResults().length) return;
      if (!window.confirm('Clear all saved test history? This cannot be undone.')) return;
      saveResults([]);
      renderProgress();
    });

    renderProgress();
  })();

})();
