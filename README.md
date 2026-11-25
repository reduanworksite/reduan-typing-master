# Reduan Typing Master — Version 2

A complete typing learning & practice website — English and Bangla typing practice, timed speed tests with real WPM and accuracy, and progress tracking. Free, in the browser, no sign-up.

**Live website:** https://reduanworksite.github.io/reduan-typing-master/

> **Status: version 2 built locally — will be republished, not yet live with v2.** The live URL above currently serves version 1. Version 2 (below) is built and verified locally in this repository's files; it goes live when the updated files are published to GitHub Pages. Do not treat v2 as live until that publishing step is confirmed.

By Reduan Hossain, Reduan Computer — https://www.facebook.com/reduancomputer

## What was broken in v1 — and what v2 fixes

| # | v1 problem | v2 fix |
|---|---|---|
| 1 | Bangla passages were split by Unicode **code point** (`Array.from`), so conjuncts (ক্ষ, স্ত) and letter+kar (কি, কে) broke into separate tiny spans and scored as separate units. | Passages and typed text are now split into **grapheme clusters** (`Intl.Segmenter('bn', {granularity:'grapheme'})`, with a manual fallback). A conjunct or letter+kar is ONE span, ONE typing unit, ONE scoring unit. Verified in Node: `ক্ষতি → [ক্ষ, তি]`, `বাংলাদেশ → [বাং, লা, দে, শ]`, `শিক্ষা → [শি, ক্ষা]` — no vowel sign or hasant appears as a standalone unit. |
| 2 | Bangla font was only Noto Sans Bengali at 1.25rem (1.1rem mobile) — too small for conjuncts. | **Hind Siliguri** (400/500/600/700) added from Google Fonts; Bangla font stack is `'Hind Siliguri','Noto Sans Bengali',sans-serif`. Bangla passage is 1.6rem / line-height 2.3 (mobile 1.35rem / 2.2), typing box 1.4rem / 2, alphabet cells 1.6rem. |
| 3 | No Bijoy keyboard at all — the page even said "no Bijoy layout is built in". | A **Bijoy (Bijoy Bayanno) keyboard mode** is built in: a key mapper (see below) plus a clickable on-screen Bijoy keyboard. Default mode stays Unicode. |
| 4 | No SutonnyMJ support. | A **SutonnyMJ display mode** is added (see below). SutonnyMJ itself is **not** embedded — it is used only when installed on the user's device. |
| 5 | English (and Bangla) text could overflow its box — `.passage` had no wrap/overflow guards. | `.passage`, `.typing-input`, `.container`, `.section`, `.card`, `.keyboard` now have `max-width:100%`, `overflow-wrap:break-word`, `word-break:break-word`, `overflow-x:hidden`; passage and input sit together in one `.typing-card`. Long sentences wrap to the next line on desktop and mobile. |
| 6 | Passages used decomposed nukta forms (ড+় for ড়, য+় for য়), which do **not** match what most Bangla keyboards type (precomposed ড়/য়) — so a correctly typed ড় could be marked wrong. | All Bangla passages were normalised to precomposed letters (ড় U+09DC, ঢ় U+09DD, য় U+09DF) — 31 occurrences fixed. The visible text is unchanged. The converter also handles nukta forms as a fallback. |
| 7 | Passage audit | All Bangla passages audited: exactly one normal space between words, never a space inside a word, conjunct or kar. |

## Features

- **English Typing Practice** — real passages, live character highlighting (correct = green, wrong = red), live WPM, accuracy, timer and mistake count; Easy / Medium / Hard; New Passage and Restart buttons. Text wraps inside the box on desktop and mobile.
- **Bangla Typing Practice** — Bangla passages in Unicode, the same live WPM / accuracy / mistake highlighting **per grapheme**, a conjunct demo strip ("যুক্তবর্ণ ঠিক আছে?" — ক্ষ স্ত ন্ত জ্ঞ হ্ম স্ক), plus a Bangla alphabet reference.
  - **Keyboard modes:** [Unicode] (default — your own system Bangla keyboard, e.g. Avro) / [Bijoy] (built-in Bijoy Bayanno layout, see below). The choice is remembered on your device.
  - **Display modes:** [Unicode (Hind Siliguri)] (default) / [Bijoy (SutonnyMJ) Display] (see below).
