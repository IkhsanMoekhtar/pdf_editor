# ============================================================
# Dockerfile — PDF backend service dengan hybrid converter
# Target: Hugging Face Spaces (Docker SDK)
# ============================================================

FROM node:20-slim

# --- System dependencies ---
# Komentar TIDAK boleh ada di dalam blok RUN apt-get (merusak parsing).
# Semua package diinstall dalam satu layer agar image lebih kecil.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    tesseract-ocr \
    tesseract-ocr-ind \
    tesseract-ocr-eng \
    poppler-utils \
    python3 \
    python3-pip \
    python3-venv \
    fonts-liberation \
    fonts-dejavu-core \
    libreoffice \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# --- Python virtual environment & packages ---
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir \
    "PyMuPDF==1.24.14" \
    "pdf2docx==0.5.8" \
    "python-docx==1.1.2" \
    "pdfplumber==0.11.4" \
    "pytesseract==0.3.13" \
    "Pillow==11.1.0"

# Verifikasi instalasi Python
RUN python3 -c "import fitz; import pdf2docx; import pdfplumber; import pytesseract; print('Python deps OK')"

# --- Node.js app setup ---
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Copy semua source code (termasuk pdftodocx.py)
COPY . .

# Hugging Face Spaces menjalankan container sebagai user non-root (UID 1000)
RUN useradd -m -u 1000 hfuser \
    && chown -R hfuser:hfuser /app \
    && chown -R hfuser:hfuser /opt/venv \
    && mkdir -p /home/hfuser/.config \
    && chown -R hfuser:hfuser /home/hfuser

USER hfuser

ENV HOME=/home/hfuser
ENV PATH="/opt/venv/bin:$PATH"
ENV LIBREOFFICE_SKIP_LOCK_CHECK=1

EXPOSE 7860
ENV PORT=7860

CMD ["node", "index.js"]