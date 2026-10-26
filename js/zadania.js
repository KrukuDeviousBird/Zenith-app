let otwarteId = null;       // id aktualnie otwartego zadania
let otwarteZadanie = null;  // jego dane

// ====================== LISTA ZADAŃ ======================

async function wczytajZadania() {
  // RLS zwraca Twoje zadania i te, do których Cię dodano
  const { data: zadania, error } = await db.from('tasks').select('*')
    .order('created_at', { ascending: false });
  if (error) { alert('Błąd: ' + error.message); return; }

  // liczba podzadań i ukończonych (dla każdego zadania)
  const { data: podzadania } = await db.from('subtasks').select('task_id, done');
  const licznik = {};
  (podzadania || []).forEach((p) => {
    if (!licznik[p.task_id]) licznik[p.task_id] = { razem: 0, zrobione: 0 };
    licznik[p.task_id].razem++;
    if (p.done) licznik[p.task_id].zrobione++;
  });

  const nazwy = await nazwyUzytkownikow(zadania.map((z) => z.user_id));

  const lista = el('listaZadan');
  lista.innerHTML = '';
  if (zadania.length === 0) {
    const pusty = document.createElement('li');
    pusty.textContent = 'Brak zadań.';
    lista.append(pusty);
    return;
  }

  zadania.forEach((z) => {
    const li = document.createElement('li');

    const tytul = document.createElement(z.done ? 's' : 'b'); // <s> = przekreślenie, bez CSS
    tytul.textContent = z.title;

    let info = '';
    if (z.due_date) info += ' | termin: ' + z.due_date;
    const l = licznik[z.id];
    if (l) info += ' | podzadania: ' + l.zrobione + '/' + l.razem;
    if (z.user_id !== mojeId) info += ' | od: ' + (nazwy[z.user_id] || 'nieznany');
    const opis = document.createElement('span');
    opis.textContent = info + ' ';

    const otworz = document.createElement('button');
    otworz.textContent = 'Otwórz';
    otworz.onclick = () => otworzZadanie(z.id);

    li.append(tytul, opis, otworz);
    lista.append(li);
  });
}

async function dodajZadanie() {
  const tytul = el('zadanieTytul').value.trim();
  if (!tytul) return;

  const { error } = await db.from('tasks').insert({
    title: tytul,
    description: el('zadanieOpis').value,
    due_date: el('zadanieTermin').value || null
  });
  if (error) { alert('Błąd: ' + error.message); return; }

  el('zadanieTytul').value = '';
  el('zadanieOpis').value = '';
  el('zadanieTermin').value = '';
  wczytajZadania();
}

// ====================== SZCZEGÓŁY ZADANIA ======================

async function otworzZadanie(id) {
  otwarteId = id;
  el('zadaniaLista').hidden = true;
  el('zadanieSzczegoly').hidden = false;
  await odswiezSzczegoly();
}

function zamknijZadanie() {
  otwarteId = null;
  otwarteZadanie = null;
  el('zadanieSzczegoly').hidden = true;
  el('zadaniaLista').hidden = false;
  wczytajZadania();
}

async function odswiezSzczegoly() {
  const { data, error } = await db.from('tasks').select('*').eq('id', otwarteId).single();
  if (error) {
    alert('Nie udało się wczytać zadania (może zostało usunięte albo straciłeś do niego dostęp).');
    zamknijZadanie();
    return;
  }
  otwarteZadanie = data;
  const wlasciciel = data.user_id === mojeId;
  const nazwy = await nazwyUzytkownikow([data.user_id]);

  el('szTytul').textContent = data.title;
  el('szInfo').textContent =
    'Właściciel: ' + (nazwy[data.user_id] || 'nieznany') +
    ' | Termin: ' + (data.due_date || 'brak') +
    ' | Status: ' + (data.done ? 'zrobione' : 'w toku');
  tekstZLiniami(el('szOpis'), data.description || '(brak opisu)');

  // edycja i dodawanie osób tylko dla właściciela
  el('szEdycja').hidden = !wlasciciel;
  el('szDodajCzlonka').hidden = !wlasciciel;
  if (wlasciciel) {
    el('edTytul').value = data.title;
    el('edOpis').value = data.description || '';
    el('edTermin').value = data.due_date || '';
    el('edGotowe').checked = data.done;
  }

  await Promise.all([wczytajCzlonkow(), wczytajPodzadania(), wczytajKomentarze()]);
}

