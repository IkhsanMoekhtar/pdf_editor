# ============================================================
# Dockerfile — PDF backend service dengan hybrid converter
# Target: Hugging Face Spaces (Docker SDK)
# ============================================================

FROM node:20-slim

# Nonaktifkan prompt interaktif saat apt install (penting untuk LibreOffice)
ENV DEBIAN_FRONTEND=noninteractive

# --- System dependencies ---
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
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

COPY . .

# node:20-slim sudah punya user 'node' dengan UID 1000 — tidak perlu membuat user baru
RUN mkdir -p /home/node/.config \
    && chown -R node:node /app \
    && chown -R node:node /opt/venv \
    && chown -R node:node /home/node

USER node

ENV HOME=/home/node
ENV PATH="/opt/venv/bin:$PATH"
ENV LIBREOFFICE_SKIP_LOCK_CHECK=1
ENV DEBIAN_FRONTEND=

EXPOSE 7860
ENV PORT=7860

CMD ["node", "index.js"]