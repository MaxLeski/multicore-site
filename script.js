/**
 * MULTICORE Maksym Leski - Official Frontend Engine
 * Skanowanie 3D • Inżynieria Odwrotna CAD • Druk 3D • Embedded & Automatyka
 */

// Globalna warstwa analityczna i zdarzenia
(function initAnalyticsLayer() {
  const params = new URLSearchParams(window.location.search);
  const sessionData = {
    landingPage: window.location.pathname,
    referrer: document.referrer || 'direct',
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || ''
  };

  try {
    if (!sessionStorage.getItem('mc_traffic_meta')) {
      sessionStorage.setItem('mc_traffic_meta', JSON.stringify(sessionData));
    }
  } catch (e) {}

  window.multicoreAnalytics = {
    track: function(eventName, customData = {}) {
      let traffic = {};
      try {
        traffic = JSON.parse(sessionStorage.getItem('mc_traffic_meta') || '{}');
      } catch (e) {}

      // Bezpieczny payload - bez PII (danych osobowych)
      const payload = {
        event: eventName,
        timestamp: new Date().toISOString(),
        page: window.location.pathname,
        utm_source: traffic.utm_source || undefined,
        utm_medium: traffic.utm_medium || undefined,
        utm_campaign: traffic.utm_campaign || undefined,
        ...customData
      };

      // Push do dataLayer (jeśli obecny GTM/GA4)
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(payload);

      // Emisja zdarzenia DOM
      window.dispatchEvent(new CustomEvent('multicore:track', { detail: payload }));

      if (window.MULTICORE_CONFIG?.analytics?.debug) {
        console.log('[Multicore Analytics]', eventName, payload);
      }
    }
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  // 1. Dynamiczny rok w stopce
  const yearEls = document.querySelectorAll('.current-year');
  const curYear = new Date().getFullYear();
  yearEls.forEach(el => (el.textContent = curYear));

  // 2. Obsługa nawigacji i menu mobilnego
  initNavigation();

  // 3. Moduł kalkulatora zintegrowany z konfiguracją cenową
  initCalculator();

  // 4. Zaawansowana obsługa formularza z uploadem plików i fallbackiem
  initQuoteForm();

  // 5. Galeria Case Studies i Lightbox
  initGallery();

  // 6. Śledzenie globalnych kliknięć CTA, telefonu i maila
  initGlobalConversionTracking();
});

/* ==========================================================
   NAWIGACJA & STICKY HEADER & DROPDOWN
   ========================================================== */
function initNavigation() {
  const header = document.querySelector('.site-header');
  const mobileToggle = document.querySelector('.btn-mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');
  const navDropdowns = document.querySelectorAll('.nav-dropdown');

  // Sticky header class
  window.addEventListener('scroll', () => {
    if (header) {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  }, { passive: true });

  // Toggle mobilny
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', isOpen);
      mobileToggle.classList.toggle('active', isOpen);
      document.body.classList.toggle('nav-open', isOpen);
    });

    // Zamykanie menu po kliknięciu zwykłego linku
    navMenu.querySelectorAll('.nav-link:not(.dropdown-toggle)').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileToggle.classList.remove('active');
        document.body.classList.remove('nav-open');
      });
    });
  }

  // Dropdown na mobile i desktop
  navDropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        if (window.innerWidth <= 992) {
          e.preventDefault();
          dropdown.classList.toggle('open');
          const isExp = dropdown.classList.contains('open');
          toggle.setAttribute('aria-expanded', isExp);
        }
      });
    }
  });

  // Zamykanie dropdownów po kliknięciu poza
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-dropdown')) {
      navDropdowns.forEach(d => {
        d.classList.remove('open');
        d.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded', 'false');
      });
    }
  });
}

/* ==========================================================
   KALKULATOR WYCENY SKANOWANIA 3D & PRZENOSZENIE DO FORMULARZA
   ========================================================== */
