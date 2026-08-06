/**
 * STEP 2 — flaga budżetu kampanii reklamowych
 *
 * Decyzja o pieniądzach liczona deterministycznie, nie przez model językowy.
 * Ten sam zestaw danych wejściowych zawsze da tę samą flagę — wynik jest
 * odtwarzalny i da się go wytłumaczyć klientowi.
 *
 * Wejście:  ad_insights (wyniki kampanii), stats_ruch (własny pixel)
 * Wyjście:  lista kampanii z flagą ZWIEKSZ / trzymaj / WYLACZ
 */

const dzisD = new Date().toISOString().slice(0, 10);

// Klucz rozmyty — Facebook, Instagram i własny pixel nazywają tę samą kampanię
// inaczej: "Post: „X”" vs "Post na Instagramie: X" vs surowa nazwa.
// Sprowadzamy wszystko do wspólnego mianownika, żeby dało się je połączyć.
const key = s => String(s || '').toLowerCase()
  .replace(/^post na instagramie:\s*/, '')
  .replace(/^post:\s*/, '')
  .replace(/[„”"'']/g, '')
  .replace(/[^a-ząćęłńóśźż0-9]/g, '')
  .slice(0, 30);

// Kampanie zakończone przed dzisiaj psuły średnie — odfiltrowane.
// Brak daty zakończenia albo data w przyszłości = kampania aktywna, zostaje.
const ads = $('Ad_insignis').all().map(i => i.json)
  .filter(a => !a.campaign_stop || String(a.campaign_stop).slice(0, 10) >= dzisD);

// Współczynnik odrzuceń z własnego pixela, po kluczu rozmytym.
// Wejście krótsze niż 3 sekundy traktujemy jako odrzucenie.
const ruch = $('stats_ruch').all().map(i => i.json);
const bounceByKey = {};
for (const r of ruch) {
  const k = key(r.kampania);
  if (!k) continue;
  bounceByKey[k] = bounceByKey[k] || { n: 0, b: 0 };
  bounceByKey[k].n++;
  if ((r.czas_s ?? 0) < 3) bounceByKey[k].b++;
}

// Agregacja per kampania + platforma. Sumujemy dni;
// jako wynik bierzemy pierwsze niezerowe pole z listy priorytetów.
const agg = {};
for (const a of ads) {
  const id = (a.campaign_name || '-') + ' | ' + (a.platform || '-');
  agg[id] = agg[id] || { kampania: a.campaign_name, platforma: a.platform, spend: 0, wynik: 0 };
  agg[id].spend += Number(a.spend) || 0;
  agg[id].wynik += Number(a.link_clicks || a.clicks || a.post_engagement || a.reactions || 0) || 0;
}

// Progi skalibrowane ręcznie z obserwacji — do przeliczenia
// na podstawie rozkładu historycznego, gdy uzbiera się próba.
const flags = Object.values(agg).map(c => {
  const koszt  = c.wynik ? Math.round(c.spend / c.wynik * 100) / 100 : null;
  const bc     = bounceByKey[key(c.kampania)];
  const bounce = bc ? Math.round(100 * bc.b / bc.n) : null;

  let flaga = 'trzymaj';
  if (koszt === null)                                flaga = 'brak_wynikow';
  else if (bounce !== null && bounce > 50)           flaga = 'WYLACZ — tani klik, ludzie uciekaja';
  else if (koszt > 0.30)                             flaga = 'WYLACZ / obniz';
  else if (koszt < 0.10 && (bounce ?? 100) < 40)     flaga = 'ZWIEKSZ / przedluz';

  return {
    kampania: c.kampania,
    platforma: c.platforma,
    spend: Math.round(c.spend * 100) / 100,
    wynik: c.wynik,
    koszt_za_wynik: koszt,
    bounce_pct: bounce,
    flaga
  };
});

return [{
  json: {
    insight_type: 'budget_flag',
    result: flags,
    based_on_sources: ['ad_insights', 'stats_ruch']
  }
}];
