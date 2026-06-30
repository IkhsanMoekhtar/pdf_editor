---
title: PDF Backend Service
emoji: 📄
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Hybrid PDF → Word Converter


Modifikasi pipeline konversi PDF → Word untuk hasil semaksimal mungkin,
100% self-hosted, tanpa API eksternal, kompatibel dengan Hugging Face Spaces.

---

## Arsitektur

```
PDF input
    │
    ▼
[Stage 1] Analisis otomatis
    │  • deteksi text-based vs scanned vs hybrid
    │  • deteksi tabel & layout multi-kolom
    │  • hitung text density
    │
    ├─── text-based ──────────────────────► [pdf2docx]
    │                                           │  PyMuPDF + python-docx
    │                                           │  layout-aware, kolom, tabel
    │                                           │
    │                                     [pdfplumber enhance]
    │                                           │  tambah tabel yang terlewat
    │
    └─── scanned / gambar ───────────────► [Tesseract OCR]
                                                │  Ghostscript render 300 DPI
                                                │  psm 3 auto layout detection
                                                │  ind+eng language pack

    ▼
[Stage 4] Quality check
    │  confidence score 0-1
    │
    ├─── confidence ≥ 0.60 ──────────────► DOCX output ✅
    │
    └─── confidence < 0.60 ──────────────► LibreOffice fallback
                                           (safety net, tetap ada)
```

---

## File yang disertakan

| File | Fungsi |
|------|--------|
| `pdftodocx.py` | Python converter script (4-stage pipeline) |
| `Dockerfile` | Dockerfile backend referensi untuk build dari folder `server/` |
| `index.js.patch` | Referensi patch lama; runtime sekarang sudah memakai implementasi langsung |

---

## Cara Apply (step by step)

### 1. Salin file Python ke root project

```bash
cp pdftodocx.py /path/ke/project/server/
```

### 2. Gantikan Dockerfile

```bash
cp Dockerfile /path/ke/project/server/Dockerfile
```

### 3. Modifikasi `index.js`

Buka `index.js` dan lakukan 3 perubahan berikut:

#### A. Tambah imports (di atas baris `const app = express();`)

```js
import { execFile } from 'node:child_process';

const PYTHON_CMD = process.env.PYTHON_CMD || '/opt/venv/bin/python3';
const HYBRID_CONVERTER_SCRIPT = path.join(serverRootDir, 'pdftodocx.py');
const OCR_LANG = process.env.OCR_LANG || 'ind+eng';
const PYTHON_CONVERTER_TIMEOUT_MS = Number(process.env.PYTHON_CONVERTER_TIMEOUT_MS || 120_000);
```

#### B. Tambah fungsi baru (setelah fungsi `convertOfficeDirect()`)

Copy-paste blok **BAGIAN B** dari file `index.js.patch`:
- `isHybridConverterAvailable()`
- `runHybridConverter()`

#### C. Ganti blok konversi Word di route `/api/convert`

Cari blok ini (sekitar baris 1400):
```js
} else {
  const libreOfficeCommand = await getLibreOfficeCommand();
  ...
  const officeConversionPlan = { word: { ... }, ppt: { ... }, excel: { ... } };
  ...
  method = `libreoffice:${libreOfficeCommand}`;
  conversionSource = 'pdf';
  conversionTarget = target;
}
```

Ganti seluruh blok `} else { ... }` tersebut dengan blok **BAGIAN C**
dari file `index.js.patch`.

### 4. Optional: Tambah monitoring di `/api/health`

Di dalam `res.json({...})` route GET `/api/health`, tambahkan:
```js
hybridConverterAvailable: await isHybridConverterAvailable(),
```

---

## Environment Variables

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `PYTHON_CMD` | `/opt/venv/bin/python3` | Path ke Python di venv |
| `OCR_LANG` | `ind+eng` | Bahasa Tesseract. Lihat daftar: `tesseract --list-langs` |
| `PYTHON_CONVERTER_TIMEOUT_MS` | `120000` | Timeout konversi (ms). Naikkan untuk PDF besar |

---

## Response Headers Baru

Setelah patch, response `/api/convert` untuk target Word akan menyertakan:

| Header | Contoh nilai | Keterangan |
|--------|-------------|------------|
| `X-Hybrid-Confidence` | `0.82` | Skor kepercayaan konversi (0-1) |
| `X-Hybrid-Method` | `pdf2docx` | Engine yang dipakai |
| `X-Pdf-Is-Scanned` | `false` | Apakah PDF terdeteksi sebagai scan |
| `X-Pdf-Has-Tables` | `true` | Apakah PDF mengandung tabel |
| `X-Conversion-Method` | `hybrid:pdf2docx` | Method akhir |

---

## Batasan yang perlu diketahui

1. **pdf2docx maksimal 2 kolom per section** — PDF dengan 3+ kolom
   akan di-konversi dengan layout yang disederhanakan.

2. **OCR tidak sempurna untuk PDF scan berkualitas rendah** — Confidence
   akan rendah dan LibreOffice fallback akan aktif secara otomatis.

3. **Font proprietary (Arial, Times New Roman) mungkin di-substitute**
   di Hugging Face Spaces karena license. Pakai `fonts-liberation` sebagai
   pengganti open source.

4. **Build time lebih lama** — LibreOffice + Tesseract + Python deps
   menambah ~500MB ke image. Wajar untuk Docker Spaces.

5. **PPT dan Excel tetap via LibreOffice** — pdf2docx hanya support
   konversi ke DOCX. Untuk PPT/Excel, LibreOffice tetap satu-satunya pilihan
   open source yang feasible.

---

## Ekspektasi kualitas output

| Jenis PDF | Engine | Ekspektasi |
|-----------|--------|-----------|
| Resume / CV teks murni | pdf2docx | ⭐⭐⭐⭐ Font, spasi, alignment dipertahankan |
| Dokumen teks 1 kolom | pdf2docx | ⭐⭐⭐⭐ |
| Dokumen 2 kolom | pdf2docx | ⭐⭐⭐ Layout kolom dipertahankan |
| Dokumen dengan tabel | pdf2docx + pdfplumber | ⭐⭐⭐ Tabel terbaca, border mungkin beda |
| PDF scan foto | Tesseract OCR | ⭐⭐ Teks terbaca, layout tidak dipertahankan |
| PDF dengan 3+ kolom kompleks | LibreOffice fallback | ⭐⭐ |
| PDF dengan gambar vektor kompleks | pdf2docx | ⭐⭐⭐ Gambar di-embed sebagai PNG |