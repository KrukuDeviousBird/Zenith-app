// ===== stan =====
let aktywnyTrening = null;   // trening, do którego zapisujesz wyniki
let aktywneCw = [];          // ćwiczenia w otwartym treningu: [{ nazwa, serie }]
let zapisane = {};           // zapisane serie otwartego treningu: { ćwiczenie: [wiersze z bazy] }
let statDane = {};           // { ćwiczenie: { data: najlepszy szacowany max } }
let wykres1 = null;
let wykres2 = null;

function trEsc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// przycisk usuwania z klasą btn-usun (opakowuje przyciskUsun)
function usunBtn(tabela, id, odswiez) {
  const b = przyciskUsun(tabela, id, odswiez);
  b.classList.add('btn-usun');
  return b;
}

// wywołaj po zalogowaniu (w app.js)
async function wczytajTrening() {
  await wczytajZgode();
  await wczytajPlany();
  await wczytajTreningi();
  pokazTr('trPlany');
}

function pokazTr(id) {
  ['trPlany', 'trSesja', 'trStaty', 'trOsiagi'].forEach(x => {
    document.getElementById(x).hidden = (x !== id);
  });
  if (id === 'trStaty') wczytajStaty();
  if (id === 'trOsiagi') wczytajOsiagi();
}

// ===== PLANY =====
async function wczytajPlany() {
  const { data, error } = await db.from('plany')
    .select('id, nazwa, plan_cwiczenia(id, nazwa, serie)')
    .order('nazwa');
  if (error) return alert('Błąd: ' + error.message);

  // lista planów w zakładce Trening (start treningu z planu)
  document.getElementById('sesjaPlan').innerHTML =
    data.map(p => `<option value="${p.id}">${trEsc(p.nazwa)}</option>`).join('');

  // lista planów z ćwiczeniami w zakładce Plany
  const box = document.getElementById('listaPlanow');
  box.innerHTML = '';
  if (data.length === 0) {
    box.textContent = 'Nie masz jeszcze żadnych planów.';
    return;
  }
  data.forEach(p => box.appendChild(zbudujPlan(p)));
}

function zbudujPlan(p) {
  const div = document.createElement('div');
  div.className = 'plan';
  div.id = `plan-${p.id}`;

  // nazwa planu (edytowalna)
  const naglowek = document.createElement('p');
  const nazwa = document.createElement('input');
  nazwa.type = 'text';
  nazwa.className = 'planNazwaInput';
  nazwa.value = p.nazwa;
  const zapisz = document.createElement('button');
  zapisz.textContent = 'Zapisz nazwę';
  zapisz.className = 'btn';
  zapisz.onclick = () => zapiszNazwePlanu(p.id, nazwa.value, zapisz);
  const usun = document.createElement('button');
  usun.textContent = 'Usuń plan';
  usun.className = 'btn-usun';
  usun.onclick = () => usunPlan(p.id);
  naglowek.append(nazwa, ' ', zapisz, ' ', usun);
  div.appendChild(naglowek);

  // ćwiczenia w planie
  const ul = document.createElement('ul');
  p.plan_cwiczenia.sort((a, b) => a.id - b.id).forEach(c => ul.appendChild(zbudujCwiczenie(c)));
  div.appendChild(ul);

  // dodawanie nowego ćwiczenia do tego planu
  const nowe = document.createElement('p');
  nowe.className = 'noweCw';
  nowe.innerHTML = `<input type="text" class="nNazwa" placeholder="Nowe ćwiczenie">
    <input type="number" class="nSerie" placeholder="Serie"> `;
  const dodaj = document.createElement('button');
  dodaj.textContent = 'Dodaj ćwiczenie';
  dodaj.className = 'btn';
  dodaj.onclick = () => dodajCwiczeniePlanu(p.id, nowe);
  nowe.appendChild(dodaj);
  div.appendChild(nowe);

  return div;
}

function zbudujCwiczenie(c) {
  const li = document.createElement('li');
  li.id = `cw-${c.id}`;
  li.innerHTML = `<input type="text" class="eNazwa" value="${trEsc(c.nazwa)}">
    <input type="number" class="eSerie" value="${c.serie}"> serie `;
  const zapisz = document.createElement('button');
  zapisz.textContent = 'Zapisz';
  zapisz.className = 'btn';
  zapisz.onclick = () => zapiszCwiczenie(c.id, li, zapisz);
  li.append(zapisz, ' ', usunBtn('plan_cwiczenia', c.id, wczytajPlany));
  return li;
}

