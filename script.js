(function () {
  "use strict";

  const DEFAULTS = {
    colorVariant: "all-blue",
    showTopArcText: true,
    useDiskImage: false,
    bottomText: "",
    ncsaSelect: "",
    regionSelect: "",
    wingSelect: "",
    squadronSelect: "",
    makeTransparent: false
  };

  const GRAPHIC_GROUPS = {
    ncsa: {
      folder: "ncsa",
      label: "NCSA",
      selectId: "ncsaSelect",
      emptyOption: "No NCSA selected"
    },
    region: {
      folder: "region",
      label: "Region",
      selectId: "regionSelect",
      emptyOption: "No region selected"
    },
    wing: {
      folder: "wing",
      label: "Wing",
      selectId: "wingSelect",
      emptyOption: "No wing selected"
    },
    squadron: {
      folder: "squadron",
      label: "Squadron",
      selectId: "squadronSelect",
      emptyOption: "No squadron selected"
    }
  };

  const GRAPHICS = {
    ncsa: {},
    region: {},
    wing: {},
    squadron: {}
  };
  const GRAPHIC_FILES = {
    ncsa: ["mots.png"],
    region: ["swremblem.png"],
    wing: [
      "aremblem.png",
      "azemblem.png",
      "gaemblem.png",
      "laemblem.png",
      "natcapemblem.png",
      "nmemblem.png",
      "nvemblem.png",
      "okemblem.png",
      "txemblem.png"
    ],
    squadron: [
      "dc026emblem.png",
      "dc033emblem.png",
      "dc045emblem.png",
      "dc051emblem.png",
      "dc053emblem.png",
      "dc060emblem.png",
      "in002emblem.webp",
      "tx076emblem.png",
      "tx154emblem.png",
      "tx388emblem.png"
    ]
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
    colorVariant: $("colorVariant"),
    showTopArcText: $("showTopArcText"),
    useDiskImage: $("useDiskImage"),
    bottomText: $("bottomText"),
    ncsaSelect: $("ncsaSelect"),
    regionSelect: $("regionSelect"),
    wingSelect: $("wingSelect"),
    squadronSelect: $("squadronSelect"),
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

  async function init() {
    bindEvents();
    await loadApprovedGraphics();
    applyStateToForm();
    renderAll();
  }

  function bindEvents() {
    els.colorVariant.addEventListener("change", onFieldChange);
    els.showTopArcText.addEventListener("change", onFieldChange);
    els.useDiskImage.addEventListener("change", onFieldChange);
    els.bottomText.addEventListener("input", onFieldChange);
    els.ncsaSelect.addEventListener("change", onGroupedSelectChange("ncsaSelect"));
    els.regionSelect.addEventListener("change", onGroupedSelectChange("regionSelect"));
    els.wingSelect.addEventListener("change", onGroupedSelectChange("wingSelect"));
    els.squadronSelect.addEventListener("change", onGroupedSelectChange("squadronSelect"));
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
    els.colorVariant.value = state.colorVariant;
    els.showTopArcText.checked = state.showTopArcText;
    els.useDiskImage.checked = state.useDiskImage;
    els.bottomText.value = state.bottomText;
    els.ncsaSelect.value = state.ncsaSelect;
    els.regionSelect.value = state.regionSelect;
    els.wingSelect.value = state.wingSelect;
    els.squadronSelect.value = state.squadronSelect;
    els.makeTransparent.checked = state.makeTransparent;
  }

  function onGroupedSelectChange(activeSelectId) {
    return () => {
      if (els[activeSelectId].value) {
        clearOtherSelects(activeSelectId);
        clearUploadedGraphic();
      }
      onFieldChange();
    };
  }

  function clearOtherSelects(activeSelectId) {
    ["ncsaSelect", "regionSelect", "wingSelect", "squadronSelect"].forEach((selectId) => {
      if (selectId !== activeSelectId) {
        els[selectId].value = "";
      }
    });
  }

  function clearUploadedGraphic() {
    state.uploadedImageDataUrl = null;
    state.uploadedImageSize = null;
    els.graphicUpload.value = "";
  }

  function onFieldChange(event) {
    if (event?.target === els.bottomText) {
      const cursorPosition = els.bottomText.selectionStart;
      const uppercasedValue = els.bottomText.value.toUpperCase();
      if (els.bottomText.value !== uppercasedValue) {
        els.bottomText.value = uppercasedValue;
        if (typeof cursorPosition === "number") {
          els.bottomText.setSelectionRange(cursorPosition, cursorPosition);
        }
      }
    }

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
    ["ncsaSelect", "regionSelect", "wingSelect", "squadronSelect"].forEach((selectId) => {
      els[selectId].value = "";
    });
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
    state.colorVariant = els.colorVariant.value;
    state.showTopArcText = els.showTopArcText.checked;
    state.useDiskImage = els.useDiskImage.checked;
    state.bottomText = els.bottomText.value.trim().toUpperCase();
    state.ncsaSelect = els.ncsaSelect.value;
    state.regionSelect = els.regionSelect.value;
    state.wingSelect = els.wingSelect.value;
    state.squadronSelect = els.squadronSelect.value;
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

    if (!state.uploadedImageDataUrl && !getSelectedGraphicEntry()) {
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

    if (state.colorVariant === "all-white") {
      warnings.push("All White output is best used on dark backgrounds only.");
    }

    if (!state.uploadedImageDataUrl && !getSelectedGraphicEntry()) {
      warnings.push("No secondary graphic was loaded. Pick from NCSA, Region, Wing, or Squadron, or upload a file.");
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
      default:
        return {
          shieldFill: "#1736b6",
          shieldStroke: "#1736b6",
          ribbonFill: "#ffffff",
          ribbonStroke: "#1736b6",
          laurel: "#1736b6",
          arcText: "#1736b6"
        };
    }
  }

  function getGraphicHref() {
    const selectedEntry = getSelectedGraphicEntry();
    if (selectedEntry) {
      return selectedEntry.path;
    }

    if (state.uploadedImageDataUrl) {
      return state.uploadedImageDataUrl;
    }

    return "";
  }

  async function loadApprovedGraphics() {
    await Promise.all(
      Object.entries(GRAPHIC_GROUPS).map(async ([groupKey, groupConfig]) => {
        const files = await listGraphicsInFolder(groupKey);
        const entries = files.map((fileName) => {
          const key = fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          const cleanName = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim();
          return {
            key,
            label: toDisplayCase(cleanName),
            path: `${groupConfig.folder}/${encodeURIComponent(fileName)}`
          };
        });

        entries.sort((a, b) => a.label.localeCompare(b.label));
        entries.forEach((entry) => {
          GRAPHICS[groupKey][entry.key] = { label: entry.label, path: entry.path };
        });

        populateGraphicSelect(groupConfig.selectId, groupConfig.emptyOption, entries);
      })
    );
  }

  async function listGraphicsInFolder(groupKey) {
    return GRAPHIC_FILES[groupKey] ? [...GRAPHIC_FILES[groupKey]] : [];
  }

  function populateGraphicSelect(selectId, emptyOption, items) {
    const select = els[selectId];
    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = items.length ? emptyOption : "No graphics loaded";
    select.appendChild(placeholder);

    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.key;
      option.textContent = item.label;
      select.appendChild(option);
    });
  }

  function getSelectedGraphicEntry() {
    const selectOrder = [
      ["ncsa", state.ncsaSelect],
      ["region", state.regionSelect],
      ["wing", state.wingSelect],
      ["squadron", state.squadronSelect]
    ];

    for (const [groupKey, selectedKey] of selectOrder) {
      if (selectedKey && GRAPHICS[groupKey][selectedKey]) {
        return GRAPHICS[groupKey][selectedKey];
      }
    }

    return null;
  }

  function toDisplayCase(text) {
    return text.replace(/\b\w/g, (char) => char.toUpperCase());
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
    const bottomText = escapeXml(state.bottomText);
    const imagePlacement = getRelativeImagePlacement();
    const arcGap = Math.max(14, imagePlacement.height * 0.035);
    const arcY = imagePlacement.y - arcGap;
    const arcInset = Math.max(20, imagePlacement.width * 0.06);
    const startX = imagePlacement.x + arcInset;
    const endX = imagePlacement.x + imagePlacement.width - arcInset;
    const arcRadius = Math.max(140, imagePlacement.width * 0.86);
    const straightTextY = imagePlacement.y - 12;
    const straightTextX = imagePlacement.x + imagePlacement.width / 2;
    const topTextElement = !state.showTopArcText
      ? ""
      : state.useDiskImage
        ? `
  <text
    x="${straightTextX}"
    y="${straightTextY}"
    font-family="Rajdhani, Inter, Arial, sans-serif"
    font-size="70"
    font-weight="700"
    letter-spacing="6"
    text-anchor="middle"
    fill="${palette.arcText}"
  >${topText}</text>
      `
        : `
  <text
    font-family="Rajdhani, Inter, Arial, sans-serif"
    font-size="70"
    font-weight="700"
    letter-spacing="6"
    fill="${palette.arcText}"
  >
    <textPath href="#topArc" startOffset="50%" text-anchor="middle">${topText}</textPath>
  </text>
      `;
    const bottomTextElement = bottomText
      ? `
  <text
    x="600"
    y="1135"
    font-family="Rajdhani, Inter, Arial, sans-serif"
    font-size="58"
    font-weight="700"
    letter-spacing="5"
    text-anchor="middle"
    fill="${palette.arcText}"
  >${bottomText}</text>
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

  ${topTextElement}
  ${bottomTextElement}

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
