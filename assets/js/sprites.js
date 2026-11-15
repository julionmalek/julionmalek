/* Pixel art shared by the walking cat, the games, the favicon and the pro site. */
(function () {
  const PAL = {
    k: "#0b0b0f", g: "#2a2a35", e: "#d4e85a", p: "#e88aa0",
    b: "#8ec9ef", w: "#ffffff", n: "#b0702e", N: "#6b3d14",
    c: "#3c9a3c", C: "#9ee09e", d: "#4aa8ff", r: "#ff3355", y: "#ffd400",
  };

  const S = {
    // Batman, 16 x 12, facing right
    sit: [
      "..........k.k...",
      "..........kkk...",
      ".........kkekk..",
      ".........kkkkp..",
      "..........kkk...",
      ".........kkkk...",
      "........kgkkk...",
      "........kkkkk...",
      ".......kkkkkk...",
      ".k.....kkkkkk...",
      "..kkkkkkkkkkk...",
      "........k.kk....",
    ],
    walk1: [
      "................",
      "............k.k.",
      "k...........kkk.",
      ".k.........kkekk",
      ".k.........kkkkp",
      "..kkkkkkkkkkkkk.",
      "..kgkkkkkkkkkk..",
      "..kkkkkkkkkkkk..",
      "..kkkkkkkkkkk...",
      "..k.k......k.k..",
      ".k...k....k...k.",
      ".k...k....k...k.",
    ],
    walk2: [
      "................",
      "............k.k.",
      ".k..........kkk.",
      "k..........kkekk",
      "k..........kkkkp",
      ".kkkkkkkkkkkkkk.",
      "..kgkkkkkkkkkk..",
      "..kkkkkkkkkkkk..",
      "..kkkkkkkkkkk...",
      "...kk......kk...",
      "...kk......kk...",
      "...kk......kk...",
    ],
    sleep: [
      "................",
      "................",
      "................",
      "................",
      "................",
      ".....kkkkkk.k.k.",
      "...kkkkkkkkkkkk.",
      "..kkgkkkkkkgkgk.",
      ".kkkkkkkkkkkkkpk",
      ".kkkkkkkkkkkkkk.",
      "..kkkkkkkkkkkkk.",
      "...kkkkkkkkkk...",
    ],
    // front-facing head, 12 x 10 (favicon, snake head)
    face: [
      ".k........k.",
      ".kk......kk.",
      ".kkk....kkk.",
      ".kkkkkkkkkk.",
      "kkkkkkkkkkkk",
      "kkeekkkkeekk",
      "kkeekkkkeekk",
      "kkkkkppkkkkk",
      ".kkkkkkkkkk.",
      "..kkkkkkkk..",
    ],
    kitten: [
      "k....k",
      "kk..kk",
      "kkkkkk",
      "kekkek",
      "kkpkkk",
      ".kkkk.",
    ],
    fish: [
      "..bbb..b",
      ".bbbbbbb",
      "bwbbbbb.",
      ".bbbbbbb",
      "..bbb..b",
    ],
    croq: [
      ".nnnn.",
      "nnNnnn",
      "nnnnNn",
      "nNnnnn",
      "nnnNnn",
      ".nnnn.",
    ],
    cucumber: [
      ".cccccccc.",
      "cCcccCcccc",
      "ccccCccccC",
      "cccCcccccc",
      ".cccccccc.",
    ],
    drop: [
      "..d..",
      "..d..",
      ".ddd.",
      "ddwdd",
      "ddddd",
      "ddddd",
      ".ddd.",
    ],
    heart: [
      ".rr.rr.",
      "rrrrrrr",
      "rrrrrrr",
      ".rrrrr.",
      "..rrr..",
      "...r...",
    ],
  };

  /* draw(ctx, name, x, y, scale, { flip, outline }) — outline is a colour or false */
  function draw(ctx, name, x, y, scale = 1, opts = {}) {
    const rows = S[name], h = rows.length, w = rows[0].length;
    const at = (cx, cy) => (cy >= 0 && cy < h && cx >= 0 && cx < w && rows[cy][cx] !== "." ? rows[cy][cx] : null);
    for (let cy = -1; cy <= h; cy++) for (let cx = -1; cx <= w; cx++) {
      const c = at(cx, cy);
      const dx = x + (opts.flip ? w - 1 - cx : cx) * scale, dy = y + cy * scale;
      if (c) { ctx.fillStyle = PAL[c]; ctx.fillRect(dx, dy, scale, scale); }
      else if (opts.outline && (at(cx - 1, cy) || at(cx + 1, cy) || at(cx, cy - 1) || at(cx, cy + 1))) {
        ctx.fillStyle = opts.outline; ctx.fillRect(dx, dy, scale, scale);
      }
    }
  }
  const size = (name) => [S[name][0].length, S[name].length];

  window.Sprites = { draw, size, S, PAL };
})();