function mignij(przycisk) {
  const stary = przycisk.textContent;
  przycisk.textContent = 'Zapisano ✓';
  setTimeout(() => przycisk.textContent = stary, 1200);
}

async function dodajPlan() {
  const nazwa = document.getElementById('planNazwa').value.trim();
  if (!nazwa) return alert('Podaj nazwę planu');
  const { error } = await db.from('plany').insert({ nazwa });
  if (error) return alert('Błąd: ' + error.message);
  document.getElementById('planNazwa').value = '';
  wczytajPlany();
}

async function zapiszNazwePlanu(id, nazwa, przycisk) {
  nazwa = nazwa.trim();
  if (!nazwa) return alert('Nazwa planu nie może być pusta');
  const { error } = await db.from('plany').update({ nazwa }).eq('id', id);
  if (error) return alert('Błąd: ' + error.message);
  mignij(przycisk);
}

async function usunPlan(id) {
  if (!confirm('Usunąć plan razem z jego ćwiczeniami?')) return;
  const { error } = await db.from('plany').delete().eq('id', id);
  if (error) return alert('Błąd: ' + error.message);
  wczytajPlany();
}

async function dodajCwiczeniePlanu(plan_id, wiersz) {
  const nazwa = wiersz.querySelector('.nNazwa').value.trim();
  const serie = parseInt(wiersz.querySelector('.nSerie').value);
  if (!nazwa || !serie) {
    return alert('Uzupełnij nazwę ćwiczenia i liczbę serii');
  }
  const { error } = await db.from('plan_cwiczenia').insert({ plan_id, nazwa, serie });
  if (error) return alert('Błąd: ' + error.message);
  wczytajPlany();
}

async function zapiszCwiczenie(id, li, przycisk) {
  const nazwa = li.querySelector('.eNazwa').value.trim();
  const serie = parseInt(li.querySelector('.eSerie').value);
  if (!nazwa || !serie) {
    return alert('Uzupełnij nazwę ćwiczenia i liczbę serii');
  }
  const { error } = await db.from('plan_cwiczenia')
    .update({ nazwa, serie }).eq('id', id);
  if (error) return alert('Błąd: ' + error.message);
  mignij(przycisk);
}

// ===== TRENING (sesja) =====
// data lokalna (RRRR-MM-DD), żeby "dzisiaj" zgadzało się z Twoją strefą czasową
function dzisiaj() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function ustawAktywny(tr) {
  aktywnyTrening = tr;
  document.getElementById('aktywnyNazwa').textContent = tr ? `${tr.nazwa} (${tr.data})` : 'brak';
  document.getElementById('zapiszWyniki').hidden = !tr;
}

// pyta o zgodę, jeśli w otwartym treningu są niezapisane zmiany
function potwierdzPrzelaczenie() {
  const niezapisane = document.querySelector('#formularzSerii .cwBlok[data-zmienione="1"]');
  return !niezapisane || confirm('Masz niezapisane zmiany w ćwiczeniach. Przełączyć trening mimo to?');
}

async function zacznijZPlanu() {
  const select = document.getElementById('sesjaPlan');
  const planId = select.value;
  if (!planId) return alert('Najpierw utwórz plan w zakładce Plany');
  if (!potwierdzPrzelaczenie()) return;

  // jeśli dziś już zacząłeś trening z tego planu, można do niego wrócić
  const { data: istn } = await db.from('treningi')
    .select('id, nazwa, data, plan_id')
    .eq('plan_id', planId).eq('data', dzisiaj())
    .order('id', { ascending: false }).limit(1);
  if (istn && istn.length > 0 &&
      confirm('Masz już dziś rozpoczęty trening z tego planu.\nOK = kontynuuj go, Anuluj = zacznij nowy.')) {
    return otworzTrening(istn[0]);
  }

  const { data: tr, error } = await db.from('treningi')
    .insert({ nazwa: select.selectedOptions[0].text, plan_id: planId, data: dzisiaj() })
    .select().single();
  if (error) return alert('Błąd: ' + error.message);
  await otworzTrening(tr);
}

