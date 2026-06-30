# ============================================================
# Dockerfile — PDF backend service dengan hybrid converter
# Target: Hugging Face Spaces (Docker SDK)
# ============================================================

FROM node:20-slim

# --- System dependencies ---
# Semua diinstall saat build time agar tidak ada overhead di runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Ghostscript: render PDF ke gambar untuk OCR dan kompresi
    ghostscript \
    # Tesseract OCR + bahasa Indonesia & Inggris
    tesseract-ocr \
    tesseract-ocr-ind \
    tesseract-ocr-eng \
    # poppler-utils: pdfinfo, pdftotext (dipakai sebagai secondary extractor)
    poppler-utils \
    # Python 3 untuk menjalankan hybrid converter script
    python3 \
    python3-pip \
    python3-venv \
    # Font umum agar teks di DOCX tidak hilang
    fonts-liberation \
    fonts-dejavu-core \
    # LibreOffice untuk last-resort fallback (headless, tanpa UI)
    # CATATAN: ini besar (~400MB), tapi sudah ada di image sebelumnya
    # Hapus baris di bawah jika space storage di HF terlalu terbatas
    libreoffice \
    libreoffice-writer \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# --- Python virtual environment & packages ---
# Pakai venv agar tidak conflict dengan system Python
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies untuk hybrid converter
# PyMuPDF versi yang kompatibel dengan pdf2docx (1.23.x atau >= 1.23.16)
RUN pip install --no-cache-dir \
    "PyMuPDF==1.24.14" \
    "pdf2docx==0.5.8" \
    "python-docx==1.1.2" \
    "pdfplumber==0.11.4" \
    "pytesseract==0.3.13" \
    "Pillow==11.1.0"

# Verifikasi instalasi
RUN python3 -c "import fitz; import pdf2docx; import pdfplumber; import pytesseract; print('Python deps OK')"

# --- Node.js app setup ---
WORKDIR /app

# Install Node deps lebih dulu (layer cache lebih efisien)
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Copy hybrid converter ke lokasi yang bisa diakses app
COPY pdftodocx.py /app/pdftodocx.py

# Hugging Face Spaces menjalankan container sebagai user non-root
# Buat user dengan UID 1000 (standar HF)
RUN useradd -m -u 1000 hfuser \
    && chown -R hfuser:hfuser /app \
    && chown -R hfuser:hfuser /opt/venv \
    # LibreOffice butuh home dir yang bisa ditulis
    && mkdir -p /home/hfuser/.config \
    && chown -R hfuser:hfuser /home/hfuser

USER hfuser

ENV HOME=/home/hfuser
ENV PATH="/opt/venv/bin:$PATH"
# Arahkan LibreOffice user installation ke /tmp agar tidak ada permission issue
ENV LIBREOFFICE_SKIP_LOCK_CHECK=1

# HF Spaces expect port 7860
EXPOSE 7860
ENV PORT=7860

CMD ["node", "index.js"]