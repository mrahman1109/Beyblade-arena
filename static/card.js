(function () {
  "use strict";

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const dropZone        = document.getElementById("dropZone");
  const fileInput       = document.getElementById("fileInput");
  const cameraInput     = document.getElementById("cameraInput");
  const previewWrap     = document.getElementById("previewWrap");
  const previewImg      = document.getElementById("previewImg");
  const clearBtn        = document.getElementById("clearBtn");
  const identifyBtn     = document.getElementById("identifyBtn");
  const uploadSection   = document.getElementById("uploadSection");
  const statusSection   = document.getElementById("statusSection");
  const statusMsg       = document.getElementById("statusMsg");
  const errorSection    = document.getElementById("errorSection");
  const errorMsg        = document.getElementById("errorMsg");
  const retryBtn        = document.getElementById("retryBtn");
  const resultsSection  = document.getElementById("resultsSection");

  // Results DOM
  const cardImg           = document.getElementById("cardImg");
  const cardImgPlaceholder= document.getElementById("cardImgPlaceholder");
  const cardName          = document.getElementById("cardName");
  const cardMeta          = document.getElementById("cardMeta");
  const cardVariant       = document.getElementById("cardVariant");
  const priceLow          = document.getElementById("priceLow");
  const priceAvg          = document.getElementById("priceAvg");
  const priceHigh         = document.getElementById("priceHigh");
  const priceSource       = document.getElementById("priceSource");
  const cardmarketSection = document.getElementById("cardmarketSection");
  const cmLow             = document.getElementById("cmLow");
  const cmAvg             = document.getElementById("cmAvg");
  const cmHigh            = document.getElementById("cmHigh");
  const noPricesMsg       = document.getElementById("noPricesMsg");
  const linksSection      = document.getElementById("linksSection");
  const lookupAgainBtn    = document.getElementById("lookupAgainBtn");

  // ── State ───────────────────────────────────────────────────────────────────
  let currentFile = null;
  let currentState = "idle";

  const STATES = {
    idle: () => {
      statusSection.hidden  = true;
      errorSection.hidden   = true;
      resultsSection.hidden = true;
      uploadSection.hidden  = false;
    },
    loading: (msg) => {
      uploadSection.hidden  = false;
      statusSection.hidden  = false;
      errorSection.hidden   = true;
      resultsSection.hidden = true;
      statusMsg.textContent = msg || "Analyzing card…";
    },
    error: (msg) => {
      statusSection.hidden  = true;
      errorSection.hidden   = false;
      resultsSection.hidden = true;
      errorMsg.textContent  = msg || "Something went wrong.";
    },
    results: () => {
      statusSection.hidden  = true;
      errorSection.hidden   = true;
      resultsSection.hidden = false;
    },
  };

  function setState(name, arg) {
    currentState = name;
    STATES[name] && STATES[name](arg);
  }

  // ── Image handling ──────────────────────────────────────────────────────────
  function setFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewWrap.hidden = false;
      dropZone.hidden = true;
      identifyBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  function clearFile() {
    currentFile = null;
    previewImg.src = "";
    previewWrap.hidden = true;
    dropZone.hidden = false;
    identifyBtn.disabled = true;
    fileInput.value = "";
    cameraInput.value = "";
  }

  // Resize image on canvas before upload (target max 1200px, ~80% JPEG quality)
  function resizeAndEncode(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Canvas toBlob failed"));
            resolve(blob);
          },
          "image/jpeg",
          0.85
        );
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = url;
    });
  }

  // ── API call ─────────────────────────────────────────────────────────────────
  async function identify() {
    if (!currentFile) return;

    setState("loading", "Resizing image…");
    let blob;
    try {
      blob = await resizeAndEncode(currentFile);
    } catch (e) {
      blob = currentFile; // fallback: send as-is
    }

    setState("loading", "Identifying card with AI…");
    const formData = new FormData();
    formData.append("image", blob, "card.jpg");

    let data;
    try {
      const resp = await fetch("/api/identify", { method: "POST", body: formData });
      data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || `Server error ${resp.status}`);
      }
    } catch (e) {
      setState("error", e.message || "Network error. Please try again.");
      return;
    }

    setState("loading", "Fetching market prices…");
    // Small delay so user sees the "fetching" message before we render
    await new Promise(r => setTimeout(r, 300));

    renderResults(data);
  }

  // ── Rendering ───────────────────────────────────────────────────────────────
  function fmt(val, currency) {
    if (val == null) return "—";
    const sym = currency === "EUR" ? "€" : "$";
    return `${sym}${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function renderResults(data) {
    const card    = data.card    || {};
    const pricing = data.pricing || {};

    // ── Card identity ──
    const type = card.type || "unknown";

    if (type === "pokemon") {
      cardName.textContent = card.name || "Unknown Card";
      const meta = [card.set, card.number, card.year].filter(Boolean).join(" · ");
      cardMeta.textContent = meta || "Pokémon Card";
      cardVariant.textContent = card.variant || "";
    } else if (type === "sports") {
      cardName.textContent = card.player || "Unknown Player";
      const meta = [card.sport, card.team, card.year, card.brand, `#${card.number}`]
        .filter(Boolean).join(" · ");
      cardMeta.textContent = meta;
      cardVariant.textContent = card.variant || "";
    } else {
      cardName.textContent = "Unidentified Card";
      cardMeta.textContent = card.description || "Could not identify card type.";
      cardVariant.textContent = "";
    }

    // ── Card image ──
    if (pricing.image_url) {
      cardImg.src = pricing.image_url;
      cardImg.hidden = false;
      cardImgPlaceholder.hidden = true;
    } else {
      cardImg.hidden = true;
      cardImgPlaceholder.hidden = false;
    }

    // ── Prices ──
    const prices = pricing.prices;
    if (prices) {
      priceLow.textContent  = fmt(prices.low,  prices.currency);
      priceAvg.textContent  = fmt(prices.avg,  prices.currency);
      priceHigh.textContent = fmt(prices.high, prices.currency);
      priceSource.textContent = `Source: ${pricing.source || ""}`;
      noPricesMsg.hidden = true;
    } else {
      priceLow.textContent  = "—";
      priceAvg.textContent  = "—";
      priceHigh.textContent = "—";
      priceSource.textContent = "";
      noPricesMsg.hidden = false;
    }

    // ── Cardmarket (Pokémon EU) ──
    const cm = pricing.cardmarket_prices;
    if (cm) {
      cmLow.textContent  = fmt(cm.low,  cm.currency);
      cmAvg.textContent  = fmt(cm.avg,  cm.currency);
      cmHigh.textContent = fmt(cm.high, cm.currency);
      cardmarketSection.hidden = false;
    } else {
      cardmarketSection.hidden = true;
    }

    // ── Links ──
    linksSection.innerHTML = "";

    if (pricing.card_url) {
      linksSection.appendChild(makeLink("View on TCGPlayer ↗", pricing.card_url));
    }
    if (pricing.search_url && type === "pokemon" && !pricing.card_url) {
      linksSection.appendChild(makeLink("Search TCGPlayer ↗", pricing.search_url));
    }
    if (pricing.search_url && type === "sports") {
      linksSection.appendChild(makeLink("View eBay Sold Listings ↗", pricing.search_url));
    }

    setState("results");
  }

  function makeLink(text, href) {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "btn-link";
    a.textContent = text;
    return a;
  }

  // ── Event listeners ─────────────────────────────────────────────────────────
  fileInput.addEventListener("change",  () => setFile(fileInput.files[0]));
  cameraInput.addEventListener("change", () => setFile(cameraInput.files[0]));
  clearBtn.addEventListener("click", clearFile);
  identifyBtn.addEventListener("click", identify);
  retryBtn.addEventListener("click",    () => setState("idle"));
  lookupAgainBtn.addEventListener("click", () => { clearFile(); setState("idle"); });

  // Drag and drop
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });

  // Click on drop zone itself (not buttons) opens file picker
  dropZone.addEventListener("click", (e) => {
    if (e.target === dropZone || e.target.classList.contains("drop-icon") || e.target.classList.contains("drop-label")) {
      fileInput.click();
    }
  });

  // Init
  setState("idle");
})();
