/* ============================================================
   A little surprise · interactions
   Vanilla JS — no dependencies, no network calls at runtime.
   ============================================================ */

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    intro: $('intro'),
    reveal: $('reveal'),
    final: $('final'),
    openBtn: $('openBtn'),
    phraseWrap: $('phraseWrap'),
    heartBtn: $('heartBtn'),
    secretBtn: $('secretBtn'),
    secretCard: $('secretCard'),
    finalBtn: $('finalBtn'),
    replayBtn: $('replayBtn'),
    rose: $('rose'),
    soundToggle: $('soundToggle'),
    heartLayer: $('heartLayer'),
    canvas: $('scene')
  };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ---------------------------------------------------------
     Canvas: dust, sparkles, floating hearts, rose petals
     --------------------------------------------------------- */

  const ctx = el.canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  let dust = [], sparks = [], floatHearts = [], petals = [], rainHearts = [];
  let raf = 0, lastTime = 0;
  let parallaxX = 0, parallaxY = 0;
  let rainTimer = 0, buttonTimer = 0, rainSpawned = 0;

  function seedParticles() {
    const light = reduced || W < 620;
    const n = {
      dust: light ? 34 : 76,
      sparks: light ? 8 : 15,
      hearts: light ? 4 : 9,
      petals: light ? 6 : 13
    };

    dust = Array.from({ length: n.dust }, () => ({
      x: rand(0, W), y: rand(0, H),
      r: rand(0.5, 1.9),
      vx: rand(-0.06, 0.06), vy: rand(-0.14, -0.02),
      phase: rand(0, Math.PI * 2), speed: rand(0.6, 1.7),
      color: pick(['255,220,205', '255,180,200', '244,201,148'])
    }));

    sparks = Array.from({ length: n.sparks }, () => ({
      x: rand(0, W), y: rand(0, H),
      size: rand(1.6, 3.6),
      phase: rand(0, Math.PI * 2), speed: rand(0.7, 1.8),
      rot: rand(0, Math.PI)
    }));

    floatHearts = Array.from({ length: n.hearts }, () => ({
      x: rand(0, W), y: rand(0, H),
      size: rand(7, 15),
      vy: rand(-0.16, -0.05),
      sway: rand(0.2, 0.6), phase: rand(0, Math.PI * 2),
      alpha: rand(0.1, 0.28),
      color: pick(['#ff9db4', '#f5b8c6', '#f4c994'])
    }));

    petals = Array.from({ length: n.petals }, () => ({
      x: rand(0, W), y: rand(-H * 0.2, H),
      size: rand(5, 11),
      vy: rand(0.14, 0.42), vx: rand(-0.12, 0.12),
      rot: rand(0, Math.PI * 2), vr: rand(-0.008, 0.008),
      sway: rand(0.3, 0.9), phase: rand(0, Math.PI * 2),
      alpha: rand(0.22, 0.55),
      color: pick(['rgba(238,140,166,', 'rgba(255,186,180,', 'rgba(206,106,143,'])
    }));
  }

  function resizeCanvas() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    el.canvas.width = Math.floor(W * DPR);
    el.canvas.height = Math.floor(H * DPR);
    el.canvas.style.width = W + 'px';
    el.canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seedParticles();
  }

  function drawHeartPath(size) {
    ctx.beginPath();
    ctx.moveTo(0, size * 0.32);
    ctx.bezierCurveTo(-size * 0.62, -size * 0.08, -size * 0.36, -size * 0.56, 0, -size * 0.24);
    ctx.bezierCurveTo(size * 0.36, -size * 0.56, size * 0.62, -size * 0.08, 0, size * 0.32);
    ctx.closePath();
  }

  function drawSparkle(x, y, size, rotation, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = '#ffe9d2';
    ctx.beginPath();
    ctx.moveTo(0, -size * 2.1);
    ctx.quadraticCurveTo(size * 0.16, -size * 0.16, size * 2.1, 0);
    ctx.quadraticCurveTo(size * 0.16, size * 0.16, 0, size * 2.1);
    ctx.quadraticCurveTo(-size * 0.16, size * 0.16, -size * 2.1, 0);
    ctx.quadraticCurveTo(-size * 0.16, -size * 0.16, 0, -size * 2.1);
    ctx.fill();
    ctx.restore();
  }

  function drawPetal(p) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.translate(p.x + Math.sin(p.phase) * p.sway * 12, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color + '1)';
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.bezierCurveTo(p.size * 0.9, -p.size * 0.55, p.size * 0.62, p.size * 0.82, 0, p.size);
    ctx.bezierCurveTo(-p.size * 0.62, p.size * 0.82, -p.size * 0.9, -p.size * 0.55, 0, -p.size);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,232,225,0.25)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();
  }

  function render(now) {
    const dt = clamp((now - lastTime) / 16.67, 0, 3);
    lastTime = now;
    const t = now / 1000;
    ctx.clearRect(0, 0, W, H);

    // soft parallax for depth
    const ox = parallaxX * 0.14, oy = parallaxY * 0.14;

    for (const p of dust) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y < -8) { p.y = H + 8; p.x = rand(0, W); }
      if (p.x < -8) p.x = W + 8;
      if (p.x > W + 8) p.x = -8;
      const a = 0.18 + 0.42 * (0.5 + 0.5 * Math.sin(t * p.speed + p.phase));
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(' + p.color + ',1)';
      ctx.beginPath();
      ctx.arc(p.x + ox, p.y + oy, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const s of sparks) {
      drawSparkle(s.x + ox * 1.6, s.y + oy * 1.6, s.size, s.rot + t * 0.15, 0.2 + 0.5 * Math.abs(Math.sin(t * s.speed + s.phase)));
    }

    for (const h of floatHearts) {
      h.y += h.vy * dt;
      h.phase += 0.012 * dt;
      if (h.y < -30) { h.y = H + 30; h.x = rand(0, W); }
      ctx.save();
      ctx.globalAlpha = h.alpha * (0.7 + 0.3 * Math.sin(h.phase * 2));
      ctx.translate(h.x + Math.sin(h.phase) * h.sway * 30 + ox * 2, h.y + oy * 2);
      ctx.fillStyle = h.color;
      drawHeartPath(h.size);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    for (const p of petals) {
      p.y += p.vy * dt;
      p.x += (p.vx + Math.sin(p.phase) * 0.16) * dt;
      p.phase += 0.014 * dt;
      p.rot += p.vr * dt;
      if (p.y > H + 24) { p.y = rand(-120, -10); p.x = rand(0, W); }
      if (p.x < -30) p.x = W + 20;
      if (p.x > W + 30) p.x = -20;
      drawPetal(p);
    }
    ctx.globalAlpha = 1;

    // Heart rain — drawn on the same canvas so it stays smooth on phones.
    for (let i = rainHearts.length - 1; i >= 0; i--) {
      const h = rainHearts[i];
      h.y += h.vy * dt;
      h.x += (h.vx + Math.sin(h.phase) * h.sway) * dt;
      h.phase += 0.028 * dt;
      h.rot += h.vr * dt;
      if (h.y > H + h.size * 2) { rainHearts.splice(i, 1); continue; }
      const fade = clamp((h.y + h.size * 2) / 70, 0, 1) * clamp((H + h.size - h.y) / 110, 0, 1);
      ctx.save();
      ctx.globalAlpha = h.alpha * fade;
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.fillStyle = h.glow;
      drawHeartPath(h.size * 1.6);
      ctx.fill();
      ctx.fillStyle = h.color;
      drawHeartPath(h.size);
      ctx.fill();
      ctx.globalAlpha = h.alpha * fade * 0.55;
      ctx.fillStyle = '#fff2ec';
      ctx.beginPath();
      ctx.ellipse(-h.size * 0.24, -h.size * 0.18, h.size * 0.13, h.size * 0.08, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    raf = requestAnimationFrame(render);
  }

  function startCanvas() {
    if (!raf) { lastTime = performance.now(); raf = requestAnimationFrame(render); }
  }
  function stopCanvas() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvas, 150);
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopCanvas();
      clearTimeout(rainTimer);
      rainTimer = 0;
    } else {
      startCanvas();
    }
  });

  window.addEventListener('pointermove', (e) => {
    const nx = (e.clientX / W - 0.5) * 2;
    const ny = (e.clientY / H - 0.5) * 2;
    parallaxX = nx * 12;
    parallaxY = ny * 12;
    document.documentElement.style.setProperty('--px', (-nx * 6).toFixed(1));
    document.documentElement.style.setProperty('--py', (-ny * 6).toFixed(1));
  }, { passive: true });

  /* ---------------------------------------------------------
     DOM hearts
     --------------------------------------------------------- */

  const HEART_COLORS = ['#ff91ac', '#ffb3c4', '#f4c994', '#ff7fa6', '#ffd1d8'];

  function trimHearts() {
    while (el.heartLayer.childElementCount > 120) {
      el.heartLayer.removeChild(el.heartLayer.firstElementChild);
    }
  }

  function spawnTapHeart(x, y) {
    if (document.hidden) return;
    const heart = document.createElement('span');
    heart.className = 'tap-heart';
    heart.textContent = '♥';
    heart.style.setProperty('--x', x + 'px');
    heart.style.setProperty('--y', y + 'px');
    heart.style.setProperty('--dx', rand(-40, 40).toFixed(0) + 'px');
    heart.style.setProperty('--dy', rand(-150, -85).toFixed(0) + 'px');
    heart.style.setProperty('--rot', rand(-35, 35).toFixed(0) + 'deg');
    heart.style.setProperty('--size', rand(20, 34).toFixed(0) + 'px');
    heart.style.setProperty('--dur', rand(1.4, 2.1).toFixed(2) + 's');
    heart.style.setProperty('--heart-color', pick(HEART_COLORS));
    heart.addEventListener('animationend', () => heart.remove(), { once: true });
    el.heartLayer.appendChild(heart);
    trimHearts();
    registerInteraction();
  }

  function spawnBurst(count, x, y) {
    if (document.hidden) return;
    const spread = Math.min(W, H) * 0.5;
    for (let i = 0; i < count; i++) {
      const heart = document.createElement('span');
      heart.className = 'burst-heart';
      heart.textContent = i % 7 === 0 ? '♥' : '❤';
      const angle = -Math.PI / 2 + rand(-1.28, 1.28);
      const distance = rand(60, spread);
      heart.style.setProperty('--x', x + 'px');
      heart.style.setProperty('--y', y + 'px');
      heart.style.setProperty('--dx', (Math.cos(angle) * distance).toFixed(0) + 'px');
      heart.style.setProperty('--dy', (Math.sin(angle) * distance).toFixed(0) + 'px');
      heart.style.setProperty('--rot', rand(-90, 90).toFixed(0) + 'deg');
      heart.style.setProperty('--size', rand(14, 34).toFixed(0) + 'px');
      heart.style.setProperty('--dur', rand(1.7, 2.8).toFixed(2) + 's');
      heart.style.setProperty('--delay', rand(0, 0.45).toFixed(2) + 's');
      heart.style.setProperty('--heart-color', pick(HEART_COLORS));
      heart.addEventListener('animationend', () => heart.remove(), { once: true });
      el.heartLayer.appendChild(heart);
    }
    trimHearts();
  }

  // One heart per physical tap/click. Pointer events cover modern Android and
  // iOS browsers; touch/mouse fallbacks cover older WebViews. A short dedupe
  // window prevents a tap reported by two APIs from making two hearts.
  let lastTap = { t: 0, x: -999, y: -999 };
  function handleHeartTap(x, y) {
    const now = performance.now();
    if (now - lastTap.t < 130 && Math.abs(x - lastTap.x) < 16 && Math.abs(y - lastTap.y) < 16) return;
    lastTap = { t: now, x, y };
    spawnTapHeart(x, y);
  }
  function touchHeart(e) {
    if (!e.changedTouches || !e.changedTouches.length) return;
    handleHeartTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }
  function pointerHeart(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    handleHeartTap(e.clientX, e.clientY);
  }
  function mouseHeart(e) {
    if (e.button !== 0) return;
    handleHeartTap(e.clientX, e.clientY);
  }
  if ('PointerEvent' in window) {
    document.addEventListener('pointerdown', pointerHeart, { passive: true });
    document.addEventListener('touchstart', touchHeart, { passive: true });
  } else {
    document.addEventListener('touchstart', touchHeart, { passive: true });
    document.addEventListener('mousedown', mouseHeart, { passive: true });
  }

  // Heart rain: hearts enter above the viewport and fall at varied speeds.
  // Drawn on the existing canvas, so it adds no DOM nodes and stays smooth.
  function startHeartRain() {
    clearTimeout(rainTimer);
    clearTimeout(buttonTimer);
    const mobile = W < 620;
    const total = reduced ? 12 : (mobile ? 48 : 76);
    let scheduled = 0;

    function addHearts(n, initial) {
      for (let i = 0; i < n && rainHearts.length < (mobile ? 80 : 120); i++) {
        rainHearts.push({
          x: rand(-24, W + 24),
          y: initial ? rand(-H * 0.95, -12) : rand(-150, -24),
          size: rand(9, mobile ? 23 : 30),
          vy: rand(1.6, reduced ? 2.4 : 4.4),
          vx: rand(-0.38, 0.38),
          sway: rand(0.08, 0.28),
          phase: rand(0, Math.PI * 2),
          rot: rand(-0.4, 0.4),
          vr: rand(-0.014, 0.014),
          alpha: rand(0.55, 0.95),
          color: pick(HEART_COLORS),
          glow: pick(['rgba(255,145,180,0.17)', 'rgba(244,201,148,0.14)', 'rgba(255,120,165,0.15)'])
        });
        rainSpawned++;
      }
      el.heartBtn.setAttribute('data-rain-count', String(rainSpawned));
    }

    addHearts(reduced ? total : 12, true);
    el.heartBtn.classList.add('is-raining');
    buttonTimer = setTimeout(() => el.heartBtn.classList.remove('is-raining'), 1900);
    if (reduced) return;

    const tick = () => {
      if (scheduled >= total) { rainTimer = 0; return; }
      const n = Math.min(4, total - scheduled);
      scheduled += n;
      if (!document.hidden) addHearts(n, false);
      rainTimer = setTimeout(tick, 130);
    };
    rainTimer = setTimeout(tick, 130);
  }

  /* ---------------------------------------------------------
     Optional sound — generated live with Web Audio API
     No audio files, no autoplay, no copyrighted material.
     --------------------------------------------------------- */

  let audioCtx = null, master = null, musicTimer = 0, playing = false, chordIndex = 0;

  function ensureAudio() {
    if (audioCtx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioCtx = new AudioCtx();
    master = audioCtx.createGain();
    master.gain.value = 0;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1900;
    filter.Q.value = 0.3;
    master.connect(filter);
    filter.connect(audioCtx.destination);
  }

  function tone(freq, when, duration, volume, type) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + Math.min(0.9, duration * 0.35));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  const chords = [
    [293.66, 369.99, 440.00, 554.37],
    [220.00, 277.18, 329.63, 440.00],
    [246.94, 311.13, 369.99, 493.88],
    [196.00, 246.94, 293.66, 369.99]
  ];

  function scheduleMusic() {
    if (!playing || !audioCtx) return;
    const start = audioCtx.currentTime + 0.06;
    const chord = chords[chordIndex % chords.length];
    chord.forEach((freq, i) => tone(freq, start + i * 0.09, 6.2, 0.042, 'sine'));
    for (let i = 0; i < 4; i++) {
      tone(chord[(i + 1) % chord.length] * 2, start + 0.35 + i * 1.15, 2.2, 0.02, 'triangle');
    }
    chordIndex++;
    musicTimer = setTimeout(scheduleMusic, 5200);
  }

  function chime() {
    if (!playing || !audioCtx) return;
    const t = audioCtx.currentTime + 0.03;
    tone(880, t, 1.5, 0.055, 'sine');
    tone(1320, t + 0.12, 1.3, 0.03, 'sine');
  }

  function setSound(on) {
    ensureAudio();
    if (!audioCtx) {
      el.soundToggle.setAttribute('title', 'موسیقی در این مرورگر پشتیبانی نمیشه');
      return;
    }
    if (on) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      playing = true;
      master.gain.cancelScheduledValues(audioCtx.currentTime);
      master.gain.setTargetAtTime(0.85, audioCtx.currentTime, 0.7);
      clearTimeout(musicTimer);
      scheduleMusic();
      chime();
    } else {
      playing = false;
      clearTimeout(musicTimer);
      master.gain.cancelScheduledValues(audioCtx.currentTime);
      master.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.22);
    }
    el.soundToggle.classList.toggle('is-playing', playing);
    el.soundToggle.setAttribute('aria-pressed', String(playing));
    el.soundToggle.setAttribute('aria-label', playing ? 'خاموش کردن موسیقی' : 'روشن کردن موسیقی');
  }

  el.soundToggle.addEventListener('click', () => setSound(!playing));

  /* ---------------------------------------------------------
     Scene flow
     --------------------------------------------------------- */

  let opened = false;
  let interactions = 0;
  let secretRevealed = false;

  function showScene(scene) {
    [el.intro, el.reveal, el.final].forEach((s) => {
      const active = s === scene;
      s.classList.toggle('is-active', active);
      s.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    scene.scrollTop = 0;
  }

  function registerInteraction() {
    if (secretRevealed || interactions >= 3 || !el.reveal.classList.contains('is-active')) return;
    interactions++;
    if (interactions === 3) {
      el.secretBtn.classList.remove('is-hidden');
      el.secretBtn.classList.add('btn-in', 'btn--pulse');
    }
  }

  el.phraseWrap.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'clip-path' && el.phraseWrap.classList.contains('is-revealed')) {
      el.phraseWrap.classList.add('is-settled');
    }
  });

  el.openBtn.addEventListener('click', () => {
    if (opened) return;
    opened = true;
    chime();
    spawnBurst(30, W / 2, H * 0.48);
    el.intro.classList.remove('is-active');
    el.intro.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      showScene(el.reveal);
      setTimeout(() => {
        el.phraseWrap.classList.add('is-revealed');
        el.reveal.classList.add('is-revealing');
      }, 420);
    }, 320);
  });

  el.heartBtn.addEventListener('click', () => {
    startHeartRain();
    registerInteraction();
    chime();
  });

  function revealRoseHearts() {
    const r = el.rose.getBoundingClientRect();
    spawnBurst(18, r.left + r.width / 2, r.top + r.height / 2);
    registerInteraction();
  }
  el.rose.addEventListener('click', revealRoseHearts);
  el.rose.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); revealRoseHearts(); }
  });

  el.secretBtn.addEventListener('click', () => {
    if (secretRevealed) return;
    secretRevealed = true;
    el.secretCard.hidden = false;
    el.secretBtn.classList.remove('btn--pulse');
    el.secretBtn.classList.add('is-hidden');
    el.finalBtn.classList.remove('is-hidden');
    el.finalBtn.classList.add('btn-in');
    chime();
    setTimeout(() => el.secretCard.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }), 120);
  });

  function goToFinal() {
    showScene(el.final);
    el.final.classList.remove('is-revealing');
    setTimeout(() => {
      el.final.classList.add('is-revealing');
      spawnBurst(70, W / 2, H * 0.5);
      chime();
    }, 340);
  }
  el.finalBtn.addEventListener('click', goToFinal);

  el.replayBtn.addEventListener('click', () => {
    showScene(el.reveal);
    el.phraseWrap.classList.remove('is-revealed', 'is-settled');
    el.reveal.classList.remove('is-revealing');
    void el.phraseWrap.offsetWidth; // restart the CSS reveal
    setTimeout(() => {
      el.phraseWrap.classList.add('is-revealed');
      el.reveal.classList.add('is-revealing');
    }, 200);
  });

  /* ---------------------------------------------------------
     Go
     --------------------------------------------------------- */

  resizeCanvas();
  startCanvas();
})();
