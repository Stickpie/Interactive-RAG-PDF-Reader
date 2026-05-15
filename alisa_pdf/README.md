# Alisa — NLP Simplification Service

FastAPI service that simplifies text using a fine-tuned BART model and extracts text from images using OCR.

## How to Run

```bash
cd alisa_pdf/
pip install -r requirements.txt
uvicorn api:app --host 0.0.0.0 --port 8000
```

Interactive API docs at: `http://localhost:8000/docs`

### PDF + RAG (main app flow)

- **`POST /simplify-pdf/`** — upload a PDF, get a simplified PDF back; also parses text into `alisa_v2/ParsedText` and updates Chroma when configured.
- **`POST /inquire/`** — JSON `{ "segment", "question" }` for highlight-based Q&A (see `frontend/` and `alisa_v2/query_data.py`).

## Endpoints

### `POST /api/simplify`
Takes plain text and returns a simplified version.

**Request:**
```json
{ "text": "The document text to simplify..." }
```

**Response:**
```json
{ "simplified": "...", "confidence": 1.0 }
```

The text is split into paragraphs first, each paragraph is simplified independently, then the results are joined. This avoids the 512-token input limit on the BART model — feeding a full multi-paragraph document as one input causes truncation and repeated output.

### `POST /api/ocr`
Takes an image upload and returns the extracted text.

**Request:** `multipart/form-data` with a `file` field (JPEG, PNG, etc.)

**Response:**
```json
{ "text": "extracted text..." }
```

Uses pytesseract. Works well for clean printed text. Struggles with complex layouts (tables, mixed fonts).

### `POST /simplify-pdf/`
Original endpoint — accepts a PDF upload, returns a simplified PDF. Unchanged.

## Model

`elvisbakunzi/dyslexia-friendly-text-simplifier` (BART fine-tuned for dyslexia-friendly simplification)

Downloaded from HuggingFace on first run (~533 MB). Requires a HuggingFace token for full download speed — without it the download rate-limits to ~128 KB/s.

Auto-detects device: MPS (Apple Silicon) → CUDA (GPU) → CPU.

## Changes Made by Waleed (Student D)

The original `api.py` only had the `/simplify-pdf/` PDF endpoint. The following were added to support the mobile app:

**`simplify.py`** — added `simplify_text_chunked(text)`:
- Splits input by `\n` into paragraphs
- Calls `simplify_text()` on each paragraph independently
- Joins results with `\n\n`
- Replaces the old single-input approach to avoid BART truncation on long documents

**`api.py`** — two additions:
- `/api/simplify` endpoint: accepts JSON `{ text }`, calls `simplify_text_chunked()`, returns `{ simplified, confidence }`
- `/api/ocr` endpoint: accepts image file upload, runs pytesseract, returns `{ text }`
- Added `CORSMiddleware` with `allow_origins=["*"]` so the mobile app can reach the API from any origin

## Deployed

Docker image: `https://hub.docker.com/r/jingyiguo01/alisa-api`

Deployed at: `http://184.146.191.73:8001`

> The deployed image needs to be rebuilt to include the chunked simplification and `/api/ocr` endpoint. Run locally for now.
