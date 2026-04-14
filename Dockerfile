FROM node:20-bookworm-slim

WORKDIR /app

# Install conversion engines for production (Ghostscript, qpdf, LibreOffice).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ghostscript qpdf libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server

ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

CMD ["node", "server/index.js"]
