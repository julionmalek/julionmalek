/* Pixel Batman: a little black cat that follows your cursor, naps, and talks. */
(function () {
  const UI = window.UI, Sp = window.Sprites;
  const cv = document.getElementById("cat");
  const bubble = document.getElementById("cat-bubble");
  const ctx = cv.getContext("2d");
  const S = 3;
  const OUTLINE = "rgba(235,235,255,0.85)";
  cv.width = 18 * S; cv.height = 14 * S;

  const render = (frame, flip) => { ctx.clearRect(0, 0, cv.width, cv.height); Sp.draw(ctx, frame, S, S, S, { flip, outline: OUTLINE }); };

  const isTouch = matchMedia("(hover: none)").matches;
  const cat = { x: window.innerWidth - 120, y: window.innerHeight - 60, tx: null, ty: null, flip: true, frame: "sit", tick: 0, lastMove: Date.now() };

  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    cat.tx = e.clientX; cat.ty = e.clientY; cat.lastMove = Date.now();
  });
  function wander() {
    cat.tx = 40 + Math.random() * (window.innerWidth - 80);
    cat.ty = window.innerHeight - 30 - Math.random() * 60;
  }

  function step() {
    cat.tick++;
    // stay out of the way while a game is open
    cv.style.display = document.querySelector(".win.game-win") ? "none" : "";
    const asleep = Date.now() - cat.lastMove > 9000;
    let moving = false;
    if (cat.tx != null && !asleep) {
      const dx = cat.tx - cat.x, dy = cat.ty + 26 - cat.y;
      const d = Math.hypot(dx, dy);
      if (d > 50) {
        const sp = Math.min(3.2, d / 30);
        cat.x += (dx / d) * sp; cat.y += (dy / d) * sp;
        cat.flip = dx < 0; moving = true;
      }
    }
    cat.frame = moving ? (Math.floor(cat.tick / 7) % 2 ? "walk1" : "walk2") : asleep ? "sleep" : "sit";
    if (asleep && cat.tick % 90 === 0 && bubble.hidden) say("z z z", 1800);
    render(cat.frame, cat.flip);
    cv.style.transform = `translate(${Math.round(cat.x - cv.width / 2)}px, ${Math.round(cat.y - cv.height)}px)`;
    if (!bubble.hidden) placeBubble();
    requestAnimationFrame(step);
  }

  function placeBubble() {
    bubble.style.transform = `translate(${Math.round(Math.min(window.innerWidth - bubble.offsetWidth - 6, Math.max(6, cat.x - 20)))}px, ${Math.round(cat.y - cv.height - bubble.offsetHeight - 6)}px)`;
  }
  function say(msg, ms = 2600) {
    bubble.textContent = msg; bubble.hidden = false; placeBubble();
    clearTimeout(say._t); say._t = setTimeout(() => { bubble.hidden = true; }, ms);
  }

  const lines = {
    fr: ["miaou.", "prrrrr", "j'ai faim.", "embauche mon humain.", "où sont mes croquettes ?", "je suis le webmaster.", "on joue ? (menu 7)", "3615 CROQUETTES"],
    en: ["meow.", "prrrrr", "i'm hungry.", "hire my human.", "where are my treats?", "i am the webmaster.", "wanna play? (menu 7)", "3615 TREATS"],
  };
  cv.addEventListener("click", () => {
    cat.lastMove = Date.now();
    const l = lines[UI.lang];
    say(l[Math.floor(Math.random() * l.length)]);
  });

  window.Cat = { say: (m) => { cat.lastMove = Date.now(); say(m); } };

  if (UI.reducedMotion) {
    render("sit", true);
    cv.style.transform = `translate(${cat.x}px, ${cat.y - cv.height}px)`;
    return;
  }
  if (isTouch) { wander(); setInterval(() => { cat.lastMove = Date.now(); wander(); }, 7000); }
  requestAnimationFrame(step);
})();
