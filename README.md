# PDF Editor (React + Vite + Node)

Project ini sekarang memiliki:
- Frontend React + Vite untuk editing PDF.
- Backend Node.js untuk fitur kompres PDF di endpoint `/api/compress`.

## Menjalankan Project

Install dependency:

```bash
npm install
```

Jalankan frontend + backend sekaligus:

```bash
npm run dev:full
```

Atau jalankan terpisah:

```bash
npm run server
npm run dev
```

## Kompres PDF (Node Backend)

Fitur `KOMPRES PDF` dari sidebar akan mengirim file ke backend Node:
- Endpoint: `POST /api/compress`
- Form-data:
	- `pdf`: file PDF
	- `level`: `low` | `medium` | `high`

### Kualitas Kompresi

- Jika Ghostscript terpasang di sistem, backend otomatis menggunakannya untuk kompresi lebih kuat.
- Jika Ghostscript belum ada, backend tetap berjalan dengan fallback kompresi berbasis `pdf-lib`.

## Build Production

```bash
npm run build
```
