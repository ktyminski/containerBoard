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

## Weryfikacja

```bash
npm run lint -- .
npm run build
```
