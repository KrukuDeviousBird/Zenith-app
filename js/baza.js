// ===== DANE =====
const SUPABASE_URL = 'https://fnbjymidfcjfoivofjdj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_doJ3bqSgKUHODAB7lxLEzw_5wOmSdCC';
// ================

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// skrót: el('id') zamiast document.getElementById('id')
const el = (id) => document.getElementById(id);

// dane zalogowanego użytkownika (ustawia je app.js po starcie)
let mojeId = null;
let mojaNazwa = '';

// wspólny przycisk "Usuń" dla wszystkich list
function przyciskUsun(tabela, id, odswiez) {
  const b = document.createElement('button');
  b.textContent = 'Usuń';
  b.id = `usun-${tabela}-${id}`;   // unikalne, np. usun-zadania-12
  b.className = 'btn-usun';        // wspólne dla wszystkich przycisków Usuń
  b.onclick = async () => {
    const { error } = await db.from(tabela).delete().eq('id', id);
    if (error) alert('Błąd: ' + error.message);
    odswiez();
  };
  return b;
}

// wstawia tekst do elementu, zamieniając nowe linie na <br> (bezpiecznie, bez innerHTML z danymi)
function tekstZLiniami(kontener, tekst) {
  kontener.innerHTML = '';
  (tekst || '').split('\n').forEach((linia, i) => {
    if (i > 0) kontener.append(document.createElement('br'));
    kontener.append(linia);
  });
}

// zamienia listę id użytkowników na słownik { id: nazwa }
async function nazwyUzytkownikow(ids) {
  const unikalne = [...new Set(ids)];
  const mapa = {};
  if (unikalne.length === 0) return mapa;
  const { data } = await db.from('profiles').select('user_id, username').in('user_id', unikalne);
  (data || []).forEach((p) => { mapa[p.user_id] = p.username; });
  return mapa;
}

function formatData(iso) {
  return new Date(iso).toLocaleString('pl-PL');
}