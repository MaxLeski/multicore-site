/**
 * MULTICORE Maksym Leski - Official Frontend Engine
 * Skanowanie 3D • Inżynieria Odwrotna CAD • Druk 3D • Embedded & Automatyka
 */

// 1. Globalna warstwa analityczna i zarządzanie parametrami UTM
(function initAnalyticsLayer() {
  const params = new URLSearchParams(window.location.search);
  const sessionData = {
    landingPage: window.location.pathname,
    referrer: document.referrer || "direct",
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_term: params.get("utm_term") || "",
    utm_content: params.get("utm_content") || ""
  };

  try {
    const existing = sessionStorage.getItem("mc_traffic_meta");
    if (!existing) {
      sessionStorage.setItem("mc_traffic_meta", JSON.stringify(sessionData));
    } else {
      const parsed = JSON.parse(existing);
      if (sessionData.utm_source && !parsed.utm_source) {
        sessionStorage.setItem("mc_traffic_meta", JSON.stringify({ ...parsed, ...sessionData }));
      }
    }
  } catch (e) {}

  window.multicoreAnalytics = {
    track: function(eventName, customData = {}) {
      let traffic = {};
      try {
        traffic = JSON.parse(sessionStorage.getItem("mc_traffic_meta") || "{}");
      } catch (e) {}

      // Bezpieczny payload - BEZ danych osobowych (No PII)
      const payload = {
        event: eventName,
        timestamp: new Date().toISOString(),
        page: window.location.pathname,
        utm_source: traffic.utm_source || undefined,
        utm_medium: traffic.utm_medium || undefined,
        utm_campaign: traffic.utm_campaign || undefined,
        utm_term: traffic.utm_term || undefined,
        utm_content: traffic.utm_content || undefined,
        ...customData
      };

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(payload);
      window.dispatchEvent(new CustomEvent("multicore:track", { detail: payload }));

      if (window.MULTICORE_CONFIG?.analytics?.debug) {
        console.log("[Multicore Analytics]", eventName, payload);
      }
    }
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  const yearEls = document.querySelectorAll(".current-year");
  const curYear = new Date().getFullYear();
  yearEls.forEach(el => (el.textContent = curYear));

  initNavigation();
  initIntentSelector();
  initCalculator();
  initQuoteForm();
  initGallery();
  initGlobalConversionTracking();
  initSmoothScroll();
});

/* ==========================================================
   NAWIGACJA & STICKY HEADER & DROPDOWN
   ========================================================== */
function initNavigation() {
  const header = document.querySelector(".site-header");
  const mobileToggle = document.querySelector(".btn-mobile-toggle");
  const navMenu = document.querySelector(".nav-menu");
  const navDropdowns = document.querySelectorAll(".nav-dropdown");

  window.addEventListener("scroll", () => {
    if (header) {
      if (window.scrollY > 20) {
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }
    }
  }, { passive: true });

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener("click", () => {
      const isOpen = navMenu.classList.toggle("open");
      mobileToggle.setAttribute("aria-expanded", isOpen);
      mobileToggle.classList.toggle("active", isOpen);
      document.body.classList.toggle("nav-open", isOpen);
    });

    navMenu.querySelectorAll(".nav-link:not(.dropdown-toggle)").forEach(link => {
      link.addEventListener("click", () => {
        navMenu.classList.remove("open");
        mobileToggle.setAttribute("aria-expanded", "false");
        mobileToggle.classList.remove("active");
        document.body.classList.remove("nav-open");
      });
    });
  }

  navDropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector(".dropdown-toggle");
    if (toggle) {
      toggle.addEventListener("click", (e) => {
        if (window.innerWidth <= 992) {
          e.preventDefault();
          dropdown.classList.toggle("open");
          const isExp = dropdown.classList.contains("open");
          toggle.setAttribute("aria-expanded", isExp);
        }
      });
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav-dropdown")) {
      navDropdowns.forEach(d => {
        d.classList.remove("open");
        d.querySelector(".dropdown-toggle")?.setAttribute("aria-expanded", "false");
      });
    }
  });
}