async function dodajTrening() {
  const nazwa = document.getElementById('trNazwa').value.trim();
  if (!nazwa) return alert('Podaj nazwę treningu');
  if (!potwierdzPrzelaczenie()) return;
  const { data, error } = await db.from('treningi')
    .insert({ nazwa, data: dzisiaj() }).select().single();
  if (error) return alert('Błąd: ' + error.message);
  document.getElementById('trNazwa').value = '';
  await otworzTrening(data);
}

// wraca do wybranego treningu z historii, żeby go uzupełnić lub poprawić
async function edytujWybranyTrening() {
  const id = document.getElementById('trWybor').value;
  if (!id) return alert('Wybierz trening z listy');
  if (!potwierdzPrzelaczenie()) return;
  const { data, error } = await db.from('treningi')
    .select('id, nazwa, data, plan_id').eq('id', id).single();
  if (error) return alert('Błąd: ' + error.message);
  await otworzTrening(data);
  document.getElementById('formularzSerii').scrollIntoView({ behavior: 'smooth' });
}

// otwiera trening: ćwiczenia z planu + to, co już zapisano
async function otworzTrening(tr) {
  let zPlanu = [];
  if (tr.plan_id) {
    const { data, error } = await db.from('plan_cwiczenia')
      .select('nazwa, serie').eq('plan_id', tr.plan_id).order('id');
    if (error) return alert('Błąd: ' + error.message);
    zPlanu = data;
  }

  const { data: serie, error: e2 } = await db.from('serie')
    .select('*').eq('trening_id', tr.id).order('id');
  if (e2) return alert('Błąd: ' + e2.message);

  zapisane = {};
  serie.forEach(s => { (zapisane[s.cwiczenie] = zapisane[s.cwiczenie] || []).push(s); });
  Object.values(zapisane).forEach(lista =>
    lista.sort((x, y) => (x.nr_serii ?? x.id) - (y.nr_serii ?? y.id)));

  aktywneCw = zPlanu.map(c => ({ nazwa: c.nazwa, serie: c.serie }));
  Object.keys(zapisane).forEach(nazwa => {
    if (!aktywneCw.some(c => c.nazwa === nazwa)) {
      aktywneCw.push({ nazwa, serie: zapisane[nazwa].length });
    }
  });

  ustawAktywny(tr);
  zbudujFormularz();
  await wczytajTreningi(tr.id);
}

function zbudujFormularz() {
  const box = document.getElementById('formularzSerii');
  box.innerHTML = '';
  if (!aktywnyTrening) return;

  const gora = document.createElement('p');
  const zamknij = document.createElement('button');
  zamknij.id = 'zamknijTrening';
  zamknij.className = 'btn';
  zamknij.textContent = 'Zamknij trening';
  zamknij.onclick = zamknijTrening;
  gora.append(zamknij);
  box.append(gora);

  const bloki = document.createElement('div');
  bloki.id = 'blokiCw';
  if (aktywneCw.length === 0) {
    const info = document.createElement('p');
    info.id = 'pustyTrening';
    info.textContent = 'Ten trening nie ma jeszcze ćwiczeń. Dodaj pierwsze poniżej.';
    bloki.append(info);
  }
  aktywneCw.forEach(c => bloki.append(zbudujBlok(c)));
  box.append(bloki);

  // dodawanie ćwiczenia spoza planu
  const dod = document.createElement('p');
  dod.id = 'dodajCwWiersz';
  dod.innerHTML = `<input type="text" id="dodCwNazwa" placeholder="Nowe ćwiczenie">
    <input type="number" id="dodCwSerie" min="1" placeholder="Serie (domyślnie 3)"> `;
  const dodaj = document.createElement('button');
  dodaj.id = 'dodajCwDoTreningu';
  dodaj.className = 'btn';
  dodaj.textContent = 'Dodaj ćwiczenie do treningu';
  dodaj.onclick = dodajCwiczenieDoTreningu;
  dod.append(dodaj);
  box.append(dod);
}

