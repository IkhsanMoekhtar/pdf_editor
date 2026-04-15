# Vercel Deploy Guide

Panduan ini untuk menjalankan frontend PDF Editor Suite di Vercel.

Backend API tetap berjalan di Hugging Face Space atau server lain yang Anda pilih. Vercel di sini hanya menjadi host frontend static Vite.

## 1. Prasyarat

- Repository sudah ada di GitHub.
- Backend API sudah aktif, misalnya di Hugging Face Space.
- Anda punya akses ke akun Vercel.

### Pastikan repo GitHub siap diimpor

Sebelum buka Vercel, pastikan hal berikut:

1. Project sudah di-commit dan push ke branch utama GitHub, biasanya `main`.
2. Repository berisi file root berikut:
  - `package.json`
  - `vite.config.js`
  - `vercel.json`
  - `src/`
3. Kalau repo private, akun Vercel harus diberi akses ke repository tersebut saat import.
4. Jika ada branch deploy khusus, pilih branch yang benar saat membuat project di Vercel.

Sebelum deploy, pastikan project lokal bisa dibangun:

```bash
npm run build
```

Jika build lokal gagal, selesaikan dulu sebelum lanjut ke Vercel.

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
- Jika backend membalas error `Origin tidak diizinkan oleh konfigurasi CORS.`, berarti origin Vercel Anda belum dimasukkan ke `CORS_ORIGINS` di backend.

Langkah kliknya di Vercel:

1. Buka project Anda di Vercel.
2. Masuk ke `Settings`.
3. Pilih `Environment Variables`.
4. Tambahkan `VITE_API_BASE_URL`.
5. Jika backend private, tambahkan `VITE_HF_TOKEN`.
6. Simpan perubahan.
7. Redeploy project supaya env baru dipakai.

Kalau masih kena CORS, periksa juga environment backend Hugging Face dan pastikan `CORS_ORIGINS` berisi domain frontend Vercel Anda, misalnya:

```env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://pdf-editor-delta-ten.vercel.app
```

Setelah mengubah `CORS_ORIGINS`, restart atau redeploy backend Space agar env baru terbaca.

## 3. Buat Project di Vercel

1. Buka https://vercel.com dan login.
2. Klik `Add New` lalu pilih `Project`.
3. Pada halaman import, hubungkan akun GitHub Anda jika belum tersambung.
4. Pilih repository `frontend-pdf`.
5. Jika repo tidak muncul, buka pengaturan GitHub App Vercel dan pastikan repo ini diizinkan.
6. Pilih branch yang akan dideploy, biasanya `main`.
7. Pastikan framework terdeteksi sebagai Vite.
8. Jika perlu, set `Build Command` ke `npm run build`.
9. Set `Output Directory` ke `dist`.
10. Klik `Deploy`.
11. Tunggu sampai status build menjadi `Ready`.

File `vercel.json` di repo ini sudah disiapkan untuk SPA fallback.

Kalau Vercel menawarkan pengaturan tambahan yang tidak relevan, biarkan default saja.

Jika Anda ingin cek hasil build secara lokal sebelum deploy, gunakan:

```bash
npm run preview
```

## 4. Domain

### Subdomain gratis Vercel

Setelah deploy, Vercel otomatis memberi domain seperti:

```text
https://nama-project.vercel.app
```

### Custom domain

Jika Anda punya domain sendiri:

1. Buka project yang sudah dideploy.
2. Klik `Settings`.
3. Pilih `Domains`.
4. Tambahkan domain Anda.
5. Ikuti petunjuk DNS dari Vercel.
6. Tunggu propagation DNS selesai sampai domain berstatus valid.

Saya tidak bisa mendaftarkan domain baru dari sini, tetapi konfigurasi project sudah siap untuk dipasang domain apa pun.

### Kalau repo Anda private

Saat import project, Vercel biasanya akan meminta izin akses ke repository private. Berikan akses ke repo `frontend-pdf`, lalu lanjutkan deployment seperti biasa.

### Kalau belum punya domain

Pakai domain gratis Vercel dulu, misalnya `https://nama-project.vercel.app`.

## 5. Checklist Verifikasi

Setelah deploy selesai, cek:

1. Halaman utama terbuka tanpa error.
2. Upload PDF berhasil.
3. Merge/Split/Compress/Convert bisa memanggil backend production.
4. Refresh browser pada route apa pun tetap mengarah ke aplikasi yang sama.

Tambahan pengecekan cepat kalau ada masalah:

- `VITE_API_BASE_URL` harus mengarah ke backend aktif.
- Jika backend private, `VITE_HF_TOKEN` harus diisi.
- Jika request API ditolak, pastikan backend mengizinkan domain Vercel Anda di `CORS_ORIGINS`.

## 6. Troubleshooting Cepat

- Halaman putih / 404 saat refresh:
  - Pastikan `vercel.json` aktif dan rewrite ke `/index.html` tidak dihapus.
- Request API gagal:
  - Pastikan `VITE_API_BASE_URL` benar.
- Backend private menolak request:
  - Isi `VITE_HF_TOKEN` pada environment Vercel.
- File statis lama masih terbaca:
  - Redeploy project setelah update environment variables.
- Domain custom belum aktif:
  - Periksa DNS sesuai instruksi Vercel dan tunggu propagasi.
