/**
 * MULTICORE Maksym Leski - Central Site Configuration
 * Single Source of Truth for business data, pricing rules, form endpoints, and tracking.
 */

window.MULTICORE_CONFIG = {
  // Dane firmy i kontaktowe
  company: {
    name: 'MULTICORE Maksym Leski',
    shortName: 'MULTICORE',
    owner: 'Maksym Leski',
    tagline: 'Skanowanie 3D • Inżynieria Odwrotna • Druk 3D Techniczny',
    phone: '+48 533 491 374',
    phoneRaw: '+48533491374',
    email: 'kontakt@multicore.net.pl',
    address: {
      model: 'door-to-door', // Obsługa wysyłkowa na terenie całej Polski
      description: 'Obsługa klientów z całej Polski w modelu wysyłkowym door-to-door (darmowy kurier w obie strony w cenie usługi)',
      city: 'Polska',
      country: 'PL'
    },
    nip: '', // Uzupełniane przez właściciela w konfiguracji
    hours: 'Poniedziałek – Piątek: 08:00 – 18:00',
    ndaOffered: true,
    doorToDoorIncluded: true,
    leadResponseTime: 'zwykle w ciągu kilku godzin'
  },

  // Cennik bazowy kalkulatora (Single Source of Truth)
  pricing: {
    currency: 'zł netto',
    setupBaseCost: 350, // Podstawowy koszt kalibracji i przygotowania stanowiska pomiarowego
    photoDiscount: 30,  // Rabat za dołączenie zdjęcia do analizy
    
    // Progi dopłat gabarytowych (maksymalny wymiar w cm)
    sizeSurcharges: [
      { maxDim: 10, cost: 0 },
      { maxDim: 25, cost: 120 },
      { maxDim: 50, cost: 260 },
      { maxDim: 100, cost: 520 },
      { maxDim: Infinity, cost: 900 }
    ],

    // Progi dopłat objętościowych (cm3)
    volumeSurcharges: [
      { maxVol: 8000, cost: 0 },
      { maxVol: 40000, cost: 80 },
      { maxVol: 150000, cost: 180 },
      { maxVol: Infinity, cost: 350 }
    ],

    // Mnożniki złożoności geometrii
    complexity: {
      low: { mult: 1.0, label: 'Prosty detal (płaskie ścianki, proste bryły)' },
      medium: { mult: 1.25, label: 'Średnio złożony (żebra, zaokrąglenia, uchwyty)' },
      high: { mult: 1.6, label: 'Złożony techniczny (cienkie ścianki, gwinty, kształty organiczne)' }
    },

    // Trudność optyczna powierzchni
    surface: {
      easy: { surcharge: 0, label: 'Standardowa (matowa, jasna, tworzywo/metal)' },
      difficult: { surcharge: 180, label: 'Problematyczna (ciemna, błyszcząca, chrom)' },
      'very-difficult': { surcharge: 320, label: 'Bardzo trudna (przezroczysta, głębokie wąskie szczeliny)' }
    },

    // Zakres opracowania danych
    scope: {
      scan: { surcharge: 0, min: 350, label: 'Sam skan 3D (surowa chmura punktów / siatka OBJ/PLY)' },
      mesh: { surcharge: 220, min: 590, label: 'Skan + Oczyszczona siatka STL (gotowa do druku 3D)' },
      cad: { surcharge: 950, min: 1400, label: 'Skan + Model parametryczny CAD STEP (inżynieria odwrotna pod CNC / formy)' }
    },

    // Tryb realizacji
    mode: {
      standard: { mult: 1.0, label: 'Standardowy (5–7 dni roboczych)' },
      fast: { mult: 1.25, label: 'Ekspresowy (priorytetowe stanowisko)' }
    }
  },

  // Konfiguracja formularza
  form: {
    endpointUrl: '', // np. endpoint Formspree / Web3Forms / własny serverless webhook
    apiKey: '',
    maxFileSizeMb: 25,
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'step', 'stp', 'stl', 'iges', 'igs', 'zip', 'rar', '7z'],
    rateLimitMax: 5,
    rateLimitWindowMinutes: 10
  },

  // Konfiguracja analityki
  analytics: {
    enabled: true,
    debug: false,
    trackPii: false
  }
};
