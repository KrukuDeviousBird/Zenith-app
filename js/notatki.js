async function wczytajNotatki() {
  const { data, error } = await db.from('notes').select('*').order('created_at', { ascending: false });
  if (error) { alert('Błąd: ' + error.message); return; }

  const lista = el('listaNotatek');
  lista.innerHTML = '';
  data.forEach((n) => {
    const li = document.createElement('li');
    const tytul = document.createElement('b');
    tytul.textContent = n.title;

    // nowe linie z notatki zamieniamy na <br>, bo bez CSS przeglądarka by je zignorowała
    const tresc = document.createElement('div');
    tresc.className = 'notatka-tresc';
    (n.content || '').split('\n').forEach((linia, i) => {
      if (i > 0) tresc.append(document.createElement('br'));
      tresc.append(linia);
    });

    li.append(tytul, ' ', przyciskUsun('notes', n.id, wczytajNotatki), tresc);
    lista.append(li);
  });
}

async function dodajNotatke() {
  const tytul = el('notatkaTytul').value.trim();
  if (!tytul) return;

  const { error } = await db.from('notes').insert({ title: tytul, content: el('notatkaTresc').value });
  if (error) { alert('Błąd: ' + error.message); return; }

  el('notatkaTytul').value = '';
  el('notatkaTresc').value = '';
  wczytajNotatki();
}