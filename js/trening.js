// ===== stan =====
let aktywnyTrening = null;   // trening, do którego zapisujesz wyniki
let planCw = [];             // ćwiczenia planu w aktywnym treningu
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
function ustawAktywny(tr) {
  aktywnyTrening = tr;
  document.getElementById('aktywnyNazwa').textContent = tr ? tr.nazwa : 'brak';
}

async function zacznijZPlanu() {
  const select = document.getElementById('sesjaPlan');
  const planId = select.value;
  if (!planId) return alert('Najpierw utwórz plan w zakładce Plany');

  const { data: tr, error } = await db.from('treningi')
    .insert({ nazwa: select.selectedOptions[0].text, plan_id: planId })
    .select().single();
  if (error) return alert('Błąd: ' + error.message);

  const { data: cw, error: e2 } = await db.from('plan_cwiczenia')
    .select('*').eq('plan_id', planId).order('id');
  if (e2) return alert('Błąd: ' + e2.message);

  planCw = cw;
  ustawAktywny(tr);
  zbudujFormularz();
  await wczytajTreningi(tr.id);
}

function zbudujFormularz() {
  const box = document.getElementById('formularzSerii');
  box.innerHTML = '';
  planCw.forEach(c => {
    const h = document.createElement('h4');
    h.textContent = `${c.nazwa} (serie: ${c.serie})`;
    box.appendChild(h);
    for (let s = 1; s <= c.serie; s++) {
      const p = document.createElement('p');
      p.className = 'wiersz';
      p.dataset.cw = c.nazwa;
      p.dataset.nr = s;
      p.innerHTML = `Seria ${s}:
        <input type="number" class="wPow" placeholder="Powt.">
        <input type="number" class="wKg" step="0.5" placeholder="Kg">`;
      box.appendChild(p);
    }
  });
  document.getElementById('zapiszWyniki').hidden = planCw.length === 0;
}

async function zapiszWyniki() {
  if (!aktywnyTrening) return alert('Najpierw zacznij trening');
  const rekordy = [];
  document.querySelectorAll('#formularzSerii .wiersz').forEach(w => {
    const powtorzenia = parseInt(w.querySelector('.wPow').value);
    const kg = parseFloat(w.querySelector('.wKg').value);
    if (powtorzenia > 0 && kg >= 0) {   // puste lub błędne wiersze są pomijane
      rekordy.push({
        trening_id: aktywnyTrening.id,
        cwiczenie: w.dataset.cw,
        nr_serii: parseInt(w.dataset.nr),
        powtorzenia,
        kg
      });
    }
  });
  if (rekordy.length === 0) return alert('Uzupełnij przynajmniej jedną serię');

  const { error } = await db.from('serie').insert(rekordy);
  if (error) return alert('Błąd: ' + error.message);

  await opublikujOsiagi(rekordy);

  document.getElementById('trWybor').value = aktywnyTrening.id;
  document.getElementById('formularzSerii').innerHTML = '';
  document.getElementById('zapiszWyniki').hidden = true;
  planCw = [];
  ustawAktywny(null);
  wczytajSerie();
  alert('Wyniki zapisane');
}

// ===== wolny trening i serie ręczne =====
async function dodajTrening() {
  const nazwa = document.getElementById('trNazwa').value.trim();
  if (!nazwa) return alert('Podaj nazwę treningu');
  const { data, error } = await db.from('treningi').insert({ nazwa }).select().single();
  if (error) return alert('Błąd: ' + error.message);
  document.getElementById('trNazwa').value = '';
  planCw = [];
  document.getElementById('formularzSerii').innerHTML = '';
  document.getElementById('zapiszWyniki').hidden = true;
  ustawAktywny(data);
  await wczytajTreningi(data.id);
}

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
  if (aktywnyTrening && String(aktywnyTrening.id) === String(id)) {
    ustawAktywny(null);
    document.getElementById('formularzSerii').innerHTML = '';
    document.getElementById('zapiszWyniki').hidden = true;
  }
  wczytajTreningi();
}

