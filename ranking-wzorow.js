/**
 * STEP 3 — ranking wzorów produktowych
 *
 * Ocena, który wzór realnie przykuwa uwagę na stronie produktu.
 * Liczona nie z wyświetleń, tylko z zachowania: ile ktoś przescrollował,
 * czy powiększył zdjęcie, czy odpalił wideo, czy zmieniał wariant,
 * ile czasu spędził na opisie. Dane z własnego pixela.
 *
 * Wagi dobrane tak, żeby premiować sygnały wymagające intencji
 * (zoom, zmiana wariantu) nad biernym scrollem.
 *
 * Wejście:  stats_produkty (własny pixel)
 * Wyjście:  ranking wzorów posortowany po sile sygnału
 */

const wzory = $('stats_produkty').all().map(i => i.json);

const score = w =>
    (Number(w.sredni_scroll_pct)     || 0) * 0.3   // bierny sygnał, niska waga
  + (Number(w.powiekszali_zdjecie)   || 0) * 25    // intencja — ktoś chciał zobaczyć detal
  + (Number(w.odpalili_wideo)        || 0) * 15
  + (Number(w.zmieniali_wariant)     || 0) * 15    // intencja zakupowa
  + (Number(w.sredni_czas_opisu_s)   || 0) * 2;

const ranking = wzory
  .map(w => ({
    wzor:     w.produkt,
    obejrzen: w.obejrzen,
    osob:     w.unikalnych_osob,
    scroll:   w.sredni_scroll_pct,
    zoom:     w.powiekszali_zdjecie,
    wideo:    w.odpalili_wideo,
    wariant:  w.zmieniali_wariant,
    opis_s:   w.sredni_czas_opisu_s,
    sila:     Math.round(score(w))
  }))
  .sort((a, b) => b.sila - a.sila);

return [{
  json: {
    ranking,
    // Adnotacja trafia do promptu razem z danymi — żeby model
    // nie potraktował wyniku z próby 3 osób jako rozstrzygnięcia.
    uwaga: 'progi do kalibracji; mala proba (osob<5) = sygnal kierunkowy, nie wyrok'
  }
}];
