(function () {
  "use strict";

  let bpmnViewer = null;
  let bpmnLoaded = false;
  let documentUrl = null;
  let documentDocxUrl = null;

  async function exists(url) {
    try {
      const response = await fetch(url, { method: "HEAD", cache: "no-store" });
      return response.ok;
    } catch (_) {
      return false;
    }
  }

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
      bpmnViewer.get("canvas").zoom("fit-viewport");
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

  function showToast(message, type = "ok") {
    const toast = document.getElementById("export-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = `export-toast is-visible ${type === "error" ? "is-error" : ""}`;
    toast.hidden = false;
    clearTimeout(window.__dupExportToastTimer);
    window.__dupExportToastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => { toast.hidden = true; }, 180);
    }, 2200);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function getDiagramSvg() {
    if (!bpmnViewer || !bpmnLoaded) throw new Error("Схема ещё не загружена");
    const result = await bpmnViewer.saveSVG({ format: true });
    if (!result || !result.svg) throw new Error("Не удалось сформировать SVG");
    return result.svg;
  }

  function parseSvgSize(svgText) {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svg = doc.documentElement;
    const vb = (svg.getAttribute("viewBox") || "").trim().split(/[ ,]+/).map(Number);
    if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) {
      return { width: vb[2], height: vb[3] };
    }
    const width = parseFloat(svg.getAttribute("width")) || 1600;
    const height = parseFloat(svg.getAttribute("height")) || 900;
    return { width, height };
  }

  function blobToUint8Array(blob) {
    return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }

  function asciiBytes(text) {
    return new TextEncoder().encode(text);
  }

  function concatBytes(parts) {
    const size = parts.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(size);
    let offset = 0;
    parts.forEach((part) => {
      out.set(part, offset);
      offset += part.length;
    });
    return out;
  }

  function buildPdfWithJpeg(jpegBytes, imageWidth, imageHeight) {
    const ratio = imageWidth / imageHeight;
    const margin = 24;
    let pageWidth;
    let pageHeight;

    if (ratio >= 1) {
      pageHeight = 842;
      pageWidth = Math.min(4000, Math.max(1191, pageHeight * ratio));
    } else {
      pageWidth = 595;
      pageHeight = Math.min(4000, Math.max(842, pageWidth / ratio));
    }

    const scale = Math.min(
      (pageWidth - margin * 2) / imageWidth,
      (pageHeight - margin * 2) / imageHeight
    );
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;
    const content = `q\n${drawWidth.toFixed(3)} 0 0 ${drawHeight.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm\n/Im0 Do\nQ\n`;
    const contentBytes = asciiBytes(content);

    const parts = [];
    const offsets = [0];
    let cursor = 0;
    const push = (bytes) => { parts.push(bytes); cursor += bytes.length; };
    const pushText = (text) => push(asciiBytes(text));
    const startObj = (id) => { offsets[id] = cursor; pushText(`${id} 0 obj\n`); };

    pushText("%PDF-1.4\n% DUP BPMN export\n");

    startObj(1);
    pushText("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

    startObj(2);
    pushText("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

    startObj(3);
    pushText(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(3)} ${pageHeight.toFixed(3)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);

    startObj(4);
    pushText(`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
    push(jpegBytes);
    pushText("\nendstream\nendobj\n");

    startObj(5);
    pushText(`<< /Length ${contentBytes.length} >>\nstream\n`);
    push(contentBytes);
    pushText("endstream\nendobj\n");

    const xrefOffset = cursor;
    pushText("xref\n0 6\n");
    pushText("0000000000 65535 f \n");
    for (let i = 1; i <= 5; i += 1) {
      pushText(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
    }
    pushText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    return new Blob([concatBytes(parts)], { type: "application/pdf" });
  }

  async function svgToJpeg(svgText) {
    const size = parseSvgSize(svgText);
    const maxSide = 8000;
    const maxPixels = 42000000;
    const rawScale = Math.min(
      2.2,
      maxSide / Math.max(size.width, 1),
      maxSide / Math.max(size.height, 1),
      Math.sqrt(maxPixels / Math.max(size.width * size.height, 1))
    );
    const scale = Math.max(rawScale, 0.15);
    const width = Math.max(1, Math.round(size.width * scale));
    const height = Math.max(1, Math.round(size.height * scale));

    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Не удалось отрисовать SVG"));
        image.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      const jpegBlob = await new Promise((resolve, reject) => {
        canvas.toBlob((out) => out ? resolve(out) : reject(new Error("Не удалось сформировать изображение")), "image/jpeg", 0.96);
      });
      return { bytes: await blobToUint8Array(jpegBlob), width, height };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function exportSvg(button) {
    const old = button.textContent;
    button.disabled = true;
    button.textContent = "…";
    try {
      const svg = await getDiagramSvg();
      downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), "realization.svg");
      showToast("SVG готов");
    } catch (error) {
      showToast(String(error.message || error), "error");
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }

  async function exportPdf(button) {
    const old = button.textContent;
    button.disabled = true;
    button.textContent = "…";
    try {
      const svg = await getDiagramSvg();
      const jpeg = await svgToJpeg(svg);
      const pdf = buildPdfWithJpeg(jpeg.bytes, jpeg.width, jpeg.height);
      downloadBlob(pdf, "realization.pdf");
      showToast("PDF готов");
    } catch (error) {
      console.error(error);
      showToast("Не удалось сформировать PDF", "error");
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }

  async function initBpmn() {
    const url = "./diagram/realization.bpmn";
    const loading = document.getElementById("diagram-loading");
    const actions = document.getElementById("diagram-actions");
    const download = document.getElementById("diagram-download");
    const svgDownload = document.getElementById("diagram-svg-download");
    const pdfDownload = document.getElementById("diagram-pdf-download");
    const demo = document.getElementById("diagram-demo");

    if (!(await exists(url))) {
      showDiagramError("BPMN пока не добавлен", "Добавьте файл <code>processes/realization/diagram/realization.bpmn</code>.");
      return;
    }

    if (typeof window.BpmnJS !== "function") {
      showDiagramError("Не удалось загрузить просмотрщик BPMN", "Проверьте доступ к bpmn-js.");
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
      svgDownload.hidden = false;
      pdfDownload.hidden = false;
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

      svgDownload.addEventListener("click", () => exportSvg(svgDownload));
      pdfDownload.addEventListener("click", () => exportPdf(pdfDownload));

      const canvasNode = document.getElementById("bpmn-canvas");
      canvasNode.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });

      window.addEventListener("resize", () => {
        clearTimeout(window.__dupResizeTimer);
        window.__dupResizeTimer = setTimeout(updateZoomLabel, 140);
      });
    } catch (error) {
      showDiagramError("Не удалось открыть BPMN", `Проверьте файл <code>realization.bpmn</code>. ${String(error.message || error)}`);
    }
  }

  function activatePanel(name, updateHash = true) {
    const diagramTab = document.getElementById("tab-diagram");
    const documentTab = document.getElementById("tab-document");
    const diagramPanel = document.getElementById("panel-diagram");
    const documentPanel = document.getElementById("panel-document");
    const isDocument = name === "document" && documentTab && !documentTab.disabled;

    if (diagramTab) {
      diagramTab.classList.toggle("is-active", !isDocument);
      if (!isDocument) diagramTab.setAttribute("aria-current", "page");
      else diagramTab.removeAttribute("aria-current");
    }
    if (documentTab) {
      documentTab.classList.toggle("is-active", isDocument);
      if (isDocument) documentTab.setAttribute("aria-current", "page");
      else documentTab.removeAttribute("aria-current");
    }
    if (diagramPanel) {
      diagramPanel.hidden = isDocument;
      diagramPanel.classList.toggle("is-active", !isDocument);
    }
    if (documentPanel) {
      documentPanel.hidden = !isDocument;
      documentPanel.classList.toggle("is-active", isDocument);
    }

    if (isDocument) {
      const preview = document.getElementById("document-preview");
      if (preview && documentUrl && !preview.getAttribute("src")) {
        preview.src = documentUrl + "#view=FitH";
      }
    } else if (bpmnViewer) {
      requestAnimationFrame(() => {
        try {
          const canvas = bpmnViewer.get("canvas");
          if (typeof canvas.resized === "function") canvas.resized();
          updateZoomLabel();
        } catch (_) {}
      });
    }

    if (updateHash) {
      const hash = isDocument ? "#document" : "#diagram";
      history.replaceState(null, "", location.pathname + hash);
    }
  }

  function initTabs() {
    const diagramTab = document.getElementById("tab-diagram");
    const documentTab = document.getElementById("tab-document");
    diagramTab?.addEventListener("click", () => activatePanel("diagram"));
    documentTab?.addEventListener("click", () => {
      if (!documentTab.disabled) activatePanel("document");
    });
  }

  function showDocumentEmpty(hasDocx) {
    const empty = document.getElementById("document-empty");
    const preview = document.getElementById("document-preview");
    if (preview) preview.hidden = true;
    if (!empty) return;
    empty.hidden = false;
    empty.innerHTML = `
      <div class="empty-state__icon">▤</div>
      <h3>PDF пока не добавлен</h3>
      <p>${hasDocx
        ? 'Оригинал Word доступен для скачивания. Чтобы читать документ прямо здесь, добавьте рядом файл <code>regulation.pdf</code>.'
        : 'Добавьте <code>processes/realization/document/regulation.pdf</code>.'}</p>
    `;
  }

  async function initDocument() {
    const pdf = "./document/regulation.pdf";
    const docx = "./document/regulation.docx";
    const documentTab = document.getElementById("tab-document");
    const preview = document.getElementById("document-preview");
    const empty = document.getElementById("document-empty");
    const openNew = document.getElementById("document-open-new");
    const docxDownload = document.getElementById("document-docx-download");
    const [hasPdf, hasDocx] = await Promise.all([exists(pdf), exists(docx)]);

    documentUrl = hasPdf ? pdf : null;
    documentDocxUrl = hasDocx ? docx : null;

    if (documentTab) {
      const small = documentTab.querySelector("small");
      if (small) small.textContent = hasPdf ? "PDF" : (hasDocx ? "Word" : "не добавлен");
      documentTab.disabled = !hasPdf && !hasDocx;
    }

    if (openNew) {
      openNew.hidden = !hasPdf;
      if (hasPdf) openNew.href = pdf;
    }
    if (docxDownload) {
      docxDownload.hidden = !hasDocx;
      if (hasDocx) docxDownload.href = docx;
    }

    if (hasPdf && preview) {
      preview.hidden = false;
      if (empty) empty.hidden = true;
    } else {
      showDocumentEmpty(hasDocx);
    }

    if (location.hash === "#document" && !documentTab?.disabled) activatePanel("document", false);
    else activatePanel("diagram", false);
  }

  initTabs();
  initBpmn();
  initDocument();
})();
