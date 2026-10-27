let hasloGlowne = null; // trzymane tylko w pamięci strony, nigdy wysyłane ani zapisywane

function naBase64(bajty) { return btoa(String.fromCharCode(...bajty)); }
function zBase64(tekst) { return Uint8Array.from(atob(tekst), (c) => c.charCodeAt(0)); }

// z hasła głównego robi klucz szyfrujący (PBKDF2 spowalnia zgadywanie)
async function kluczZHasla(haslo, sol) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(haslo), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sol, iterations: 200000, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// wynik: "sól.iv.szyfrogram" (wszystko w base64), zapisywane w jednej kolumnie
async function zaszyfruj(tekst, haslo) {
  const sol = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const klucz = await kluczZHasla(haslo, sol);
  const szyfr = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, klucz, new TextEncoder().encode(tekst)));
  return naBase64(sol) + '.' + naBase64(iv) + '.' + naBase64(szyfr);
}

// przy złym haśle głównym rzuca błąd, i dzięki temu wiemy, że hasło jest błędne
async function odszyfruj(zapis, haslo) {
  const [sol, iv, szyfr] = zapis.split('.').map(zBase64);
  const klucz = await kluczZHasla(haslo, sol);
  const bajty = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, klucz, szyfr);
  return new TextDecoder().decode(bajty);
}

async function odblokujSejf() {
  const haslo = el('glowne').value;
  if (!haslo) return;

  // jeśli w sejfie coś już jest, sprawdzamy hasło próbą odszyfrowania pierwszego wpisu
  const { data, error } = await db.from('passwords').select('secret_enc').limit(1);
  if (error) { alert('Błąd: ' + error.message); return; }
  if (data.length > 0) {
    try { await odszyfruj(data[0].secret_enc, haslo); }
    catch (e) { alert('Złe hasło główne.'); return; }
  }

  hasloGlowne = haslo;
  el('glowne').value = '';
  el('sejfBlokada').hidden = true;
  el('sejf').hidden = false;
  wczytajHasla();
}

function zablokujSejf() {
  hasloGlowne = null;
  el('glowne').value = '';
  el('listaHasel').innerHTML = '';
  el('sejf').hidden = true;
  el('sejfBlokada').hidden = false;
}

async function dodajHaslo() {
  const serwis = el('hasSerwis').value.trim();
  const sekret = el('hasSekret').value;
  if (!serwis || !sekret) { alert('Wpisz nazwę serwisu i hasło.'); return; }

  const zapis = await zaszyfruj(
    JSON.stringify({ login: el('hasLogin').value, haslo: sekret }), hasloGlowne);
  const { error } = await db.from('passwords').insert({ service: serwis, secret_enc: zapis });
  if (error) { alert('Błąd: ' + error.message); return; }

  el('hasSerwis').value = '';
  el('hasLogin').value = '';
  el('hasSekret').value = '';
  wczytajHasla();
}

// przycisk z klasą btn
function przyciskKarty(tekst, akcja) {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = tekst;
  b.onclick = akcja;
  return b;
}

// jedno pole karty: etykieta + wartość (wypełniana dopiero po rozwinięciu)
function poleKarty(etykieta) {
  const wiersz = document.createElement('p');
  wiersz.className = 'karta-pole';
  const et = document.createElement('span');
  et.className = 'karta-etykieta';
  et.textContent = etykieta + ': ';
  const wartosc = document.createElement('span');
  wartosc.className = 'karta-wartosc';
  wiersz.append(et, wartosc);
  return { wiersz, wartosc };
}

// każda karta jest domyślnie zwinięta (widać tylko nazwę serwisu);
// kliknięcie nazwy odszyfrowuje wpis i pokazuje login, hasło i przyciski
async function wczytajHasla() {
  const { data, error } = await db.from('passwords').select('*').order('service');
  if (error) { alert('Błąd: ' + error.message); return; }

  const lista = el('listaHasel');
  lista.innerHTML = '';

  if (data.length === 0) {
    const pusty = document.createElement('li');
    pusty.textContent = 'Sejf jest pusty. Dodaj pierwsze hasło powyżej.';
    lista.append(pusty);
    return;
  }

  data.forEach((p) => {
    const karta = document.createElement('li');
    karta.className = 'karta-hasla';

    const naglowek = document.createElement('button');
    naglowek.className = 'btn karta-naglowek';
    naglowek.textContent = '▸ ' + p.service;
    naglowek.setAttribute('aria-expanded', 'false');

    const szczegoly = document.createElement('div');
    szczegoly.className = 'karta-szczegoly';
    szczegoly.hidden = true;

    const login = poleKarty('Login');
    const haslo = poleKarty('Hasło');

    let dane = null; // odszyfrowane dane, trzymane tylko gdy karta jest rozwinięta

    // kopiowanie, potwierdzenie na samym przycisku zamiast okienka
    function kopiuj(pole, przycisk) {
      return async () => {
        try {
          await navigator.clipboard.writeText((dane && dane[pole]) || '');
          const stary = przycisk.textContent;
          przycisk.textContent = 'Skopiowano ✓';
          setTimeout(() => { przycisk.textContent = stary; }, 1200);
        } catch (e) { alert('Nie udało się skopiować.'); }
      };
    }
    const kopiujLogin = przyciskKarty('Kopiuj login', null);
    kopiujLogin.onclick = kopiuj('login', kopiujLogin);
    const kopiujHaslo = przyciskKarty('Kopiuj hasło', null);
    kopiujHaslo.onclick = kopiuj('haslo', kopiujHaslo);

    const usunBtn = przyciskUsun('passwords', p.id, wczytajHasla);
    usunBtn.classList.add('btn-usun');

    const przyciski = document.createElement('p');
    przyciski.className = 'karta-przyciski';
    przyciski.append(kopiujLogin, ' ', kopiujHaslo, ' ', usunBtn);

    szczegoly.append(login.wiersz, haslo.wiersz, przyciski);

    naglowek.onclick = async () => {
      if (!szczegoly.hidden) {            // zwijanie: czyścimy odszyfrowane dane
        szczegoly.hidden = true;
        dane = null;
        login.wartosc.textContent = '';
        haslo.wartosc.textContent = '';
        naglowek.textContent = '▸ ' + p.service;
        naglowek.setAttribute('aria-expanded', 'false');
        return;
      }
      try {                               // rozwijanie: odszyfrowujemy wpis
        dane = JSON.parse(await odszyfruj(p.secret_enc, hasloGlowne));
        login.wartosc.textContent = dane.login || '(brak loginu)';
        haslo.wartosc.textContent = dane.haslo;
        szczegoly.hidden = false;
        naglowek.textContent = '▾ ' + p.service;
        naglowek.setAttribute('aria-expanded', 'true');
      } catch (e) { alert('Nie udało się odszyfrować wpisu.'); }
    };

    karta.append(naglowek, szczegoly);
    lista.append(karta);
  });
}

// przyciski z index.html w sekcji Hasła (Odblokuj, Zablokuj sejf, Zapisz) dostają klasę btn
document.querySelectorAll('#hasla button:not(.btn-usun)').forEach(b => b.classList.add('btn'));