
# PDF Editor Suite (React + Vite + Node)

Suite ini sekarang mencakup fitur lengkap:

- Edit PDF (teks, coretan, highlight, rotasi).
- Gabung PDF.
- Pisah PDF (per halaman atau rentang halaman).
- Kompres PDF (fast, lossless, balanced, aggressive).
- Konversi dokumen:
  - Ke PDF: JPG/PNG, WORD, PPT, EXCEL.
  - Dari PDF: JPG, WORD, PPT, EXCEL.
- Dashboard backend untuk observability request.

## Stack

- Frontend: React + Vite.
- Backend: Express.
- PDF engine: pdf-lib.
- Compression engine: Ghostscript + qpdf + fallback pdf-lib.
- Conversion engine: LibreOffice (Office <-> PDF) + Ghostscript (PDF -> JPG) + pdf-lib (image -> PDF).

## Menjalankan Lokal

Install dependency:

```bash
npm install
```

Jalankan frontend + backend sekaligus:

```bash
npm run dev:full
```

Atau terpisah:

```bash
npm run server
npm run dev
```

Build frontend:

```bash
npm run build
```

## API Endpoint

- GET /api/health
- POST /api/compress
- POST /api/merge
- POST /api/split
- POST /api/convert
- GET /api/dashboard/metrics

## Detail Fitur

### 1. Kompres PDF

Request:
- form-data `pdf`: file PDF
- form-data `level`: fast | lossless | balanced | aggressive

Response header penting:
- X-Compression-Method
- X-Compression-Level
- X-Compression-Strategy
- X-Saved-Percent
- X-Processing-Time-Ms

### 2. Gabung PDF

Request:
- form-data `pdfs`: banyak file PDF

Response:
- file PDF hasil gabung

### 3. Pisah PDF

Request:
- form-data `pdf`: file PDF
- form-data `mode`: each | ranges
- form-data `ranges`: contoh 1-3,5,8-10 (wajib jika mode=ranges)

Response:
- ZIP berisi potongan PDF

### 4. Konversi

Request:
- form-data `file`: file input
- form-data `direction`: to-pdf | from-pdf
- form-data `target`: jpg | word | ppt | excel

Contoh pasangan valid:
- to-pdf + jpg + file JPG/PNG
- to-pdf + word + file DOC/DOCX
- to-pdf + ppt + file PPT/PPTX
- to-pdf + excel + file XLS/XLSX
- from-pdf + jpg + file PDF
- from-pdf + word + file PDF
- from-pdf + ppt + file PDF
- from-pdf + excel + file PDF

Catatan:
- Jika file input tidak sesuai pasangan target, API mengembalikan 400.
- Jika engine runtime tidak tersedia, API mengembalikan 503.

## Environment Variables

Gunakan `.env.example` sebagai baseline.

Backend:
- PORT (default 8787)
- MAX_UPLOAD_MB (default 200)
- TRUST_PROXY (default 1)
- CORS_ORIGINS (comma-separated)
- RATE_LIMIT_WINDOW_MS (default 60000)
- RATE_LIMIT_MAX (default 20)
- ENABLE_SECOND_PASS_OPTIMIZER (opsional, default 0)
- DASHBOARD_TOKEN (opsional)
- DASHBOARD_RETENTION (default 200)

Frontend:
- VITE_API_BASE_URL (opsional untuk production)
- VITE_HF_TOKEN (opsional, jika backend Space private/gated)

## Deploy Backend ke Hugging Face (Docker)

Backend production dijalankan lewat Docker image dari file:

- Dockerfile
- server/index.js

Dependensi runtime di container:

- ghostscript
- qpdf
- libreoffice-core
- libreoffice-writer
- libreoffice-calc
- libreoffice-impress

Langkah deploy detail ada di [HUGGINGFACE_DEPLOY.md](HUGGINGFACE_DEPLOY.md).

## Keamanan dan Hygiene Repo

File sensitif dan artefak lokal sudah di-ignore melalui .gitignore, termasuk:

- .env dan .env.*
- dist
- node_modules
- .history
- sertifikat/key file
- folder test sementara (.tmp-test dan .tmp-convert-tests)

## Status Fitur (April 2026)

- Merge/Split/Compress: aktif.
- Convert: aktif (termasuk Office <-> PDF).
- Dashboard metrics: aktif.
- Deploy GitHub + Hugging Face: sinkron.