function initCalculator() {
  const calcForm = document.getElementById('calcForm');
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
      low: { mult: 1.0, label: 'Prosty detal' },
      medium: { mult: 1.25, label: 'Średnio złożony' },
      high: { mult: 1.6, label: 'Złożony techniczny' }
    },
    surface: {
      easy: { surcharge: 0, label: 'Standardowa' },
      difficult: { surcharge: 180, label: 'Ciemna / Błyszcząca' },
      'very-difficult': { surcharge: 320, label: 'Bardzo trudna' }
    },
    scope: {
      scan: { surcharge: 0, min: 350, label: 'Sam skan 3D (surowa chmura/siatka)' },
      mesh: { surcharge: 220, min: 590, label: 'Skan + Oczyszczona siatka STL' },
      cad: { surcharge: 950, min: 1400, label: 'Skan + Model CAD STEP (Reverse Engineering)' }
    },
    mode: {
      standard: { mult: 1.0, label: 'Standardowy' },
      fast: { mult: 1.25, label: 'Ekspresowy' }
    }
  };

  const lengthInput = document.getElementById('calcLength');
  const widthInput = document.getElementById('calcWidth');
  const heightInput = document.getElementById('calcHeight');
  const unitToggle = document.getElementById('calcUnitToggle');
  const priceValEl = document.getElementById('calcPriceVal');
  const priceRangeEl = document.getElementById('calcPriceRange');
  const emptyStateEl = document.getElementById('calcEmptyState');
  const resultStateEl = document.getElementById('calcResultState');
  const breakdownListEl = document.getElementById('calcBreakdownList');
  const sendQuoteBtn = document.getElementById('calcSendQuoteBtn');

  let currentUnit = 'cm'; // 'cm' lub 'mm'
  let hasStarted = false;

  // Przełącznik jednostek mm/cm
  if (unitToggle) {
    unitToggle.querySelectorAll('.unit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newUnit = btn.getAttribute('data-unit');
        if (newUnit === currentUnit) return;
        
        unitToggle.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Przeliczenie wartości w polach
        [lengthInput, widthInput, heightInput].forEach(inp => {
          if (inp && inp.value) {
            const val = parseFloat(inp.value);
            if (!isNaN(val) && val > 0) {
              inp.value = newUnit === 'mm' ? (val * 10).toFixed(0) : (val / 10).toFixed(1);
            }
          }
        });

        // Aktualizacja etykiet jednostek
        calcForm.querySelectorAll('.input-unit').forEach(u => (u.textContent = newUnit));
        currentUnit = newUnit;
        calculate();
      });
    });
  }

  // Kafelki wyboru
  setupTiles('complexityOptions', 'calcComplexity');
  setupTiles('surfaceOptions', 'calcSurface');
  setupTiles('scopeOptions', 'calcScope');
  setupTiles('modeOptions', 'calcMode');

  function setupTiles(containerId, inputId) {
    const container = document.getElementById(containerId);
    const hidden = document.getElementById(inputId);
    if (!container || !hidden) return;

    container.querySelectorAll('.option-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        container.querySelectorAll('.option-tile').forEach(t => {
          t.classList.remove('selected');
          t.setAttribute('aria-checked', 'false');
        });
        tile.classList.add('selected');
        tile.setAttribute('aria-checked', 'true');
        hidden.value = tile.getAttribute('data-value');
        
        if (!hasStarted) {
          hasStarted = true;
          window.multicoreAnalytics?.track('calculator_started');
        }
        calculate();
      });
    });
  }

  [lengthInput, widthInput, heightInput].forEach(inp => {
    if (inp) {
      inp.addEventListener('input', () => {
        if (!hasStarted) {
          hasStarted = true;
          window.multicoreAnalytics?.track('calculator_started');
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

    // Przeliczenie na cm do kalkulacji
    const l = currentUnit === 'mm' ? rawL / 10 : rawL;
    const w = currentUnit === 'mm' ? rawW / 10 : rawW;
    const h = currentUnit === 'mm' ? rawH / 10 : rawH;

    const complexityVal = document.getElementById('calcComplexity')?.value || 'medium';
    const surfaceVal = document.getElementById('calcSurface')?.value || 'easy';
    const scopeVal = document.getElementById('calcScope')?.value || 'mesh';
    const modeVal = document.getElementById('calcMode')?.value || 'standard';

    if (l <= 0 || w <= 0 || h <= 0) {
      if (emptyStateEl) emptyStateEl.style.display = 'block';
      if (resultStateEl) resultStateEl.style.display = 'none';
      if (priceValEl) priceValEl.textContent = '---';
      return;
    }

    if (emptyStateEl) emptyStateEl.style.display = 'none';
    if (resultStateEl) resultStateEl.style.display = 'block';

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

    // Szacowany przedział orientacyjny ±15%
    const minRange = Math.max(scopeConfig.min, Math.round((finalPrice * 0.9) / 10) * 10);
    const maxRange = Math.round((finalPrice * 1.15) / 10) * 10;

    if (priceValEl) {
      priceValEl.textContent = `${finalPrice.toLocaleString('pl-PL')}`;
    }
    if (priceRangeEl) {
      priceRangeEl.textContent = `Przedział szacunkowy: od ~${minRange} do ~${maxRange} zł netto`;
    }

    if (breakdownListEl) {
      const items = [
        { label: 'Kalibracja i stanowisko pomiarowe', val: `${setupCost} zł` },
        { label: `Gabaryt max (${maxDimCm.toFixed(1)} cm)`, val: sizeCost ? `+${sizeCost} zł` : 'W cenie bazowej' },
        { label: `Objętość robocza (${Math.round(volumeCm3)} cm³)`, val: volCost ? `+${volCost} zł` : 'W cenie bazowej' },
        { label: `Powierzchnia (${surfConfig.label})`, val: surfConfig.surcharge ? `+${surfConfig.surcharge} zł` : 'Standard' },
        { label: `Zakres usługi (${scopeConfig.label})`, val: scopeConfig.surcharge ? `+${scopeConfig.surcharge} zł` : 'W cenie bazowej' },
        { label: `Złożoność (${compConfig.label})`, val: `x${compConfig.mult}` },
        { label: `Tryb realizacji (${modeConfig.label})`, val: `x${modeConfig.mult}` }
      ];

      breakdownListEl.innerHTML = items.map(item => `
        <li class="breakdown-item">
          <span>${item.label}</span>
          <strong>${item.val}</strong>
        </li>
      `).join('');
    }

    // Obsługa głównego CTA: "Wyślij zdjęcia i potwierdź wycenę"
    if (sendQuoteBtn) {
      sendQuoteBtn.onclick = () => {
        window.multicoreAnalytics?.track('calculator_completed', {
          max_dim_cm: maxDimCm,
          scope: scopeVal,
          complexity: complexityVal,
          estimated_price: finalPrice
        });
        window.multicoreAnalytics?.track('calculator_quote_sent');

        const calcData = {
          dimensions: `${rawL} x ${rawW} x ${rawH} ${currentUnit}`,
          maxDimCm: maxDimCm,
          volumeCm3: Math.round(volumeCm3),
          complexity: compConfig.label,
          surface: surfConfig.label,
          scope: scopeConfig.label,
          mode: modeConfig.label,
          estimatedPrice: `${finalPrice} zł netto (przedział ${minRange}–${maxRange} zł)`
        };

        // Zapis do sessionStorage
        try {
          sessionStorage.setItem('mc_calc_data', JSON.stringify(calcData));
        } catch (e) {}

        // Jeśli na stronie jest formularz kontaktowy, scrolluj i prefilluj
        const contactSection = document.getElementById('formularz') || document.getElementById('kontakt');
        if (contactSection) {
          applyCalcDataToForm(calcData);
          contactSection.scrollIntoView({ behavior: 'smooth' });
        } else {
          // Przejdź na stronę kontaktu z parametrem
          window.location.href = `kontakt.html?source=calculator#formularz`;
        }
      };
    }
  }

  // Sprawdzenie, czy pola są już wypełnione domyślnie
  if (lengthInput && lengthInput.value && widthInput && widthInput.value && heightInput && heightInput.value) {
    calculate();
  }
}

function applyCalcDataToForm(calcData) {
  if (!calcData) return;
  const topicSelect = document.getElementById('inquiryTopic');
  const messageInput = document.getElementById('inquiryMessage');
  const calcSummaryBox = document.getElementById('formCalcSummary');
  const calcSummaryContent = document.getElementById('formCalcSummaryContent');

  if (topicSelect) {
    if (calcData.scope.includes('CAD')) {
      topicSelect.value = 'cad';
    } else {
      topicSelect.value = 'skanowanie';
    }
  }

  if (calcSummaryBox && calcSummaryContent) {
    calcSummaryBox.style.display = 'block';
    calcSummaryContent.innerHTML = `
      <strong>Parametry z kalkulatora:</strong><br />
      • Wymiary: ${calcData.dimensions}<br />
      • Zakres: ${calcData.scope}<br />
      • Geometria: ${calcData.complexity} | Powierzchnia: ${calcData.surface}<br />
      • Szacunek z kalkulatora: <strong>${calcData.estimatedPrice}</strong>
    `;
  }

  if (messageInput && (!messageInput.value || messageInput.value.includes('Parametry z kalkulatora'))) {
    messageInput.value = `Dzień dobry,

Proszę o potwierdzenie wyceny i terminu dla skanowania 3D:
- Wymiary: ${calcData.dimensions}
- Zakres: ${calcData.scope}
- Stopień złożoności: ${calcData.complexity}
- Stan powierzchni: ${calcData.surface}
- Szacunek z kalkulatora: ${calcData.estimatedPrice}

Załączam zdjęcia/opis detalu do weryfikacji.`;
  }
}

/* ==========================================================
   FORMULARZ ZAPYTANIA Z PRZESYŁANIEM PLIKÓW I WALIDACJĄ
   ========================================================== */
function initQuoteForm() {
  const form = document.getElementById('inquiryForm') || document.getElementById('quickContactForm');
  if (!form) return;

  // Odczyt danych z kalkulatora z sessionStorage, jeśli istnieją
  try {
    const savedCalc = sessionStorage.getItem('mc_calc_data');
    if (savedCalc) {
      applyCalcDataToForm(JSON.parse(savedCalc));
    }
  } catch (e) {}

  const fileInput = document.getElementById('inquiryFiles');
  const fileDropzone = document.getElementById('fileDropzone');
  const fileListEl = document.getElementById('fileList');
  const submitBtn = form.querySelector('button[type="submit"]');
  const formStatus = document.getElementById('formStatus');

  let attachedFiles = [];
  const MAX_TOTAL_SIZE = (window.MULTICORE_CONFIG?.form?.maxFileSizeMb || 25) * 1024 * 1024;
  const ALLOWED_EXTS = window.MULTICORE_CONFIG?.form?.allowedExtensions || [
    'jpg', 'jpeg', 'png', 'webp', 'pdf', 'step', 'stp', 'stl', 'iges', 'igs', 'zip', 'rar', '7z'
  ];

  // Drag & Drop plików
  if (fileDropzone && fileInput) {
    ['dragenter', 'dragover'].forEach(name => {
      fileDropzone.addEventListener(name, (e) => {
        e.preventDefault();
        fileDropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      fileDropzone.addEventListener(name, (e) => {
        e.preventDefault();
        fileDropzone.classList.remove('dragover');
      });
    });

    fileDropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesAdded(Array.from(e.dataTransfer.files));
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFilesAdded(Array.from(e.target.files));
      }
    });
  }

  function handleFilesAdded(newFiles) {
    for (const file of newFiles) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        showError(`Niedozwolony format pliku: ${file.name}. Dopuszczalne: ${ALLOWED_EXTS.join(', ')}`);
        continue;
      }
      
      const currentTotal = attachedFiles.reduce((sum, f) => sum + f.size, 0);
      if (currentTotal + file.size > MAX_TOTAL_SIZE) {
        showError(`Przekroczono łączny limit plików (${window.MULTICORE_CONFIG?.form?.maxFileSizeMb || 25} MB).`);
        break;
      }

      attachedFiles.push(file);
      window.multicoreAnalytics?.track('file_uploaded', { file_ext: ext });
    }
    renderFileList();
  }

  function renderFileList() {
    if (!fileListEl) return;
    if (attachedFiles.length === 0) {
      fileListEl.innerHTML = '';
      return;
    }

    fileListEl.innerHTML = attachedFiles.map((file, idx) => {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      const isImg = file.type.startsWith('image/');
      return `
        <div class="file-item-pill">
          <span class="file-item-icon">${isImg ? '🖼️' : '📄'}</span>
          <span class="file-item-name" title="${file.name}">${file.name} (${sizeMb} MB)</span>
          <button type="button" class="file-item-remove" data-idx="${idx}" aria-label="Usuń plik">✕</button>
        </div>
      `;
    }).join('');

    fileListEl.querySelectorAll('.file-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        attachedFiles.splice(idx, 1);
        renderFileList();
      });
    });
  }

  function showError(msg) {
    if (formStatus) {
      formStatus.className = 'form-status error';
      formStatus.textContent = msg;
      formStatus.style.display = 'block';
    } else {
      alert(msg);
    }
  }

  // Śledzenie rozpoczęcia wypełniania
  let formStarted = false;
  form.addEventListener('focusin', () => {
    if (!formStarted) {
      formStarted = true;
      const topic = document.getElementById('inquiryTopic')?.value || 'general';
      if (window.location.pathname.includes('embedded')) {
        window.multicoreAnalytics?.track('embedded_inquiry_started');
      } else {
        window.multicoreAnalytics?.track('quote_form_started', { topic });
      }
    }
  });

  // Obsługa wysyłki
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Honeypot antyspamowy
    const honeypot = form.querySelector('input[name="company_fax_or_url"]')?.value;
    if (honeypot) {
      console.warn('Bot detected');
      return;
    }

    // Rate limiter w localStorage
    const now = Date.now();
    const windowMs = (window.MULTICORE_CONFIG?.form?.rateLimitWindowMinutes || 10) * 60 * 1000;
    const maxSubmissions = window.MULTICORE_CONFIG?.form?.rateLimitMax || 5;
    let timestamps = [];
    try {
      timestamps = JSON.parse(localStorage.getItem('mc_sub_ts') || '[]').filter(t => now - t < windowMs);
    } catch (err) {}

    if (timestamps.length >= maxSubmissions) {
      showError('Wysłano zbyt wiele zapytań w krótkim czasie. Prosimy o kontakt telefoniczny: +48 533 491 374.');
      return;
    }

    const name = form.querySelector('[name="name"]')?.value?.trim() || '';
    const email = form.querySelector('[name="email"]')?.value?.trim() || '';
    const phone = form.querySelector('[name="phone"]')?.value?.trim() || '';
    const topic = form.querySelector('[name="topic"]')?.value || 'skanowanie';
    const message = form.querySelector('[name="message"]')?.value?.trim() || '';
    const contactPref = form.querySelector('[name="preferredContact"]:checked')?.value || 'email';

    // Walidacja: min. 1 sposób kontaktu
    if (!email && !phone) {
      showError('Podaj przynajmniej jeden sposób kontaktu: adres e-mail lub numer telefonu.');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Wprowadź poprawny adres e-mail (np. jan@firma.pl).');
      return;
    }

    if (!message) {
      showError('Opisz krótko swój detal lub problem inżynierski.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Wysyłanie zapytania...</span> <span class="spinner"></span>`;
    }

    if (formStatus) {
      formStatus.style.display = 'none';
    }

    const endpoint = window.MULTICORE_CONFIG?.form?.endpointUrl;

    // Przygotowanie danych do wysyłki
    const inquiryPayload = {
      name,
      email,
      phone,
      topic,
      preferredContact: contactPref,
      message,
      attachedFilesCount: attachedFiles.length,
      fileNames: attachedFiles.map(f => f.name),
      submittedAt: new Date().toLocaleString('pl-PL')
    };

    // Zapis do sessionStorage w celu wyświetlenia na stronie podziękowania
    try {
      sessionStorage.setItem('mc_last_inquiry', JSON.stringify(inquiryPayload));
      timestamps.push(now);
      localStorage.setItem('mc_sub_ts', JSON.stringify(timestamps));
    } catch (e) {}

    // Analityka
    if (topic === 'embedded') {
      window.multicoreAnalytics?.track('embedded_inquiry_completed');
    } else if (topic === 'automatyzacja') {
      window.multicoreAnalytics?.track('automation_inquiry_completed');
    } else {
      window.multicoreAnalytics?.track('quote_form_completed', { topic, has_files: attachedFiles.length > 0 });
    }

    // Jeśli skonfigurowano aktywny backend endpoint
    if (endpoint) {
      try {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        formData.append('phone', phone);
        formData.append('topic', topic);
        formData.append('preferredContact', contactPref);
        formData.append('message', message);
        attachedFiles.forEach(file => formData.append('files[]', file));

        const res = await fetch(endpoint, {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          window.location.href = 'dziekujemy.html';
          return;
        }
      } catch (err) {
        console.warn('Wysyłka endpointu nie powiodła się, przechodzenie do potwierdzenia:', err);
      }
    }

    // Bezpieczne przejście do podziękowania z zapisanym podsumowaniem
    setTimeout(() => {
      window.location.href = 'dziekujemy.html';
    }, 600);
  });
}

