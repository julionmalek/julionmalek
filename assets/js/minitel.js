/* The Julitel: a 40x24 videotex terminal. Pages are lists of rows; photos are
   dithered down to 8 grey levels like a Minitel 1. */
(function () {
  const C = window.CONTENT, UI = window.UI;
  const COLS = 40;
  const scr = document.getElementById("screen");
  const inner = document.getElementById("screen-inner");
  const led = document.getElementById("led");

  const esc = UI.esc;
  const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
  const T = () => C.mt[UI.lang];

  /* word-wrap plain text into rows of `w` columns */
  function wrap(text, w = COLS, indent = "") {
    const out = []; let line = indent;
    text.split(" ").forEach((word) => {
      if ((line + word).length > w && line.trim()) { out.push(line.replace(/\s+$/, "")); line = indent; }
      line += word + " ";
    });
    if (line.trim()) out.push(line.replace(/\s+$/, ""));
    return out;
  }
  const row = (html, cls = "") => ({ html, cls });
  const text = (s, cls = "", w, indent) => wrap(s, w, indent).map((l) => row(esc(l), cls));
  const blank = () => row("");
  const rule = (cls = "c-b") => row("", "rule " + cls);

  /* ---------- dithered photos ---------- */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const imgCache = {};
  function dither(canvas, src) {
    const draw = (img) => {
      const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
      // cover-crop the source into the canvas
      const r = Math.max(w / img.width, h / img.height);
      const sw = w / r, sh = h / r;
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
      const d = ctx.getImageData(0, 0, w, h), p = d.data;
      // auto-levels: stretch the 2nd..98th percentile so a black cat on a dark wall still reads
      const lum = new Float32Array(w * h);
      for (let j = 0; j < w * h; j++) lum[j] = (0.299 * p[j * 4] + 0.587 * p[j * 4 + 1] + 0.114 * p[j * 4 + 2]) / 255;
      const sorted = Float32Array.from(lum).sort();
      const lo = sorted[Math.floor(sorted.length * 0.02)], hi = sorted[Math.floor(sorted.length * 0.98)];
      const span = Math.max(0.05, hi - lo);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let g = Math.max(0, Math.min(1, (lum[y * w + x] - lo) / span));
        g = Math.pow(g, 0.85);
        const t = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
        const lvl = Math.min(7, Math.floor(g * 7 + t));
        const v = Math.round((lvl / 7) * 255);
        p[i] = p[i + 1] = p[i + 2] = v;
      }
      ctx.putImageData(d, 0, 0);
    };
    if (imgCache[src] && imgCache[src].complete) return draw(imgCache[src]);
    const img = imgCache[src] || new Image();
    imgCache[src] = img;
    img.addEventListener("load", () => draw(img), { once: true });
    if (!img.src) img.src = src;
  }
  // an image block: `cols` x `rows` cells, 4x6 px per cell
  const photo = (src, cols, rows, opts = {}) => ({ photo: { src, cols, rows, ...opts } });
  const split = (left, right) => ({ split: [left, right] });

  /* ---------- pages ---------- */
  const MENU = ["qui", "parcours", "competences", "projets", "batman", "contact", "jeux"];
  const footer = (t, n, total) => {
    const pg = total > 1 ? `${t.page} ${n}/${total}` : "";
    return [row(`<span class="inv c-c"> ${esc(t.sommaire)} </span>  ${total > 1 ? `<span class="inv c-g"> SUITE </span> <span class="inv c-y"> RETOUR </span>` : ""}`.padEnd(10) + `<span class="right c-w">${pg}</span>`, "foot-row")];
  };
  const header = (title, color = "c-y") => [row(`<span class="dh ${color}">${esc(title)}</span>`, "dh-row"), rule()];

  const sections = {
    sommaire() {
      const t = T();
      const rows = [
        blank(),
        row(`<span class="dh dw c-y blink-cur">3615 JULION</span>`, "dh-row center"),
        blank(),
        row(esc(t.tagline), "center c-c"),
        row(esc(t.sub), "center c-w"),
        rule("c-m"),
      ];
      t.menu.forEach((m, i) => rows.push(row(`<a class="mt-link" data-choice="${i + 1}"><span class="inv c-g"> ${i + 1} </span> ${esc(m)}</a>`, "menu-row")));
      rows.push(rule("c-m"));
      return [rows];
    },
    qui() {
      const t = T();
      const p1 = [...header(t.menu[0]),
        split(photo("/assets/img/julion-headshot.jpg", 14, 11), t.about.flatMap((s) => [...text(s, "c-w", 25), blank()])),
      ];
      const p2 = [...header(t.menu[0]), blank(),
        ...t.about2.flatMap((s) => [...text(s, "c-w"), blank()]),
        row(`<a class="mt-link" data-cmd="CARTE"><span class="inv c-y"> CARTE </span> ${esc(t.card_cta.split(":").slice(1).join(":").trim() || t.card_cta)}</a>`),
      ];
      return [p1, p2];
    },
    parcours() {
      const t = T(), L = UI.lang;
      return C.jobs.map((j) => {
        const rows = [...header(j.co, "c-y"),
          row(`<span class="c-c">${esc(j.where)}</span> · <span class="c-m">${esc(j.dates[L])}</span>`),
          ...text(j.role[L], "c-g"), blank()];
        const pts = (j.mt || j.pts)[L];
        pts.forEach((p) => { rows.push(...text("▪ " + p, "c-w", COLS, "  ")); });
        if (!pts.length) rows.push(...text(L === "fr" ? "▪ Du code, du début à la fin. Front, back, tout." : "▪ Code, front to back. All of it.", "c-w", COLS, "  "));
        return rows;
      }).concat([[
        ...header(L === "fr" ? "FORMATION" : "EDUCATION"),
        ...C.school.flatMap((s) => [row(`<span class="c-y">${esc(s.name)}</span> <span class="c-m">${esc(s.dates)}</span>`), ...text(s.what[L], "c-w"), blank()]),
      ]]);
    },
    competences() {
      const t = T();
      const rows = [...header(t.menu[2])];
      t.skills.forEach(([k, v]) => { rows.push(row(`<span class="inv c-c"> ${esc(k)} </span>`)); rows.push(...text(v, "c-w", COLS, " ")); });
      return [rows];
    },
    projets() {
      const t = T(), L = UI.lang;
      const pages = C.projects.map((p) => [
        ...header(p.name, "c-y"),
        row(`<span class="c-m">${esc(p.year)}</span> · <span class="inv c-g"> ${esc(p.status.toUpperCase())} </span>`),
        blank(),
        ...text(p.desc[L], "c-w"),
        blank(),
        ...text(p.tags.join(" · "), "c-c"),
        blank(),
        row([p.demo && `<a class="mt-link" href="${esc(p.demo)}"><span class="inv c-y"> ${esc(t.demo)} </span></a>`, p.repo && `<a class="mt-link" href="${esc(p.repo)}" target="_blank" rel="noopener"><span class="inv c-c"> ${esc(t.code)} </span></a>`].filter(Boolean).join("  ")),
      ]);
      return [...pages, [...header(t.menu[3]), blank(),
        row(`<span class="dh c-y blink">🚧 ${esc(t.projects_title)} 🚧</span>`, "dh-row center"),
        row(`<span class="hazard">${"▄▀".repeat(20)}</span>`),
        blank(),
        ...t.projects.flatMap((s) => [...text(s, "c-w"), blank()]),
        row(`<a class="mt-link" href="${C.links.github}" target="_blank" rel="noopener"><span class="inv c-g"> GITHUB </span> github.com/julionmalek</a>`),
      ]];
    },
    jeux() {
      const t = T(), G = C.games[UI.lang];
      const rows = [...header(t.menu[6], "c-g"), blank(), ...text(t.games_intro, "c-w"), blank()];
      [["snake", "SNAKE"], ["catch", "CROQ"], ["laser", "LASER"]].forEach(([id, code]) => {
        rows.push(row(`<a class="mt-link" data-game="${id}"><span class="inv c-y"> ${code} </span> <span class="c-y">${esc(G[id].name)}</span></a>`));
        rows.push(...text(G[id].tag, "c-c", COLS, "        "));
        rows.push(blank());
      });
      rows.push(...text(t.games_cta, "c-m"));
      return [rows];
    },
    batman() {
      const t = T();
      return t.batman.map((cap, i) => [
        row(`<span class="c-y">${esc(t.batman_head)}</span>`),
        rule("c-r"),
        photo(`/assets/img/batman-${i + 1}.jpg`, 17, 16, { center: true, hd: true, res: 6 }),
        ...text(`« ${cap} »`, "center c-c"),
        row(`<a class="mt-link" data-cmd="HD"><span class="inv c-m"> HD </span> ${esc(t.batman_hd.split(":").slice(1).join(":").trim())}</a>`, "center"),
      ]);
    },
    contact() {
      const t = T();
      const href = { 0: `mailto:${C.links.email}`, 1: C.links.linkedin, 2: C.links.github };
      const rows = [...header(t.menu[5]), blank()];
      t.contact.forEach(([k, v], i) => {
        rows.push(row(`<span class="inv c-c"> ${esc(k)} </span>`));
        rows.push(row(`<a class="mt-link c-w" href="${href[i]}" ${i ? 'target="_blank" rel="noopener"' : ""}>  ${esc(v)}</a>`));
        rows.push(blank());
      });
      rows.push(...text(t.contact_note, "c-m"));
      return [rows];
    },
    guide() {
      const t = T();
      return [[...header("GUIDE", "c-g"), blank(), ...t.guide.map((g) => row(esc(g), "c-w")), blank(), ...text(t.guide_secret, "c-m blink")]];
    },
  };

  /* ---------- terminal state ---------- */
  const M = {
    state: "off", // off | dial | connecting | online
    section: "sommaire", page: 0, input: "", message: "",
    startedAt: 0, renderToken: 0,

    renderRows(rows, animate = true) {
      const token = ++M.renderToken;
      const html = rows.map((r, i) => M.rowHtml(r, i)).join("");
      inner.innerHTML = html;
      inner.querySelectorAll("canvas[data-src]").forEach((cv) => dither(cv, cv.dataset.src));
      if (!animate || UI.reducedMotion) { inner.classList.add("shown"); return; }
      // 1200 baud feel: rows appear one after another
      inner.classList.remove("shown");
      const kids = [...inner.children];
      kids.forEach((k, i) => { k.style.animationDelay = i * 28 + "ms"; k.classList.add("paint"); });
      setTimeout(() => { if (token === M.renderToken) inner.classList.add("shown"); }, kids.length * 28 + 900);
    },
    rowHtml(r) {
      if (r.photo) {
        const { src, cols, rows, center, hd, res = 4 } = r.photo;
        return `<div class="mt-photo ${center ? "center" : ""}" style="--rows:${rows}"><canvas data-src="${src}" width="${cols * res}" height="${rows * res * 1.5}" style="width:calc(var(--cw) * ${cols});height:calc(var(--ch) * ${rows})" ${hd ? 'data-hd="1"' : ""}></canvas></div>`;
      }
      if (r.split) {
        const [left, right] = r.split;
        const h = Math.max(left.photo ? left.photo.rows : 0, right.length);
        return `<div class="mt-split" style="--rows:${h}">${M.rowHtml(left)}<div class="mt-col">${right.map((x) => M.rowHtml(x)).join("")}</div></div>`;
      }
      return `<div class="mt-row ${r.cls || ""}">${r.html || "&nbsp;"}</div>`;
    },

    /* status line (row 0) + body + input line (row 24) */
    draw(animate = true) {
      const t = T();
      if (M.state !== "online") return;
      const pages = sections[M.section]();
      M.page = Math.max(0, Math.min(M.page, pages.length - 1));
      const body = pages[M.page];
      const status = row(`<span class="c-w">3615 JULION</span><span class="right"><span id="mt-cost" class="c-y">${M.cost()}</span> <span class="inv c-g">C</span></span>`, "status-row");
      const used = body.reduce((n, r) => n + (r.photo ? r.photo.rows : r.split ? Math.max(r.split[0].photo.rows, r.split[1].length) : r.cls && r.cls.includes("dh-row") ? 2 : 1), 0);
      const filler = Array.from({ length: Math.max(0, 21 - used) }, blank);
      const isMenu = M.section === "sommaire";
      const msg = M.message ? `<span class="c-r blink">${esc(M.message)}</span>` : "";
      const inputRow = isMenu
        ? row(`${esc(t.choice)} <span class="field">${esc(pad(M.input, 6)).replace(/ /g, ".")}</span> <span class="inv c-c"> ENVOI </span> ${msg}`, "input-row")
        : footer(t, M.page + 1, pages.length)[0];
      if (!isMenu && msg) inputRow.html = msg;
      M.renderRows([status, ...body, ...filler, inputRow], animate);
    },
    cost() {
      const min = (Date.now() - M.startedAt) / 60000;
      const f = (min * 1.29).toFixed(2).replace(".", UI.lang === "fr" ? "," : ".");
      return `${f} F`;
    },

    flash(msg) {
      M.message = msg; UI.beep(); M.draw(false);
      clearTimeout(M._msgT); M._msgT = setTimeout(() => { M.message = ""; M.draw(false); }, 2200);
    },

    /* ---------- screens before connecting ---------- */
    powerOn() {
      if (M.state !== "off") return M.powerOff();
      M.state = "dial"; M.input = "JULION";
      led.classList.add("on");
      scr.classList.remove("crt-off"); scr.classList.add("crt-on");
      M.drawDial(true);
    },
    powerOff() {
      M.state = "off"; M.renderToken++;
      document.getElementById("julitel").classList.remove("dialing");
      led.classList.remove("on", "online");
      scr.classList.remove("crt-on"); scr.classList.add("crt-off");
      setTimeout(() => { if (M.state === "off") M.drawOff(); }, 350);
    },
    drawOff() {
      inner.innerHTML = `<div class="mt-off"><span>${esc(T().off)}</span></div>`;
    },
    drawDial(animate) {
      const t = T();
      document.getElementById("julitel").classList.add("dialing");
      const rows = [
        row(`<span class="c-w">F</span>`, "status-row right-only"),
        blank(), blank(),
        row(`<span class="dh dw c-w">${t.dial_title}</span>`, "dh-row center"),
        blank(), blank(), blank(),
        row(esc(t.dial_code), "center c-c"),
        blank(),
        row(`<span class="dh c-y">3615 <span class="field">${esc(pad(M.input, 8)).replace(/ /g, ".")}</span></span>`, "dh-row center"),
        blank(),
        row(esc(t.dial_help), "center c-w"),
        blank(),
        row(`<span class="blink">${esc(t.dial_help2)}</span>`, "center c-g"),
        blank(),
        ...(M.message ? [blank(), row(`<span class="c-r">${esc(M.message)}</span>`, "center")] : []),
      ];
      M.renderRows(rows, animate);
    },
    connect() {
      const code = M.input.trim().toUpperCase();
      const known = { JULION: "sommaire", BATMAN: "batman", MIAOU: "batman", MEOW: "batman", JULITEL: "sommaire" };
      if (code === "METEO" || code === "MÉTÉO" || code === "WEATHER") { M.message = T().meteo; M.input = "JULION"; return M.drawDial(false); }
      if (!known[code]) { M.message = T().unknown; UI.beep(); M.input = "JULION"; return M.drawDial(false); }
      M.message = "";
      M.state = "connecting";
      document.getElementById("julitel").classList.remove("dialing");
      const dur = UI.modem();
      const t = T();
      let dots = 0;
      const tick = () => {
        if (M.state !== "connecting") return;
        inner.innerHTML = M.rowHtml(row("", "status-row")) + `<div class="mt-connecting"><div class="c-w">${esc(t.connecting)}${".".repeat(dots % 4)}</div><div class="modem-bar"><i style="width:${Math.min(100, dots * 12)}%"></i></div></div>`;
        dots++;
      };
      tick();
      const iv = setInterval(tick, 160);
      setTimeout(() => {
        clearInterval(iv);
        if (M.state !== "connecting") return;
        M.state = "online"; M.startedAt = Date.now();
        led.classList.add("online");
        M.section = known[code]; M.page = 0; M.input = "";
        M.draw();
        clearInterval(M._costT);
        M._costT = setInterval(() => { const el = document.getElementById("mt-cost"); if (el) el.textContent = M.cost(); }, 1000);
      }, Math.max(1100, dur));
    },
    hangup() {
      clearInterval(M._costT);
      M.state = "dial"; M.input = "JULION";
      led.classList.remove("online");
      const t = T();
      M.renderRows([blank(), blank(), blank(), blank(), blank(), blank(), blank(), blank(), ...text(t.bye, "center c-y"), blank(), row(`<span class="c-w">${M.cost()}</span>`, "center")]);
      setTimeout(() => { if (M.state === "dial") M.drawDial(true); }, 2600);
    },

    /* ---------- navigation ---------- */
    goto(section, page = 0) {
      if (section === "boring") return UI.goPro();
      document.getElementById("julitel").scrollIntoView({ behavior: UI.reducedMotion ? "auto" : "smooth", block: "center" });
      const go = () => { M.section = section; M.page = page; M.input = ""; M.draw(); };
      if (M.state === "online") return go();
      if (M.state === "off") M.powerOn();
      M.input = "JULION";
      M.connect();
      const wait = setInterval(() => { if (M.state === "online") { clearInterval(wait); go(); } }, 100);
    },
    command(raw) {
      const cmd = raw.trim().toUpperCase();
      if (!cmd) return;
      if (cmd === "CARTE" || cmd === "CARD") { M.input = ""; M.draw(false); return UI.card(); }
      if (cmd === "HD" && M.section === "batman") { M.input = ""; return UI.viewer(`/assets/img/batman-${M.page + 1}.jpg`); }
      const games = { SNAKE: "snake", SERPENT: "snake", CROQ: "catch", CROQUETTES: "catch", TREATS: "catch", LASER: "laser", JEUX: "snake", GAMES: "snake" };
      if (games[cmd] && window.Games) { M.input = ""; M.draw(false); return window.Games.open(games[cmd]); }
      if (cmd === "MIAOU" || cmd === "MEOW") { M.input = ""; window.Cat && window.Cat.say(T().miaou); return M.draw(false); }
      if (cmd === "METEO" || cmd === "MÉTÉO" || cmd === "WEATHER") { M.input = ""; return M.flash(T().meteo); }
      const n = parseInt(cmd, 10);
      if (n >= 1 && n <= MENU.length) { M.section = MENU[n - 1]; M.page = 0; M.input = ""; return M.draw(); }
      M.input = "";
      M.flash(T().bad_choice);
    },

    key(fn) {
      if (M.state === "off") { if (fn === "CONNEXION" || fn === "ENVOI") M.powerOn(); return; }
      if (M.state === "connecting") return;
      if (M.state === "dial") {
        if (fn === "CONNEXION" || fn === "ENVOI") return M.connect();
        if (fn === "CORRECTION") { M.input = M.input.slice(0, -1); return M.drawDial(false); }
        if (fn === "ANNULATION") { M.input = ""; return M.drawDial(false); }
        return;
      }
      const pages = sections[M.section]().length;
      switch (fn) {
        case "CONNEXION": return M.hangup();
        case "SOMMAIRE": M.section = "sommaire"; M.page = 0; M.input = ""; return M.draw();
        case "GUIDE": M.section = "guide"; M.page = 0; return M.draw();
        case "REPETITION": return M.draw();
        case "SUITE":
          if (M.page < pages - 1) { M.page++; return M.draw(); }
          return M.flash(T().no_next);
        case "RETOUR":
          if (M.page > 0) { M.page--; return M.draw(); }
          if (M.section !== "sommaire") { M.section = "sommaire"; return M.draw(); }
          return M.flash(T().no_prev);
        case "CORRECTION": M.input = M.input.slice(0, -1); return M.draw(false);
        case "ANNULATION": M.input = ""; return M.draw(false);
        case "ENVOI": return M.command(M.input);
      }
    },
    type(ch) {
      if (M.state === "off" || M.state === "connecting") return;
      if (M.input.length >= 8) return UI.beep();
      M.input += ch.toUpperCase();
      if (M.state === "dial") return M.drawDial(false);
      if (M.section !== "sommaire") {
        // on inner pages, a digit jumps straight to that menu entry
        if (/^[1-7]$/.test(ch)) return M.command(ch);
        M.flash(M.input);
        return;
      }
      M.draw(false);
    },
    redraw() { if (M.state === "online") M.draw(false); else if (M.state === "dial") M.drawDial(false); else if (M.state === "off") M.drawOff(); },
  };

  /* ---------- wiring ---------- */
  document.querySelectorAll("[data-fn]").forEach((b) => b.addEventListener("click", () => { M.key(b.dataset.fn); scr.focus({ preventScroll: true }); }));
  document.querySelectorAll("[data-key]").forEach((b) => b.addEventListener("click", () => { M.type(b.dataset.key); scr.focus({ preventScroll: true }); }));
  document.getElementById("power").addEventListener("click", () => M.powerOn());

  inner.addEventListener("click", (e) => {
    const a = e.target.closest(".mt-link");
    if (a) {
      if (a.dataset.choice) { M.input = a.dataset.choice; M.command(a.dataset.choice); }
      else if (a.dataset.cmd) M.command(a.dataset.cmd);
      else if (a.dataset.game) window.Games.open(a.dataset.game);
      else if (a.dataset.fn) M.key(a.dataset.fn);
      return;
    }
    if (e.target.matches("canvas[data-hd]")) return UI.viewer(`/assets/img/batman-${M.page + 1}.jpg`);
    if (M.state === "off") M.powerOn();
  });

  // physical keyboard: only when not typing into something else
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest("input, textarea, .win")) return;
    const map = { Enter: "ENVOI", Escape: "SOMMAIRE", Backspace: "CORRECTION", ArrowRight: "SUITE", ArrowDown: "SUITE", PageDown: "SUITE", ArrowLeft: "RETOUR", ArrowUp: "RETOUR", PageUp: "RETOUR", Delete: "ANNULATION", F1: "GUIDE" };
    if (e.key === "Escape" && UI.closeTopWindow()) return;
    if (map[e.key]) {
      if (M.state === "off" && e.key !== "Enter") return;
      if (["ArrowDown", "ArrowUp", "Backspace", "PageDown", "PageUp"].includes(e.key) && M.state !== "online") return;
      e.preventDefault();
      const btn = document.querySelector(`.fk[data-fn="${map[e.key]}"]`);
      if (btn) { btn.classList.add("pressed"); setTimeout(() => btn.classList.remove("pressed"), 120); }
      return M.key(map[e.key]);
    }
    if (/^[a-zA-Z0-9*#éÉ]$/.test(e.key)) {
      if (M.state === "online" && document.activeElement !== scr && !/^[0-9]$/.test(e.key)) return;
      e.preventDefault();
      M.type(e.key);
    }
  });

  UI.onLang(() => M.redraw());
  window.Minitel = M;
})();
