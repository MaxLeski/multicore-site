const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
let errors = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
    console.error(`❌ FAIL: ${message}`);
  } else {
    passed++;
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('=== MULTICORE TEST SUITE ===\n');

// 1. Sprawdzenie kluczowych plików
const requiredFiles = [
  'index.html',
  'skanowanie-3d.html',
  'druk-3d.html',
  'embedded.html',
  'automatyzacja.html',
  'realizacje.html',
  'kalkulator.html',
  'kontakt.html',
  'odtwarzanie-czesci.html',
  'skanowanie-czesci-maszyn.html',
  'rekonstrukcja-czesci-zabytkowych.html',
  'kontrola-jakosci-3d.html',
  'firmware-bms-powertrain.html',
  'dziekujemy.html',
  'polityka-prywatnosci.html',
  '404.html',
  'styles.css',
  'script.js',
  'site-config.js',
  'robots.txt',
  'sitemap.xml',
  '_redirects',
  '.htaccess',
  'MARKETING-TODO.md'
];

requiredFiles.forEach(file => {
  assert(fs.existsSync(path.join(ROOT_DIR, file)), `Plik istnieje: ${file}`);
});

// 2. Walidacja HTML i SEO dla każdego pliku HTML
const htmlFiles = fs.readdirSync(ROOT_DIR).filter(f => f.endsWith('.html'));

htmlFiles.forEach(file => {
  const content = fs.readFileSync(path.join(ROOT_DIR, file), 'utf8');
  
  // Dokładnie 1 h1
  const h1Matches = content.match(/<h1[^>]*>/gi) || [];
  assert(h1Matches.length === 1, `${file} zawiera dokładnie jeden nagłówek <h1> (znaleziono: ${h1Matches.length})`);

  // Title
  assert(/<title[^>]*>.+<\/title>/i.test(content), `${file} zawiera unikalny <title>`);

  // Meta description (oprócz 404/dziekujemy jeśli celowo pominięte)
  if (file !== '404.html' && file !== 'dziekujemy.html') {
    assert(/<meta\s+name=["']description["']/i.test(content), `${file} zawiera <meta name="description">`);
    assert(/<link\s+rel=["']canonical["']/i.test(content), `${file} zawiera <link rel="canonical">`);
  }

  // noindex dla dziekujemy.html
  if (file === 'dziekujemy.html' || file === '404.html') {
    assert(/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(content), `${file} ma poprawny robots noindex`);
  }

  // JSON-LD walidacja parsowania
  const jsonLdMatches = content.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      JSON.parse(match[1]);
      assert(true, `${file} zawiera poprawny składniowo JSON-LD`);
    } catch (e) {
      assert(false, `${file} zawiera BŁĘDNY JSON-LD: ${e.message}`);
    }
  }

  // Sprawdzenie linków wewnętrznych href
  const hrefMatches = content.matchAll(/href=["']([^"']+)["']/gi);
  for (const m of hrefMatches) {
    const href = m[1];
    if (href.startsWith('http') || href.startsWith('tel:') || href.startsWith('mailto:') || href.startsWith('#') || href.startsWith('data:')) {
      continue;
    }
    const cleanHref = href.split('#')[0].split('?')[0];
    if (cleanHref) {
      const targetPath = path.join(ROOT_DIR, cleanHref);
      assert(fs.existsSync(targetPath), `${file}: cel odnośnika istnieje: ${cleanHref}`);
    }
  }

  // Sprawdzenie obrazów src
  const srcMatches = content.matchAll(/src=["']([^"']+)["']/gi);
  for (const m of srcMatches) {
    const src = m[1];
    if (src.startsWith('http') || src.startsWith('data:') || src === '') continue;
    const targetPath = path.join(ROOT_DIR, decodeURIComponent(src));
    assert(fs.existsSync(targetPath), `${file}: plik obrazu/skryptu istnieje: ${src}`);
  }

  // Sprawdzenie galerii JSON
  const galleryMatches = content.matchAll(/data-gallery-photos='([^']+)'/gi);
  for (const m of galleryMatches) {
    try {
      const photos = JSON.parse(m[1]);
      photos.forEach(photo => {
        const photoPath = typeof photo === 'string' ? photo : photo.src;
        assert(fs.existsSync(path.join(ROOT_DIR, decodeURIComponent(photoPath))), `${file}: zdjęcie w galerii istnieje: ${photoPath}`);
      });
    } catch (e) {
      assert(false, `${file}: błąd parsowania data-gallery-photos`);
    }
  }
});

// 3. Sprawdzenie sitemap.xml
const sitemapContent = fs.readFileSync(path.join(ROOT_DIR, 'sitemap.xml'), 'utf8');
assert(sitemapContent.includes('https://multicore.net.pl/'), 'sitemap.xml zawiera URL główny');
assert(sitemapContent.includes('skanowanie-3d.html'), 'sitemap.xml zawiera skanowanie-3d.html');
assert(!sitemapContent.includes('dziekujemy.html'), 'sitemap.xml NIE zawiera noindex dziekujemy.html');
assert(!sitemapContent.includes('404.html'), 'sitemap.xml NIE zawiera noindex 404.html');

// 4. Sprawdzenie robots.txt
const robotsContent = fs.readFileSync(path.join(ROOT_DIR, 'robots.txt'), 'utf8');
assert(robotsContent.includes('Sitemap: https://multicore.net.pl/sitemap.xml'), 'robots.txt wskazuje sitemap');
assert(robotsContent.includes('Disallow: /dziekujemy.html'), 'robots.txt blokuje dziekujemy.html');

// 5. Test logiki kalkulatora
const siteConfigCode = fs.readFileSync(path.join(ROOT_DIR, 'site-config.js'), 'utf8');
eval(`var window = {}; ${siteConfigCode}`);
assert(window.MULTICORE_CONFIG && window.MULTICORE_CONFIG.pricing, 'site-config.js poprawnie definiuje MULTICORE_CONFIG.pricing');
assert(window.MULTICORE_CONFIG.company.phone === '+48 533 491 374', 'Poprawny numer telefonu w konfiguracji');
assert(window.MULTICORE_CONFIG.company.email === 'kontakt@multicore.net.pl', 'Poprawny email w konfiguracji');


// 6. Testy konwersji i lejków CRO
const indexHtml = fs.readFileSync(path.join(ROOT_DIR, "index.html"), "utf8");
assert(indexHtml.includes("Masz uszkodzoną lub niedostępną część? Odtworzymy ją."), "index.html zawiera prawidłowy nagłówek CRO Hero");
assert(indexHtml.includes("Z czym możemy Ci pomóc?"), "index.html zawiera sekcję wyboru intencji klienta");
assert(indexHtml.includes("data-intent=\"odtwarzanie\""), "index.html zawiera kafelek intencji odtwarzania części");
assert(indexHtml.includes("data-intent=\"skanowanie\""), "index.html zawiera kafelek intencji skanowania");
assert(indexHtml.includes("data-intent=\"cad\""), "index.html zawiera kafelek intencji CAD");
assert(indexHtml.includes("data-intent=\"druk\""), "index.html zawiera kafelek intencji druku 3D");
assert(indexHtml.includes("Wyceń swój detal"), "index.html zawiera Primary CTA Wyceń swój detal");
assert(indexHtml.includes("sticky-bottom-bar"), "index.html zawiera sticky mobile CTA");

const scriptContent = fs.readFileSync(path.join(ROOT_DIR, "script.js"), "utf8");
assert(scriptContent.includes("intent_card_clicked"), "script.js śledzi kliknięcia intencji");
assert(scriptContent.includes("calculator_completed"), "script.js śledzi zakończenie kalkulacji");
assert(scriptContent.includes("calculator_lead_submitted"), "script.js śledzi wysłanie leada z kalkulatora");
assert(scriptContent.includes("file_uploaded"), "script.js śledzi upload plików");
assert(scriptContent.includes("mc_traffic_meta"), "script.js obsługuje zachowanie parametrów UTM");

const kalkulatorHtml = fs.readFileSync(path.join(ROOT_DIR, "kalkulator.html"), "utf8");
assert(kalkulatorHtml.includes("Wyślij kalkulację i zdjęcia do bezpłatnej weryfikacji"), "kalkulator.html zawiera poprawiony CTA");
assert(kalkulatorHtml.includes("id=\"formularz\""), "kalkulator.html zawiera osadzony formularz wyceny");

console.log(`\n========================================`);
console.log(`PODSUMOWANIE TESTÓW: ${passed} PASSED, ${errors.length} FAILED`);
console.log(`========================================`);

if (errors.length > 0) {
  process.exit(1);
} else {
  console.log('🎉 Wszystkie testy przeszły pomyślnie!');
}