async function zapiszZadanie() {
  const tytul = el('edTytul').value.trim();
  if (!tytul) { alert('Tytuł nie może być pusty.'); return; }

  const { error } = await db.from('tasks').update({
    title: tytul,
    description: el('edOpis').value,
    due_date: el('edTermin').value || null,
    done: el('edGotowe').checked
  }).eq('id', otwarteId);
  if (error) { alert('Błąd: ' + error.message); return; }

  odswiezSzczegoly();
}

async function usunZadanie() {
  if (!confirm('Usunąć zadanie razem z podzadaniami, komentarzami i listą osób?')) return;
  const { error } = await db.from('tasks').delete().eq('id', otwarteId);
  if (error) { alert('Błąd: ' + error.message); return; }
  zamknijZadanie();
}

// ====================== UŻYTKOWNICY W ZADANIU ======================

async function wczytajCzlonkow() {
  const { data, error } = await db.from('task_members').select('*').eq('task_id', otwarteId);
  if (error) { alert('Błąd: ' + error.message); return; }

  const jestemWlascicielem = otwarteZadanie.user_id === mojeId;
  const nazwy = await nazwyUzytkownikow([otwarteZadanie.user_id, ...data.map((m) => m.user_id)]);

  const lista = el('szCzlonkowie');
  lista.innerHTML = '';

  const wl = document.createElement('li');
  wl.textContent = (nazwy[otwarteZadanie.user_id] || 'nieznany') + ' (właściciel)';
  lista.append(wl);

  data.forEach((m) => {
    const li = document.createElement('li');
    li.append((nazwy[m.user_id] || 'nieznany') + ' ');

    const toJa = m.user_id === mojeId;
    if (jestemWlascicielem || toJa) {
      const b = document.createElement('button');
      b.textContent = toJa && !jestemWlascicielem ? 'Opuść zadanie' : 'Usuń z zadania';
      b.onclick = async () => {
        const { error: e } = await db.from('task_members').delete()
          .eq('task_id', otwarteId).eq('user_id', m.user_id);
        if (e) { alert('Błąd: ' + e.message); return; }
        if (toJa && !jestemWlascicielem) zamknijZadanie(); else wczytajCzlonkow();
      };
      li.append(b);
    }
    lista.append(li);
  });
}

async function dodajCzlonka() {
  const nazwa = el('czlonekNazwa').value.trim();
  if (!nazwa) return;

  const { data: profil, error: e1 } = await db.from('profiles')
    .select('user_id, username').eq('username_lower', nazwa.toLowerCase()).maybeSingle();
  if (e1) { alert('Błąd: ' + e1.message); return; }
  if (!profil) { alert('Nie znaleziono użytkownika o takiej nazwie.'); return; }
  if (profil.user_id === mojeId) { alert('Jesteś już właścicielem tego zadania.'); return; }

  const { error } = await db.from('task_members').insert({ task_id: otwarteId, user_id: profil.user_id });
  if (error) {
    alert(error.code === '23505' ? 'Ten użytkownik już ma dostęp do zadania.' : 'Błąd: ' + error.message);
    return;
  }
  el('czlonekNazwa').value = '';
  wczytajCzlonkow();
}

// ====================== PODZADANIA ======================