- **Typing Speed Test** — English only, 30 seconds / 1 minute / 2 minutes, difficulty selector; the countdown starts on the **first keystroke**, finishes automatically; results panel (WPM, accuracy %, correct, wrong, total words) and Save Result.
- **Save Result / Progress Tracking** — best WPM, best accuracy, total tests, average WPM, recent-history table, Clear History, empty state. Stored in the browser only (`localStorage`, key `reduan-typing-results`).
- **On-screen keyboards** — QWERTY for English, Bijoy board for Bangla Bijoy mode; both highlight the next key to press.

## Bijoy keyboard — how it works

Layout source: LearnType "Bijoy Keyboard Layout" guide (Bijoy Bayanno), cross-checked against the Bijoy 52 conjunct key sequences. Standard mapping (lowercase → letter, Shift → second letter):

| Key | Letter | Shift | Key | Letter | Shift |
|---|---|---|---|---|---|
| Q | ঙ | ং | A | ৃ | র্ (reph) |
| W | য | য় | S | ু | ূ |
| E | ড | ঢ | D | ি | ী |
| R | প | ফ | F | া | অ |
| T | ট | ঠ | G | ্ (hasant) | । |
| Y | চ | ছ | H | ব | ভ |
| U | জ | ঝ | J | ক | খ |
| I | হ | ঞ | K | ত | থ |
| O | গ | ঘ | L | দ | ধ |
| P | ড় | ঢ় | Z | ্র | ্য |
| X | ও | ৗ | C | ে | ৈ |
| V | র | ল | B | ন | ণ |
| N | স | ষ | M | ম | শ |
| \\ | ৎ | ঃ | Shift+7 | ঁ (chandrabindu) | |

Typing rules in Bijoy mode:
- **Pre-base kars** (ি, ী, ে, ৈ) are typed **before** the consonant, as in Bijoy: `d` then `j` → কি, `c` then `j` → কে. The site buffers the kar and inserts it after the consonant in Unicode order, so scoring still matches the passage. A small "অপেক্ষমাণ কার" indicator shows a buffered kar.
- **ো / ৌ:** `c` + consonant + `f` → কো; Shift+C + consonant + Shift+X → কৌ.
- **Conjuncts:** consonant + `g` (hasant) + consonant, e.g. `j` `g` `k` → ক্ত, `j` `g` Shift+N → ক্ষ.
- **Full vowels:** `g` + kar key — `g` `f` → আ, `g` `d` → ই, `g` `c` → এ; অ = Shift+F, ও = `x`.
- **Reph:** Shift+A inserts র্ — type it **before** the consonant it modifies (Unicode order), e.g. `j` Shift+A `m` → কর্ম.
- The on-screen Bijoy keyboard is clickable (Shift is one-shot for clicks). Backspace, arrows, Ctrl shortcuts and digits pass through normally.

## SutonnyMJ display — how it works and its limits