// jeden blok = jedno ćwiczenie ze swoimi seriami i własnym przyciskiem zapisu
function zbudujBlok(c) {
  const zap = zapisane[c.nazwa] || [];
  const blok = document.createElement('div');
  blok.className = 'cwBlok';
  blok.dataset.cw = c.nazwa;

  const h = document.createElement('h4');
  h.textContent = c.nazwa + ' ';
  const status = document.createElement('span');
  status.className = 'cwStatus';
  status.textContent = zap.length ? '✓ zapisane' : '';
  h.append(status);
  blok.append(h);

  const wiersze = document.createElement('div');
  wiersze.className = 'cwWiersze';
  const ile = Math.max(c.serie || 1, zap.length, 1);
  for (let i = 0; i < ile; i++) wiersze.append(zbudujWiersz(i + 1, zap[i]));
  blok.append(wiersze);

  const przyciski = document.createElement('p');
  const zapisz = document.createElement('button');
  zapisz.className = 'btn';
  zapisz.textContent = 'Zapisz ćwiczenie';
  zapisz.onclick = () => zapiszCwiczenie(blok, zapisz);
  const plus = document.createElement('button');
  plus.className = 'btn';
  plus.textContent = 'Dodaj serię';
  plus.onclick = () => {
    wiersze.append(zbudujWiersz(wiersze.children.length + 1));
    blok.dataset.zmienione = '1';
    status.textContent = 'niezapisane zmiany';
  };
  przyciski.append(zapisz, ' ', plus);
  blok.append(przyciski);

  blok.addEventListener('input', () => {
    blok.dataset.zmienione = '1';
    status.textContent = 'niezapisane zmiany';
  });
  return blok;
}

// kolejność: ciężar, potem powtórzenia
function zbudujWiersz(nr, s) {
  const p = document.createElement('p');
  p.className = 'wiersz';
  p.innerHTML = `Seria ${nr}:
    <input type="number" class="wKg" step="0.5" min="0" placeholder="Kg" value="${s ? s.kg : ''}"> kg ×
    <input type="number" class="wPow" min="1" placeholder="Powt." value="${s ? s.powtorzenia : ''}"> powt.`;
  return p;
}

function dodajCwiczenieDoTreningu() {
  if (!aktywnyTrening) return alert('Najpierw zacznij trening');
  const nazwa = document.getElementById('dodCwNazwa').value.trim();
  const serie = parseInt(document.getElementById('dodCwSerie').value) || 3;
  if (!nazwa) return alert('Podaj nazwę ćwiczenia');
  if (aktywneCw.some(c => c.nazwa.toLowerCase() === nazwa.toLowerCase())) {
    return alert('To ćwiczenie jest już w treningu');
  }
  const c = { nazwa, serie };
  aktywneCw.push(c);
  const pusty = document.getElementById('pustyTrening');
  if (pusty) pusty.remove();
  document.getElementById('blokiCw').append(zbudujBlok(c));
  document.getElementById('dodCwNazwa').value = '';
  document.getElementById('dodCwSerie').value = '';
}

// zapisuje jedno ćwiczenie: nowe serie zastępują poprzednio zapisane dla tego ćwiczenia
async function zapiszBlok(blok, cicho) {
  const cw = blok.dataset.cw;
  const rekordy = [];
  blok.querySelectorAll('.wiersz').forEach(w => {
    const kg = parseFloat(w.querySelector('.wKg').value);
    const powtorzenia = parseInt(w.querySelector('.wPow').value);
    if (kg >= 0 && powtorzenia > 0) {   // puste lub błędne wiersze są pomijane
      rekordy.push({ trening_id: aktywnyTrening.id, cwiczenie: cw, nr_serii: rekordy.length + 1, kg, powtorzenia });
    }
  });
  const stare = (zapisane[cw] || []).map(s => s.id);

  if (rekordy.length === 0) {
    if (cicho) return false;
    if (stare.length === 0) { alert('Uzupełnij przynajmniej jedną serię (kg i powtórzenia)'); return false; }
    if (!confirm('Wszystkie serie są puste. Usunąć zapisane wyniki tego ćwiczenia?')) return false;
  }

  let nowe = [];
  if (rekordy.length > 0) {
    const { data, error } = await db.from('serie').insert(rekordy).select();
    if (error) { alert('Błąd: ' + error.message); return false; }
    nowe = data;
  }
  if (stare.length > 0) {
    const { error } = await db.from('serie').delete().in('id', stare);
    if (error) { alert('Błąd przy zastępowaniu starych wyników: ' + error.message); return false; }
  }

  zapisane[cw] = nowe.sort((x, y) => x.nr_serii - y.nr_serii);
  blok.dataset.zmienione = '';
  blok.querySelector('.cwStatus').textContent = nowe.length ? '✓ zapisane' : '';
  await aktualizujOsiagi(aktywnyTrening.id, cw, rekordy);
  return true;
}

