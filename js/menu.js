// Menu boczne: przycisk "Menu" wysuwa panel z lewej strony, w którym wybierasz sekcję.
// "Trening" rozwija 4 opcje (Plany, Treningi, Statystyki, Nowe osiągi).
// Wysuwanie robi menu.css (klasa "otwarty"). Wybór sekcji korzysta z istniejącej funkcji pokaz() z app.js,
// a opcji Treningu z pokazTr() z trening.js.
(function () {
  const SEKCJE = ['zadania', 'notatki', 'trening', 'hasla'];
  const PODSEKCJE = ['trPlany', 'trSesja', 'trStaty', 'trOsiagi'];

  const przycisk = document.getElementById('menuBtn');
  const panel = document.getElementById('menuPanel');
  const tlo = document.getElementById('menuTlo');
  const zamknijBtn = document.getElementById('menuZamknij');
  const aplikacja = document.getElementById('aplikacja');
  const grupa = document.getElementById('menuTrening');        // przycisk "Trening" w menu
  const podlista = document.getElementById('menuTreningPod');  // jego 4 opcje
  if (!przycisk || !panel || !tlo) return;

  const czyOtwarte = () => panel.classList.contains('otwarty');

  function pierwszaWidoczna(lista) {
    return lista.find(id => {
      const e = document.getElementById(id);
      return e && !e.hidden;
    });
  }
  const aktualnaSekcja = () => pierwszaWidoczna(SEKCJE);
  const aktualnaPodsekcja = () => pierwszaWidoczna(PODSEKCJE);

  // rozwija / zwija listę opcji Treningu
  function ustawPodlista(rozwinieta) {
    if (!grupa || !podlista) return;
    podlista.hidden = !rozwinieta;
    grupa.setAttribute('aria-expanded', rozwinieta ? 'true' : 'false');
    const strzalka = grupa.querySelector('.menu-strzalka');
    if (strzalka) strzalka.textContent = rozwinieta ? '\u25BE' : '\u25B8';
  }

  // zaznacza w panelu bieżącą sekcję i opcję Treningu (klasa "aktywna")
  function zaznaczAktywna() {
    const sekcja = aktualnaSekcja();
    panel.querySelectorAll('.menu-pozycja').forEach(b => {
      const jest = b.dataset.sekcja === sekcja;
      b.classList.toggle('aktywna', jest);
      if (jest) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    const pod = sekcja === 'trening' ? aktualnaPodsekcja() : null;
    panel.querySelectorAll('.menu-podpozycja').forEach(b => {
      const jest = b.dataset.pod === pod;
      b.classList.toggle('aktywna', jest);
      if (jest) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
  }

  function otworz() {
    zaznaczAktywna();
    ustawPodlista(aktualnaSekcja() === 'trening');   // w Treningu od razu widać opcje
    panel.classList.add('otwarty');
    tlo.classList.add('otwarty');
    document.body.classList.add('menu-otwarte');
    przycisk.setAttribute('aria-expanded', 'true');
    const start = panel.querySelector('.menu-podpozycja.aktywna')
      || panel.querySelector('.menu-pozycja.aktywna')
      || panel.querySelector('.menu-pozycja');
    if (start) start.focus();
  }

  function zamknij(przywrocFokus) {
    panel.classList.remove('otwarty');
    tlo.classList.remove('otwarty');
    document.body.classList.remove('menu-otwarte');
    przycisk.setAttribute('aria-expanded', 'false');
    if (przywrocFokus) przycisk.focus();
  }

  przycisk.addEventListener('click', () => (czyOtwarte() ? zamknij(true) : otworz()));
  zamknijBtn.addEventListener('click', () => zamknij(true));
  tlo.addEventListener('click', () => zamknij(false));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && czyOtwarte()) zamknij(true);
  });

  // zwykłe sekcje (Zadania, Notatki, Hasła)
  panel.querySelectorAll('.menu-pozycja:not(.menu-grupa)').forEach(b => {
    b.addEventListener('click', () => {
      pokaz(b.dataset.sekcja);
      zamknij(true);
    });
  });

  // "Trening" tylko rozwija opcje, sekcja zmienia się po wyborze jednej z nich
  if (grupa && podlista) {
    grupa.addEventListener('click', () => ustawPodlista(podlista.hidden));
  }
  panel.querySelectorAll('.menu-podpozycja').forEach(b => {
    b.addEventListener('click', () => {
      pokaz('trening');
      if (typeof pokazTr === 'function') pokazTr(b.dataset.pod);
      zamknij(true);
    });
  });

  // po wylogowaniu (cała aplikacja znów ukryta) panel ma być zamknięty
  if (aplikacja) {
    new MutationObserver(() => { if (aplikacja.hidden) zamknij(false); })
      .observe(aplikacja, { attributes: true, attributeFilter: ['hidden'] });
  }
})();