/* ==========================================================
   WYBÓR INTENCJI KLIENTA (INTENT SELECTOR)
   ========================================================== */
function initIntentSelector() {
  const intentCards = document.querySelectorAll(".intent-card");
  if (!intentCards.length) return;

  intentCards.forEach(card => {
    const intent = card.getAttribute("data-intent");
    const targetLink = card.querySelector("a.btn-intent") || card.querySelector("a");

    const handleIntentClick = (e) => {
      window.multicoreAnalytics?.track("intent_card_clicked", {
        intent: intent || "unknown",
        card_title: card.querySelector("h3")?.textContent?.trim() || ""
      });

      if (targetLink && targetLink.getAttribute("href")?.startsWith("#")) {
        const targetId = targetLink.getAttribute("href").substring(1);
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          e.preventDefault();
          
          if (intent === "odtwarzanie" || intent === "cad") {
            selectCalculatorOption("calcScope", "cad");
          } else if (intent === "skanowanie") {
            selectCalculatorOption("calcScope", "scan");
          } else if (intent === "druk") {
            selectCalculatorOption("calcScope", "mesh");
          }

          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };

    if (targetLink) {
      targetLink.addEventListener("click", handleIntentClick);
    }
  });
}

function selectCalculatorOption(containerInputId, val) {
  const hiddenInput = document.getElementById(containerInputId);
  if (!hiddenInput) return;
  hiddenInput.value = val;

  const parent = hiddenInput.parentElement;
  if (parent) {
    parent.querySelectorAll(".option-tile").forEach(tile => {
      const isMatch = tile.getAttribute("data-value") === val;
      tile.classList.toggle("selected", isMatch);
      tile.setAttribute("aria-checked", isMatch ? "true" : "false");
    });
  }

  if (window.refreshMulticoreCalculator) {
    window.refreshMulticoreCalculator();
  }
}

/* ==========================================================
   KALKULATOR WYCENY SKANOWANIA 3D & PRZEKAZYWANIE DO FORMULARZA
   ========================================================== */
function initCalculator() {
  const calcForm = document.getElementById("calcForm");
  if (!calcForm) return;

  const cfg = window.MULTICORE_CONFIG?.pricing || {
    setupBaseCost: 350,
    photoDiscount: 30,
    sizeSurcharges: [
      { maxDim: 10, cost: 0 },
      { maxDim: 25, cost: 120 },
      { maxDim: 50, cost: 260 },
      { maxDim: 100, cost: 520 },
      { maxDim: Infinity, cost: 900 }
    ],
    volumeSurcharges: [
      { maxVol: 8000, cost: 0 },
      { maxVol: 40000, cost: 80 },
      { maxVol: 150000, cost: 180 },
      { maxVol: Infinity, cost: 350 }
    ],
    complexity: {
      low: { mult: 1.0, label: "Prosty detal (płaskie ścianki, proste bryły)" },
      medium: { mult: 1.25, label: "Średnio złożony (żebra, zaokrąglenia, uchwyty)" },
      high: { mult: 1.6, label: "Złożony techniczny (cienkie ścianki, gwinty, kształty organiczne)" }
    },
    surface: {
      easy: { surcharge: 0, label: "Standardowa (matowa, jasna)" },
      difficult: { surcharge: 180, label: "Ciemna / Błyszcząca / Chrom" },
      "very-difficult": { surcharge: 320, label: "Bardzo trudna (przezroczysta, głębokie szczeliny)" }
    },
    scope: {
      scan: { surcharge: 0, min: 350, label: "Sam skan 3D (surowa chmura/siatka)" },
      mesh: { surcharge: 220, min: 590, label: "Skan + Oczyszczona siatka STL (pod druk 3D)" },
      cad: { surcharge: 950, min: 1400, label: "Skan + Model CAD STEP (Inżynieria odwrotna pod CNC)" }
    },
    mode: {
      standard: { mult: 1.0, label: "Standardowy (5–7 dni roboczych)" },
      fast: { mult: 1.25, label: "Ekspresowy (priorytetowe stanowisko)" }
    }
  };

  const lengthInput = document.getElementById("calcLength");
  const widthInput = document.getElementById("calcWidth");
  const heightInput = document.getElementById("calcHeight");
  const unitToggle = document.getElementById("calcUnitToggle");
  const priceValEl = document.getElementById("calcPriceVal");
  const priceRangeEl = document.getElementById("calcPriceRange");
  const emptyStateEl = document.getElementById("calcEmptyState");
  const resultStateEl = document.getElementById("calcResultState");
  const breakdownListEl = document.getElementById("calcBreakdownList");
  const sendQuoteBtn = document.getElementById("calcSendQuoteBtn");

  let currentUnit = "cm";
  let hasStarted = false;

  if (unitToggle) {
    unitToggle.querySelectorAll(".unit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const newUnit = btn.getAttribute("data-unit");
        if (newUnit === currentUnit) return;
        
        unitToggle.querySelectorAll(".unit-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        [lengthInput, widthInput, heightInput].forEach(inp => {
          if (inp && inp.value) {
            const val = parseFloat(inp.value);
            if (!isNaN(val) && val > 0) {
              inp.value = newUnit === "mm" ? (val * 10).toFixed(0) : (val / 10).toFixed(1);
            }
          }
        });

        calcForm.querySelectorAll(".input-unit").forEach(u => (u.textContent = newUnit));
        currentUnit = newUnit;
        calculate();
      });
    });
  }

  setupTiles("complexityOptions", "calcComplexity");
  setupTiles("surfaceOptions", "calcSurface");
  setupTiles("scopeOptions", "calcScope");
  setupTiles("modeOptions", "calcMode");

  function setupTiles(containerId, inputId) {
    const container = document.getElementById(containerId);
    const hidden = document.getElementById(inputId);
    if (!container || !hidden) return;

    container.querySelectorAll(".option-tile").forEach(tile => {
      tile.addEventListener("click", () => {
        container.querySelectorAll(".option-tile").forEach(t => {
          t.classList.remove("selected");
          t.setAttribute("aria-checked", "false");
        });
        tile.classList.add("selected");
        tile.setAttribute("aria-checked", "true");
        hidden.value = tile.getAttribute("data-value");
        
        if (!hasStarted) {
          hasStarted = true;
          window.multicoreAnalytics?.track("calculator_started");
        }
        calculate();
      });
    });
  }

  [lengthInput, widthInput, heightInput].forEach(inp => {
    if (inp) {
      inp.addEventListener("input", () => {
        if (!hasStarted) {
          hasStarted = true;
          window.multicoreAnalytics?.track("calculator_started");
        }
        calculate();
      });
    }
  });

  function getSizeCost(maxCm) {
    for (const rule of cfg.sizeSurcharges) {
      if (maxCm <= rule.maxDim) return rule.cost;
    }
    return 900;
  }

  function getVolCost(volCm3) {
    for (const rule of cfg.volumeSurcharges) {
      if (volCm3 <= rule.maxVol) return rule.cost;
    }
    return 350;
  }

  function calculate() {
    let rawL = parseFloat(lengthInput?.value) || 0;
    let rawW = parseFloat(widthInput?.value) || 0;
    let rawH = parseFloat(heightInput?.value) || 0;

    const l = currentUnit === "mm" ? rawL / 10 : rawL;
    const w = currentUnit === "mm" ? rawW / 10 : rawW;
    const h = currentUnit === "mm" ? rawH / 10 : rawH;

    const complexityVal = document.getElementById("calcComplexity")?.value || "medium";
    const surfaceVal = document.getElementById("calcSurface")?.value || "easy";
    const scopeVal = document.getElementById("calcScope")?.value || "mesh";
    const modeVal = document.getElementById("calcMode")?.value || "standard";

    if (l <= 0 || w <= 0 || h <= 0) {
      if (emptyStateEl) emptyStateEl.style.display = "block";
      if (resultStateEl) resultStateEl.style.display = "none";
      if (priceValEl) priceValEl.textContent = "---";
      return;
    }

    if (emptyStateEl) emptyStateEl.style.display = "none";
    if (resultStateEl) resultStateEl.style.display = "block";

    const maxDimCm = Math.max(l, w, h);
    const volumeCm3 = l * w * h;

    const setupCost = cfg.setupBaseCost;
    const sizeCost = getSizeCost(maxDimCm);
    const volCost = getVolCost(volumeCm3);

    const compConfig = cfg.complexity[complexityVal] || cfg.complexity.medium;
    const surfConfig = cfg.surface[surfaceVal] || cfg.surface.easy;
    const scopeConfig = cfg.scope[scopeVal] || cfg.scope.mesh;
    const modeConfig = cfg.mode[modeVal] || cfg.mode.standard;

    const subtotal = setupCost + sizeCost + volCost + surfConfig.surcharge + scopeConfig.surcharge;
    const rawTotal = subtotal * compConfig.mult * modeConfig.mult;
    const finalPrice = Math.max(scopeConfig.min, Math.round(rawTotal / 10) * 10);

    const minRange = Math.max(scopeConfig.min, Math.round((finalPrice * 0.9) / 10) * 10);
    const maxRange = Math.round((finalPrice * 1.15) / 10) * 10;

    if (priceValEl) {
      priceValEl.textContent = `${finalPrice.toLocaleString("pl-PL")}`;
    }
    if (priceRangeEl) {
      priceRangeEl.textContent = `Przedział szacunkowy: od ~${minRange} do ~${maxRange} zł netto`;
    }

    if (breakdownListEl) {
      const items = [
        { label: "Kalibracja i stanowisko pomiarowe", val: `${setupCost} zł` },
        { label: `Gabaryt max (${maxDimCm.toFixed(1)} cm)`, val: sizeCost ? `+${sizeCost} zł` : "W cenie bazowej" },
        { label: `Objętość robocza (${Math.round(volumeCm3)} cm³)`, val: volCost ? `+${volCost} zł` : "W cenie bazowej" },
        { label: `Powierzchnia (${surfConfig.label})`, val: surfConfig.surcharge ? `+${surfConfig.surcharge} zł` : "Standard" },
        { label: `Zakres usługi (${scopeConfig.label})`, val: scopeConfig.surcharge ? `+${scopeConfig.surcharge} zł` : "W cenie bazowej" },
        { label: `Złożoność (${compConfig.label})`, val: `x${compConfig.mult}` },
        { label: `Tryb realizacji (${modeConfig.label})`, val: `x${modeConfig.mult}` }
      ];

      breakdownListEl.innerHTML = items.map(item => `
        <li class="breakdown-item">
          <span>${item.label}</span>
          <strong>${item.val}</strong>
        </li>
      `).join("");
    }

    if (sendQuoteBtn) {
      sendQuoteBtn.onclick = () => {
        window.multicoreAnalytics?.track("calculator_completed", {
          max_dim_cm: maxDimCm,
          scope: scopeVal,
          complexity: complexityVal,
          estimated_price: finalPrice
        });
        window.multicoreAnalytics?.track("calculator_lead_started", {
          estimated_price: finalPrice,
          scope: scopeVal
        });

        const calcData = {
          dimensions: `${rawL} × ${rawW} × ${rawH} ${currentUnit}`,
          maxDimCm: maxDimCm,
          volumeCm3: Math.round(volumeCm3),
          complexity: compConfig.label,
          surface: surfConfig.label,
          scope: scopeConfig.label,
          scopeVal: scopeVal,
          mode: modeConfig.label,
          estimatedPrice: `${finalPrice} zł netto (przedział ${minRange}–${maxRange} zł)`
        };

        try {
          sessionStorage.setItem("mc_calc_data", JSON.stringify(calcData));
        } catch (e) {}

        const contactSection = document.getElementById("formularz") || document.getElementById("kontakt");
        if (contactSection) {
          applyCalcDataToForm(calcData);
          contactSection.scrollIntoView({ behavior: "smooth" });
          setTimeout(() => {
            const emailInp = document.getElementById("inquiryEmail");
            if (emailInp) emailInp.focus();
          }, 600);
        } else {
          window.location.href = `kontakt.html?source=calculator#formularz`;
        }
      };
    }
  }

  window.refreshMulticoreCalculator = calculate;

  if (lengthInput && lengthInput.value && widthInput && widthInput.value && heightInput && heightInput.value) {
    calculate();
  }
}

