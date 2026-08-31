(function () {
  "use strict";

  const tabButtons = Array.from(document.querySelectorAll("button[data-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-panel]"));
  let bpmnViewer = null;
  let bpmnLoaded = false;

  function getDiagramBounds() {
    if (!bpmnViewer) return null;
    try {
      const registry = bpmnViewer.get("elementRegistry");
      const elements = registry.getAll().filter((el) =>
        el && !el.labelTarget &&
        Number.isFinite(el.x) && Number.isFinite(el.y) &&
        Number.isFinite(el.width) && Number.isFinite(el.height) &&
        el.width > 0 && el.height > 0
      );
      if (!elements.length) return null;

      const minX = Math.min(...elements.map((e) => e.x));
      const minY = Math.min(...elements.map((e) => e.y));
      const maxX = Math.max(...elements.map((e) => e.x + e.width));
      const maxY = Math.max(...elements.map((e) => e.y + e.height));
      return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    } catch (_) {
      return null;
    }
  }

  function updateZoomLabel() {
    const label = document.getElementById("diagram-zoom-value");
    if (!label || !bpmnViewer) return;
    try {
      const zoom = bpmnViewer.get("canvas").zoom() || 1;
      label.textContent = `${Math.round(zoom * 100)}%`;
    } catch (_) {}
  }

  function fitWholeDiagram() {
    if (!bpmnViewer) return;
    try {
      const canvas = bpmnViewer.get("canvas");
      canvas.zoom("fit-viewport");
      updateZoomLabel();
    } catch (_) {}
  }

  function focusDiagramStart() {
    if (!bpmnViewer) return;
    try {
      const canvas = bpmnViewer.get("canvas");
      const frame = document.getElementById("bpmn-canvas");
      const bounds = getDiagramBounds();
      if (!frame || !bounds || !frame.clientWidth || !frame.clientHeight) {
        fitWholeDiagram();
        return;
      }

      const padX = 90;
      const padY = 70;
      const fitWidthScale = frame.clientWidth / Math.max(bounds.width + padX * 2, 1);
      // Для очень широких схем не открываем их микроскопически: показываем читаемое начало.
      const scale = Math.min(Math.max(fitWidthScale * 1.15, 0.22), 0.85);
      const worldWidth = frame.clientWidth / scale;
      const worldHeight = frame.clientHeight / scale;

      canvas.viewbox({
        x: bounds.minX - padX,
        y: bounds.minY - padY,
        width: worldWidth,
        height: worldHeight
      });
      updateZoomLabel();
    } catch (_) {
      fitWholeDiagram();
    }
  }

  function setActiveTab(name, updateHash = true) {
    const allowed = ["diagram", "document"];
    const next = allowed.includes(name) ? name : "diagram";

    tabButtons.forEach((button) => {
      const active = button.dataset.tab === next;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });

    panels.forEach((panel) => {
      const active = panel.dataset.panel === next;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    if (updateHash) history.replaceState(null, "", `#${next}`);
    if (next === "diagram" && bpmnLoaded) requestAnimationFrame(updateZoomLabel);
  }

  tabButtons.forEach((button, index) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + delta + tabButtons.length) % tabButtons.length;
      tabButtons[nextIndex].focus();
      setActiveTab(tabButtons[nextIndex].dataset.tab);
    });
  });

  window.addEventListener("hashchange", () => {
    const hash = location.hash.replace("#", "");
    if (hash === "guide") {
      location.href = "./guide/";
      return;
    }
    setActiveTab(hash, false);
  });

  const initialHash = location.hash.replace("#", "");
  if (initialHash === "guide") {
    location.replace("./guide/");
    return;
  }
  setActiveTab(initialHash || "diagram", false);

  async function exists(url) {
    try {
      const response = await fetch(url, { method: "HEAD", cache: "no-store" });
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  function showDiagramError(title, body) {
    document.getElementById("diagram-loading").hidden = true;
    const empty = document.getElementById("diagram-empty");
    empty.hidden = false;
    empty.innerHTML = `
      <div class="empty-state__icon">⌘</div>
      <h3>${title}</h3>
      <p>${body}</p>
    `;
  }

  async function initBpmn() {
    const url = "./diagram/realization.bpmn";
    const loading = document.getElementById("diagram-loading");
    const actions = document.getElementById("diagram-actions");
    const download = document.getElementById("diagram-download");
    const demo = document.getElementById("diagram-demo");

    if (!(await exists(url))) {
      showDiagramError("BPMN пока не добавлен", "Добавьте файл <code>processes/realization/diagram/realization.bpmn</code>.");
      return;
    }

    if (typeof window.BpmnJS !== "function") {
      showDiagramError("Не удалось загрузить просмотрщик BPMN", "Проверьте доступ к CDN или подключите bpmn-js локально.");
      return;
    }

    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();

      bpmnViewer = new window.BpmnJS({ container: "#bpmn-canvas" });
      await bpmnViewer.importXML(xml);
      bpmnLoaded = true;

      loading.hidden = true;
      actions.hidden = false;
      download.hidden = false;
      demo.hidden = !xml.includes("DUP_PORTAL_DEMO_PLACEHOLDER");

      requestAnimationFrame(() => requestAnimationFrame(focusDiagramStart));

      document.querySelector("[data-diagram-action='zoom-in']").addEventListener("click", () => {
        const canvas = bpmnViewer.get("canvas");
        canvas.zoom(Math.min((canvas.zoom() || 1) + 0.15, 4));
        updateZoomLabel();
      });

      document.querySelector("[data-diagram-action='zoom-out']").addEventListener("click", () => {
        const canvas = bpmnViewer.get("canvas");
        canvas.zoom(Math.max((canvas.zoom() || 1) - 0.15, 0.08));
        updateZoomLabel();
      });

      document.querySelector("[data-diagram-action='zoom-reset']").addEventListener("click", fitWholeDiagram);

      document.querySelector("[data-diagram-action='fullscreen']").addEventListener("click", async () => {
        const frame = document.getElementById("bpmn-frame");
        if (!document.fullscreenElement) await frame.requestFullscreen?.();
        else await document.exitFullscreen?.();
        setTimeout(updateZoomLabel, 160);
      });

      // Колесо мыши внутри BPMN управляет только схемой. Глобального скролла на странице процесса нет.
      const canvasNode = document.getElementById("bpmn-canvas");
      canvasNode.addEventListener("wheel", (event) => {
        event.stopPropagation();
      }, { passive: true });

      window.addEventListener("resize", () => {
        if (document.querySelector("[data-panel='diagram']")?.classList.contains("is-active")) {
          clearTimeout(window.__dupResizeTimer);
          window.__dupResizeTimer = setTimeout(updateZoomLabel, 140);
        }
      });
    } catch (error) {
      showDiagramError("Не удалось открыть BPMN", `Проверьте файл <code>realization.bpmn</code>. ${String(error.message || error)}`);
    }
  }

  async function initDocument() {
    const pdf = "./document/regulation.pdf";
    const docx = "./document/regulation.docx";
    const viewer = document.getElementById("document-viewer");
    const empty = document.getElementById("document-empty");
    const actions = document.getElementById("document-actions");
    const docxLink = document.getElementById("document-docx-download");
    const pdfOpen = document.getElementById("document-open");
    const pdfDownload = document.getElementById("document-pdf-download");

    const [hasPdf, hasDocx] = await Promise.all([exists(pdf), exists(docx)]);
    pdfOpen.hidden = !hasPdf;
    pdfDownload.hidden = !hasPdf;

    if (hasPdf) {
      viewer.src = `${pdf}#toolbar=1&navpanes=0&view=FitH`;
      viewer.hidden = false;
      empty.hidden = true;
      actions.hidden = false;
    }

    if (hasDocx) {
      docxLink.hidden = false;
      actions.hidden = false;
    }

    if (!hasPdf && hasDocx) {
      empty.innerHTML = `
        <div class="empty-state__icon">▤</div>
        <h3>Документ доступен в DOCX</h3>
        <p>Для просмотра прямо на странице добавьте рядом файл <code>regulation.pdf</code>.</p>
      `;
    }
  }

  initBpmn();
  initDocument();
})();
