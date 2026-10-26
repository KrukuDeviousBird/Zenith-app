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

async function wczytajHasla() {
  const { data, error } = await db.from('passwords').select('*').order('service');
  if (error) { alert('Błąd: ' + error.message); return; }

  const lista = el('listaHasel');
  lista.innerHTML = '';
  data.forEach((p) => {
    const li = document.createElement('li');
    const nazwa = document.createElement('b');
    nazwa.textContent = p.service + ' ';
    const wynik = document.createElement('span');

    const pokazBtn = document.createElement('button');
    pokazBtn.className = 'btn';
    pokazBtn.textContent = 'Pokaż';
    pokazBtn.onclick = async () => {
      if (wynik.textContent) { wynik.textContent = ''; pokazBtn.textContent = 'Pokaż'; return; }
      try {
        const dane = JSON.parse(await odszyfruj(p.secret_enc, hasloGlowne));
        wynik.textContent = dane.login + ' / ' + dane.haslo + ' ';
        pokazBtn.textContent = 'Ukryj';
      } catch (e) { alert('Nie udało się odszyfrować wpisu.'); }
    };

    const kopiujBtn = document.createElement('button');
    kopiujBtn.className = 'btn';
    kopiujBtn.textContent = 'Kopiuj hasło';
    kopiujBtn.onclick = async () => {
      try {
        const dane = JSON.parse(await odszyfruj(p.secret_enc, hasloGlowne));
        await navigator.clipboard.writeText(dane.haslo);
        alert('Skopiowano hasło.');
      } catch (e) { alert('Nie udało się skopiować.'); }
    };

    const usunBtn = przyciskUsun('passwords', p.id, wczytajHasla);
    usunBtn.classList.add('btn-usun');

    li.append(nazwa, wynik, pokazBtn, ' ', kopiujBtn, ' ', usunBtn);
    lista.append(li);
  });
}

// przyciski z index.html w sekcji Hasła (Odblokuj, Zablokuj sejf, Zapisz) dostają klasę btn
document.querySelectorAll('#hasla button:not(.btn-usun)').forEach(b => b.classList.add('btn'));