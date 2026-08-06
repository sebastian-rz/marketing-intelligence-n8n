/**
 * STEP 3 — scalanie konfiguracji skanu rynku
 *
 * Zamknięcie pętli. Model językowy zwraca propozycję zmian w liście
 * zapytań i hashtagów (apify_zmiany). Ten kod je normalizuje, scala
 * z aktualną konfiguracją i zapisuje z powrotem do bazy.
 *
 * Efekt: w kolejny poniedziałek skan rynku (STEP 4) rusza już według
 * nowej listy. Nikt nie zmienia jej ręcznie.
 *
 * Wejście:  apify_configs (aktualna konfiguracja), wynik STRATEG 2
 * Wyjście:  ładunek do PATCH apify_configs
 */

const s2 = $('Kod: Parsuj S2').first().json;
const zm = (s2.result && s2.result.apify_zmiany) || {};

const norm = s => String(s || '').toLowerCase().replace(/^#/, '').trim();

// Transliteracja polskich znaków — używana WYŁĄCZNIE do porównywania.
// Bez tego "#automatyzacja" i "#automatyzacją" tworzyły duplikaty.
// W zapisywanej wartości zostaje oryginalna pisownia.
const PL = { 'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z' };
const strip = s => norm(s).split('').map(ch => PL[ch] || ch).join('').replace(/[^a-z0-9]/g, '');

const dodaj     = [...(zm.hashtagi_dodac || []), ...(zm.zapytania || [])].map(norm).filter(Boolean);
const usun      = new Set((zm.hashtagi_usunac || []).map(norm));
const usunStrip = new Set((zm.hashtagi_usunac || []).map(strip));

const out = [];

for (const item of $input.all()) {
  const c = item.json;
  const inp = (typeof c.input_json === 'string')
    ? JSON.parse(c.input_json || '{}')
    : Object.assign({}, c.input_json || {});

  let zmienione = false;

  // Aktorzy Apify mają dwa formaty wejścia — tablica searchQueries
  // albo pojedynczy string search rozdzielony przecinkami.
  if (Array.isArray(inp.searchQueries)) {
    const stare = inp.searchQueries.map(String);
    let nowe = stare.filter(x => !usun.has(norm(x)));
    for (const d of dodaj) if (!nowe.some(x => norm(x) === d)) nowe.push(d);
    nowe = nowe.slice(0, 8);

    // BEZPIECZNIK: model nie może jednym błędnym wynikiem
    // wyłączyć całego skanu rynku.
    if (nowe.length < 2) nowe = stare;

    zmienione = JSON.stringify(nowe) !== JSON.stringify(stare);
    inp.searchQueries = nowe;

  } else if (typeof inp.search === 'string') {
    const stare = inp.search.split(',').map(s => s.trim()).filter(Boolean);
    let nowe = stare.filter(x => !usun.has(norm(x)) && !usunStrip.has(strip(x)));
    for (const d of dodaj) {
      const t = strip(d);
      if (t && !nowe.some(x => strip(x) === t)) nowe.push(t);
    }
    nowe = nowe.slice(0, 6);

    if (nowe.length < 2) nowe = stare;   // ten sam bezpiecznik

    zmienione = nowe.join(', ') !== stare.join(', ');
    inp.search = nowe.join(', ');
  }

  out.push({
    json: {
      id: c.id,
      actor_name: c.actor_name,
      zmienione,
      body: { input_json: inp, last_updated: new Date().toISOString() }
    }
  });
}

return out;