async function zapiszCwiczenie(blok, przycisk) {
  if (!aktywnyTrening) return;
  przycisk.disabled = true;
  const ok = await zapiszBlok(blok, false);
  przycisk.disabled = false;
  if (ok) mignij(przycisk);
}

// zapisuje wszystkie ćwiczenia, w których coś zmieniono
async function zapiszWyniki() {
  if (!aktywnyTrening) return alert('Najpierw zacznij trening');
  const bloki = [...document.querySelectorAll('#formularzSerii .cwBlok')]
    .filter(b => b.dataset.zmienione === '1');
  let zapisano = 0;
  for (const b of bloki) {
    if (await zapiszBlok(b, true)) zapisano++;
  }
  alert(zapisano > 0 ? 'Zapisano ćwiczeń: ' + zapisano : 'Brak zmian do zapisania');
}

function zamknijTrening() {
  const niezapisane = document.querySelector('#formularzSerii .cwBlok[data-zmienione="1"]');
  if (niezapisane && !confirm('Masz niezapisane zmiany w ćwiczeniach. Zamknąć trening mimo to?')) return;
  ustawAktywny(null);
  aktywneCw = [];
  zapisane = {};
  document.getElementById('formularzSerii').innerHTML = '';
  wczytajSerie();
}

// ===== historia treningów =====
async function wczytajTreningi(wybierzId) {
  const { data, error } = await db.from('treningi').select('id, nazwa, data')
    .order('data', { ascending: false }).order('id', { ascending: false });
  if (error) return alert('Błąd: ' + error.message);
  const sel = document.getElementById('trWybor');
  sel.innerHTML = data.map(t => `<option value="${t.id}">${t.data} – ${trEsc(t.nazwa)}</option>`).join('');
  if (wybierzId) sel.value = wybierzId;
  wczytajSerie();
}

async function usunTrening() {
  const id = document.getElementById('trWybor').value;
  if (!id) return;
  if (!confirm('Usunąć ten trening razem ze wszystkimi seriami?')) return;
  const { error } = await db.from('treningi').delete().eq('id', id);
  if (error) return alert('Błąd: ' + error.message);
  await db.from('osiagi').delete().eq('trening_id', id);   // osiągi z tego treningu też znikają
  if (aktywnyTrening && String(aktywnyTrening.id) === String(id)) {
    ustawAktywny(null);
    aktywneCw = [];
    zapisane = {};
    document.getElementById('formularzSerii').innerHTML = '';
  }
  wczytajTreningi();
}

async function usunCwiczenieZTreningu(trening_id, cwiczenie) {
  if (!confirm('Usunąć ćwiczenie „' + cwiczenie + '” z tego treningu?')) return;
  const { error } = await db.from('serie').delete().eq('trening_id', trening_id).eq('cwiczenie', cwiczenie);
  if (error) return alert('Błąd: ' + error.message);
  await db.from('osiagi').delete().eq('trening_id', trening_id).eq('cwiczenie', cwiczenie);
  wczytajSerie();
}

// wyniki wybranego treningu: każde ćwiczenie jeden raz, a pod nim wszystkie serie w jednej linii
async function wczytajSerie() {
  const id = document.getElementById('trWybor').value;
  const ul = document.getElementById('listaSerii');
  ul.innerHTML = '';
  if (!id) return;

  const komunikat = tekst => {
    const li = document.createElement('li');
    li.textContent = tekst;
    ul.appendChild(li);
  };

  if (aktywnyTrening && String(aktywnyTrening.id) === String(id)) {
    komunikat('Ten trening jest otwarty wyżej, tam widzisz i poprawiasz wyniki.');
    return;
  }

  const { data, error } = await db.from('serie').select('*').eq('trening_id', id).order('id');
  if (error) return alert('Błąd: ' + error.message);
  if (data.length === 0) { komunikat('Ten trening nie ma jeszcze zapisanych wyników.'); return; }

  const grupy = {};
  data.forEach(s => { (grupy[s.cwiczenie] = grupy[s.cwiczenie] || []).push(s); });

  Object.keys(grupy).forEach(nazwa => {
    const serie = grupy[nazwa].sort((x, y) => (x.nr_serii ?? x.id) - (y.nr_serii ?? y.id));
    const li = document.createElement('li');
    li.className = 'cwWynik';

    const b = document.createElement('b');
    b.textContent = nazwa + ' ';
    const usun = document.createElement('button');
    usun.className = 'btn-usun';
    usun.textContent = 'Usuń ćwiczenie';
    usun.onclick = () => usunCwiczenieZTreningu(id, nazwa);

    const opis = document.createElement('div');
    opis.className = 'cwSerie';
    opis.textContent = serie.map(s => `${s.kg} kg × ${s.powtorzenia}`).join('  ·  ');

    li.append(b, usun, opis);
    ul.appendChild(li);
  });
}

