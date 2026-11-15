/* The serious site: everything is rendered from content.js so both sites stay in sync. */
(function () {
  const C = window.CONTENT;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const $ = (id) => document.getElementById(id);
  let lang = store.get("lang", (navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en");
  store.set("site", "pro");

  // static links
  const mail = `mailto:${C.links.email}`;
  $("mail-btn").href = mail; $("big-mail").href = mail; $("big-mail").textContent = C.links.email;
  ["li-btn", "li-2"].forEach((id) => { $(id).href = C.links.linkedin; });
  ["gh-btn", "gh-2"].forEach((id) => { $(id).href = C.links.github; });
  [$("to-y2k"), $("psst")].forEach((a) => a.addEventListener("click", () => store.set("site", "y2k")));

  function render() {
    const P = C.pro[lang];
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-t]").forEach((el) => { const v = P[el.dataset.t]; if (typeof v === "string") el.textContent = v; });
    $("lang").textContent = lang === "fr" ? "EN" : "FR";
    document.title = lang === "fr" ? "Julion Malek · Ingénieur logiciel" : "Julion Malek · Software Engineer";

    $("about-text").innerHTML = P.about.map((p) => `<p>${esc(p)}</p>`).join("");

    $("timeline").innerHTML = C.jobs.map((j) => `
      <li>
        <div class="tl-date">${esc(j.dates[lang])}</div>
        <div class="tl-body">
          <h3>${esc(j.co)} <span>· ${esc(j.where)}</span></h3>
          <p class="tl-role">${esc(j.role[lang])}</p>
          ${j.pts[lang].length ? `<ul>${j.pts[lang].map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        </div>
      </li>`).join("");

    $("cards").innerHTML = C.projects.map((p) => `
      <article class="card">
        <div class="card-top"><span class="badge">${esc(p.status === "live" ? P.live : p.status)}</span><span class="year">${esc(p.year)}</span></div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.desc[lang])}</p>
        <ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <div class="card-links">
          ${p.demo ? `<a href="${esc(p.demo)}">${esc(P.demo)} →</a>` : ""}
          ${p.repo ? `<a href="${esc(p.repo)}" target="_blank" rel="noopener">${esc(P.code)} ↗</a>` : ""}
        </div>
      </article>`).join("") + `
      <article class="card soon">
        <h3>${esc(P.soon_title)}</h3>
        <p>${esc(P.soon)}</p>
      </article>`;

    $("skills").innerHTML = C.mt[lang].skills.map(([k, v]) => `<dt>${esc(k.length <= 3 ? k : k.toLowerCase())}</dt><dd>${v.split(", ").map((x) => `<span>${esc(x)}</span>`).join("")}</dd>`).join("");
    $("edu").innerHTML = C.school.map((s) => `<div class="edu"><h3>${esc(s.name)}</h3><p>${esc(s.what[lang])}${s.dates ? ` · ${esc(s.dates)}` : ""}</p></div>`).join("");
  }

  $("lang").addEventListener("click", () => { lang = lang === "fr" ? "en" : "fr"; store.set("lang", lang); render(); });

  // pixel Batman: in the logo, and sitting on the footer (he blinks)
  const S = window.Sprites;
  const OUT = "rgba(240,240,255,.75)";
  S.draw($("logo-cat").getContext("2d"), "face", 2, 2, 2, { outline: OUT });
  const fc = $("foot-cat").getContext("2d");
  const drawFoot = (frame) => { fc.clearRect(0, 0, 64, 48); S.draw(fc, frame, 4, 4, 3, { flip: true, outline: OUT }); };
  drawFoot("sit");
  $("foot-cat").addEventListener("click", () => { drawFoot("sleep"); setTimeout(() => drawFoot("sit"), 1500); });

  // subtle reveal on scroll
  const io = "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 })
    : null;
  render();
  document.querySelectorAll(".section, .stats").forEach((el) => { if (io) { el.classList.add("reveal"); io.observe(el); } });
})();
