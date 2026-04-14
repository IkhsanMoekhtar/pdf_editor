# Hugging Face Deploy Runbook (Backend)

Dokumen ini khusus untuk deploy backend `server/index.js` ke Hugging Face Spaces (Docker) sesuai kondisi fitur terbaru.

## 1. Prasyarat

- Akun Hugging Face aktif.
- Sudah membuat Space baru dengan SDK: `Docker`.
- Nama Space contoh: `pdf-backend`.
- URL Space contoh: `https://<username>-pdf-backend.hf.space`.

## 2. Fitur Backend yang Dideploy

Backend yang masuk ke Space mencakup endpoint berikut:

- `GET /api/health`
- `POST /api/compress`
- `POST /api/merge`
- `POST /api/split`
- `POST /api/convert`
- `GET /api/dashboard/metrics`

Engine runtime yang dipakai di Space:

- Ghostscript (compression + PDF to JPG)
- qpdf (optimizer tambahan)
- LibreOffice headless (Office <-> PDF)
- pdf-lib (fallback dan operasi PDF)

## 3. Variables yang Disarankan (Space Settings -> Variables)

Gunakan nilai ini sebagai baseline awal:

- `MAX_UPLOAD_MB=200`
- `TRUST_PROXY=1`
- `CORS_ORIGINS=http://localhost:5173,https://<frontend-domain-anda>`
- `RATE_LIMIT_WINDOW_MS=60000`
- `RATE_LIMIT_MAX=20`
- `DASHBOARD_RETENTION=200`

Opsional (disarankan untuk Space publik):

- `DASHBOARD_TOKEN=<token-rahasia-anda>`
- `ENABLE_SECOND_PASS_OPTIMIZER=0` (default latency-first)

Catatan:
- `PORT` tidak perlu diisi manual karena `Dockerfile` sudah `ENV PORT=7860`.
- Tambahkan semua origin frontend yang valid ke `CORS_ORIGINS` (pisahkan dengan koma).

## 4. Command Push ke Space (PowerShell)

Ganti placeholder berikut:
- `<HF_USERNAME>`
- `<SPACE_NAME>`

### Opsi A: Push langsung branch utama

```powershell
# dari root project

git add .

git commit -m "prepare backend for hugging face deploy"

git remote add hf https://huggingface.co/spaces/<HF_USERNAME>/<SPACE_NAME>

git push hf main
```

Jika remote `hf` sudah ada:

```powershell
git remote set-url hf https://huggingface.co/spaces/<HF_USERNAME>/<SPACE_NAME>
git push hf main
```

### Opsi B (Direkomendasikan): backend-only push dari branch terpisah

Jika repo utama berisi frontend + backend, gunakan branch backend-only agar isi Space tetap minimal:

```powershell
git fetch huggingface
git checkout -B hf-backend-only huggingface/main
git cherry-pick <commit-backend-yang-ingin-dideploy>
git push huggingface HEAD:main
git checkout main
```

## 5. Verifikasi Setelah Deploy

Jalankan cek berikut setelah status Space `Running`:

1. Health check:

```text
GET https://<HF_USERNAME>-<SPACE_NAME>.hf.space/api/health
```

Ekspektasi minimal:
- `ok: true`
- `service: "pdf-compress-service"`
- `ghostscriptAvailable: true`
- `qpdfAvailable: true`
- `libreOfficeAvailable: true`

2. Compress check:
- Kirim `POST /api/compress` dengan form-data:
  - `pdf`: file PDF
  - `level`: `fast` | `balanced` | `aggressive` | `lossless`

Ekspektasi header response:
- `X-Compression-Method`
- `X-Processing-Time-Ms`
- `X-Saved-Percent`

3. Merge check:
- Kirim `POST /api/merge` dengan minimal 2 file PDF (`pdfs[]`).
- Ekspektasi response berupa file PDF.

4. Split check:
- Kirim `POST /api/split`:
  - `pdf` (file PDF)
  - `mode` = `each` atau `ranges`
  - `ranges` (jika `mode=ranges`)
- Ekspektasi response berupa ZIP.

5. Convert check:
- Kirim `POST /api/convert` dengan kombinasi valid:
  - `direction=to-pdf` + `target=jpg|word|ppt|excel`
  - `direction=from-pdf` + `target=jpg|word|ppt|excel`
- Ekspektasi response file sesuai target.

6. Dashboard check:

```text
GET https://<HF_USERNAME>-<SPACE_NAME>.hf.space/dashboard
```

Jika `DASHBOARD_TOKEN` aktif, akses dengan query:

```text
GET https://<HF_USERNAME>-<SPACE_NAME>.hf.space/dashboard?token=<token-rahasia-anda>
```

Endpoint data dashboard:

```text
GET /api/dashboard/metrics
GET /api/dashboard/metrics?compact=1
```

## 6. Hubungkan Frontend ke Backend Space

Di environment frontend, isi:

```env
VITE_API_BASE_URL=https://<HF_USERNAME>-<SPACE_NAME>.hf.space
```

Jika Space private/gated, tambahkan token:

```env
VITE_HF_TOKEN=<hf_token_anda>
```

## 7. Troubleshooting Cepat

- 403 CORS:
  - Pastikan domain frontend benar di `CORS_ORIGINS`.
- 429 Too Many Requests:
  - Naikkan `RATE_LIMIT_MAX` bertahap (misal 20 -> 40).
- 413 Payload Too Large:
  - Naikkan `MAX_UPLOAD_MB` sesuai kebutuhan.
- Kompresi lambat:
  - Coba `level=fast`, cek ukuran file input, dan lihat `X-Processing-Time-Ms`.
- Konversi Office gagal:
  - Pastikan health menunjukkan `libreOfficeAvailable: true`.
- PDF ke JPG gagal:
  - Pastikan health menunjukkan `ghostscriptAvailable: true`.