// ===== STATYSTYKI =====
// wzór Epleya: szacowany maksymalny ciężar na 1 powtórzenie
function e1rm(kg, powt) {
  return kg * (1 + powt / 30);
}

async function wczytajStaty() {
  const { data, error } = await db.from('serie')
    .select('cwiczenie, powtorzenia, kg, treningi(data)')
    .gt('kg', 0)
    .order('id');
  if (error) return alert('Błąd: ' + error.message);

  // dla każdego ćwiczenia i dnia zostaje najlepsza seria
  statDane = {};
  data.forEach(s => {
    const dzien = s.treningi.data;
    const e = e1rm(s.kg, s.powtorzenia);
    statDane[s.cwiczenie] = statDane[s.cwiczenie] || {};
    statDane[s.cwiczenie][dzien] = Math.max(statDane[s.cwiczenie][dzien] || 0, e);
  });

  const sel = document.getElementById('statCw');
  const poprzednie = sel.value;
  sel.innerHTML = Object.keys(statDane).sort()
    .map(c => `<option value="${trEsc(c)}">${trEsc(c)}</option>`).join('');
  if (poprzednie && statDane[poprzednie]) sel.value = poprzednie;

  rysujStaty();
  rysujWszystkie();
}

function rysujStaty() {
  const cw = document.getElementById('statCw').value;
  const info = document.getElementById('statPodsumowanie');
  if (wykres1) wykres1.destroy();
  if (!cw || !statDane[cw]) {
    info.textContent = 'Brak danych. Zapisz kilka treningów z ciężarem.';
    return;
  }

  const dni = Object.keys(statDane[cw]).sort();
  const wart = dni.map(d => Math.round(statDane[cw][d] * 10) / 10);
  const pierwszy = wart[0];
  const ostatni = wart[wart.length - 1];

  if (wart.length < 2) {
    info.textContent = 'Potrzeba minimum 2 treningów tego ćwiczenia, żeby policzyć progres.';
  } else {
    const proc = ((ostatni - pierwszy) / pierwszy * 100).toFixed(1);
    info.textContent = `Start: ${pierwszy} kg → teraz: ${ostatni} kg (${proc >= 0 ? '+' : ''}${proc}%). Rekord: ${Math.max(...wart)} kg.`;
  }

  wykres1 = new Chart(document.getElementById('wykresCw'), {
    type: 'line',
    data: {
      labels: dni,
      datasets: [{
        label: 'Szacowany max na 1 powtórzenie (kg)',
        data: wart,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            afterLabel: ctx => {
              const p = ((ctx.raw - pierwszy) / pierwszy * 100).toFixed(1);
              return `Zmiana od startu: ${p >= 0 ? '+' : ''}${p}%`;
            }
          }
        }
      }
    }
  });
}

function rysujWszystkie() {
  const nazwy = [];
  const proc = [];
  Object.keys(statDane).sort().forEach(cw => {
    const dni = Object.keys(statDane[cw]).sort();
    if (dni.length < 2) return;
    const start = statDane[cw][dni[0]];
    const teraz = statDane[cw][dni[dni.length - 1]];
    nazwy.push(cw);
    proc.push(Math.round((teraz - start) / start * 1000) / 10);
  });

  if (wykres2) wykres2.destroy();
  wykres2 = new Chart(document.getElementById('wykresWszystkie'), {
    type: 'bar',
    data: {
      labels: nazwy,
      datasets: [{
        label: 'Progres od pierwszego treningu (%)',
        data: proc,
        backgroundColor: proc.map(x => x >= 0 ? 'rgba(46,160,67,0.7)' : 'rgba(220,53,69,0.7)')
      }]
    },
    options: { indexAxis: 'y' }
  });
}

// ===== NOWE OSIĄGI =====
let zgodaOsiagi = false;   // czy użytkownik zgodził się na pokazywanie swoich osiągów
let zgodaNazwa = '';       // nazwa, pod jaką pokazują się jego osiągi

