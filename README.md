[README.md](https://github.com/user-attachments/files/34125605/README.md)
# Zenith

Osobista aplikacja webowa „wszystko w jednym": **zadania**, **notatki**, **trening** (plany, wyniki, statystyki progresu) i **sejf na hasła**. Napisana w czystym HTML, CSS i JavaScript, bez frameworków i bez kroku budowania. Dane trzyma w Supabase, a stronę można hostować za darmo na GitHub Pages.

## Funkcje

### Zadania
- zadania z terminem i opisem, oznaczanie jako zrobione,
- podzadania z własnymi opisami i paskiem postępu,
- komentarze do zadań,
- dodawanie innych użytkowników do zadania (wspólna praca),
- edycja i usuwanie zadania dostępne dla jego właściciela.

### Notatki
- notatki z tytułem i treścią, z zachowaniem nowych linii,
- lista od najnowszej, usuwanie notatek.

### Trening
- **Plany treningowe**: tworzysz plan, nadajesz mu nazwę i dodajesz ćwiczenia (nazwa + liczba serii). Plany i ćwiczenia edytujesz w miejscu.
- **Treningi**: start z planu albo wolny trening. Każde ćwiczenie ma własny blok i przycisk zapisu, więc zapisujesz je pojedynczo. Do rozpoczętego treningu można wrócić i poprawić wyniki (ciężar × powtórzenia). Historia pokazuje każde ćwiczenie jeden raz, z seriami w jednej linii.
- **Statystyki**: wykres progresu wybranego ćwiczenia oraz wykres procentowego progresu wszystkich ćwiczeń. Progres liczony jest z szacowanego maksimum na 1 powtórzenie (wzór Epleya: `kg × (1 + powtórzenia / 30)`).
- **Nowe osiągi**: lista nowych rekordów siłowych użytkowników. Udział jest dobrowolny: domyślnie nic nie jest publikowane, a przyciski zgody i rezygnacji pozwalają w każdej chwili włączyć lub wyłączyć wyświetlanie swoich osiągów (rezygnacja usuwa też już opublikowane wpisy).

### Hasła (sejf)
- hasła są **szyfrowane w przeglądarce** (AES-GCM, klucz z hasła głównego przez PBKDF2, 200 000 iteracji) zanim trafią do bazy,
- hasło główne sejfu nigdy nie jest wysyłane ani zapisywane. Serwer widzi tylko szyfrogram,
- każdy wpis to zwinięta karta: po kliknięciu pokazuje login, hasło oraz przyciski kopiowania i usuwania,
- sejf można w każdej chwili zablokować.

> **Uwaga:** hasła głównego nie da się odzyskać. Jeśli je zgubisz, zaszyfrowanych wpisów nie da się odczytać.

### Interfejs
- boczne menu wysuwane z lewej strony, z sekcjami Zadania, Notatki, Trening i Hasła,
- „Trening" rozwija w menu cztery opcje: Plany, Treningi, Statystyki, Nowe osiągi.

## Technologie

| Obszar | Rozwiązanie |
| --- | --- |
| Frontend | HTML, CSS, czysty JavaScript (bez frameworków) |
| Baza danych i logowanie | [Supabase](https://supabase.com) (PostgreSQL + Auth + Row Level Security) |
| Wykresy | [Chart.js](https://www.chartjs.org) 4 |
| Szyfrowanie haseł | Web Crypto API (AES-GCM, PBKDF2) |
| Hosting | GitHub Pages |

## Struktura projektu

```
.
├── index.html        # cała struktura strony
├── style.css         # wygląd aplikacji
├── menu.css          # mechanika wysuwanego menu bocznego
├── trening.css       # układ listy wyników w historii treningów
└── js/
    ├── baza.js       # połączenie z Supabase (URL i klucz publiczny), funkcje wspólne
    ├── app.js        # logowanie, wylogowanie, przełączanie sekcji (pokaz)
    ├── zadania.js    # zadania, podzadania, komentarze, użytkownicy w zadaniu
    ├── notatki.js    # notatki
    ├── trening.js    # plany, treningi, statystyki, osiągi
    ├── hasla.js      # sejf: szyfrowanie i karty z hasłami
    └── menu.js       # menu boczne
```

Kolejność skryptów w `index.html` ma znaczenie: biblioteki (Supabase, Chart.js), potem `baza.js`, moduły sekcji i na końcu `app.js`.

## Uruchomienie

1. **Utwórz projekt w Supabase** (darmowy plan wystarczy).
2. **Utwórz tabele** w SQL Editor (patrz sekcja „Baza danych") i włącz Row Level Security na każdej z nich.
3. **Wpisz dane projektu** w `js/baza.js`: adres projektu (Project URL) i klucz publiczny (`anon` / publishable key).
4. **Otwórz `index.html`** lokalnie (najlepiej przez prosty serwer, np. rozszerzenie Live Server w VS Code albo `python -m http.server`). Szyfrowanie haseł wymaga bezpiecznego kontekstu, więc działa na `localhost` i na HTTPS, ale nie z adresu `file://` w niektórych przeglądarkach.
5. **Wdróż na GitHub Pages**: *Settings → Pages → Deploy from a branch → `main` / root*.

## Baza danych

Aplikacja korzysta z tabel (wszystkie z włączonym RLS, każdy użytkownik widzi tylko swoje dane):

| Tabela | Zawartość |
| --- | --- |
| tabele zadań | zadania, podzadania, komentarze i użytkownicy przypisani do zadań |
| `notes` | notatki (`title`, `content`, `created_at`) |
| `passwords` | wpisy sejfu (`service`, `secret_enc`: zaszyfrowany login i hasło) |
| `plany` | plany treningowe |
| `plan_cwiczenia` | ćwiczenia w planie (nazwa, liczba serii) |
| `treningi` | rozpoczęte treningi (nazwa, data, powiązany plan) |
| `serie` | wyniki: ćwiczenie, numer serii, ciężar, powtórzenia |
| `osiagi_zgoda` | zgoda użytkownika na publikowanie osiągów |
| `osiagi` | opublikowane osiągi (czytają je wszyscy zalogowani) |

<details>
<summary>Skrypt SQL dla modułu Trening i osiągów</summary>

```sql
create table if not exists plany (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  nazwa text not null
);

create table if not exists plan_cwiczenia (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  plan_id bigint not null references plany(id) on delete cascade,
  nazwa text not null,
  serie int not null,
  powtorzenia int,
  kg numeric
);

create table if not exists treningi (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  nazwa text not null,
  data date not null default current_date,
  plan_id bigint references plany(id) on delete set null
);

create table if not exists serie (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  trening_id bigint not null references treningi(id) on delete cascade,
  cwiczenie text not null,
  nr_serii int,
  powtorzenia int not null,
  kg numeric not null
);

create table if not exists osiagi_zgoda (
  user_id uuid primary key default auth.uid(),
  nazwa text not null,
  zgoda boolean not null default false
);

create table if not exists osiagi (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  trening_id bigint,
  nazwa text not null,
  cwiczenie text not null,
  poprzedni numeric not null,
  nowy numeric not null,
  procent numeric not null,
  created_at timestamptz not null default now()
);

alter table plany enable row level security;
alter table plan_cwiczenia enable row level security;
alter table treningi enable row level security;
alter table serie enable row level security;
alter table osiagi_zgoda enable row level security;
alter table osiagi enable row level security;

create policy "plany_moje" on plany for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "plan_cw_moje" on plan_cwiczenia for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "treningi_moje" on treningi for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "serie_moje" on serie for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "zgoda_moja" on osiagi_zgoda for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- osiągi czytają wszyscy zalogowani, dodać można tylko własne i tylko mając zgodę
create policy "osiagi_czytaj" on osiagi for select to authenticated using (true);
create policy "osiagi_dodaj" on osiagi for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from osiagi_zgoda z where z.user_id = auth.uid() and z.zgoda)
  );
create policy "osiagi_usun" on osiagi for delete to authenticated using (user_id = auth.uid());
```

</details>

## Bezpieczeństwo

- Klucz publiczny (`anon`) w `js/baza.js` jest przeznaczony do użycia w przeglądarce. Ochronę danych zapewnia **Row Level Security** w bazie, więc upewnij się, że jest włączone na każdej tabeli.
- **Nigdy nie umieszczaj w repozytorium klucza `service_role`** ani innych kluczy prywatnych.
- Hasła w sejfie są szyfrowane po stronie klienta, a hasło główne istnieje tylko w pamięci otwartej karty przeglądarki.
- Osiągi innych użytkowników są widoczne tylko dla tych, którzy wyrazili na to zgodę, i tylko w zakresie: nazwa użytkownika, ćwiczenie, szacowane maksimum i procent progresu.

## Plany rozwoju

- [ ] kalendarz (terminy zadań i zaplanowane treningi),
- [ ] bot na Discordzie (JavaScript), np. powiadomienia o osiągach i terminach,
- [ ] zmiana kolejności ćwiczeń w planie,
- [ ] eksport historii treningów do CSV,
- [ ] minutnik przerw między seriami.

## Licencja

Projekt prywatny. Dodaj plik `LICENSE`, jeśli chcesz go udostępnić na określonych zasadach.
