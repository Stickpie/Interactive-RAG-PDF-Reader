# Alisa — Integration Notes

These are the changes made to `alisa_pdf/api.py` and `alisa_pdf/simplify.py` to connect the NLP service with the frontend. The same app also exposes **`POST /simplify-pdf/`** and **`POST /inquire/`** (see repo root `frontend/` and `alisa_v2/`).

---

## What changed

### `/api/simplify` — updated to use chunked simplification

```
POST /api/simplify
```

**Request body:**
```json
{ "text": "The document text to simplify..." }
```

**Response:**
```json
{ "simplified": "...", "confidence": 1.0 }
```

Previously called `simplify_text()` directly, which fed the entire document as a single 512-token BART input. This caused truncation on longer texts and occasional hallucination at the end of the output.

Now calls `simplify_text_chunked()` from `simplify.py`, which splits the input by newlines into paragraphs and simplifies each one independently, then joins the results with `\n\n`. This keeps each BART call well within the token limit and produces much cleaner output.

---

### `/api/ocr` — new endpoint

```
POST /api/ocr
```

**Request:** `multipart/form-data` with a single `file` field (image: JPEG, PNG, etc.)

**Response:**
```json
{ "text": "extracted text..." }
```

Or if nothing was detected:
```json
{ "text": "", "error": "No text detected in image" }
```

Uses `pytesseract.image_to_string()` on the uploaded image. Requires `pytesseract` and `Pillow` in `requirements.txt`.

---

## Running locally

```bash
cd alisa/
uvicorn api:app --host 0.0.0.0 --port 8001
```

Interactive docs at: `http://localhost:8001/docs`

---

## Deployed service

The Docker image is published at:
`https://hub.docker.com/r/jingyiguo01/alisa-api`

Deployed at: `http://184.146.191.73:8001`

> **Note:** The Docker image needs to be rebuilt and redeployed to pick up the chunked simplification and the new `/api/ocr` endpoint. The existing deployment may be running an older version.

---

## Existing endpoint (unchanged)

```
POST /simplify-pdf/
```
Accepts a PDF file upload, returns a simplified PDF. No changes here.

---

## CORS

`CORSMiddleware` is already configured with `allow_origins=["*"]` — no changes needed.
