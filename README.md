# ContainerBoard

MVP aplikacji do publikowania i przegladania kontenerow:
- dostepne kontenery,
- poszukiwane kontenery,
- zapytania email do wlasciciela ogloszenia.

## Start lokalny

1. Skopiuj `.env.example` do `.env.local`.
2. Ustaw co najmniej:
- `MONGODB_URI`
- `MONGODB_DB`
- `AUTH_JWT_SECRET`
3. Zainstaluj zaleznosci:

```bash
npm install
```

4. Uruchom:

```bash
npm run dev
```

## Najwazniejsze endpointy MVP

- `GET /api/containers`
- `POST /api/containers`
- `GET /api/containers/[id]`
- `PATCH /api/containers/[id]`
- `DELETE /api/containers/[id]`
- `POST /api/containers/[id]/inquiry`
- `GET /api/admin/containers` (admin)
- `GET/POST /api/cron/fx-rates` (cron, wymaga `CRON_SECRET`)

## Kursy walut (FX)

- Kursy `PLN/EUR` i `PLN/USD` sa odswiezane przez cron raz dziennie (`vercel.json`, 05:00 UTC).
- Ostatni kurs zapisywany jest w Mongo (`fx_rates`, dokument `latest`).
- API serwerowe korzysta z kursu z bazy (bez requestow do zewnetrznego API podczas tworzenia/edycji ogloszenia).
- Gdy odswiezenie sie nie uda, zapisywany jest fallback z env:
  - `FX_FALLBACK_PLN_PER_EUR`
  - `FX_FALLBACK_PLN_PER_USD`
  - `FX_FALLBACK_SOURCE`

## Weryfikacja

```bash
npm run lint -- .
npm run build
```
