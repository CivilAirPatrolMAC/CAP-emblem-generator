(function () {
  "use strict";

  const DEFAULTS = {
    mode: "wing-region",
    templateStyle: "shield-ribbon",
    colorVariant: "blue-gold",
    showTopArcText: true,
    graphicSelect: "oklahoma",
    makeTransparent: false
  };

  const GRAPHICS = {
    oklahoma: {
      label: "Oklahoma Wing",
      path: "assets/wing/okemblem.png"
    },
    texas: {
      label: "Texas Wing",
      path: "assets/wing/txemblem.png"
    },
    "new-mexico": {
      label: "New Mexico Wing",
      path: "assets/wing/nmemblem.png"
    },
    "southwest-region": {
      label: "Southwest Region",
      path: "assets/region/swr-emblem.png"
    },
    "north-central-region": {
      label: "North Central Region",
      path: "assets/region/ncr-emblem.png"
    }
  };

  const state = {
    ...DEFAULTS,
    uploadedImageDataUrl: null,
    uploadedImageSize: null,
    renderedSvg: ""
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    form: $("emblem-form"),
    mode: $("mode"),
    templateStyle: $("templateStyle"),
    colorVariant: $("colorVariant"),
    showTopArcText: $("showTopArcText"),
    graphicSelect: $("graphicSelect"),
    graphicUpload: $("graphicUpload"),
    makeTransparent: $("makeTransparent"),
    previewMount: $("previewMount"),
    svgCode: $("svgCode"),
    renderedPanel: $("renderedPanel"),
    svgPanel: $("svgPanel"),
    warningBox: $("validation_warnings"),
    downloadPngBtn: $("downloadPngBtn"),
    downloadSvgBtn: $("downloadSvgBtn"),
    resetBtn: $("resetBtn"),
    previewTabs: Array.from(document.querySelectorAll(".preview-tab"))
  };

  function init() {
    bindEvents();
    applyStateToForm();
    renderAll();
  }

  function bindEvents() {
    els.mode.addEventListener("change", onFieldChange);
    els.templateStyle.addEventListener("change", onFieldChange);
    els.colorVariant.addEventListener("change", onFieldChange);
    els.showTopArcText.addEventListener("change", onFieldChange);
    els.graphicSelect.addEventListener("change", onFieldChange);
    els.makeTransparent.addEventListener("change", onFieldChange);
    els.graphicUpload.addEventListener("change", onUploadChange);

    els.downloadPngBtn.addEventListener("click", downloadPng);
    els.downloadSvgBtn.addEventListener("click", downloadSvg);
    els.resetBtn.addEventListener("click", resetForm);

    els.previewTabs.forEach((tab) => {
      tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
    });
  }

  function applyStateToForm() {
    els.mode.value = state.mode;
    els.templateStyle.value = state.templateStyle;
    els.colorVariant.value = state.colorVariant;
    els.showTopArcText.checked = state.showTopArcText;
    els.graphicSelect.value = state.graphicSelect;
    els.makeTransparent.checked = state.makeTransparent;
  }

  function onFieldChange() {
    readFormIntoState();
    renderAll();
  }

  async function onUploadChange(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      state.uploadedImageDataUrl = null;
      state.uploadedImageSize = null;
      renderAll();
      return;
    }

    const fileDataUrl = await readFileAsDataUrl(file);
    state.uploadedImageDataUrl = fileDataUrl;
    const uploadedImage = await loadImage(fileDataUrl);
    state.uploadedImageSize = {
      width: uploadedImage.naturalWidth || 1,
      height: uploadedImage.naturalHeight || 1
    };
    readFormIntoState();

    if (state.makeTransparent) {
      try {
        state.uploadedImageDataUrl = await removeWhiteBackground(fileDataUrl);
      } catch (error) {
        console.warn("Transparency cleanup failed:", error);
      }
    }

    renderAll();
  }

  function readFormIntoState() {
    state.mode = els.mode.value;
    state.templateStyle = els.templateStyle.value;
    state.colorVariant = els.colorVariant.value;
    state.showTopArcText = els.showTopArcText.checked;
    state.graphicSelect = els.graphicSelect.value;
    state.makeTransparent = els.makeTransparent.checked;
  }

  function escapeXml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function setActiveTab(tabName) {
    const rendered = tabName === "rendered";
    els.renderedPanel.hidden = !rendered;
    els.svgPanel.hidden = rendered;

    els.previewTabs.forEach((tab) => {
      const active = tab.dataset.tab === tabName;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function renderAll() {
    const warnings = getValidationWarnings();
    renderValidationWarnings(warnings);

    if (!state.uploadedImageDataUrl) {
      state.renderedSvg = "";
      els.svgCode.value = "";
      els.previewMount.innerHTML = "";
      els.previewMount.classList.add("preview-mount--empty");
      return;
    }

    const svg = buildSvg();
    state.renderedSvg = svg;
    els.svgCode.value = svg;
    els.previewMount.innerHTML = svg;
    els.previewMount.classList.remove("preview-mount--empty");
  }

  function getValidationWarnings() {
    const warnings = [];

    if (state.mode === "custom" && !state.uploadedImageDataUrl) {
      warnings.push("Custom mode is selected, but no approved secondary graphic has been uploaded.");
    }

    if (state.colorVariant === "all-white") {
      warnings.push("All White output is best used on dark backgrounds only.");
    }

    return warnings;
  }

  function renderValidationWarnings(items) {
    if (!items.length) {
      els.warningBox.hidden = true;
      els.warningBox.innerHTML = "";
      return;
    }

    const list = items.map((item) => `<li>${escapeXml(item)}</li>`).join("");
    els.warningBox.innerHTML = `
      <h3>Brand standards review</h3>
      <ul>${list}</ul>
    `;
    els.warningBox.hidden = false;
  }

  function getPalette() {
    switch (state.colorVariant) {
      case "all-blue":
        return {
          shieldFill: "#1736b6",
          shieldStroke: "#1736b6",
          ribbonFill: "#ffffff",
          ribbonStroke: "#1736b6",
          laurel: "#1736b6",
          arcText: "#1736b6"
        };
      case "all-white":
        return {
          shieldFill: "#ffffff",
          shieldStroke: "#ffffff",
          ribbonFill: "#ffffff",
          ribbonStroke: "#ffffff",
          laurel: "#ffffff",
          arcText: "#ffffff"
        };
      case "blue-gold":
      default:
        return {
          shieldFill: "#1b2aa8",
          shieldStroke: "#f0b323",
          ribbonFill: "#ffffff",
          ribbonStroke: "#f0b323",
          laurel: "#f0b323",
          arcText: "#1736b6"
        };
    }
  }

  function getGraphicHref() {
    if (state.mode === "custom" && state.uploadedImageDataUrl) {
      return state.uploadedImageDataUrl;
    }

    if (state.uploadedImageDataUrl) {
      return state.uploadedImageDataUrl;
    }

    const entry = GRAPHICS[state.graphicSelect];
    return entry ? entry.path : "";
  }

  function getRelativeImagePlacement() {
    const frame = { x: 180, y: 220, width: 840, height: 840 };
    const source = state.uploadedImageSize || { width: 1, height: 1 };
    const scale = Math.min(frame.width / source.width, frame.height / source.height);
    const width = source.width * scale;
    const height = source.height * scale;
    const x = frame.x + (frame.width - width) / 2;
    const y = frame.y + (frame.height - height) / 2;

    return { x, y, width, height };
  }

  function buildSvg() {
    const palette = getPalette();
    const topText = "CIVIL AIR PATROL";
    const graphicHref = escapeXml(getGraphicHref());
    const imagePlacement = getRelativeImagePlacement();
    const arcGap = Math.max(30, imagePlacement.height * 0.08);
    const arcY = imagePlacement.y - arcGap;
    const arcInset = Math.max(20, imagePlacement.width * 0.06);
    const startX = imagePlacement.x + arcInset;
    const endX = imagePlacement.x + imagePlacement.width - arcInset;
    const arcRadius = Math.max(120, imagePlacement.width * 0.62);
    const arcTextElement = state.showTopArcText
      ? `
  <text
    font-family="Inter, Arial, sans-serif"
    font-size="70"
    font-weight="800"
    letter-spacing="6"
    fill="${palette.arcText}"
  >
    <textPath href="#topArc" startOffset="50%" text-anchor="middle">${topText}</textPath>
  </text>
      `
      : "";

    return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 1200 1200"
  role="img"
  aria-label="${topText} emblem graphic"
>
  <defs>
    <path id="topArc" d="M ${startX} ${arcY} A ${arcRadius} ${arcRadius} 0 0 1 ${endX} ${arcY}" />
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-opacity="0.18" />
    </filter>
  </defs>

  <rect width="1200" height="1200" fill="transparent" />

  ${arcTextElement}

  <g filter="url(#softShadow)">
    <image
      href="${graphicHref}"
      x="${imagePlacement.x}"
      y="${imagePlacement.y}"
      width="${imagePlacement.width}"
      height="${imagePlacement.height}"
      preserveAspectRatio="xMidYMid meet"
    />
  </g>
</svg>
    `.trim();
  }

  function resetForm() {
    Object.assign(state, DEFAULTS, { uploadedImageDataUrl: null, uploadedImageSize: null, renderedSvg: "" });
    els.graphicUpload.value = "";
    applyStateToForm();
    renderAll();
    setActiveTab("rendered");
  }

  function downloadSvg() {
    if (!state.renderedSvg) return;
    const blob = new Blob([state.renderedSvg], { type: "image/svg+xml;charset=utf-8" });
    const filename = makeFilename("svg");
    triggerDownload(URL.createObjectURL(blob), filename, true);
  }

  async function downloadPng() {
    if (!state.renderedSvg) return;
    try {
      const blob = new Blob([state.renderedSvg], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(blob);

      const image = await loadImage(svgUrl);
      const canvas = document.createElement("canvas");
      const size = 1600;
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(image, 0, 0, size, size);

      URL.revokeObjectURL(svgUrl);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        triggerDownload(URL.createObjectURL(pngBlob), makeFilename("png"), true);
      }, "image/png");
    } catch (error) {
      console.error("PNG export failed:", error);
      alert("Unable to export PNG. Check your asset paths and browser console.");
    }
  }

  function makeFilename(ext) {
    return `cap-emblem.${ext}`;
  }

  function triggerDownload(url, filename, revokeLater = false) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    if (revokeLater) {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function removeWhiteBackground(dataUrl) {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  }

  init();
})();
