/* Shared UI bits: language, storage, sounds, draggable windows, pop-up ads,
   photo viewer, baseball card, visitor counter. */
(function () {
  const C = window.CONTENT;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const reducedMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const UI = {
    store, esc, reducedMotion,
    lang: store.get("lang", (navigator.language || "fr").toLowerCase().startsWith("fr") ? "fr" : "en"),
    muted: store.get("muted", "0") === "1",
    listeners: [],

    t(key) { return C.ui[UI.lang][key]; },

    setLang(lang) {
      UI.lang = lang;
      store.set("lang", lang);
      document.documentElement.lang = lang;
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const v = UI.t(el.dataset.i18n);
        if (typeof v === "string") el.textContent = v;
      });
      document.getElementById("lang-label").textContent = lang === "fr" ? "ENGLISH" : "FRANÇAIS";
      document.getElementById("flag").className = "flag " + (lang === "fr" ? "flag-us" : "flag-fr");
      document.title = lang === "fr" ? "3615 JULION — La page perso de Julion Malek" : "3615 JULION — Julion Malek's Home Page";
      UI.listeners.forEach((fn) => fn(lang));
    },
    onLang(fn) { UI.listeners.push(fn); },

    /* ---------------- sound ---------------- */
    audio() {
      if (UI.muted) return null;
      try {
        UI._ctx = UI._ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (UI._ctx.state === "suspended") UI._ctx.resume();
        return UI._ctx;
      } catch (e) { return null; }
    },
    tone(ctx, freq, start, dur, vol = 0.05, type = "sine") {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(vol, start + 0.01);
      g.gain.setValueAtTime(vol, start + dur - 0.02);
      g.gain.linearRampToValueAtTime(0, start + dur);
      o.connect(g).connect(ctx.destination);
      o.start(start); o.stop(start + dur + 0.02);
    },
    beep() {
      const ctx = UI.audio(); if (!ctx) return;
      UI.tone(ctx, 1000, ctx.currentTime, 0.06, 0.03, "square");
    },
    /* DTMF "3615" then a (short, polite) modem handshake. Returns duration in ms. */
    modem() {
      const ctx = UI.audio(); if (!ctx) return 1200;
      const dtmf = { 1: [697, 1209], 3: [697, 1477], 5: [770, 1336], 6: [770, 1477] };
      let t = ctx.currentTime + 0.05;
      for (const d of "3615") {
        dtmf[d].forEach((f) => UI.tone(ctx, f, t, 0.12, 0.04));
        t += 0.2;
      }
      t += 0.2;
      UI.tone(ctx, 2100, t, 0.5, 0.03); t += 0.55;
      for (let i = 0; i < 10; i++) {
        UI.tone(ctx, i % 2 ? 1180 : 980, t, 0.06, 0.025, "square");
        UI.tone(ctx, 1650 + (i % 3) * 200, t + 0.03, 0.05, 0.015, "sawtooth");
        t += 0.07;
      }
      // noisy hiss
      const len = 0.6, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.04;
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start(t);
      t += len;
      return Math.round((t - ctx.currentTime) * 1000);
    },
    toggleSound() {
      UI.muted = !UI.muted;
      store.set("muted", UI.muted ? "1" : "0");
      document.getElementById("sound-btn").textContent = UI.muted ? "🔇" : "🔊";
    },

    /* ---------------- windows ---------------- */
    z: 1000,
    openWindow({ title, body, cls = "", width = 320, x, y, onClose }) {
      const win = document.createElement("div");
      win.className = "win " + cls;
      win.style.width = Math.min(width, window.innerWidth - 24) + "px";
      win.style.zIndex = ++UI.z;
      win.innerHTML = `
        <div class="win-title"><span class="win-name">${esc(title)}</span>
          <span class="win-ctrls"><button tabindex="-1" aria-hidden="true">_</button><button tabindex="-1" aria-hidden="true">□</button><button class="win-x" aria-label="Close">×</button></span>
        </div>
        <div class="win-body"></div>`;
      const bodyEl = win.querySelector(".win-body");
      if (typeof body === "string") bodyEl.innerHTML = body; else bodyEl.appendChild(body);
      document.getElementById("windows").appendChild(win);

      const w = win.offsetWidth, h = win.offsetHeight;
      const px = x != null ? x : Math.random() * Math.max(8, window.innerWidth - w - 16) + 8;
      const py = y != null ? y : Math.random() * Math.max(8, window.innerHeight - h - 16) + 8;
      win.style.left = Math.max(4, Math.min(px, window.innerWidth - w - 4)) + "px";
      win.style.top = Math.max(4, Math.min(py, window.innerHeight - h - 4)) + "px";

      const close = () => { win.remove(); onClose && onClose(); };
      win.querySelector(".win-x").addEventListener("click", close);
      win.addEventListener("pointerdown", () => { win.style.zIndex = ++UI.z; });

      // drag by title bar
      const bar = win.querySelector(".win-title");
      bar.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button")) return;
        const ox = e.clientX - win.offsetLeft, oy = e.clientY - win.offsetTop;
        bar.setPointerCapture(e.pointerId);
        const move = (ev) => {
          win.style.left = Math.max(-w + 60, Math.min(ev.clientX - ox, window.innerWidth - 60)) + "px";
          win.style.top = Math.max(0, Math.min(ev.clientY - oy, window.innerHeight - 30)) + "px";
        };
        const up = () => { bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); };
        bar.addEventListener("pointermove", move);
        bar.addEventListener("pointerup", up);
      });
      win.close = close;
      return win;
    },
    closeTopWindow() {
      const wins = [...document.querySelectorAll(".win")];
      if (!wins.length) return false;
      wins.sort((a, b) => b.style.zIndex - a.style.zIndex)[0].close();
      return true;
    },

    viewer(src, capKey) {
      const name = src.split("/").pop();
      const cap = capKey ? UI.t(capKey) || capKey : "";
      UI.openWindow({
        title: `${name} - ${UI.t("viewer")}`, width: 420, cls: "viewer",
        x: (window.innerWidth - 420) / 2, y: 40,
        body: `<img src="${esc(src)}" alt=""><p>${esc(cap)}</p>`,
      });
    },

    /* ---------------- baseball card ---------------- */
    card() {
      if (document.querySelector(".win.card-win")) return;
      const fr = UI.lang === "fr";
      const L = fr
        ? { mcp: "OUTILS MCP", born: "NÉ EN", bats: "FRAPPE", throws: "LANCE", hometown: "VILLE", career: "CARRIÈRE", flip: "cliquez pour retourner", query: "TEMPS DE REQUÊTE", rows: "LIGNES IMPORTÉES", langs: "LANGUES", pets: "CHATS", trivia: "LE SAVIEZ-VOUS ? Il a été capitaine de l'équipe de baseball du Lycée Français de New York, puis a joué pour Polytechnique Montréal." }
        : { mcp: "MCP TOOLS", born: "BORN", bats: "BATS", throws: "THROWS", hometown: "HOMETOWN", career: "CAREER", flip: "click to flip", query: "QUERY TIME", rows: "ROWS IMPORTED", langs: "LANGUAGES", pets: "CATS", trivia: "DID YOU KNOW? He captained the Lycée Français de New York baseball team, then played for Polytechnique Montréal." };
      const body = `
        <div class="bcard" tabindex="0" role="button" aria-label="${L.flip}">
          <div class="bcard-inner">
            <div class="bcard-front">
              <div class="bcard-team">JULITEL ★ NEW YORK</div>
              <div class="bcard-photo"><img src="/assets/img/julion-headshot.jpg" alt=""></div>
              <div class="bcard-name">JULION MALEK</div>
              <div class="bcard-pos">SOFTWARE ENG. · ${fr ? "DONNÉES + IA" : "DATA + AI"}</div>
              <div class="bcard-rookie">ROOKIE<br>2001</div>
            </div>
            <div class="bcard-back">
              <div class="bcard-back-head">#01 · JULION MALEK</div>
              <table>
                <tr><td>${L.born}</td><td>2001</td></tr>
                <tr><td>${L.hometown}</td><td>New York</td></tr>
                <tr><td>${L.bats}</td><td>Python</td></tr>
                <tr><td>${L.throws}</td><td>TypeScript</td></tr>
                <tr><td>${L.query}</td><td>170s → 3s</td></tr>
                <tr><td>${L.rows}</td><td>731,000</td></tr>
                <tr><td>${L.mcp}</td><td>✔ ${fr ? "sécurisés" : "secured"}</td></tr>
                <tr><td>${L.langs}</td><td>EN · FR · ES</td></tr>
                <tr><td>${L.pets}</td><td>1 (Batman)</td></tr>
              </table>
              <p>${L.trivia}</p>
            </div>
          </div>
        </div>
        <p class="tiny center">${L.flip}</p>`;
      const win = UI.openWindow({ title: "rookie_card_2001.bmp", body, width: 300, cls: "card-win", x: (window.innerWidth - 300) / 2, y: 30 });
      const card = win.querySelector(".bcard");
      const flip = () => card.classList.toggle("flipped");
      card.addEventListener("click", flip);
      card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
    },

    /* ---------------- pop-up ads (toned down: one at a time, a handful per visit) ---------------- */
    ads() {
      const fr = UI.lang === "fr";
      return [
        {
          title: fr ? "⚠ OFFRE EXCLUSIVE ⚠" : "⚠ EXCLUSIVE OFFER ⚠", cls: "ad ad-red",
          html: fr
            ? `<h3>Les DBA le DÉTESTENT !</h3><p>Un ingénieur new-yorkais a fait passer une requête de <b>170 secondes à 3</b> avec CETTE astuce bizarre.</p>`
            : `<h3>DBAs HATE HIM!</h3><p>A New York engineer cut a database commit from <b>170 seconds to 3</b> with ONE WEIRD TRICK.</p>`,
          btn: fr ? "EN SAVOIR PLUS >>" : "LEARN MORE >>", go: "parcours",
        },
        {
          title: fr ? "🎉 FÉLICITATIONS 🎉" : "🎉 CONGRATULATIONS 🎉", cls: "ad ad-gold",
          html: fr
            ? `<h3 class="rainbow">Vous êtes le 1 000 000<sup>ème</sup> visiteur !!!</h3><p>Vous avez gagné : <b>un café de 30 minutes avec Julion</b>.</p>`
            : `<h3 class="rainbow">You are the 1,000,000<sup>th</sup> visitor!!!</h3><p>You've won: <b>a 30-minute coffee chat with Julion</b>.</p>`,
          btn: fr ? "RÉCLAMER MON PRIX" : "CLAIM MY PRIZE", go: "contact",
        },
        {
          title: "Batman - Message", cls: "ad ad-msn",
          html: fr
            ? `<p><b>Batman</b> vient de se connecter.</p><p class="msn-msg">Batman dit : miaou.<br><i>(traduction : embauchez mon humain, j'ai besoin de croquettes)</i></p>`
            : `<p><b>Batman</b> has just signed in.</p><p class="msn-msg">Batman says: meow.<br><i>(translation: hire my human, I need more treats)</i></p>`,
          btn: fr ? "VOIR BATMAN" : "SEE BATMAN", go: "batman",
        },
        {
          title: fr ? "Ingénieur BILINGUE près de chez vous" : "BILINGUAL engineer in your area", cls: "ad ad-blue",
          html: fr
            ? `<h3>Il parle Python, TypeScript <u>ET</u> français.</h3><p>Disponible pour discuter. Libre de toute dette technique.</p>`
            : `<h3>He speaks Python, TypeScript <u>AND</u> French.</h3><p>Available to chat. Free of all technical debt.</p>`,
          btn: fr ? "VOIR LE PROFIL" : "VIEW PROFILE", go: "boring",
        },
        {
          title: fr ? "Votre ordinateur est LENT ?" : "Is your computer SLOW?", cls: "ad ad-ram",
          html: fr
            ? `<h3>TÉLÉCHARGEZ PLUS DE RAM</h3><div class="progress"><i></i></div><p class="ram-msg">100% gratuit. 0% virus*</p><p class="tiny">*probablement</p>`
            : `<h3>DOWNLOAD MORE RAM</h3><div class="progress"><i></i></div><p class="ram-msg">100% free. 0% viruses*</p><p class="tiny">*probably</p>`,
          btn: fr ? "TÉLÉCHARGER" : "DOWNLOAD", go: "ram",
        },
      ];
    },
    adsShown: 0,
    adOrder: null,
    scheduleAd(delay) {
      clearTimeout(UI._adTimer);
      if (UI.adsShown >= 4) return;
      UI._adTimer = setTimeout(UI.showAd, delay);
    },
    showAd() {
      if (document.querySelector(".win.ad, .win.game-win")) return UI.scheduleAd(20000);
      if (!UI.adOrder) UI.adOrder = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
      const ad = UI.ads()[UI.adOrder[UI.adsShown % 5]];
      UI.adsShown++;
      const win = UI.openWindow({
        title: ad.title, cls: ad.cls, width: 290,
        body: `${ad.html}<button class="ad-btn">${UI.esc(ad.btn)}</button>`,
        onClose: () => UI.scheduleAd(45000 + Math.random() * 30000),
      });
      if (ad.cls.includes("ad-msn")) { // MSN toast sits bottom-right
        win.style.left = window.innerWidth - win.offsetWidth - 12 + "px";
        win.style.top = window.innerHeight - win.offsetHeight - 12 + "px";
      }
      win.querySelector(".ad-btn").addEventListener("click", () => {
        if (ad.go === "ram") {
          const bar = win.querySelector(".progress i"), msg = win.querySelector(".ram-msg");
          bar.style.width = "99%";
          setTimeout(() => { msg.textContent = UI.lang === "fr" ? "ERREUR : le chat s'est assis sur le clavier." : "ERROR: the cat sat on the keyboard."; }, 1800);
          return;
        }
        win.close();
        if (ad.go === "boring") UI.goPro();
        else window.Minitel && window.Minitel.goto(ad.go);
      });
    },

    /* ---------------- switching sites (choice is remembered) ---------------- */
    goPro() { store.set("site", "pro"); location.href = "/pro/"; },
    goY2k() { store.set("site", "y2k"); location.href = "/y2k/"; },

    /* ---------------- visitor counter ---------------- */
    counter() {
      const el = document.getElementById("counter");
      const draw = (n) => { el.innerHTML = String(n).padStart(7, "0").split("").map((d) => `<span>${d}</span>`).join(""); };
      draw(999999);
      setTimeout(() => { draw(1000000); el.classList.add("hit"); }, 4000);
    },

    nowPlaying() {
      const el = document.getElementById("now-playing");
      let i = 0;
      const tick = () => { const list = UI.t("now_playing"); el.textContent = list[i++ % list.length]; };
      tick();
      setInterval(tick, 7000);
      UI.onLang(tick);
    },
  };

  window.UI = UI;
})();
