# Release Notes

## 2026-04-14

### Highlight

Rilis ini menyelesaikan paket fitur PDF end-to-end: edit, merge, split, compress, convert, dashboard observability, dan sinkronisasi deploy ke GitHub + Hugging Face.

### Fitur Baru

- Workspace khusus untuk:
  - Gabung PDF
  - Pisah PDF
  - Kompres PDF
  - Konversi file
- Konversi lengkap:
  - Ke PDF: JPG/PNG, WORD, PPT, EXCEL
  - Dari PDF: JPG, WORD, PPT, EXCEL
- Batch tools panel untuk merge/split/compress.
- Convert tools panel untuk semua preset konversi.

### Backend API

Endpoint aktif:

- GET /api/health
- POST /api/compress
- POST /api/merge
- POST /api/split
- POST /api/convert
- GET /api/dashboard/metrics

### Engine dan Proses

- Kompresi: Ghostscript + qpdf + fallback pdf-lib.
- Konversi Office <-> PDF: LibreOffice headless.
- Konversi PDF -> JPG: Ghostscript.
- Konversi image -> PDF: pdf-lib.

### Observability

- Dashboard metrics mencatat semua request utama (bukan hanya kompresi).
- Ringkasan latency, status, bytes in/out, request aktif, dan recent requests.

### Deploy

- GitHub main: sinkron dengan fitur terbaru.
- Hugging Face main: backend-only deploy untuk route API production.
- Runtime Space tervalidasi aktif untuk Ghostscript, qpdf, dan LibreOffice.

### Perubahan Dokumen

- README diperbarui agar sesuai fitur terbaru.
- HUGGINGFACE_DEPLOY runbook diperbarui (endpoint, engine, workflow deploy, checklist verifikasi).

### Catatan Validasi

- Build frontend sukses.
- Syntax backend tervalidasi.
- Smoke test live di Space berhasil untuk jalur konversi utama dengan input valid.