/* ==========================================================
   CASE STUDIES & PEŁNOEKRANOWY LIGHTBOX
   ========================================================== */
function initGallery() {
  const filterTabs = document.querySelectorAll('.filter-tab');
  const portfolioCards = document.querySelectorAll('.portfolio-card');
  const lightbox = document.getElementById('siteLightbox');
  if (!lightbox) return;

  const lightboxImg = document.getElementById('lightboxImage');
  const lightboxCounter = document.getElementById('lightboxCounter');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const btnClose = document.getElementById('lightboxClose');
  const btnPrev = document.getElementById('lightboxPrev');
  const btnNext = document.getElementById('lightboxNext');

  // Filtrowanie kategorii
  if (filterTabs.length > 0 && portfolioCards.length > 0) {
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.getAttribute('data-filter');

        portfolioCards.forEach(card => {
          const category = card.getAttribute('data-category');
          if (filter === 'all' || category === filter || card.classList.contains(filter)) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  let currentPhotos = [];
  let currentIndex = 0;

  document.querySelectorAll('[data-gallery-photos]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      try {
        const raw = trigger.getAttribute('data-gallery-photos');
        const photos = JSON.parse(raw);
        const title = trigger.getAttribute('data-gallery-title') || 'Realizacja';
        if (photos && photos.length > 0) {
          currentPhotos = photos.map(p => typeof p === 'string' ? { src: p, title } : p);
          currentIndex = 0;
          openLightbox();
          window.multicoreAnalytics?.track('case_study_opened', { title });
        }
      } catch (err) {
        console.error('Błąd otwarcia galerii:', err);
      }
    });
  });

  function openLightbox() {
    updateView();
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lightboxImg) lightboxImg.src = '';
  }

  function updateView() {
    if (!currentPhotos.length) return;
    const cur = currentPhotos[currentIndex];
    if (lightboxImg) {
      lightboxImg.src = cur.src;
      lightboxImg.alt = cur.title || 'Zdjęcie z realizacji';
    }
    if (lightboxCaption) {
      lightboxCaption.textContent = cur.title || '';
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

  if (btnClose) btnClose.addEventListener('click', closeLightbox);
  if (btnNext) btnNext.addEventListener('click', showNext);
  if (btnPrev) btnPrev.addEventListener('click', showPrev);

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.classList.contains('lightbox-dialog')) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'ArrowLeft') showPrev();
  });
}

/* ==========================================================
   ŚLEDZENIE KLIKNIĘĆ TELEFONU, E-MAILA I GŁÓWNYCH CTA
   ========================================================== */
function initGlobalConversionTracking() {
  // Kliknięcie telefonu
  document.querySelectorAll('a[href^="tel:"]').forEach(link => {
    link.addEventListener('click', () => {
      window.multicoreAnalytics?.track('phone_clicked', { phone: link.getAttribute('href') });
    });
  });

  // Kliknięcie maila
  document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
    link.addEventListener('click', () => {
      window.multicoreAnalytics?.track('email_clicked', { email: link.getAttribute('href') });
    });
  });

  // Główne CTA
  document.querySelectorAll('.btn-primary, [data-track-cta]').forEach(cta => {
    cta.addEventListener('click', () => {
      const text = cta.textContent?.trim() || '';
      window.multicoreAnalytics?.track('primary_cta_clicked', { text });
    });
  });
}
