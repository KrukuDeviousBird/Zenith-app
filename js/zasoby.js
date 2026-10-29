// Zakładka "Database resources": segmentowe paski z zużyciem zasobów bazy.
// Sama buduje swoją sekcję i pozycję w menu bocznym (na samym dole), więc w HTML wystarczy podpiąć ten plik i zasoby.css.
// Plik musi być podpięty PRZED menu.js (menu.js podpina kliknięcia pod pozycje, które już istnieją).
(function () {
  // ===== ustawienia =====
  const ODSWIEZANIE_MS = 30000;        // jak często odświeżać, gdy zakładka jest otwarta
  const LIMIT_BAZY_MB = 500;           // limit rozmiaru bazy w Twoim planie (Free: zwykle 500 MB, sprawdź w Supabase)
  const SEGMENTY = 40;                 // z ilu kresek składa się pasek
  const PROG_OSTRZEZENIE = 60;         // od tylu % pasek jest pomarańczowy
  const PROG_KRYTYCZNY = 85;           // od tylu % pasek jest czerwony
  const FUNKCJA_EDGE = 'db-resources'; // opcjonalna funkcja Supabase dla CPU i RAM (patrz db-resources.ts)

  const aplikacja = document.getElementById('aplikacja') || document.body;

  // ===== sekcja =====
  const sekcja = document.createElement('div');
  sekcja.id = 'zasoby';
  sekcja.hidden = true;
  sekcja.innerHTML = `
    <h2>Database resources</h2>
    <div id="zasobyLista"></div>
    <p>
      <button id="zasobyOdswiez" class="btn">Odśwież</button>
      <span id="zasobyInfo"></span>
    </p>`;
  aplikacja.appendChild(sekcja);

  // ===== pozycja w menu (na samym dole) =====
  const menuLista = document.getElementById('menuLista');
  if (menuLista) {
    const li = document.createElement('li');
    li.innerHTML = '<button class="btn menu-pozycja" data-sekcja="zasoby">Database resources</button>';
    menuLista.appendChild(li);
  }

  // ===== wiersze =====
  const WIERSZE = [
    { klucz: 'cpu', nazwa: 'CPU', brak: 'niedostępne: wymaga funkcji db-resources i planu z Metrics API' },
    { klucz: 'ram', nazwa: 'RAM', brak: 'niedostępne: wymaga funkcji db-resources i planu z Metrics API' },
    { klucz: 'dysk', nazwa: 'Dysk (rozmiar bazy)', brak: 'brak danych' },
    { klucz: 'polaczenia', nazwa: 'Połączenia z bazą', brak: 'brak danych' }
  ];

  const poziom = p => (p >= PROG_KRYTYCZNY ? 'krytyczny' : p >= PROG_OSTRZEZENIE ? 'ostrzezenie' : 'ok');
  const proc = p => (p > 0 && p < 10 ? p.toFixed(1) : Math.round(p)) + '%';
  const ogranicz = p => Math.max(0, Math.min(100, p));

  function zbudujWiersz(def, dane) {
    const w = document.createElement('div');
    w.className = 'zasob';
    w.dataset.zasob = def.klucz;

    const gora = document.createElement('div');
    gora.className = 'zasob-gora';
    const nazwa = document.createElement('span');
    nazwa.className = 'zasob-nazwa';
    nazwa.textContent = def.nazwa;
    const wartosc = document.createElement('span');
    wartosc.className = 'zasob-proc';
    gora.append(nazwa, wartosc);

    const pasek = document.createElement('div');
    pasek.className = 'zasob-pasek';
    const opis = document.createElement('div');
    opis.className = 'zasob-opis';

    let pct = null;
    if (dane && typeof dane.pct === 'number' && isFinite(dane.pct)) pct = ogranicz(dane.pct);

    if (pct === null) {
      w.dataset.poziom = 'brak';
      wartosc.textContent = 'n/d';
      opis.textContent = def.brak;
    } else {
      w.dataset.poziom = poziom(pct);
      wartosc.textContent = proc(pct);
      opis.textContent = dane.opis || '';
    }

    const zapalone = pct === null ? 0 : (pct > 0 ? Math.max(1, Math.round(pct / 100 * SEGMENTY)) : 0);
    for (let i = 0; i < SEGMENTY; i++) {
      const s = document.createElement('span');
      s.className = 'zasob-seg' + (i < zapalone ? ' on' : '');
      pasek.append(s);
    }

    w.append(gora, pasek, opis);
    return w;
  }

  function rysuj(wynik) {
    const lista = document.getElementById('zasobyLista');
    lista.innerHTML = '';
    WIERSZE.forEach(def => lista.append(zbudujWiersz(def, wynik[def.klucz])));
    const info = document.getElementById('zasobyInfo');
    info.textContent = wynik.blad
      ? 'Błąd: ' + wynik.blad
      : 'Ostatnia aktualizacja: ' + new Date().toLocaleTimeString('pl-PL');
  }

  // ===== dane =====
  let edgeDziala = true;   // po pierwszym błędzie nie pytamy już funkcji, dopóki nie klikniesz Odśwież
  let timer = null;
  let trwaPobieranie = false;

  async function pobierz() {
    const wynik = { cpu: null, ram: null, dysk: null, polaczenia: null, blad: null };

    // dysk i połączenia: funkcja SQL database_resources (działa na każdym planie)
    const { data, error } = await db.rpc('database_resources');
    if (error) {
      wynik.blad = error.message + ' (czy uruchomiłeś zasoby.sql w Supabase?)';
    } else if (data) {
      const mb = Number(data.db_size_bytes) / 1048576;
      wynik.dysk = { pct: mb / LIMIT_BAZY_MB * 100, opis: mb.toFixed(1) + ' MB z ' + LIMIT_BAZY_MB + ' MB' };
      wynik.polaczenia = {
        pct: Number(data.connections) / Number(data.max_connections) * 100,
        opis: data.connections + ' z ' + data.max_connections + ' połączeń'
      };
    }

    // CPU i RAM: tylko jeśli wdrożyłeś funkcję Supabase z db-resources.ts
    if (edgeDziala) {
      try {
        const { data: d, error: e } = await db.functions.invoke(FUNKCJA_EDGE);
        if (e || !d || d.cpu_pct == null || d.ram_pct == null) throw e || new Error('brak danych');
        wynik.cpu = { pct: Number(d.cpu_pct), opis: '' };
        wynik.ram = { pct: Number(d.ram_pct), opis: '' };
      } catch (e) {
        edgeDziala = false;
      }
    }
    return wynik;
  }

  async function odswiez() {
    if (aplikacja.hidden) { zatrzymaj(); return; }   // po wylogowaniu nie pytamy bazy
    if (trwaPobieranie) return;
    trwaPobieranie = true;
    try {
      rysuj(await pobierz());
    } catch (e) {
      rysuj({ blad: e.message });
    } finally {
      trwaPobieranie = false;
    }
  }

  function uruchom() {
    odswiez();
    zatrzymaj();
    timer = setInterval(odswiez, ODSWIEZANIE_MS);
  }
  function zatrzymaj() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  // odświeżanie działa tylko wtedy, gdy zakładka jest widoczna
  new MutationObserver(() => (sekcja.hidden ? zatrzymaj() : uruchom()))
    .observe(sekcja, { attributes: true, attributeFilter: ['hidden'] });

  document.getElementById('zasobyOdswiez').addEventListener('click', () => {
    edgeDziala = true;
    odswiez();
  });
})();
