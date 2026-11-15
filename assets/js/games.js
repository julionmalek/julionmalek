/* Three tiny Batman games, each in its own Windows 98-style window:
   BATMAN SNAKE, TREAT STORM and LASER! */
(function () {
  const UI = window.UI, Sp = window.Sprites, C = window.CONTENT;
  const T = () => C.games[UI.lang];
  const FONT = (px) => `${px}px VT323, "Courier New", monospace`;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const best = (id, v) => {
    const k = "best_" + id, cur = +UI.store.get(k, "0") || 0;
    if (v != null && v > cur) { UI.store.set(k, String(v)); return v; }
    return cur;
  };

  /* window + canvas + score bar shared by every game */
  function shell(id, w, h, opts = {}) {
    const open = document.querySelector(`.win.game-${id}`);
    if (open) { open.style.zIndex = ++UI.z; open.focus(); return null; }
    const t = T()[id];
    const body = document.createElement("div");
    body.className = "game";
    body.innerHTML = `
      <div class="game-bar"><span>${T().score}: <b class="g-score">0</b></span><span>${T().best}: <b class="g-best">${best(id)}</b></span></div>
      <canvas width="${w}" height="${h}"></canvas>
      ${opts.dpad ? `<div class="dpad"><button data-d="up" aria-label="up">▲</button><button data-d="left" aria-label="left">◀</button><button data-d="down" aria-label="down">▼</button><button data-d="right" aria-label="right">▶</button></div>` : ""}
      <p class="game-help">${UI.esc(t.help)}</p>`;
    const g = { alive: true, closers: [] };
    const width = Math.min(Math.max(w + 26, 440), window.innerWidth - 16, (window.innerHeight - 150) * (w / h) + 26);
    g.win = UI.openWindow({
      title: t.file, body, width, cls: `game-win game-${id}`,
      x: (window.innerWidth - width) / 2, y: 12,
      onClose: () => { g.alive = false; g.closers.forEach((f) => f()); },
    });
    g.win.tabIndex = -1;
    g.win.focus();
    g.cv = body.querySelector("canvas");
    g.ctx = g.cv.getContext("2d");
    g.ctx.imageSmoothingEnabled = false;
    g.body = body;
    g.t = t;
    g.score = (s) => { body.querySelector(".g-score").textContent = s; };
    g.best = (s) => { body.querySelector(".g-best").textContent = best(id, s); };
    // canvas coords from a pointer event
    g.pos = (e) => { const r = g.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (w / r.width), y: (e.clientY - r.top) * (h / r.height) }; };
    g.loop = (fn) => { let last = performance.now(); const f = (now) => { if (!g.alive) return; fn(now, Math.min(50, now - last)); last = now; requestAnimationFrame(f); }; requestAnimationFrame(f); };
    return g;
  }

  /* centred text with a dark box behind it */
  function banner(ctx, w, h, lines, { bg = "rgba(0,0,0,.72)", fg = "#fff" } = {}) {
    const lh = 22, total = lines.length * lh + 20;
    ctx.fillStyle = bg;
    ctx.fillRect(12, h / 2 - total / 2, w - 24, total);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    lines.forEach((l, i) => {
      const [txt, col, size] = Array.isArray(l) ? l : [l, fg, 20];
      ctx.font = FONT(size || 20);
      ctx.fillStyle = col || fg;
      wrapText(ctx, txt, w / 2, h / 2 - total / 2 + 10 + lh / 2 + i * lh, w - 40);
    });
  }
  function wrapText(ctx, txt, x, y, maxW) {
    if (ctx.measureText(txt).width <= maxW) return ctx.fillText(txt, x, y);
    ctx.font = FONT(16);
    ctx.fillText(txt, x, y, maxW);
  }
  function floater(list, text, x, y, color = "#fff") { list.push({ text, x, y, color, life: 900 }); }
  function drawFloaters(ctx, list, dt) {
    ctx.textAlign = "center"; ctx.font = FONT(20);
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i]; f.life -= dt; f.y -= dt * 0.04;
      if (f.life <= 0) { list.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, f.life / 300);
      ctx.fillStyle = "#000"; ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  /* =====================================================================
     BATMAN SNAKE — Batman leads a conga line of kittens.
     ===================================================================== */
  function snake() {
    const N = 16, CELL = 20, W = N * CELL;
    const g = shell("snake", W, W, { dpad: true });
    if (!g) return;
    const { ctx } = g;
    const GB = { bg: "#9bbc0f", grid: "#8bac0f", dark: "#0f380f", mid: "#306230" };
    const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
    let mode = "title", body, dir, queue, food, fish, cuke, score, speed, acc, shakeUntil = 0, flash = null, overMsg = "", paused = false;
    let fishAt, cukeAt;
    const floats = [];

    const occupied = (p) => body.some((b) => same(b, p)) || same(food, p) || same(fish, p) || same(cuke, p);
    const free = () => { let p, n = 0; do { p = { x: (Math.random() * N) | 0, y: (Math.random() * N) | 0 }; } while (occupied(p) && n++ < 500); return p; };

    function reset(now) {
      body = [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }];
      dir = DIRS.right; queue = []; food = null; fish = null; cuke = null;
      food = free(); score = 0; speed = 150; acc = 0; paused = false;
      fishAt = now + 9000; cukeAt = now + 11000;
      g.score(0); mode = "play";
    }
    function turn(name) {
      const now = performance.now();
      if (mode !== "play") { reset(now); }
      const d = DIRS[name]; if (!d) return;
      const lastDir = queue.length ? queue[queue.length - 1] : dir;
      if (d.x === -lastDir.x && d.y === -lastDir.y) return;
      if (queue.length < 3) queue.push(d);
    }
    function over() {
      mode = "over"; overMsg = pick(g.t.over); g.best(score);
    }
    function step(now) {
      if (queue.length) dir = queue.shift();
      const h = { x: body[0].x + dir.x, y: body[0].y + dir.y };
      if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || body.slice(0, -1).some((b) => same(b, h))) return over();
      body.unshift(h);
      const cx = h.x * CELL + CELL / 2, cy = h.y * CELL;
      if (same(h, food)) {
        score += 1; food = free(); speed = Math.max(72, speed - 3);
        floater(floats, g.t.yum, cx, cy, "#fff");
      } else if (same(h, fish)) {
        score += 5; fish = null; body.push({ ...body[body.length - 1] });
        floater(floats, g.t.fish, cx, cy, "#ffd400");
      } else body.pop();
      if (same(h, cuke)) {
        cuke = null; shakeUntil = now + 500; flash = { text: g.t.cuke, until: now + 1400 };
        body = body.slice(0, Math.max(3, Math.ceil(body.length / 2)));
        cukeAt = now + rand(9000, 15000);
      }
      g.score(score);
    }
    function spawns(now) {
      if (!fish && now > fishAt) { fish = free(); fish.until = now + 6000; }
      if (fish && now > fish.until) { fish = null; fishAt = now + rand(8000, 14000); }
      if (!cuke && now > cukeAt) { cuke = free(); cuke.until = now + 7000; }
      if (cuke && now > cuke.until) { cuke = null; cukeAt = now + rand(9000, 15000); }
    }

    function draw(now) {
      ctx.save();
      if (now < shakeUntil) ctx.translate(rand(-4, 4), rand(-4, 4));
      ctx.fillStyle = GB.bg; ctx.fillRect(-5, -5, W + 10, W + 10);
      ctx.fillStyle = GB.grid;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) ctx.fillRect(i * CELL, j * CELL, CELL, CELL);
      if (mode !== "title") {
        Sp.draw(ctx, "croq", food.x * CELL + 4, food.y * CELL + 4, 2);
        if (fish && (fish.until - now > 1500 || Math.floor(now / 150) % 2)) Sp.draw(ctx, "fish", fish.x * CELL + 2, fish.y * CELL + 5, 2);
        if (cuke && (cuke.until - now > 1500 || Math.floor(now / 150) % 2)) Sp.draw(ctx, "cucumber", cuke.x * CELL, cuke.y * CELL + 5, 2);
        for (let i = body.length - 1; i > 0; i--) Sp.draw(ctx, "kitten", body[i].x * CELL + 4, body[i].y * CELL + 4, 2);
        Sp.draw(ctx, "face", body[0].x * CELL - 2, body[0].y * CELL, 2);
      }
      ctx.restore();
      drawFloaters(ctx, floats, 16);
      if (flash && now < flash.until) banner(ctx, W, W, [[flash.text, "#ff3355", 26]], { bg: "rgba(15,56,15,.85)" });
      if (mode === "title") {
        Sp.draw(ctx, "face", W / 2 - 36, 40, 6);
        banner(ctx, W, W + 120, [[g.t.name, "#ffd400", 30], [g.t.tag, "#fff", 18], [T().play, "#9bbc0f", 18]], { bg: "rgba(15,56,15,.9)" });
      }
      if (mode === "over") banner(ctx, W, W, [["GAME OVER", "#ff3355", 30], [overMsg, "#fff", 17], [`${T().score}: ${score}`, "#ffd400", 22], [T().again, "#9bbc0f", 17]], { bg: "rgba(15,56,15,.9)" });
      if (paused) banner(ctx, W, W, [[T().paused, "#fff", 30]]);
    }

    g.loop((now, dt) => {
      if (mode === "play" && !paused) {
        spawns(now);
        acc += dt;
        while (acc >= speed && mode === "play") { acc -= speed; step(now); }
      }
      draw(now);
    });

    const keys = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right" };
    g.win.addEventListener("keydown", (e) => {
      if (keys[e.key]) { e.preventDefault(); return turn(keys[e.key]); }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (mode !== "play") reset(performance.now()); }
      if ((e.key === "p" || e.key === "P") && mode === "play") paused = !paused;
    });
    g.body.querySelectorAll(".dpad button").forEach((b) => b.addEventListener("pointerdown", (e) => { e.preventDefault(); g.win.focus(); turn(b.dataset.d); }));
    let sw = null;
    g.cv.addEventListener("pointerdown", (e) => { sw = { x: e.clientX, y: e.clientY }; g.cv.setPointerCapture(e.pointerId); });
    g.cv.addEventListener("pointerup", (e) => {
      if (!sw) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
      if (Math.hypot(dx, dy) < 18) { if (mode !== "play") reset(performance.now()); return; }
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    });
    g.cv.style.touchAction = "none";
  }

  /* =====================================================================
     TREAT STORM — catch treats, dodge water and cucumbers.
     ===================================================================== */
  function catcher() {
    const W = 320, H = 360, FLOOR = H - 14;
    const g = shell("catch", W, H);
    if (!g) return;
    const { ctx } = g;
    const KINDS = [
      { s: "croq", p: 0.58, pts: 1, sc: 3 },
      { s: "fish", p: 0.12, pts: 5, sc: 3 },
      { s: "cucumber", p: 0.15, bad: true, sc: 3 },
      { s: "drop", p: 0.15, bad: true, sc: 3 },
    ];
    let mode = "title", cat, items, lives, score, spawnIn, t0, inv, overMsg, held = {}, target = null;
    const floats = [];

    function reset(now) {
      cat = { x: W / 2 - 24, flip: false, tick: 0 }; items = []; lives = 3; score = 0; spawnIn = 400; t0 = now; inv = 0;
      g.score(0); mode = "play";
    }
    function spawn(elapsed) {
      let r = Math.random(), k = KINDS[0];
      for (const kind of KINDS) { if (r < kind.p) { k = kind; break; } r -= kind.p; }
      const [sw, sh] = Sp.size(k.s);
      items.push({ k, x: rand(4, W - sw * k.sc - 4), y: -sh * k.sc, w: sw * k.sc, h: sh * k.sc, vy: rand(1.4, 2.2) + elapsed / 25, wob: rand(0, 6) });
    }
    function update(now, dt) {
      const k = dt / 16.7, elapsed = (now - t0) / 1000;
      // move
      let vx = 0;
      if (held.left) vx -= 5.5; if (held.right) vx += 5.5;
      if (target != null && !held.left && !held.right) { const d = target - (cat.x + 24); vx = Math.max(-7, Math.min(7, d * 0.25)); }
      cat.x = Math.max(0, Math.min(W - 48, cat.x + vx * k));
      if (Math.abs(vx) > 0.5) { cat.flip = vx < 0; cat.tick += dt; }
      // spawn
      spawnIn -= dt;
      if (spawnIn <= 0) { spawn(elapsed); spawnIn = Math.max(300, 850 - elapsed * 12) * rand(0.7, 1.3); }
      // fall + collide
      const cy = FLOOR - 36;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.y += it.vy * k; it.wob += 0.05 * k;
        const ix = it.x + Math.sin(it.wob) * 1.5;
        const hit = it.y + it.h > cy + 6 && it.y < cy + 24 && ix + it.w > cat.x + 6 && ix < cat.x + 42;
        if (hit) {
          items.splice(i, 1);
          if (it.k.bad) {
            if (now > inv) {
              lives--; inv = now + 1100;
              floater(floats, it.k.s === "drop" ? g.t.splash : g.t.eek, cat.x + 24, cy - 6, "#4aa8ff");
              if (lives <= 0) { mode = "over"; overMsg = pick(g.t.over); g.best(score); }
            }
          } else {
            score += it.k.pts; g.score(score);
            floater(floats, "+" + it.k.pts, cat.x + 24, cy - 6, it.k.pts > 1 ? "#ffd400" : "#fff");
          }
        } else if (it.y > H) items.splice(i, 1);
      }
    }
    function draw(now, dt) {
      // kitchen floor
      for (let y = 0; y < H; y += 32) for (let x = 0; x < W; x += 32) {
        ctx.fillStyle = ((x + y) / 32) % 2 ? "#e9dcc0" : "#f6eedb"; ctx.fillRect(x, y, 32, 32);
      }
      ctx.fillStyle = "#8a6a45"; ctx.fillRect(0, FLOOR, W, H - FLOOR);
      if (mode !== "title") {
        items.forEach((it) => Sp.draw(ctx, it.k.s, Math.round(it.x + Math.sin(it.wob) * 1.5), Math.round(it.y), it.k.sc));
        const blink = now < inv && Math.floor(now / 90) % 2;
        if (!blink) Sp.draw(ctx, Math.abs(cat.tick) > 0 && Math.floor(cat.tick / 120) % 2 ? "walk1" : "walk2", Math.round(cat.x), FLOOR - 36, 3, { flip: cat.flip });
        for (let i = 0; i < 3; i++) { ctx.globalAlpha = i < lives ? 1 : 0.2; Sp.draw(ctx, "heart", 8 + i * 26, 8, 3); }
        ctx.globalAlpha = 1;
      }
      drawFloaters(ctx, floats, dt);
      if (mode === "title") {
        Sp.draw(ctx, "sit", W / 2 - 40, 50, 5, { flip: false });
        banner(ctx, W, H + 110, [[g.t.name, "#ffd400", 30], [g.t.tag, "#fff", 18], [T().play, "#9ee09e", 18]]);
      }
      if (mode === "over") banner(ctx, W, H, [["GAME OVER", "#ff3355", 30], [overMsg, "#fff", 17], [`${T().score}: ${score}`, "#ffd400", 22], [T().again, "#9ee09e", 17]]);
    }
    g.loop((now, dt) => { if (mode === "play") update(now, dt); draw(now, dt); });

    g.win.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a") { held.left = true; target = null; e.preventDefault(); }
      if (e.key === "ArrowRight" || e.key === "d") { held.right = true; target = null; e.preventDefault(); }
      if ((e.key === "Enter" || e.key === " ") && mode !== "play") { e.preventDefault(); reset(performance.now()); }
    });
    g.win.addEventListener("keyup", (e) => {
      if (e.key === "ArrowLeft" || e.key === "a") held.left = false;
      if (e.key === "ArrowRight" || e.key === "d") held.right = false;
    });
    g.cv.style.touchAction = "none";
    g.cv.addEventListener("pointermove", (e) => { if (mode === "play") target = g.pos(e).x; });
    g.cv.addEventListener("pointerdown", (e) => { if (mode !== "play") return reset(performance.now()); target = g.pos(e).x; });
    g.closers.push(() => { held = {}; });
  }

  /* =====================================================================
     LASER! — you vs Batman for the red dot.
     ===================================================================== */
  function laser() {
    const W = 320, H = 320, GOAL = 10;
    const g = shell("laser", W, H);
    if (!g) return;
    const { ctx } = g;
    let mode = "title", dot, cat, you, bat, round, endMsg;
    const floats = [];

    function newDot() {
      let p, n = 0;
      do { p = { x: rand(24, W - 24), y: rand(50, H - 24) }; } while (cat && Math.hypot(p.x - cat.x, p.y - cat.y) < 140 && n++ < 50);
      dot = { ...p, ox: p.x, oy: p.y, t: rand(0, 6) };
    }
    function reset() {
      cat = { x: W / 2, y: H / 2 + 40, flip: false, tick: 0 }; you = 0; bat = 0; round = 0;
      g.score("0 – 0"); mode = "play"; newDot();
    }
    function point(who) {
      if (who === "you") { you++; floater(floats, "+1", dot.x, dot.y - 10, "#4dff5a"); }
      else { bat++; floater(floats, "MIAOU", dot.x, dot.y - 10, "#ff3355"); }
      round++;
      g.score(`${you} – ${bat}`);
      if (you >= GOAL || bat >= GOAL) { mode = "over"; endMsg = you >= GOAL ? g.t.win : g.t.lose; g.best(you); return; }
      newDot();
    }
    function update(now, dt) {
      const k = dt / 16.7;
      dot.t += 0.06 * k;
      dot.x = dot.ox + Math.sin(dot.t * 1.7) * 10; dot.y = dot.oy + Math.cos(dot.t * 2.3) * 7;
      const speed = (1.6 + round * 0.22) * k;
      const dx = dot.x - cat.x, dy = dot.y - cat.y, d = Math.hypot(dx, dy);
      if (d < 12) return point("cat");
      cat.x += (dx / d) * speed; cat.y += (dy / d) * speed; cat.flip = dx < 0; cat.tick += dt;
    }
    function draw(now, dt) {
      // a rug, in honour of Batman's favourite sunbathing spot
      ctx.fillStyle = "#d9773a"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#3d5ea8"; ctx.fillRect(14, 14, W - 28, H - 28);
      ctx.fillStyle = "#e9a066"; ctx.fillRect(26, 26, W - 52, H - 52);
      ctx.fillStyle = "#3d5ea8";
      for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate((i * Math.PI) / 3); ctx.fillRect(-6, -90, 12, 50); ctx.restore(); }
      ctx.fillStyle = "#2b3f75"; ctx.beginPath(); ctx.arc(W / 2, H / 2, 26, 0, Math.PI * 2); ctx.fill();
      if (mode === "play" || mode === "over") {
        ctx.font = FONT(22); ctx.textAlign = "left"; ctx.fillStyle = "#fff";
        ctx.fillText(`${g.t.you} ${you}`, 34, 46);
        ctx.textAlign = "right"; ctx.fillText(`${bat} ${g.t.cat}`, W - 34, 46);
      }
      if (mode === "play") {
        Sp.draw(ctx, Math.floor(cat.tick / 110) % 2 ? "walk1" : "walk2", Math.round(cat.x - 24), Math.round(cat.y - 30), 3, { flip: cat.flip, outline: "rgba(255,255,255,.6)" });
        const glow = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, 16);
        glow.addColorStop(0, "rgba(255,40,40,1)"); glow.addColorStop(0.3, "rgba(255,40,40,.7)"); glow.addColorStop(1, "rgba(255,40,40,0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(dot.x, dot.y, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(dot.x, dot.y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      drawFloaters(ctx, floats, dt);
      if (mode === "title") {
        Sp.draw(ctx, "sit", W / 2 - 40, 46, 5, { outline: "rgba(255,255,255,.6)" });
        banner(ctx, W, H + 110, [[g.t.name, "#ff3355", 30], [g.t.tag, "#fff", 18], [T().play, "#ffd400", 18]]);
      }
      if (mode === "over") banner(ctx, W, H, [[you >= GOAL ? (UI.lang === "fr" ? "VICTOIRE !" : "YOU WIN!") : "GAME OVER", you >= GOAL ? "#4dff5a" : "#ff3355", 30], [endMsg, "#fff", 17], [`${you} – ${bat}`, "#ffd400", 22], [T().again, "#ffd400", 17]]);
    }
    g.loop((now, dt) => { if (mode === "play") update(now, dt); draw(now, dt); });
    g.cv.style.touchAction = "none";
    g.cv.style.cursor = "crosshair";
    g.cv.addEventListener("pointerdown", (e) => {
      if (mode !== "play") return reset();
      const p = g.pos(e);
      if (Math.hypot(p.x - dot.x, p.y - dot.y) < 24) point("you");
    });
    g.win.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && mode !== "play") { e.preventDefault(); reset(); } });
  }

  window.Games = { open: (id) => ({ snake, catch: catcher, laser }[id] || snake)() };
})();