- SutonnyMJ is a **commercial Bijoy ANSI font**. It is **not** embedded in this project and no font file is included. In SutonnyMJ display mode the passage is shown as Bijoy ANSI codes (e.g. `আমি` → `Avwg`), and the font stack is `'SutonnyMJ','Hind Siliguri',...` — so it renders as Bangla **only if SutonnyMJ is installed on the user's device**. Without it, Hind Siliguri is used and the ANSI codes show as Latin-looking characters. That is expected and labelled on the page.
- The converter (Unicode → Bijoy ANSI, display only) reorders pre-base kars (ি/ে/ৈ) before their consonant, splits ো/ৌ around the consonant (‡ before, v/Š after), and moves reph (র্) after the consonant it sits on. **Scoring always stays in Unicode underneath** — the ANSI text is only what you see.
- **Converter coverage (verified against published examples):** all 11 independent vowels, all 36 consonants, kars (া ি ী ু ূ ৃ ে ো ৌ), marks (ং ঃ ঁ ্), ra-phala (Ö), ya-phala (¨), reph (©), Bangla digits, দাঁড়ি (। → |), em/en-dash (→ -), and these conjuncts as single codes: ক্ষ ¶, জ্ঞ Á, ঞ্চ Â, ঞ্জ Ä, ঙ্ক ¼, ঙ্গ ½, ষ্ঠ ô, ষ্ণ ò, ণ্ড Ê, ণ্ট È, দ্ধ ×, ন্ত্র š¿, হ্ম þ, হ্ন ý, ক্ক °, ক্ট ±, ক্ত ³, ন্ত š. Verified test vectors (all pass): আমি→Avwg, কে→‡K, কো→‡Kv, ধর্ম→ag©, প্রকাশ→cÖKvk, ক্ষমা→¶gv, বাংলা→evsjv, কর্ম→Kg©, বাংলাদেশ→evsjv‡`k, আমার সোনার বাংলা→Avgvi ‡mvbvi evsjv. No passage produces an uncovered character.
- **Not covered / fallback:** any other conjunct (e.g. স্ত, স্ক, ষ্ট) is converted per-character (consonant + `&` + consonant), which shows as separate glyphs in SutonnyMJ rather than one joined glyph — documented, not hidden.
- **Unverified — please check:** (1) `ৈ` maps to `‡` (the same slot as `ে`) — I could not independently confirm a separate slot for it; (2) `ৃ` maps to `{` (inferred from the chart's ASCII sequence); (3) `্র` maps to `Ö` (two full-word examples) while the BanglaTools chart lists `«` for the same — Ö is used, and the discrepancy is noted here; (4) হ্ম has a variant code `ÿ` in one source vs `þ` used here.

## Pages

- [Home](index.html) — hero, how it works, practice mode cards, best-stats summary
- [English Typing Practice](english.html)
- [Bangla Typing Practice](bangla.html) — Unicode/Bijoy keyboard toggle, Unicode/SutonnyMJ display toggle, conjunct demo strip
- [Typing Speed Test](test.html) — English only (Bangla practice is on bangla.html)
- [Progress & Performance Report](progress.html)

Every page has the same header navigation linking to all five pages, and the same footer. All internal links are relative, so every page has a real direct URL and a browser refresh never 404s on a static host.

## How scoring works (exact rule, v2)

- The score is always computed from the **current** text in the typing box, compared **grapheme by grapheme** with the passage.
- `correct` = graphemes that match the passage at the same position.
- `wrong` = graphemes that do not match at the same position (including graphemes typed past the end of the passage).
- `accuracy = correct / (correct + wrong) × 100`
- `WPM = (correct graphemes / 5) / minutes elapsed`
- **Backspace rule:** if you press Backspace and fix a wrong grapheme, that mistake disappears from the count. It is **not** counted twice, and it is not kept forever. The score reflects what is on screen now. This is deliberate.
- On the Speed Test, the timer counts down from the selected time and the result is taken when time runs out. WPM uses the elapsed time of the test.

## How to test (Bangla conjunct checklist)

1. Open `bangla.html`. The demo strip must show ক্ষ স্ত ন্ত জ্ঞ হ্ম স্ক as six joined glyphs, not broken letters.
2. Type the first easy passage in **Unicode** mode with a Bangla keyboard: conjuncts (e.g. ক্ষ in "শিক্ষা") must turn green as ONE unit.
3. Switch to **Bijoy** mode: type `d` then `j` — কি must appear and score correct. Type `j` `g` Shift+N — ক্ষ must appear. Type `c` `j` `f` — কো must appear.
4. Switch display to **SutonnyMJ**: with SutonnyMJ installed the passage must read as Bangla; without it, Latin-looking codes show (expected — Hind Siliguri is the fallback).
5. Open `english.html` on a phone-width window (360px): long sentences must wrap inside the box — no horizontal overflow, no text outside the card.
6. Node checks (for developers): `node --check script.js`, and the pure-helper test in `script.js` (segment `ক্ষতি` / `বাংলাদেশ`, convert `আমি` → `Avwg`, etc.).

## How to run locally

No build step, no server framework needed. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000

## Tech used

- Pure HTML + CSS + JavaScript — no framework, no build step, no external JS libraries
- Google Fonts (Inter + Sora, Hind Siliguri + Noto Sans Bengali on the Bangla page) with system-font fallbacks
- `Intl.Segmenter` (grapheme granularity) with a manual fallback for older browsers
- `localStorage` for saved test results and mode choices only — nothing is sent to any server

## Project structure

```
index.html      Home
english.html    English Typing Practice
bangla.html     Bangla Typing Practice (Unicode/Bijoy keyboard, SutonnyMJ display)
test.html       Typing Speed Test (English only)
progress.html   Performance Report / Progress Tracking
style.css       Shared stylesheet (v2: Bangla typography, overflow guards)
script.js       Shared JavaScript (grapheme engine, Bijoy mapper, ANSI converter)
README.md       This file
```

## Contact

- Email: reduan.digital@gmail.com
- Reduan Computer: https://www.facebook.com/reduancomputer
