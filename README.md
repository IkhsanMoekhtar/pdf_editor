
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

## Middleware Production Yang Digunakan

Backend saat ini memakai middleware berikut agar aman dan stabil saat deploy:
- `helmet`: menambahkan security headers standar.
- `cors`: membatasi origin frontend yang diizinkan.
- `express-rate-limit`: membatasi spam request ke `/api/compress`.
- `morgan`: logging request untuk observability.
- `multer` file filter + size limit: menolak non-PDF dan file terlalu besar.

## Environment Variables

Salin `.env.example` sesuai kebutuhan environment Anda.

Backend:
- `PORT`: port server API (default `8787`).
- `MAX_UPLOAD_MB`: batas upload PDF dalam MB (default `200`).
- `TRUST_PROXY`: aktifkan mode proxy-aware IP (`1` untuk platform seperti Hugging Face).
- `CORS_ORIGINS`: daftar origin dipisahkan koma.
- `RATE_LIMIT_WINDOW_MS`: jendela rate limit dalam ms.
- `RATE_LIMIT_MAX`: maksimum request dalam jendela rate limit.

Frontend:
- `VITE_API_BASE_URL`: URL backend production.
	- Kosongkan di local dev agar tetap pakai Vite proxy `/api -> localhost:8787`.
	- Isi saat production, contoh `https://nama-space.hf.space`.

## Build Production

```bash
npm run build
```

## Deploy Backend ke Hugging Face (Docker Space)

Ikuti langkah ini untuk deploy **backend Express** dari project ini ke Hugging Face.

### 1. Siapkan konfigurasi sebelum deploy

1. Pastikan backend lokal berjalan:

```bash
npm run server
```

2. Cek endpoint health di browser atau curl:

```bash
http://localhost:8787/api/health
```

3. Buat daftar origin frontend production Anda untuk CORS.

### 2. Buat Space baru

1. Buka Hugging Face -> `New Space`.
2. Pilih `Docker` sebagai SDK.
3. Pilih visibilitas (`Private` / `Public`).

### 3. Upload source ke Space

Pastikan file berikut ikut ke repository Space:
- `Dockerfile`
- `.dockerignore`
- `package.json`
- `package-lock.json`
- `server/`

### 4. Atur Variables di Hugging Face Space

Set variable ini di menu Settings -> Variables:

- `MAX_UPLOAD_MB=200`
- `TRUST_PROXY=1`
- `CORS_ORIGINS=https://frontend-anda.com,http://localhost:5173`
- `RATE_LIMIT_WINDOW_MS=60000`
- `RATE_LIMIT_MAX=20`

Catatan:
- `PORT` tidak wajib diisi manual karena Dockerfile sudah default ke `7860`.
- Jika frontend Anda di domain lain, wajib masuk ke `CORS_ORIGINS`.

### 5. Tunggu build selesai

Hugging Face akan build image dari `Dockerfile`.

Jika sukses, backend akan aktif di URL:

```text
https://<nama-space>.hf.space
```

Endpoint API:
- `GET /api/health`
- `POST /api/compress`

### 6. Hubungkan frontend ke backend Hugging Face

Set environment frontend:

```env
VITE_API_BASE_URL=https://<nama-space>.hf.space
```

Karena frontend sekarang memakai `VITE_API_BASE_URL`, request akan otomatis mengarah ke backend production.

## Checklist Pra-Deploy (Wajib Lolos)

1. `npm run lint` bersih.
2. `npm run build` sukses.
3. `GET /api/health` lokal sukses.
4. Upload non-PDF ditolak (`400`).
5. Upload melebihi limit ditolak (`413`).
6. Burst request mengembalikan `429` (rate limit bekerja).

## Checklist Pasca-Deploy

1. `GET https://<nama-space>.hf.space/api/health` mengembalikan `ok: true`.
2. Kompres PDF kecil dan besar berhasil.
3. Header response kompres tersedia:
	- `X-Compression-Method`
	- `X-Processing-Time-Ms`
	- `X-Saved-Percent`