function applyCalcDataToForm(calcData) {
  if (!calcData) return;
  const topicSelect = document.getElementById("inquiryTopic");
  const messageInput = document.getElementById("inquiryMessage");
  const calcSummaryBox = document.getElementById("formCalcSummary");
  const calcSummaryContent = document.getElementById("formCalcSummaryContent");

  if (topicSelect) {
    if (calcData.scopeVal === "cad" || calcData.scope.includes("CAD")) {
      topicSelect.value = "cad";
    } else if (calcData.scopeVal === "scan" || calcData.scope.includes("skan")) {
      topicSelect.value = "skanowanie";
    } else if (calcData.scopeVal === "mesh") {
      topicSelect.value = "druk";
    }
  }

  if (calcSummaryBox && calcSummaryContent) {
    calcSummaryBox.style.display = "block";
    calcSummaryContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
        <div>
          <strong style="color: var(--cyan); font-family: var(--font-mono); font-size: 0.85rem; text-transform: uppercase;">
            ✓ Parametry przeniesione z kalkulatora:
          </strong>
          <div style="margin-top: 0.35rem; line-height: 1.5; font-size: 0.88rem;">
            • Wymiary: <strong>${calcData.dimensions}</strong> | Zakres: <strong>${calcData.scope}</strong><br />
            • Szacunek z kalkulatora: <strong style="color: #fff;">${calcData.estimatedPrice}</strong>
          </div>
        </div>
        <button type="button" class="btn btn-outline btn-sm" id="btnResetCalcSummary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">Zmień kalkulację</button>
      </div>
    `;

    const resetBtn = document.getElementById("btnResetCalcSummary");
    if (resetBtn) {
      resetBtn.onclick = () => {
        const calcSection = document.getElementById("kalkulator") || document.getElementById("kalkulator-sekcja");
        if (calcSection) {
          calcSection.scrollIntoView({ behavior: "smooth" });
        } else {
          window.location.href = "kalkulator.html";
        }
      };
    }
  }

  if (messageInput && (!messageInput.value || messageInput.value.includes("Wycena z kalkulatora") || messageInput.value.includes("Parametry z kalkulatora"))) {
    messageInput.value = `Dzień dobry,

Proszę o potwierdzenie wyceny i terminu dla skanowania 3D:
• Wymiary: ${calcData.dimensions}
• Zakres usługi: ${calcData.scope}
• Stopień złożoności: ${calcData.complexity}
• Powierzchnia: ${calcData.surface}
• Szacunkowy koszt z kalkulatora: ${calcData.estimatedPrice}

Załączam zdjęcia/pliki detalu do bezpłatnej oceny technologicznej.`;
  }
}

/* ==========================================================
   FORMULARZ ZAPYTANIA Z PRZESYŁANIEM PLIKÓW I DIRECT AJAX/API
   ========================================================== */
function initQuoteForm() {
  const form = document.getElementById("inquiryForm") || document.getElementById("quickContactForm");
  if (!form) return;

  try {
    const savedCalc = sessionStorage.getItem("mc_calc_data");
    if (savedCalc) {
      applyCalcDataToForm(JSON.parse(savedCalc));
    }
  } catch (e) {}

  const fileInput = document.getElementById("inquiryFiles");
  const fileDropzone = document.getElementById("fileDropzone");
  const fileListEl = document.getElementById("fileList");
  const submitBtn = form.querySelector("button[type=\"submit\"]");
  const formStatus = document.getElementById("formStatus");

  let attachedFiles = [];
  const MAX_TOTAL_SIZE = (window.MULTICORE_CONFIG?.form?.maxFileSizeMb || 25) * 1024 * 1024;
  const ALLOWED_EXTS = window.MULTICORE_CONFIG?.form?.allowedExtensions || [
    "jpg", "jpeg", "png", "webp", "pdf", "step", "stp", "stl", "iges", "igs", "zip", "rar", "7z"
  ];

  if (fileDropzone && fileInput) {
    ["dragenter", "dragover"].forEach(name => {
      fileDropzone.addEventListener(name, (e) => {
        e.preventDefault();
        fileDropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach(name => {
      fileDropzone.addEventListener(name, (e) => {
        e.preventDefault();
        fileDropzone.classList.remove("dragover");
      });
    });

    fileDropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesAdded(Array.from(e.dataTransfer.files));
      }
    });

    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFilesAdded(Array.from(e.target.files));
      }
    });
  }

  function handleFilesAdded(newFiles) {
    for (const file of newFiles) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        showError(`Niedozwolony format: "${file.name}". Dozwolone: ${ALLOWED_EXTS.join(", ")}`);
        continue;
      }
      
      const currentTotal = attachedFiles.reduce((sum, f) => sum + f.size, 0);
      if (currentTotal + file.size > MAX_TOTAL_SIZE) {
        showError(`Przekroczono łączny limit plików (${window.MULTICORE_CONFIG?.form?.maxFileSizeMb || 25} MB).`);
        break;
      }

      attachedFiles.push(file);
      window.multicoreAnalytics?.track("file_uploaded", { file_ext: ext, file_size_kb: Math.round(file.size / 1024) });
    }
    renderFileList();
  }

  function renderFileList() {
    if (!fileListEl) return;
    if (attachedFiles.length === 0) {
      fileListEl.innerHTML = "";
      return;
    }

    fileListEl.innerHTML = attachedFiles.map((file, idx) => {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      const isImg = file.type.startsWith("image/");
      const icon = isImg ? "🖼️" : file.name.endsWith(".pdf") ? "📄" : "📐";
      return `
        <div class="file-item-pill">
          <span class="file-item-icon">${icon}</span>
          <span class="file-item-name" title="${file.name}">${file.name} <small>(${sizeMb} MB)</small></span>
          <button type="button" class="file-item-remove" data-idx="${idx}" aria-label="Usuń plik ${file.name}">✕</button>
        </div>
      `;
    }).join("");

    fileListEl.querySelectorAll(".file-item-remove").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-idx"), 10);
        attachedFiles.splice(idx, 1);
        renderFileList();
      });
    });
  }

  function showError(msg) {
    if (formStatus) {
      formStatus.className = "form-status error";
      formStatus.textContent = msg;
      formStatus.style.display = "block";
      formStatus.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      alert(msg);
    }
  }

  let formStarted = false;
  form.addEventListener("focusin", () => {
    if (!formStarted) {
      formStarted = true;
      const topic = document.getElementById("inquiryTopic")?.value || "general";
      window.multicoreAnalytics?.track("contact_form_started", { topic });
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const honeypot = form.querySelector("input[name=\"company_fax_or_url\"]")?.value;
    if (honeypot) {
      console.warn("Spam bot detected.");
      return;
    }

    const now = Date.now();
    const windowMs = (window.MULTICORE_CONFIG?.form?.rateLimitWindowMinutes || 10) * 60 * 1000;
    const maxSubmissions = window.MULTICORE_CONFIG?.form?.rateLimitMax || 5;
    let timestamps = [];
    try {
      timestamps = JSON.parse(localStorage.getItem("mc_sub_ts") || "[]").filter(t => now - t < windowMs);
    } catch (err) {}

    if (timestamps.length >= maxSubmissions) {
      showError("Wysłano zbyt wiele zapytań w krótkim czasie. W pilnych sprawach prosimy o kontakt telefoniczny: +48 533 491 374.");
      return;
    }

    const name = form.querySelector("[name=\"name\"]")?.value?.trim() || "";
    const email = form.querySelector("[name=\"email\"]")?.value?.trim() || "";
    const phone = form.querySelector("[name=\"phone\"]")?.value?.trim() || "";
    const topic = form.querySelector("[name=\"topic\"]")?.value || "skanowanie";
    const message = form.querySelector("[name=\"message\"]")?.value?.trim() || "";
    const contactPref = form.querySelector("[name=\"preferredContact\"]:checked")?.value || "email";

    if (!email && !phone) {
      showError("Podaj przynajmniej jeden sposób kontaktu: adres e-mail lub numer telefonu.");
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError("Wprowadź poprawny adres e-mail (np. jan@firma.pl).");
      return;
    }

    if (!message) {
      showError("Opisz krótko swój detal lub projekt inżynierski.");
      return;
    }

    let trafficMeta = {};
    try {
      trafficMeta = JSON.parse(sessionStorage.getItem("mc_traffic_meta") || "{}");
    } catch (err) {}

    let calcData = {};
    try {
      calcData = JSON.parse(sessionStorage.getItem("mc_calc_data") || "{}");
    } catch (err) {}

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Przetwarzanie zapytania...</span> <span class="spinner"></span>`;
    }

    if (formStatus) {
      formStatus.style.display = "none";
    }

    const inquiryPayload = {
      name,
      email,
      phone,
      topic,
      preferredContact: contactPref,
      message,
      attachedFilesCount: attachedFiles.length,
      fileNames: attachedFiles.map(f => f.name),
      calcData: calcData.estimatedPrice ? calcData : null,
      trafficMeta,
      submittedAt: new Date().toLocaleString("pl-PL")
    };

    try {
      sessionStorage.setItem("mc_last_inquiry", JSON.stringify(inquiryPayload));
      timestamps.push(now);
      localStorage.setItem("mc_sub_ts", JSON.stringify(timestamps));
    } catch (e) {}

    window.multicoreAnalytics?.track("contact_form_submitted", {
      topic,
      has_files: attachedFiles.length > 0,
      files_count: attachedFiles.length,
      has_calc_data: !!calcData.estimatedPrice
    });

    if (calcData.estimatedPrice) {
      window.multicoreAnalytics?.track("calculator_lead_submitted", {
        estimated_price: calcData.estimatedPrice
      });
    }

    const endpoint = window.MULTICORE_CONFIG?.form?.endpointUrl;

    if (endpoint) {
      try {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("email", email);
        formData.append("phone", phone);
        formData.append("topic", topic);
        formData.append("preferredContact", contactPref);
        formData.append("message", message);
        formData.append("utm_source", trafficMeta.utm_source || "");
        formData.append("utm_medium", trafficMeta.utm_medium || "");
        formData.append("utm_campaign", trafficMeta.utm_campaign || "");
        
        if (calcData.estimatedPrice) {
          formData.append("calc_summary", JSON.stringify(calcData));
        }

        attachedFiles.forEach(file => formData.append("files[]", file));

        const res = await fetch(endpoint, {
          method: "POST",
          body: formData
        });

        if (res.ok) {
          window.location.href = "dziekujemy.html";
          return;
        }
      } catch (err) {
        console.warn("Wysyłka do endpointu nie powiodła się, przechodzenie do potwierdzenia:", err);
      }
    }

    setTimeout(() => {
      window.location.href = "dziekujemy.html";
    }, 500);
  });
}

