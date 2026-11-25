# Reduan Typing Master

A complete typing learning & practice website — English and Bangla typing practice, timed speed tests with real WPM and accuracy, and progress tracking. Free, in the browser, no sign-up.

**Live website:** https://reduanworksite.github.io/reduan-typing-master/

> **Status: not yet live.** The site is built and verified locally. The live URL above is the intended GitHub Pages address (repo `reduan-typing-master` under `reduanworksite`); it will work once the project is published to GitHub Pages. Do not treat it as live until that publishing step is confirmed.

By Reduan Hossain, Reduan Computer — https://www.facebook.com/reduancomputer

## Features

- **English Typing Practice** — real passages, live character highlighting (correct = green, wrong = red), live WPM, accuracy, timer and mistake count; Easy / Medium / Hard difficulty changes passage length and vocabulary; New Passage and Restart buttons.
- **Bangla Typing Practice** — Bangla passages in Unicode (computers, Bangladesh, daily life), the same live WPM / accuracy / mistake highlighting, plus a Bangla alphabet reference for learners.
  - Bangla typing needs the user's own system Bangla keyboard (for example Avro / Unicode). This site does **not** install a keyboard and does **not** include a built-in Bangla keyboard layout.
- **Typing Speed Test** — 30 seconds / 1 minute / 2 minutes, difficulty selector, Start button; the countdown starts on the **first keystroke**, finishes automatically at time-up; results panel shows WPM, accuracy %, correct characters, wrong characters and total words typed.
- **Save Result** — on the Speed Test page only, stores the result in the browser (`localStorage`, key `reduan-typing-results`). Practice sessions are never saved automatically.
- **Performance Report / Progress Tracking** — best WPM, best accuracy, total tests and average WPM, plus a table of recent test history (date, mode, time, WPM, accuracy) and a Clear History button, with a friendly empty state when nothing is saved yet.
- **On-screen keyboard** — QWERTY row layout that highlights the next key to press (English letters and Space; Bangla characters have no QWERTY key, so no key is highlighted for them).
- **Home page best-stats summary** — best WPM, best accuracy, total tests and average WPM, read from saved results; shows 0 / — when empty.

## Pages

- [Home](index.html) — hero, how it works, practice mode cards, best-stats summary
- [English Typing Practice](english.html)
- [Bangla Typing Practice](bangla.html)
- [Typing Speed Test](test.html)
- [Progress & Performance Report](progress.html)

Every page has the same header navigation linking to all five pages, and the same footer. All internal links are relative, so every page has a real direct URL and a browser refresh never 404s on a static host.

## How scoring works (exact rule)

- The score is always computed from the **current** text in the typing box, compared character by character with the passage.
- `correct` = characters that match the passage at the same position.
- `wrong` = characters that do not match at the same position (including characters typed past the end of the passage).
- `accuracy = correct / (correct + wrong) × 100`
- `WPM = (correct characters / 5) / minutes elapsed`
- **Backspace rule:** if you press Backspace and fix a wrong character, that mistake disappears from the count. It is **not** counted twice, and it is not kept forever. The score reflects what is on screen now. This is deliberate.
- On the Speed Test, the timer counts down from the selected time and the result is taken when time runs out. WPM uses the elapsed time of the test.

## How to run locally

No build step, no server framework needed. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000

## Tech used

- Pure HTML + CSS + JavaScript — no framework, no build step, no external JS libraries
- Google Fonts (Inter + Sora, plus Noto Sans Bengali on the Bangla page) with system-font fallbacks, so the site still looks good if the fonts fail to load
- `localStorage` for saved test results only — nothing is sent to any server

## Project structure

```
index.html      Home
english.html    English Typing Practice
bangla.html     Bangla Typing Practice
test.html       Typing Speed Test
progress.html   Performance Report / Progress Tracking
style.css       Shared stylesheet
script.js       Shared JavaScript (typing engine, timer, storage, keyboard)
README.md       This file
```

## Contact

- Email: reduan.digital@gmail.com
- Reduan Computer: https://www.facebook.com/reduancomputer
