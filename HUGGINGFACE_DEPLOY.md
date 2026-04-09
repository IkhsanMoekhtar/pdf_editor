# Hugging Face Deploy Runbook (Backend)

Dokumen ini khusus untuk deploy backend `server/index.js` ke Hugging Face Spaces (Docker).

## 1. Prasyarat

- Akun Hugging Face aktif.
- Sudah membuat Space baru dengan SDK: `Docker`.
- Nama Space contoh: `pdf-compress-backend`.
- URL Space contoh: `https://<username>-pdf-compress-backend.hf.space`.

## 2. Variables yang Disarankan (Space Settings -> Variables)

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

## 3. Command Push ke Space (PowerShell)

Ganti placeholder berikut:
- `<HF_USERNAME>`
- `<SPACE_NAME>`

```powershell
# dari root project

git add server/index.js src/App.jsx package.json package-lock.json eslint.config.js README.md .env.example Dockerfile .dockerignore src/components/pdf/PdfViewer.jsx

git commit -m "prepare backend for hugging face deploy"

git remote add hf https://huggingface.co/spaces/<HF_USERNAME>/<SPACE_NAME>

git push hf main
```

Jika remote `hf` sudah ada:

```powershell
git remote set-url hf https://huggingface.co/spaces/<HF_USERNAME>/<SPACE_NAME>
git push hf main
```

## 4. Verifikasi Setelah Deploy

Jalankan cek berikut setelah status Space `Running`:

1. Health check:

```text
GET https://<HF_USERNAME>-<SPACE_NAME>.hf.space/api/health
```

Ekspektasi minimal:
- `ok: true`
- `service: "pdf-compress-service"`

2. Compress check:
- Kirim `POST /api/compress` dengan form-data:
  - `pdf`: file PDF
  - `level`: `fast` | `balanced` | `aggressive` | `lossless`

Ekspektasi header response:
- `X-Compression-Method`
- `X-Processing-Time-Ms`
- `X-Saved-Percent`

3. Dashboard check:

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

## 5. Hubungkan Frontend ke Backend Space

Di environment frontend, isi:

```env
VITE_API_BASE_URL=https://<HF_USERNAME>-<SPACE_NAME>.hf.space
```

## 6. Troubleshooting Cepat

- 403 CORS:
  - Pastikan domain frontend benar di `CORS_ORIGINS`.
- 429 Too Many Requests:
  - Naikkan `RATE_LIMIT_MAX` bertahap (misal 20 -> 40).
- 413 Payload Too Large:
  - Naikkan `MAX_UPLOAD_MB` sesuai kebutuhan.
- Kompresi lambat:
  - Coba `level=fast`, cek ukuran file input, dan lihat `X-Processing-Time-Ms`.