/* ==========================================================
   CASE STUDIES & LIGHTBOX
   ========================================================== */
function initGallery() {
  const filterTabs = document.querySelectorAll(".filter-tab");
  const portfolioCards = document.querySelectorAll(".portfolio-card");
  const lightbox = document.getElementById("siteLightbox");
  if (!lightbox) return;

  const lightboxImg = document.getElementById("lightboxImage");
  const lightboxCounter = document.getElementById("lightboxCounter");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const btnClose = document.getElementById("lightboxClose");
  const btnPrev = document.getElementById("lightboxPrev");
  const btnNext = document.getElementById("lightboxNext");

  if (filterTabs.length > 0 && portfolioCards.length > 0) {
    filterTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        filterTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const filter = tab.getAttribute("data-filter");

        portfolioCards.forEach(card => {
          const category = card.getAttribute("data-category");
          if (filter === "all" || category === filter || card.classList.contains(filter)) {
            card.style.display = "flex";
          } else {
            card.style.display = "none";
          }
        });
      });
    });
  }

  let currentPhotos = [];
  let currentIndex = 0;

  document.querySelectorAll("[data-gallery-photos]").forEach(trigger => {
    trigger.addEventListener("click", () => {
      try {
        const raw = trigger.getAttribute("data-gallery-photos");
        const photos = JSON.parse(raw);
        const title = trigger.getAttribute("data-gallery-title") || "Realizacja";
        if (photos && photos.length > 0) {
          currentPhotos = photos.map(p => typeof p === "string" ? { src: p, title } : p);
          currentIndex = 0;
          openLightbox();
          window.multicoreAnalytics?.track("case_study_viewed", { title });
        }
      } catch (err) {
        console.error("Błąd otwarcia galerii:", err);
      }
    });
  });

  function openLightbox() {
    updateView();
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lightboxImg) lightboxImg.src = "";
  }

  function updateView() {
    if (!currentPhotos.length) return;
    const cur = currentPhotos[currentIndex];
    if (lightboxImg) {
      lightboxImg.src = cur.src;
      lightboxImg.alt = cur.title || "Zdjęcie z realizacji";
    }
    if (lightboxCaption) {
      lightboxCaption.textContent = cur.title || "";
    }
    if (lightboxCounter) {
      lightboxCounter.textContent = `${currentIndex + 1} / ${currentPhotos.length}`;
    }
  }

  function showNext() {
    if (!currentPhotos.length) return;
    currentIndex = (currentIndex + 1) % currentPhotos.length;
    updateView();
  }

  function showPrev() {
    if (!currentPhotos.length) return;
    currentIndex = (currentIndex - 1 + currentPhotos.length) % currentPhotos.length;
    updateView();
  }

  if (btnClose) btnClose.addEventListener("click", closeLightbox);
  if (btnNext) btnNext.addEventListener("click", showNext);
  if (btnPrev) btnPrev.addEventListener("click", showPrev);

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target.classList.contains("lightbox-dialog")) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") showNext();
    if (e.key === "ArrowLeft") showPrev();
  });
}

