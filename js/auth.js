// nazwa -> sztuczny e-mail (hex, żeby polskie znaki i spacje nie psuły adresu)
function naEmail(nazwa) {
  const bajty = new TextEncoder().encode(nazwa.trim().toLowerCase());
  const hex = Array.from(bajty).map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex + '@example.com';
}

// dopisek sprawia, że nawet hasło "1" przejdzie minimum 6 znaków
function naHaslo(haslo) {
  return haslo + '::moja-aplikacja';
}

async function zaloguj() {
  const nazwa = el('login').value.trim();
  const haslo = el('haslo').value;
  if (!nazwa || !haslo) { el('blad').textContent = 'Wpisz nazwę i hasło.'; return; }

  const { error } = await db.auth.signInWithPassword({ email: naEmail(nazwa), password: naHaslo(haslo) });
  if (error) { el('blad').textContent = 'Zła nazwa lub hasło.'; return; }
  window.location.href = 'app.html';
}

async function zarejestruj() {
  const nazwa = el('login').value.trim();
  const haslo = el('haslo').value;
  if (!nazwa || !haslo) { el('blad').textContent = 'Wpisz nazwę i hasło.'; return; }
  if (nazwa.length > 30) { el('blad').textContent = 'Nazwa może mieć maksymalnie 30 znaków.'; return; }

  const { data, error } = await db.auth.signUp({
    email: naEmail(nazwa),
    password: naHaslo(haslo),
    options: { data: { nazwa: nazwa } }
  });
  if (error) { el('blad').textContent = 'Nie udało się założyć konta: ' + error.message; return; }
  if (data.session) { window.location.href = 'app.html'; return; }
  el('blad').textContent = 'Konto założone, ale wymaga potwierdzenia. Wyłącz "Confirm email" w Supabase.';
}

// Enter w polu hasła = zaloguj
el('haslo').addEventListener('keydown', (e) => { if (e.key === 'Enter') zaloguj(); });

// jeśli ktoś jest już zalogowany, od razu przenieś go do aplikacji
async function sprawdzSesje() {
  const { data } = await db.auth.getSession();
  if (data.session) window.location.href = 'app.html';
}
sprawdzSesje();