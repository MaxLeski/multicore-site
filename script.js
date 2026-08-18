// Multicore Maksym Leski - Interactive Engine

document.addEventListener('DOMContentLoaded', () => {
  // 1. Aktualizacja roku w stopce
  const yearEls = document.querySelectorAll('.current-year');
  const curYear = new Date().getFullYear();
  yearEls.forEach(el => el.textContent = curYear);

  // 2. Menu Mobilne & Header Scroll
  const header = document.querySelector('.site-header');
  const mobileToggle = document.querySelector('.btn-mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      const isOpen = navMenu.classList.contains('open');
      mobileToggle.setAttribute('aria-expanded', isOpen);
    });

    // Zamykanie menu po kliknięciu linku
    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
      });
    });
  }

  window.addEventListener('scroll', () => {
    if (header) {
      if (window.scrollY > 30) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  });

  // 3. Moduł Kalkulatora Skanowania 3D
  initCalculator();

  // 4. Moduł Galerii i Lightboxa
  initGallery();

  // 5. Szybki Formularz Kontaktowy
  initContactForm();
});

/* ==========================================================
   KALKULATOR WYCENY SKANOWANIA 3D
   ========================================================== */
function initCalculator() {
  const calcForm = document.getElementById('calcForm');
  if (!calcForm) return;

  const lengthInput = document.getElementById('calcLength');
  const widthInput = document.getElementById('calcWidth');
  const heightInput = document.getElementById('calcHeight');
  const photoInput = document.getElementById('calcPhoto');
  const dropzone = document.getElementById('calcDropzone');
  const previewBox = document.getElementById('calcPhotoPreview');
  const previewImg = document.getElementById('calcPreviewImg');

  const priceValEl = document.getElementById('calcPriceVal');
  const breakdownListEl = document.getElementById('calcBreakdownList');
  const sendQuoteBtn = document.getElementById('calcSendQuoteBtn');

  // Obsługa kafelków opcji (Visual Tiles)
  setupOptionTiles('complexityOptions', 'calcComplexity');
  setupOptionTiles('surfaceOptions', 'calcSurface');
  setupOptionTiles('scopeOptions', 'calcScope');
  setupOptionTiles('modeOptions', 'calcMode');

  // Drag & Drop i podgląd zdjęcia
  if (dropzone && photoInput) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        photoInput.files = e.dataTransfer.files;
        handlePhotoPreview(photoInput.files[0]);
      }
    });

    photoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handlePhotoPreview(e.target.files[0]);
      } else {
        resetPhotoPreview();
      }
    });
  }

  function handlePhotoPreview(file) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (previewImg && previewBox) {
        previewImg.src = ev.target.result;
        previewBox.style.display = 'block';
      }
      calculateEstimate();
    };
    reader.readAsDataURL(file);
  }

  function resetPhotoPreview() {
    if (previewImg && previewBox) {
      previewImg.src = '';
      previewBox.style.display = 'none';
    }
    calculateEstimate();
  }

  // Nasłuchiwanie zmian w formularzu
  [lengthInput, widthInput, heightInput].forEach(inp => {
    if (inp) {
      inp.addEventListener('input', calculateEstimate);
    }
  });

  function setupOptionTiles(containerId, hiddenInputId) {
    const container = document.getElementById(containerId);
    const hiddenInput = document.getElementById(hiddenInputId);
    if (!container || !hiddenInput) return;

    const tiles = container.querySelectorAll('.option-tile');
    tiles.forEach(tile => {
      tile.addEventListener('click', () => {
        tiles.forEach(t => t.classList.remove('selected'));
        tile.classList.add('selected');
        const val = tile.getAttribute('data-value');
        hiddenInput.value = val;
        calculateEstimate();
      });
    });
  }

  function getSizeSurcharge(maxDimension) {
    if (maxDimension <= 10) return 0;
    if (maxDimension <= 25) return 120;
    if (maxDimension <= 50) return 260;
    if (maxDimension <= 100) return 520;
    return 900;
  }

  function getVolumeSurcharge(volume) {
    if (volume <= 8000) return 0;
    if (volume <= 40000) return 80;
    if (volume <= 150000) return 180;
    return 350;
  }

  function calculateEstimate() {
    const l = parseFloat(lengthInput.value) || 0;
    const w = parseFloat(widthInput.value) || 0;
    const h = parseFloat(heightInput.value) || 0;

    const complexity = document.getElementById('calcComplexity')?.value || 'medium';
    const surface = document.getElementById('calcSurface')?.value || 'easy';
    const scope = document.getElementById('calcScope')?.value || 'mesh';
    const mode = document.getElementById('calcMode')?.value || 'standard';

    if (l <= 0 || w <= 0 || h <= 0) {
      if (priceValEl) priceValEl.textContent = '---';
      if (breakdownListEl) {
        breakdownListEl.innerHTML = '<li class="breakdown-item"><span>Wpisz wymiary detalu (Dł x Szer x Wys) powyżej, aby zobaczyć wycenę na żywo.</span></li>';
      }
      return;
    }

    const maxDim = Math.max(l, w, h);
    const volume = l * w * h;
    const hasPhoto = photoInput && photoInput.files && photoInput.files.length > 0;

    const setupCost = 350;
    const sizeSurcharge = getSizeSurcharge(maxDim);
    const volumeSurcharge = getVolumeSurcharge(volume);

    const complexityConfig = {
      low: { mult: 1, label: 'Prosty detal' },
      medium: { mult: 1.25, label: 'Średnio złożony' },
      high: { mult: 1.6, label: 'Złożony techniczny' }
    }[complexity] || { mult: 1.25, label: 'Średnio złożony' };

    const surfaceConfig = {
      easy: { surcharge: 0, label: 'Standardowa' },
      difficult: { surcharge: 180, label: 'Ciemna / Błyszcząca' },
      'very-difficult': { surcharge: 320, label: 'B. trudna / Maskowanie' }
    }[surface] || { surcharge: 0, label: 'Standardowa' };

    const scopeConfig = {
      scan: { surcharge: 0, min: 350, label: 'Sam skan 3D (surowa chmura/siatka)' },
      mesh: { surcharge: 220, min: 590, label: 'Skan + Oczyszczenie siatki (STL gotowy do druku)' },
      cad: { surcharge: 950, min: 1400, label: 'Skan + Model CAD / Reverse Engineering (STEP/IGES)' }
    }[scope] || { surcharge: 220, min: 590, label: 'Skan + Oczyszczenie siatki' };

    const modeConfig = {
      standard: { mult: 1, label: 'Standardowy (do 5-7 dni)' },
      fast: { mult: 1.25, label: 'Ekspresowy (priorytetowy)' }
    }[mode] || { mult: 1, label: 'Standardowy' };

    const photoDiscount = hasPhoto ? 30 : 0;

    const subtotal = setupCost + sizeSurcharge + volumeSurcharge + surfaceConfig.surcharge + scopeConfig.surcharge - photoDiscount;
    const rawTotal = subtotal * complexityConfig.mult * modeConfig.mult;
    const finalPrice = Math.max(scopeConfig.min, Math.round(rawTotal / 10) * 10);

    if (priceValEl) {
      priceValEl.textContent = finalPrice.toLocaleString('pl-PL');
    }

    if (breakdownListEl) {
      const items = [
        { label: 'Kalibracja i stanowisko pomiarowe', val: `${setupCost} zł` },
        { label: `Gabaryt max (${maxDim} cm)`, val: `+${sizeSurcharge} zł` },
        { label: `Objętość robocza (${Math.round(volume)} cm³)`, val: `+${volumeSurcharge} zł` },
        { label: `Powierzchnia (${surfaceConfig.label})`, val: surfaceConfig.surcharge ? `+${surfaceConfig.surcharge} zł` : '0 zł' },
        { label: `Zakres usługi (${scopeConfig.label})`, val: scopeConfig.surcharge ? `+${scopeConfig.surcharge} zł` : 'W cenie' },
        { label: `Złożoność (${complexityConfig.label})`, val: `x${complexityConfig.mult}` },
        { label: `Tryb (${modeConfig.label})`, val: `x${modeConfig.mult}` }
      ];

      if (hasPhoto) {
        items.push({ label: 'Rabat za dołączone zdjęcie detalu', val: `-${photoDiscount} zł`, accent: true });
      }

      breakdownListEl.innerHTML = items.map(item => `
        <li class="breakdown-item ${item.accent ? 'accent' : ''}">
          <span>${item.label}</span>
          <strong>${item.val}</strong>
        </li>
      `).join('');
    }

    // Podpięcie generowania e-maila zapytania
    if (sendQuoteBtn) {
      sendQuoteBtn.onclick = () => {
        const subject = encodeURIComponent(`Zapytanie o wycenę skanowania 3D [${l}x${w}x${h} cm] - Multicore`);
        const body = encodeURIComponent(
`Dzień dobry,

Chciałbym skonsultować i zlecić wycenę skanowania 3D dla detalu:

- Wymiary: ${l} x ${w} x ${h} cm
- Geometria: ${complexityConfig.label}
- Powierzchnia: ${surfaceConfig.label}
- Zakres prac: ${scopeConfig.label}
- Tryb realizacji: ${modeConfig.label}
- Orientacyjna cena z kalkulatora: ok. ${finalPrice} zł netto

Proszę o kontakt w sprawie potwierdzenia terminu i szczegółów wysyłki detalu.

Pozdrawiam,`
        );
        window.location.href = `mailto:maksym.leski@gmail.com?subject=${subject}&body=${body}`;
      };
    }
  }

  // Pierwsze przeliczenie
  calculateEstimate();
}

