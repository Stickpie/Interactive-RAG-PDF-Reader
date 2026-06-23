# Build from the repository root (MZ07), not from alisa_pdf:
#   docker build -f alisa_pdf/Dockerfile .
#
# Ollama runs on the host by default; from inside the container use host.docker.internal
# (Docker Desktop) or your LAN IP. If needed, extend the app to pass base_url into
# OllamaEmbeddings / ChatOllama, or run Ollama in the same Compose network as this service.

FROM python:3.11-slim

# System deps: PDF/Tesseract (unstructured, simplify), libmagic, OpenCV-ish needs
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    poppler-utils \
    libmagic1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# API and PDF pipeline live here; api.py resolves alisa_v2 as /app/../alisa_v2
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY alisa_pdf/ /app/
COPY alisa_v2/ /alisa_v2/

RUN mkdir -p /alisa_v2/UnparsedText /alisa_v2/ParsedText /alisa_v2/chroma_db

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
