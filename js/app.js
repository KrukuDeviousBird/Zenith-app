const ZAKLADKI = ['zadania', 'notatki', 'trening', 'hasla'];

// pokazuje jedną zakładkę, chowa pozostałe (i ostrzega, gdy HTML jest źle ułożony)
function pokaz(nazwa) {
  ZAKLADKI.forEach((n) => {
    const blok = el(n);
    if (!blok) { console.error('Brak elementu #' + n + ' w app.html'); return; }
    if (blok.parentElement.id !== 'aplikacja') {
      console.error('#' + n + ' jest wewnątrz #' + blok.parentElement.id +
        ' (brakuje albo jest za dużo </div> w app.html)');
    }
    blok.hidden = (n !== nazwa);
  });
}

async function wyloguj() {
  await db.auth.signOut();
  window.location.href = 'index.html';
}

// wylogowanie w innej karcie też przenosi tutaj do logowania
db.auth.onAuthStateChange((zdarzenie) => {
  if (zdarzenie === 'SIGNED_OUT') window.location.href = 'index.html';
});

async function start() {
  const { data } = await db.auth.getSession();
  if (!data.session) { window.location.href = 'index.html'; return; }

  mojeId = data.session.user.id;
  mojaNazwa = data.session.user.user_metadata.nazwa || '';
  el('kto').textContent = mojaNazwa;
  el('aplikacja').hidden = false;

  // każda zakładka ładuje się osobno: błąd w jednej nie zatrzymuje pozostałych
  // (sejf z hasłami wczytuje się dopiero po odblokowaniu hasłem głównym)
  ['wczytajZadania', 'wczytajNotatki', 'wczytajTreningi'].forEach((nazwa) => {
    if (typeof window[nazwa] !== 'function') {
      console.error('Brak funkcji ' + nazwa + ' (plik z js/ się nie wczytał albo ma błąd składni)');
      return;
    }
    Promise.resolve(window[nazwa]()).catch((e) => console.error('Błąd w ' + nazwa + ':', e));
  });
}

start();