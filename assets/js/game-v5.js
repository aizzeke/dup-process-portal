(function () {
  "use strict";

  const ROLE_ICON = {
    "МП":"🧭","ОСД":"📄","ЦП":"📐","ЦКС":"🛠","ОДС":"⚙️","ССОР":"🧾",
    "СБУЭиФ":"💰","СМиК":"🔍","ГД ДУП":"🖋","Контрагент":"🏗","overview":"🗺"
  };

    document.body.classList.add("dup-guide-enhanced");

  function createTopbar() {
    if (document.querySelector(".site-header")) return;
    const bar = document.createElement("header");
    bar.className = "site-header dup-guide-site-header";
    bar.innerHTML = `
      <div class="shell site-header__inner">
        <div class="site-header__left">
          <a class="brand" href="../../../" aria-label="Вернуться к каталогу процессов">
            <span class="brand__mark">ДУП</span>
            <span class="brand__text">Навигатор процессов</span>
          </a>
          <nav class="header-context" aria-label="Текущий раздел">
            <a href="../">Реализация проекта</a>
            <span class="header-context__sep">/</span>
            <span class="header-context__current">Моя роль</span>
          </nav>
        </div>
        <div class="site-header__actions">
          <div class="header-status" id="dup-guide-status" hidden>
            <span class="header-status__ring" id="dup-guide-status-ring"><span class="header-status__pct" id="dup-guide-status-pct">0%</span></span>
            <span class="header-status__text"><b id="dup-guide-status-title">Моя роль</b><small id="dup-guide-status-sub">Путь по процессу</small></span>
          </div>
          <button class="theme-toggle" type="button" id="dup-guide-theme" data-theme-toggle title="Сменить тему" aria-label="Сменить тему"><span class="theme-toggle__icon" data-theme-icon>☾</span></button>
        </div>
      </div>`;
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function parseWalkCount() {
    const node = document.querySelector(".walk-count");
    if (!node) return null;
    const text = node.textContent || "";
    const m = text.match(/Момент\s+(\d+)\s+из\s+(\d+).*?этап\s+(\d+)\s+из\s+(\d+)/i);
    if (!m) return null;
    return { current:+m[1], total:+m[2], stage:+m[3], stages:+m[4] };
  }

  function currentStageTitle() {
    const kicker = document.querySelector(".moment-kicker");
    if (!kicker) return "";
    return (kicker.textContent || "").replace(/^Этап\s+\d+\s*·\s*/i, "").trim();
  }

  function updateTopbar() {
    const status = document.getElementById("dup-guide-status");
    if (!status) return;
    const walk = parseWalkCount();
    const done = document.querySelector(".done-hero");

    if (!walk && !done) {
      status.hidden = true;
      return;
    }

    status.hidden = false;
    const role = (document.querySelector(".walk-role")?.textContent || document.querySelector(".done-big")?.textContent || "Моя роль").trim();
    const title = document.getElementById("dup-guide-status-title");
    const sub = document.getElementById("dup-guide-status-sub");
    const ring = document.getElementById("dup-guide-status-ring");
    const pct = document.getElementById("dup-guide-status-pct");

    if (walk) {
      const percent = Math.round((walk.current / Math.max(walk.total, 1)) * 100);
      title.textContent = role;
      sub.textContent = `Этап ${walk.stage} · момент ${walk.current}/${walk.total}`;
      ring.style.setProperty("--p", percent);
      pct.textContent = `${percent}%`;
    } else {
      title.textContent = role;
      sub.textContent = "Путь завершён";
      ring.style.setProperty("--p", 100);
      pct.textContent = "100%";
    }
  }

  function addRoleIcons() {
    document.querySelectorAll(".role-card[data-key]").forEach((card) => {
      const key = card.getAttribute("data-key");
      const name = card.querySelector(".rname");
      if (!name || name.querySelector(".dup-role-icon")) return;
      const icon = document.createElement("span");
      icon.className = "dup-role-icon";
      icon.textContent = ROLE_ICON[key] || "👤";
      name.prepend(icon);
    });

    const overview = document.querySelector(".role-card.overview[data-key='overview'] .rname");
    if (overview && !overview.querySelector(".dup-role-icon")) {
      const icon = document.createElement("span");
      icon.className = "dup-role-icon";
      icon.textContent = ROLE_ICON.overview;
      overview.prepend(icon);
    }
  }

  function addWalkRoleIcon() {
    const role = document.querySelector(".walk-role");
    if (!role || role.querySelector(".dup-role-icon")) return;
    const name = (role.textContent || "").trim();
    const icon = document.createElement("span");
    icon.className = "dup-role-icon";
    icon.textContent = ROLE_ICON[name] || (name === "Весь процесс" ? "🗺" : "👤");
    role.prepend(icon);
  }

  function addMissionHud() {
    const card = document.querySelector(".moment-card");
    const walk = parseWalkCount();
    if (!card || !walk) return;
    const existing = document.querySelector(".dup-mission-hud");
    const percent = Math.round((walk.current / Math.max(walk.total, 1)) * 100);
    const stageTitle = currentStageTitle();

    if (existing) {
      existing.querySelector(".dup-mission-hud__index b").textContent = `${walk.stage}/${walk.stages}`;
      existing.querySelector(".dup-mission-hud__copy b").textContent = stageTitle;
      existing.querySelector(".dup-mission-hud__ring").style.setProperty("--p", percent);
      existing.querySelector(".dup-mission-hud__ring span").textContent = `${percent}%`;
      return;
    }

    const hud = document.createElement("div");
    hud.className = "dup-mission-hud";
    hud.innerHTML = `
      <div class="dup-mission-hud__index"><b>${walk.stage}/${walk.stages}</b><small>этап</small></div>
      <div class="dup-mission-hud__copy"><small>Текущий участок маршрута</small><b>${stageTitle}</b></div>
      <div class="dup-mission-hud__ring" style="--p:${percent}"><span>${percent}%</span></div>`;
    card.parentNode.insertBefore(hud, card);
  }

  function addHotkeys() {
    const nav = document.querySelector(".nav-row");
    if (!nav || nav.querySelector(".dup-hotkeys")) return;
    const hint = document.createElement("span");
    hint.className = "dup-hotkeys";
    hint.textContent = "← / → с клавиатуры";
    const spacer = nav.querySelector(".nav-spacer");
    if (spacer) spacer.after(hint);
    else nav.appendChild(hint);
  }

  function markScreen() {
    let screen = "intro";
    if (document.querySelector(".walk-top")) screen = "walk";
    else if (document.querySelector(".done-hero")) screen = "done";
    document.body.setAttribute("data-dup-screen", screen);
  }

  let scheduled = false;
  function refresh() {
    scheduled = false;
    markScreen();
    addRoleIcons();
    addWalkRoleIcon();
    addMissionHud();
    addHotkeys();
    updateTopbar();
  }
  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  }

  createTopbar();
  refresh();

  const root = document.getElementById("pageRoot");
  if (root) new MutationObserver(scheduleRefresh).observe(root, { childList:true, subtree:true });

  document.addEventListener("click", (event) => {
    const checklist = event.target.closest(".checklist-item");
    if (checklist) checklist.classList.toggle("is-done");
  });

  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const tag = (event.target && event.target.tagName || "").toLowerCase();
    if (["input","textarea","select"].includes(tag)) return;
    if (document.body.getAttribute("data-dup-screen") !== "walk") return;

    if (event.key === "ArrowRight") {
      const next = document.querySelector('[data-action="next"]');
      if (next) { event.preventDefault(); next.click(); }
    } else if (event.key === "ArrowLeft") {
      const back = document.querySelector('[data-action="back"]:not([disabled])');
      if (back) { event.preventDefault(); back.click(); }
    }
  });
})();
