/* Reduan Typing Master — shared JavaScript (no libraries).
 *
 * Typing rules (also documented in README.md):
 * - The score is always computed from the CURRENT text in the typing box,
 *   compared character by character with the passage.
 * - correct = characters that match the passage at the same position.
 * - wrong = characters that do NOT match at the same position.
 * - accuracy = correct / (correct + wrong) * 100 (100% when nothing typed yet
 *   is shown as — / 100% only after typing starts; see updateStats).
 * - If you press Backspace and fix a wrong character, that mistake disappears
 *   from the count: it is NOT counted twice, and it is not kept forever.
 *   This is deliberate — the score reflects what is on screen now.
 * - WPM = (correct characters / 5) / minutes elapsed.
 *   minutes = elapsed seconds / 60. WPM is 0 until at least 1 second passes.
 * - Results are saved only when the user clicks "Save Result" on the
 *   Speed Test page. Practice pages never save automatically.
 */

(function () {
  'use strict';

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
  // Active nav: match the current file name.
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
    // Keep the newest 100 results so storage never grows without bound.
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
    if (!totalEl) return; // not the home page
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

  var BANGLA_PASSAGES = {
    easy: [
      'আমি প্রতিদিন কম্পিউটার শিখি। কম্পিউটার আমাদের জীবনকে সহজ করে। আমি বাংলা টাইপ করতে শিখছি।',
      'বাংলাদেশ আমার দেশ। আমি বাংলায় কথা বলি। আমার বাড়ির পাশে একটি স্কুল আছে। আমি সেখানে পড়ি।',
      'সকালে আমি ভাত খাই। তারপর স্কুলে যাই। শিক্ষক আমাকে পড়া শেখান। আমি মন দিয়ে পড়ি।'
    ],
    medium: [
      'কম্পিউটার শেখা এখন খুব দরকারি। আমরা কম্পিউটারে লিখতে পারি, ছবি আঁকতে পারি, আর ইন্টারনেটে পড়তে পারি। প্রতিদিন একটু একটু করে চর্চা করলে টাইপ করা সহজ হয়ে যায়।',
      'বাংলাদেশের মানুষ খুব পরিশ্রমী। তারা মাঠে কাজ করে, নদীতে মাছ ধরে, আর শহরে নানা কাজ করে। আমাদের দেশের ভাষা বাংলা, আর আমরা এই ভাষাকে খুব ভালোবাসি।',
      'ইন্টারনেট আমাদের অনেক কিছু শেখায়। আমরা ইমেইল পাঠাতে পারি, খবর পড়তে পারি, আর অনলাইনে ক্লাস করতে পারি। তবে ইন্টারনেট ব্যবহার করার সময় সাবধানে থাকতে হবে।'
    ],
    hard: [
      'ভালো টাইপিস্ট হতে হলে শুধু দ্রুত লেখা নয়, সঠিকভাবে লেখা শিখতে হয়। ভুল বেশি হলে সময় নষ্ট হয়। তাই ধীরে ধীরে সঠিক কী চাপা শিখুন, প্রতিদিন অল্প সময় চর্চা করুন, আর ধৈর্য ধরে এগিয়ে যান।',
      'কম্পিউটার শিক্ষা এখন প্রতিটি ছাত্রের জন্য জরুরি। মাইক্রোসফট ওয়ার্ডে চিঠি লেখা, এক্সেলে হিসাব রাখা, আর পাওয়ারপয়েন্টে উপস্থাপনা তৈরি করা — এই দক্ষতাগুলো চাকরি আর পড়াশোনায় অনেক কাজে লাগে।'
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
  function highlightNextKey(container, nextChar) {
    if (!container) return;
    container.querySelectorAll('.key').forEach(function (k) { k.classList.remove('next'); });
    if (nextChar === undefined || nextChar === null) return;
    var target = nextChar.toLowerCase();
    // Bangla and other non-QWERTY characters have no key on this board.
    var key = container.querySelector('[data-key="' + target + '"]');
    if (key) key.classList.add('next');
  }

  /* ---------- Typing engine (shared by practice + test) ---------- */
  function createTypingEngine(opts) {
    var passageEl = opts.passageEl;
    var inputEl = opts.inputEl;
    var stats = opts.stats || {};
    var onFirstKey = opts.onFirstKey || function () {};
    var onComplete = opts.onComplete || function () {};
    var onInput = opts.onInput || function () {};
    var testMode = !!opts.testMode;

    var targetChars = [];
    var passageText = '';
    var started = false;
    var startTime = 0;
    var finished = false;

    function setPassage(text) {
      passageText = text;
      targetChars = Array.from(text);
      passageEl.innerHTML = '';
      targetChars.forEach(function (ch) {
        var span = document.createElement('span');
        span.className = 'ch' + (ch === ' ' ? ' space-ch' : '');
        span.textContent = ch === ' ' ? '\u00a0' : ch;
        passageEl.appendChild(span);
      });
      reset();
    }

    function currentTyped() { return Array.from(inputEl.value); }

    function compute() {
      var typed = currentTyped();
      var correct = 0, wrong = 0;
      for (var i = 0; i < typed.length && i < targetChars.length; i++) {
        if (typed[i] === targetChars[i]) correct++; else wrong++;
      }
      // Characters typed beyond the passage length count as wrong.
      if (typed.length > targetChars.length) wrong += typed.length - targetChars.length;
      var elapsedSec = started ? (Date.now() - startTime) / 1000 : 0;
      var minutes = elapsedSec / 60;
      var wpm = minutes > 0 ? Math.round((correct / 5) / minutes) : 0;
      var total = correct + wrong;
      var accuracy = total > 0 ? Math.round((correct / total) * 100) : 100;
      return {
        typed: typed.length, correct: correct, wrong: wrong,
        elapsedSec: elapsedSec, wpm: wpm, accuracy: accuracy,
        totalChars: targetChars.length
      };
    }

    function render() {
      var typed = currentTyped();
      var spans = passageEl.querySelectorAll('.ch');
      spans.forEach(function (span, i) {
        span.classList.remove('correct', 'wrong', 'current', 'space-wrong');
        if (i < typed.length) {
          if (typed[i] === targetChars[i]) {
            span.classList.add('correct');
          } else {
            span.classList.add('wrong');
            if (targetChars[i] === ' ') span.classList.add('space-wrong');
          }
        } else if (i === typed.length && !finished) {
          span.classList.add('current');
        }
      });
      var s = compute();
      if (stats.wpm) stats.wpm.textContent = String(s.wpm);
      if (stats.accuracy) stats.accuracy.textContent = typed.length ? s.accuracy + '%' : '—';
      if (stats.mistakes) stats.mistakes.textContent = String(s.wrong);
      if (stats.time) stats.time.textContent = formatTime(s.elapsedSec);
      if (stats.progress) stats.progress.textContent = Math.min(typed.length, targetChars.length) + ' / ' + targetChars.length + ' characters';
      if (stats.progressBar) stats.progressBar.style.width = targetChars.length ? Math.min(100, (typed.length / targetChars.length) * 100) + '%' : '0%';
      if (opts.keyboardEl) {
        var next = finished ? null : targetChars[Math.min(typed.length, targetChars.length - 1)];
        // When the passage is complete there is no next key.
        if (typed.length >= targetChars.length) next = null;
        highlightNextKey(opts.keyboardEl, next);
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
      // Prevent typing far beyond the passage: trim extra input.
      if (Array.from(inputEl.value).length > targetChars.length + 20) {
        inputEl.value = Array.from(inputEl.value).slice(0, targetChars.length + 20).join('');
      }
      if (!started && inputEl.value.length > 0) {
        started = true;
        startTime = Date.now();
        onFirstKey();
      }
      var s = render();
      if (testMode) return; // the test page handles finishing by timer
      if (Array.from(inputEl.value).length >= targetChars.length) {
        finished = true;
        inputEl.disabled = true;
        onComplete(s);
      }
    }

    inputEl.addEventListener('input', handleInput);
    // Clicking the passage focuses the typing box — a common learner habit.
    passageEl.addEventListener('click', function () { inputEl.focus(); });

    return {
      setPassage: setPassage,
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

  /* ---------- Practice pages: english.html / bangla.html ---------- */
  (function initPractice() {
    var passageEl = $('passage');
    var inputEl = $('typingInput');
    var modeEl = $('practiceMode');
    if (!passageEl || !inputEl || !modeEl) return; // not a practice page
    var mode = modeEl.value; // 'english' or 'bangla'
    var isBangla = mode === 'bangla';
    var passages = isBangla ? BANGLA_PASSAGES : ENGLISH_PASSAGES;
    var difficultyEl = $('difficulty');
    var newBtn = $('newPassageBtn');
    var restartBtn = $('restartBtn');
    var statusEl = $('statusLine');
    var keyboardEl = $('keyboard');

    if (keyboardEl) buildKeyboard(keyboardEl);

    var engine = createTypingEngine({
      passageEl: passageEl,
      inputEl: inputEl,
      keyboardEl: keyboardEl,
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

    var currentPassage = '';
    function loadNewPassage() {
      var diff = difficultyEl ? difficultyEl.value : 'easy';
      var list = passages[diff] || passages.easy;
      currentPassage = pickPassage(list, currentPassage);
      inputEl.disabled = false;
      engine.setPassage(currentPassage);
      if (statusEl) statusEl.textContent = 'Start typing in the box below. The timer starts on your first keystroke.';
      inputEl.focus();
    }
    on(difficultyEl, 'change', loadNewPassage);
    on(newBtn, 'click', loadNewPassage);
    on(restartBtn, 'click', function () {
      inputEl.disabled = false;
      engine.setPassage(currentPassage);
      if (statusEl) statusEl.textContent = 'Restarted. Start typing when you are ready.';
      inputEl.focus();
    });

    // A ticking clock for practice pages: update the time display each second
    // once typing has started, so WPM keeps moving even between keystrokes.
    setInterval(function () {
      if (engine.isStarted() && !engine.isFinished()) engine.render();
    }, 1000);

    loadNewPassage();
  })();

  /* ---------- Speed Test page: test.html ---------- */
  (function initTest() {
    var passageEl = $('testPassage');
    var inputEl = $('testInput');
    if (!passageEl || !inputEl) return; // not the test page
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
      stats: {
        wpm: $('testWpm'), accuracy: $('testAccuracy'),
        mistakes: $('testMistakes'), time: $('testElapsed'),
        progress: $('testProgress'), progressBar: $('testProgressFill')
      },
      onFirstKey: function () {
        // The countdown starts on the first keystroke, not on Start.
        startCountdown();
        if (statusEl) statusEl.textContent = 'Test running — keep typing!';
      }
    });

    function loadTestPassage() {
      var diff = difficultyEl ? difficultyEl.value : 'medium';
      // Test passages are English only; Bangla practice is on bangla.html.
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
        // Keep live stats moving each second.
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

    // Initial state: passage shown, typing disabled until Start.
    loadTestPassage();
    inputEl.disabled = true;
    if (countdownEl) countdownEl.textContent = engine.formatTime(60);
    if (statusEl) statusEl.textContent = 'Choose a time and difficulty, then click Start Test.';
  })();

  /* ---------- Progress page: progress.html ---------- */
  (function initProgress() {
    var totalEl = $('progTotal');
    if (!totalEl) return; // not the progress page
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
        // Newest first.
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