/* ==========================================================
   ŚLEDZENIE KLIKNIĘĆ TELEFONU, E-MAILA I GŁÓWNYCH CTA
   ========================================================== */
function initGlobalConversionTracking() {
  document.querySelectorAll("a[href^=\"tel:\"]").forEach(link => {
    link.addEventListener("click", () => {
      window.multicoreAnalytics?.track("phone_clicked", { phone: link.getAttribute("href") });
    });
  });

  document.querySelectorAll("a[href^=\"mailto:\"]").forEach(link => {
    link.addEventListener("click", () => {
      window.multicoreAnalytics?.track("email_clicked", { email: link.getAttribute("href") });
    });
  });

  document.querySelectorAll(".btn-primary, [data-track-cta]").forEach(cta => {
    cta.addEventListener("click", () => {
      const text = cta.textContent?.trim() || "";
      window.multicoreAnalytics?.track("service_cta_clicked", {
        cta_text: text,
        cta_href: cta.getAttribute("href") || ""
      });
    });
  });

  const heroPrimaryCta = document.querySelector(".section-hero .btn-primary");
  if (heroPrimaryCta) {
    heroPrimaryCta.addEventListener("click", () => {
      window.multicoreAnalytics?.track("hero_cta_click", { cta_type: "primary_quote" });
    });
  }
}

/* ==========================================================
   PŁYNNE PRZEWIJANIE DO KOTWIC
   ========================================================== */
function initSmoothScroll() {
  document.querySelectorAll("a[href^=\"#\"]:not([href=\"#\"])").forEach(anchor => {
    anchor.addEventListener("click", function(e) {
      const targetId = this.getAttribute("href").substring(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}