/* ==========================================================
   GALERIA REALIZACJI I PEŁNOEKRANOWY LIGHTBOX
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

  // Kolekcja zdjęć do nawigacji w lightboxie
  let currentImageGroup = [];
  let currentImageIndex = 0;

  // Rejestracja kliknięć w zdjęcia projektów
  document.querySelectorAll('[data-gallery-photos]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      try {
        const photosJson = trigger.getAttribute('data-gallery-photos');
        const photos = JSON.parse(photosJson);
        const title = trigger.getAttribute('data-gallery-title') || 'Projekt';
        if (photos && photos.length > 0) {
          currentImageGroup = photos.map(item => typeof item === 'string' ? { src: item, title } : item);
          currentImageIndex = 0;
          openLightbox();
        }
      } catch (err) {
        console.error('Błąd otwarcia galerii:', err);
      }
    });
  });

  function openLightbox() {
    updateLightboxView();
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

  function updateLightboxView() {
    if (!currentImageGroup || currentImageGroup.length === 0) return;
    const current = currentImageGroup[currentImageIndex];
    if (lightboxImg) {
      lightboxImg.src = current.src;
      lightboxImg.alt = current.title || 'Zdjęcie realizacji';
    }
    if (lightboxCaption) {
      lightboxCaption.textContent = current.title || '';
    }
    if (lightboxCounter) {
      lightboxCounter.textContent = `${currentImageIndex + 1} / ${currentImageGroup.length}`;
    }
  }

  function showNext() {
    if (currentImageGroup.length === 0) return;
    currentImageIndex = (currentImageIndex + 1) % currentImageGroup.length;
    updateLightboxView();
  }

  function showPrev() {
    if (currentImageGroup.length === 0) return;
    currentImageIndex = (currentImageIndex - 1 + currentImageGroup.length) % currentImageGroup.length;
    updateLightboxView();
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
   FORMULARZ SZYBKIEGO KONTAKTU
   ========================================================== */
function initContactForm() {
  const form = document.getElementById('quickContactForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('contactName')?.value || 'Klient';
    const email = document.getElementById('contactEmail')?.value || '';
    const phone = document.getElementById('contactPhone')?.value || '';
    const message = document.getElementById('contactMessage')?.value || '';

    const subject = encodeURIComponent(`Zapytanie od: ${name} (Multicore)`);
    const body = encodeURIComponent(
`Wiadomość z formularza na stronie Multicore:

Imię i nazwisko / Firma: ${name}
E-mail zwrotny: ${email}
Telefon: ${phone}

Treść wiadomości:
${message}`
    );

    window.location.href = `mailto:maksym.leski@gmail.com?subject=${subject}&body=${body}`;
  });
}
