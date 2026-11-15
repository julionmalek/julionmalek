(function () {
  const UI = window.UI, M = window.Minitel;

  document.getElementById("lang-toggle").addEventListener("click", () => UI.setLang(UI.lang === "fr" ? "en" : "fr"));
  document.getElementById("boring-btn").addEventListener("click", () => UI.goPro());
  UI.store.set("site", "y2k");
  document.getElementById("sound-btn").addEventListener("click", UI.toggleSound);
  document.getElementById("sound-btn").textContent = UI.muted ? "🔇" : "🔊";
  document.getElementById("open-card").addEventListener("click", () => UI.card());

  document.querySelectorAll("[data-view]").forEach((el) => el.addEventListener("click", () => UI.viewer(el.dataset.view, el.dataset.cap)));
  document.querySelectorAll("[data-goto]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); M.goto(el.dataset.goto); }));

  // projects list in the right column (data lives in content.js)
  const renderProjects = () => {
    const ul = document.getElementById("y2k-projects");
    ul.innerHTML = window.CONTENT.projects.map((p, i) =>
      `<li><a href="#" data-project="${i}">${UI.esc(p.name)}</a> <span class="tiny">${UI.esc(p.year)}</span></li>`).join("");
    ul.querySelectorAll("[data-project]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); M.goto("projets", +el.dataset.project); }));
  };
  UI.onLang(renderProjects);

  // little pixel icons on the game buttons
  document.querySelectorAll("canvas[data-sprite]").forEach((c) => {
    const [w, h] = window.Sprites.size(c.dataset.sprite);
    const sc = Math.floor(Math.min(c.width / w, c.height / h));
    window.Sprites.draw(c.getContext("2d"), c.dataset.sprite, (c.width - w * sc) / 2, (c.height - h * sc) / 2, sc);
  });

  UI.setLang(UI.lang);
  UI.counter();
  UI.nowPlaying();

  document.querySelectorAll("[data-game]").forEach((el) => el.addEventListener("click", () => window.Games.open(el.dataset.game)));

  // the Julitel warms up on its own; you just press CONNEXION
  M.drawOff();
  setTimeout(() => M.powerOn(), 700);

  // a few pop-ups per visit, never more than one at a time
  UI.scheduleAd(18000);
})();