async function wczytajPodzadania() {
  const { data, error } = await db.from('subtasks').select('*')
    .eq('task_id', otwarteId).order('created_at');
  if (error) { alert('Błąd: ' + error.message); return; }

  const zrobione = data.filter((s) => s.done).length;
  el('szPostep').textContent = data.length
    ? 'Ukończono ' + zrobione + ' z ' + data.length
    : 'Brak podzadań.';

  const lista = el('szPodzadania');
  lista.innerHTML = '';
  data.forEach((s) => {
    const li = document.createElement('li');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = s.done;
    cb.onchange = async () => {
      const { error: e } = await db.from('subtasks').update({ done: cb.checked }).eq('id', s.id);
      if (e) alert('Błąd: ' + e.message);
      wczytajPodzadania();
    };

    // <details> = rozwijany opis, działa bez CSS i bez JS
    const szczegoly = document.createElement('details');
    const naglowek = document.createElement('summary');
    const tytul = document.createElement(s.done ? 's' : 'span');
    tytul.textContent = s.title;
    naglowek.append(tytul);

    const opis = document.createElement('div');
    tekstZLiniami(opis, s.description || '(brak opisu)');

    const edytuj = document.createElement('button');
    edytuj.textContent = 'Edytuj';
    edytuj.onclick = async () => {
      const nowyTytul = prompt('Tytuł podzadania:', s.title);
      if (nowyTytul === null) return;
      const nowyOpis = prompt('Opis podzadania:', s.description || '');
      if (nowyOpis === null) return;
      if (!nowyTytul.trim()) { alert('Tytuł nie może być pusty.'); return; }
      const { error: e } = await db.from('subtasks')
        .update({ title: nowyTytul.trim(), description: nowyOpis }).eq('id', s.id);
      if (e) alert('Błąd: ' + e.message);
      wczytajPodzadania();
    };

    szczegoly.append(naglowek, opis, edytuj, ' ', przyciskUsun('subtasks', s.id, wczytajPodzadania));
    li.append(cb, ' ', szczegoly);
    lista.append(li);
  });
}

async function dodajPodzadanie() {
  const tytul = el('podTytul').value.trim();
  if (!tytul) return;

  const { error } = await db.from('subtasks').insert({
    task_id: otwarteId,
    title: tytul,
    description: el('podOpis').value
  });
  if (error) { alert('Błąd: ' + error.message); return; }

  el('podTytul').value = '';
  el('podOpis').value = '';
  wczytajPodzadania();
}

// ====================== KOMENTARZE ======================

async function wczytajKomentarze() {
  const { data, error } = await db.from('task_comments').select('*')
    .eq('task_id', otwarteId).order('created_at');
  if (error) { alert('Błąd: ' + error.message); return; }

  const nazwy = await nazwyUzytkownikow(data.map((k) => k.user_id));
  const jestemWlascicielem = otwarteZadanie.user_id === mojeId;

  const lista = el('szKomentarze');
  lista.innerHTML = '';
  if (data.length === 0) {
    const pusty = document.createElement('li');
    pusty.textContent = 'Brak komentarzy.';
    lista.append(pusty);
    return;
  }

  data.forEach((k) => {
    const li = document.createElement('li');

    const autor = document.createElement('b');
    autor.textContent = nazwy[k.user_id] || 'nieznany';
    const czas = document.createElement('small');
    czas.textContent = ' (' + formatData(k.created_at) + ') ';
    li.append(autor, czas);

    // usuwać możesz swoje komentarze; właściciel zadania może usunąć każdy
    if (k.user_id === mojeId || jestemWlascicielem) {
      li.append(przyciskUsun('task_comments', k.id, wczytajKomentarze));
    }

    const tresc = document.createElement('div');
    tekstZLiniami(tresc, k.body);
    li.append(tresc);
    lista.append(li);
  });
}

async function dodajKomentarz() {
  const tresc = el('komTresc').value.trim();
  if (!tresc) return;

  const { error } = await db.from('task_comments').insert({ task_id: otwarteId, body: tresc });
  if (error) { alert('Błąd: ' + error.message); return; }

  el('komTresc').value = '';
  wczytajKomentarze();
}