async function dodajSerie() {
  const trening_id = document.getElementById('trWybor').value;
  const cwiczenie = document.getElementById('serCw').value.trim();
  const powtorzenia = parseInt(document.getElementById('serPow').value);
  const kg = parseFloat(document.getElementById('serKg').value);
  if (!trening_id || !cwiczenie || !powtorzenia || isNaN(kg)) {
    return alert('Wybierz trening i uzupełnij ćwiczenie, powtórzenia i kg');
  }
  const { error } = await db.from('serie').insert({ trening_id, cwiczenie, powtorzenia, kg });
  if (error) return alert('Błąd: ' + error.message);
  document.getElementById('serPow').value = '';
  wczytajSerie();
}

async function wczytajSerie() {
  const id = document.getElementById('trWybor').value;
  const ul = document.getElementById('listaSerii');
  ul.innerHTML = '';
  if (!id) return;
  const { data, error } = await db.from('serie').select('*').eq('trening_id', id).order('id');
  if (error) return alert('Błąd: ' + error.message);
  data.forEach(s => {
    const li = document.createElement('li');
    li.textContent = `${s.cwiczenie}${s.nr_serii ? ' – seria ' + s.nr_serii : ''}: ${s.powtorzenia} × ${s.kg} kg `;
    li.appendChild(usunBtn('serie', s.id, wczytajSerie));
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

// buduje zakładkę "Nowe osiągi" (przycisk w menu + panel), index.html zostaje bez zmian
function zbudujOsiagiUI() {
  const menu = document.getElementById('trMenu');
  const trening = document.getElementById('trening');
  if (!menu || !trening || document.getElementById('trOsiagi')) return;

  const przycisk = document.createElement('button');
  przycisk.className = 'btn';
  przycisk.id = 'trOsiagiBtn';
  przycisk.textContent = 'Nowe osiągi';
  przycisk.onclick = () => pokazTr('trOsiagi');
  menu.append(' ', przycisk);

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

// po zapisaniu wyników: jeśli jest zgoda i padł nowy rekord, publikujemy osiąg
async function opublikujOsiagi(rekordy) {
  if (!zgodaOsiagi || !zgodaNazwa) return;
  try {
    // najlepszy wynik z tego treningu dla każdego ćwiczenia
    const teraz = {};
    rekordy.forEach(r => {
      if (!(r.kg > 0)) return;
      const e = e1rm(r.kg, r.powtorzenia);
      if (!teraz[r.cwiczenie] || e > teraz[r.cwiczenie]) teraz[r.cwiczenie] = e;
    });
    const nazwy = Object.keys(teraz);
    if (nazwy.length === 0) return;

    // dotychczasowe rekordy z poprzednich treningów
    const { data, error } = await db.from('serie')
      .select('cwiczenie, powtorzenia, kg')
      .in('cwiczenie', nazwy)
      .neq('trening_id', rekordy[0].trening_id)
      .gt('kg', 0);
    if (error) throw error;

    const poprzednio = {};
    data.forEach(s => {
      const e = e1rm(s.kg, s.powtorzenia);
      if (!poprzednio[s.cwiczenie] || e > poprzednio[s.cwiczenie]) poprzednio[s.cwiczenie] = e;
    });

    const wpisy = [];
    nazwy.forEach(cw => {
      const prev = poprzednio[cw];
      if (!prev || teraz[cw] <= prev) return;   // brak historii albo brak progresu
      wpisy.push({
        nazwa: zgodaNazwa,
        cwiczenie: cw,
        poprzedni: zaokr(prev),
        nowy: zaokr(teraz[cw]),
        procent: zaokr((teraz[cw] - prev) / prev * 100)
      });
    });
    if (wpisy.length > 0) {
      const { error: e2 } = await db.from('osiagi').insert(wpisy);
      if (e2) throw e2;
    }
  } catch (e) {
    console.warn('Nie udało się opublikować osiągów:', e);   // zapis treningu i tak się udał
  }
}

zbudujOsiagiUI();

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