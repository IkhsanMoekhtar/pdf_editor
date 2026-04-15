# Vercel Deploy Guide

Panduan ini untuk menjalankan frontend PDF Editor Suite di Vercel.

Backend API tetap berjalan di Hugging Face Space atau server lain yang Anda pilih. Vercel di sini hanya menjadi host frontend static Vite.

## 1. Prasyarat

- Repository sudah ada di GitHub.
- Backend API sudah aktif, misalnya di Hugging Face Space.
- Anda punya akses ke akun Vercel.

## 2. Environment Variables

Atur di Vercel Project Settings -> Environment Variables:

```env
VITE_API_BASE_URL=https://<username>-pdf-backend.hf.space
```

Jika backend Anda private/gated:

```env
VITE_HF_TOKEN=<hf_token_anda>
```

Catatan:
- `VITE_API_BASE_URL` wajib diisi agar frontend Vercel tahu endpoint backend produksi.
- `VITE_HF_TOKEN` hanya diperlukan jika backend Hugging Face memakai token.

## 3. Buat Project di Vercel

1. Buka Vercel.
2. Pilih `Add New -> Project`.
3. Import repository GitHub `frontend-pdf`.
4. Pastikan framework terdeteksi sebagai Vite.
5. Build command: `npm run build`.
6. Output directory: `dist`.
7. Deploy.

File `vercel.json` di repo ini sudah disiapkan untuk SPA fallback.

## 4. Domain

### Subdomain gratis Vercel

Setelah deploy, Vercel otomatis memberi domain seperti:

```text
https://nama-project.vercel.app
```

### Custom domain

Jika Anda punya domain sendiri:

1. Buka Project -> Settings -> Domains.
2. Tambahkan domain Anda.
3. Ikuti petunjuk DNS dari Vercel.
4. Tunggu propagation DNS selesai.

Saya tidak bisa mendaftarkan domain baru dari sini, tetapi konfigurasi project sudah siap untuk dipasang domain apa pun.

## 5. Checklist Verifikasi

Setelah deploy selesai, cek:

1. Halaman utama terbuka tanpa error.
2. Upload PDF berhasil.
3. Merge/Split/Compress/Convert bisa memanggil backend production.
4. Refresh browser pada route apa pun tetap mengarah ke aplikasi yang sama.

## 6. Troubleshooting Cepat

- Halaman putih / 404 saat refresh:
  - Pastikan `vercel.json` aktif dan rewrite ke `/index.html` tidak dihapus.
- Request API gagal:
  - Pastikan `VITE_API_BASE_URL` benar.
- Backend private menolak request:
  - Isi `VITE_HF_TOKEN` pada environment Vercel.
- File statis lama masih terbaca:
  - Redeploy project setelah update environment variables.