function zaokr(x) { return Math.round(x * 10) / 10; }

// buduje panel zakładki "Nowe osiągi" (przycisk wejścia jest w menu bocznym, w index.html)
function zbudujOsiagiUI() {
  const trening = document.getElementById('trening');
  if (!trening || document.getElementById('trOsiagi')) return;

  const div = document.createElement('div');
  div.id = 'trOsiagi';
  div.hidden = true;
  div.innerHTML = `
    <h3>Nowe osiągi</h3>
    <p id="osiagiInfo">Tu widać nowe rekordy siłowe użytkowników (wzrost szacowanego maksimum na 1 powtórzenie).
      Jeśli się zgodzisz, inni zobaczą Twoją nazwę użytkownika, nazwę ćwiczenia, szacowany max i procent progresu.
      Nie pokazujemy nic poza tym: ani pozostałych treningów, ani haseł, notatek czy zadań.
      Zgodę możesz w każdej chwili cofnąć, a Twoje opublikowane osiągi znikną.</p>
    <p>Twój status: <b id="osiagiStatus">sprawdzam…</b></p>
    <p>
      <button id="osiagiZgoda" class="btn" onclick="ustawZgode(true)">Zgadzam się na wyświetlanie moich osiągów</button>
      <button id="osiagiRezygnacja" class="btn" onclick="ustawZgode(false)">Rezygnuję z wyświetlania moich osiągów</button>
    </p>
    <h4>Ostatnie osiągi użytkowników</h4>
    <ul id="listaOsiagow"></ul>`;
  trening.appendChild(div);
}

async function idUzytkownika() {
  const { data: { user } } = await db.auth.getUser();
  return user ? user.id : null;
}

async function wczytajZgode() {
  try {
    const id = await idUzytkownika();
    if (!id) return;
    const { data, error } = await db.from('osiagi_zgoda').select('zgoda, nazwa').eq('user_id', id).maybeSingle();
    if (error) { console.warn('osiagi_zgoda:', error.message); return; }
    zgodaOsiagi = !!(data && data.zgoda);
    zgodaNazwa = data ? data.nazwa : '';
  } catch (e) { console.warn('osiagi_zgoda:', e); }
}

function odswiezStatusZgody() {
  document.getElementById('osiagiStatus').textContent = zgodaOsiagi
    ? 'zgoda udzielona, Twoje nowe osiągi są widoczne dla innych'
    : 'brak zgody, Twoje osiągi są ukryte';
  document.getElementById('osiagiZgoda').disabled = zgodaOsiagi;
  document.getElementById('osiagiRezygnacja').disabled = !zgodaOsiagi;
}

async function ustawZgode(zgoda) {
  const id = await idUzytkownika();
  if (!id) return alert('Nie jesteś zalogowany.');

  if (zgoda) {
    const nazwa = (document.getElementById('kto').textContent || '').trim();
    if (!nazwa) return alert('Nie udało się ustalić Twojej nazwy użytkownika.');
    if (!confirm('Inni użytkownicy zobaczą Twoją nazwę (' + nazwa + '), ćwiczenie, szacowany max i procent progresu. Zgadzasz się?')) return;
    const { error } = await db.from('osiagi_zgoda').upsert({ user_id: id, nazwa, zgoda: true });
    if (error) return alert('Błąd: ' + error.message);
    zgodaOsiagi = true;
    zgodaNazwa = nazwa;
  } else {
    if (!confirm('Cofnąć zgodę? Twoje dotychczas opublikowane osiągi zostaną usunięte.')) return;
    const { error } = await db.from('osiagi_zgoda').upsert({ user_id: id, nazwa: zgodaNazwa || '-', zgoda: false });
    if (error) return alert('Błąd: ' + error.message);
    const { error: e2 } = await db.from('osiagi').delete().eq('user_id', id);
    if (e2) return alert('Błąd: ' + e2.message);
    zgodaOsiagi = false;
  }
  odswiezStatusZgody();
  wczytajOsiagi();
}

