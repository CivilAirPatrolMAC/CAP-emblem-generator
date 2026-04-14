(function () {
  "use strict";

  const DEFAULTS = {
    mode: "wing-region",
    templateStyle: "shield-ribbon",
    colorVariant: "blue-gold",
    topText: "CIVIL AIR PATROL",
    bottomText: "OKLAHOMA WING",
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

  const CAP_SEAL_PATH = "assets/core/cap-triangle-starmark.png";

  const state = {
    ...DEFAULTS,
    uploadedImageDataUrl: null,
    renderedSvg: ""
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    form: $("emblem-form"),
    mode: $("mode"),
    templateStyle: $("templateStyle"),
    colorVariant: $("colorVariant"),
    topText: $("topText"),
    bottomText: $("bottomText"),
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
    els.topText.addEventListener("input", onFieldChange);
    els.bottomText.addEventListener("input", onFieldChange);
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
    els.topText.value = state.topText;
    els.bottomText.value = state.bottomText;
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
      renderAll();
      return;
    }

    const fileDataUrl = await readFileAsDataUrl(file);
    state.uploadedImageDataUrl = fileDataUrl;
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
    state.topText = sanitizeArcText(els.topText.value, 24);
    state.bottomText = sanitizeArcText(els.bottomText.value, 28);
    state.graphicSelect = els.graphicSelect.value;
    state.makeTransparent = els.makeTransparent.checked;
  }

  function sanitizeArcText(value, maxLen) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase()
      .slice(0, maxLen);
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

    const svg = buildSvg();
    state.renderedSvg = svg;
    els.svgCode.value = svg;
    els.previewMount.innerHTML = svg;
  }

  function getValidationWarnings() {
    const warnings = [];

    if (!state.topText) {
      warnings.push("Top text is required.");
    }

    if (!state.bottomText) {
      warnings.push("Bottom text is required.");
    }

    if (state.topText.length > 18) {
      warnings.push("Top text is approaching the maximum safe length for upper-arc readability.");
    }

    if (state.bottomText.length > 22) {
      warnings.push("Bottom text is approaching the maximum safe length for lower-arc readability.");
    }

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

  function buildSvg() {
    const palette = getPalette();
    const topText = escapeXml(state.topText || "CIVIL AIR PATROL");
    const bottomText = escapeXml(state.bottomText || "");
    const graphicHref = escapeXml(getGraphicHref());
    const sealHref = escapeXml(CAP_SEAL_PATH);

    const bottomElement =
      state.templateStyle === "shield-ribbon"
        ? `
          <g transform="translate(600 938)">
            <path
              d="M -245 -40 C -230 -78, -178 -104, -128 -88 C -108 -42, -76 -20, 0 -20 C 76 -20, 108 -42, 128 -88 C 178 -104, 230 -78, 245 -40 C 205 18, 140 54, 0 54 C -140 54, -205 18, -245 -40 Z"
              fill="${palette.ribbonFill}"
              stroke="${palette.ribbonStroke}"
              stroke-width="8"
            />
            <text
              x="0"
              y="18"
              text-anchor="middle"
              font-size="60"
              font-weight="700"
              fill="${palette.arcText}"
              letter-spacing="4"
            >${bottomText}</text>
          </g>
        `
        : `
          <text
            font-size="62"
            font-weight="700"
            letter-spacing="5"
            fill="${palette.arcText}"
          >
            <textPath href="#bottomArc" startOffset="50%" text-anchor="middle">${bottomText}</textPath>
          </text>
        `;

    return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 1200 1200"
  role="img"
  aria-label="${topText} emblem graphic"
>
  <defs>
    <path id="topArc" d="M 210 268 A 390 390 0 0 1 990 268" />
    <path id="bottomArc" d="M 315 930 A 285 285 0 0 0 885 930" />
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-opacity="0.18" />
    </filter>
  </defs>

  <rect width="1200" height="1200" fill="transparent" />

  <text
    font-family="Inter, Arial, sans-serif"
    font-size="70"
    font-weight="800"
    letter-spacing="6"
    fill="${palette.arcText}"
  >
    <textPath href="#topArc" startOffset="50%" text-anchor="middle">${topText}</textPath>
  </text>

  <g filter="url(#softShadow)">
    <path
      d="M 320 250 L 880 250 L 950 330 L 920 700 C 910 860, 800 960, 600 1060 C 400 960, 290 860, 280 700 L 250 330 Z"
      fill="${palette.shieldFill}"
      stroke="${palette.shieldStroke}"
      stroke-width="10"
    />

    <g transform="translate(600 708)">
      <path
        d="M -170 0 C -130 46, -80 74, -20 82 C -60 42, -95 0, -110 -58 C -132 -32, -152 -12, -170 0 Z"
        fill="${palette.laurel}"
        opacity="0.95"
      />
      <path
        d="M 170 0 C 130 46, 80 74, 20 82 C 60 42, 95 0, 110 -58 C 132 -32, 152 -12, 170 0 Z"
        fill="${palette.laurel}"
        opacity="0.95"
      />
    </g>

    <image
      href="${graphicHref}"
      x="315"
      y="340"
      width="570"
      height="570"
      preserveAspectRatio="xMidYMid meet"
    />

    <image
      href="${sealHref}"
      x="485"
      y="505"
      width="230"
      height="230"
      preserveAspectRatio="xMidYMid meet"
      opacity="0.98"
    />

    ${bottomElement}
  </g>
</svg>
    `.trim();
  }

  function resetForm() {
    Object.assign(state, DEFAULTS, { uploadedImageDataUrl: null, renderedSvg: "" });
    els.graphicUpload.value = "";
    applyStateToForm();
    renderAll();
    setActiveTab("rendered");
  }

  function downloadSvg() {
    const blob = new Blob([state.renderedSvg], { type: "image/svg+xml;charset=utf-8" });
    const filename = makeFilename("svg");
    triggerDownload(URL.createObjectURL(blob), filename, true);
  }

  async function downloadPng() {
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
    const safeBottom = (state.bottomText || "cap-emblem")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return `${safeBottom || "cap-emblem"}.${ext}`;
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