async function wczytajOsiagi() {
  await wczytajZgode();
  odswiezStatusZgody();

  const ul = document.getElementById('listaOsiagow');
  ul.innerHTML = '';
  const { data, error } = await db.from('osiagi').select('*')
    .order('created_at', { ascending: false }).limit(30);
  if (error) { ul.textContent = 'Błąd: ' + error.message; return; }
  if (data.length === 0) { ul.textContent = 'Na razie brak osiągów do pokazania.'; return; }

  data.forEach(o => {
    const li = document.createElement('li');
    li.className = 'osiag';
    li.textContent = `${o.nazwa} – ${o.cwiczenie}: +${o.procent}% (szacowany max ${o.poprzedni} → ${o.nowy} kg) · ${new Date(o.created_at).toLocaleDateString('pl-PL')}`;
    ul.appendChild(li);
  });
}

// po zapisaniu ćwiczenia: jeśli jest zgoda, odświeża osiąg tego ćwiczenia w tym treningu
async function aktualizujOsiagi(trening_id, cwiczenie, rekordy) {
  if (!zgodaOsiagi || !zgodaNazwa) return;
  try {
    // dotychczasowy osiąg z tego treningu zastępujemy nowym (albo znika, jeśli progresu już nie ma)
    await db.from('osiagi').delete().eq('trening_id', trening_id).eq('cwiczenie', cwiczenie);

    let najlepszy = 0;
    rekordy.forEach(r => {
      if (r.kg > 0) najlepszy = Math.max(najlepszy, e1rm(r.kg, r.powtorzenia));
    });
    if (najlepszy === 0) return;

    // dotychczasowy rekord z innych treningów
    const { data, error } = await db.from('serie')
      .select('powtorzenia, kg')
      .eq('cwiczenie', cwiczenie)
      .neq('trening_id', trening_id)
      .gt('kg', 0);
    if (error) throw error;

    let poprzedni = 0;
    data.forEach(s => { poprzedni = Math.max(poprzedni, e1rm(s.kg, s.powtorzenia)); });
    if (poprzedni === 0 || najlepszy <= poprzedni) return;   // brak historii albo brak progresu

    const { error: e2 } = await db.from('osiagi').insert({
      nazwa: zgodaNazwa,
      trening_id,
      cwiczenie,
      poprzedni: zaokr(poprzedni),
      nowy: zaokr(najlepszy),
      procent: zaokr((najlepszy - poprzedni) / poprzedni * 100)
    });
    if (e2) throw e2;
  } catch (e) {
    console.warn('Nie udało się zaktualizować osiągów:', e);   // zapis ćwiczenia i tak się udał
  }
}

zbudujOsiagiUI();

// ===== dopasowanie układu z index.html (sam HTML zostaje bez zmian) =====
(function () {
  // przycisk powrotu do treningu obok listy historii
  const wybor = document.getElementById('trWybor');
  if (wybor && !document.getElementById('edytujTrening')) {
    const b = document.createElement('button');
    b.id = 'edytujTrening';
    b.className = 'btn';
    b.textContent = 'Kontynuuj / edytuj trening';
    b.onclick = edytujWybranyTrening;
    wybor.after(' ', b);
  }
  // stary wiersz ręcznego dodawania serii jest zbędny: ćwiczenia poprawia się w otwartym treningu
  const serCw = document.getElementById('serCw');
  if (serCw && serCw.closest('p')) serCw.closest('p').hidden = true;
  // nowe nazwy
  const zapisz = document.getElementById('zapiszWyniki');
  if (zapisz) zapisz.textContent = 'Zapisz wszystkie ćwiczenia';
  document.querySelectorAll('#trSesja h3').forEach(h => {
    if (h.textContent.trim() === 'Historia i wolne serie') h.textContent = 'Historia treningów';
  });
})();

// przycisk "Usuń trening" jest w index.html, klasa dodawana tutaj
document.querySelectorAll('button[onclick="usunTrening()"]').forEach(b => b.classList.add('btn-usun'));

// pozostałe przyciski z index.html w sekcji Trening dostają klasę btn
document.querySelectorAll('#trening button:not(.btn-usun)').forEach(b => b.classList.add('btn'));

// ===== automatyczne wczytanie po zalogowaniu =====
// działa niezależnie od app.js: gdy #aplikacja zostaje odkryta (po zalogowaniu),
// plany i treningi ładują się same
(function () {
  const app = document.getElementById('aplikacja');
  if (!app) return;
  let wczytano = false;
  function sprobuj() {
    if (!wczytano && !app.hidden && app.style.display !== 'none') {
      wczytano = true;
      wczytajTrening();
    }
  }
  new MutationObserver(sprobuj).observe(app, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
  sprobuj(); // na wypadek, gdyby aplikacja była już widoczna
})();