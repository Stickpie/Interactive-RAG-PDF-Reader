# Dyslexia-Friendly PDF Reader

This is a reading assistant that simplifies academic PDFs into dyslexia-friendly language, keeps a personal document library in the browser, and answers questions about highlighted passages using retrieval-augmented generation (RAG).

The stack is split into a static web frontend (`alisa_frontend_demo/`), a FastAPI backend (`alisa_pdf/`), and a RAG pipeline (`alisa_v2/`).

---

## What the application does

1. **Upload and organize PDFs** — Users upload PDFs into named folders. The sidebar library survives page reloads.
2. **Simplify PDFs** — The backend extracts text from each page, runs it through a Hugging Face BART model tuned for dyslexia-friendly simplification, and returns a new PDF with simplified wording while preserving layout where possible.
3. **View original vs. simplified** — PDF.js renders either version in the main viewer; users can switch between them.
4. **Ask about a passage (Inquire)** — Users select text in the viewer, ask a question, and receive an answer grounded in the document via ChromaDB + Ollama.
5. **Delete documents** — Removing a PDF from the library clears local blobs and, when linked, deletes the server copy plus matching Chroma chunks.

---

## Features

| Feature | Description |
|--------|-------------|
| Folder library | Group PDFs under user-created folders (e.g. Math, English). |
| Persistent library metadata | Folder names, PDF titles, selection state, and server **stem** IDs survive reloads. |
| Local PDF storage | Original and simplified PDF bytes are stored in the browser (IndexedDB), not on the server disk for every read. |
| Server-side ingest | After simplification, the backend stores the upload, parses text, and indexes chunks in ChromaDB for Q&A. |
| Highlight-to-inquire | Text selection opens a modal; questions are sent to `POST /inquire/`. |
| Library cleanup | `DELETE /library-document/{stem}` removes unparsed PDF, parsed text files, and Chroma entries for that upload. |

---

## Frontend architecture

**Location:** `alisa_frontend_demo/index.html` (single-page app, no build step).

**PDF rendering:** [PDF.js](https://mozilla.github.io/pdf.js/) draws pages to canvas and overlays a selectable text layer for highlight-based inquire.

### Three layers of client-side state

```
┌─────────────────────────────────────────────────────────────┐
│  localStorage  ("pdfSimplifierLibraryV1")                   │
│  • folders (id, name)                                       │
│  • pdfs (id, folderId, displayName, storedStem)             │
│  • selectedFolderId, selectedPdfId                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │  storedStem links metadata → server
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  IndexedDB  ("pdfSimplifierIDB" / store "pdfBlobs")         │
│  • key: pdfId (client UUID)                                 │
│  • value: { original: Blob, simplified: Blob | null }       │
└─────────────────────────────────────────────────────────────┘
                              │
                              │  X-Stored-Stem response header
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Server stem  (under alisa_v2/UnparsedText & ParsedText)    │
│  • format: {32-hex-uuid}_{original-filename}.pdf            │
│  • returned as X-Stored-Stem after POST /simplify-pdf/      │
└─────────────────────────────────────────────────────────────┘
```

- **localStorage** holds lightweight JSON only (no binary PDF data). It is fast to read on load and drives the sidebar.
- **IndexedDB** stores the actual PDF blobs so large files do not blow the `localStorage` quota (~5 MB). When a user reopens a saved document, blobs are read from IndexedDB and turned into object URLs for PDF.js.
- **Stem** is the server-side basename (without `.pdf`) for that upload. The frontend saves it on `library.pdfs[].storedStem` after simplification so deletes can call `DELETE /library-document/{stem}` and remove matching files and vectors on the server.

The frontend talks to the API at `http://127.0.0.1:8000` (see `API_BASE` in `index.html`).

---

## Backend architecture

```
  Browser
     │
     ├─ POST /simplify-pdf/  ──►  unstructured (PDF partition)
     │                              │
     │                              ▼
     │                         Hugging Face BART
     │                         elvisbakunzi/dyslexia-friendly-text-simplifier
     │                              │
     │                              ▼
     │                         remakePDF → simplified PDF bytes
     │                              │
     │                              ├─► copy to alisa_v2/UnparsedText/{stem}.pdf
     │                              ├─► parse_text → ParsedText/{stem}.txt
     │                              └─► populate_chroma → chroma_db/
     │
     └─ POST /inquire/  ──►  inquire_state.json
                                │
                                ▼
                           query_data.py
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
              ChromaDB                  Ollama
         (nomic-embed-text)      (qwen2.5:7b-instruct)
         similarity search       answer with context + segment
```

### Hugging Face — dyslexia simplification

- **Model:** [`elvisbakunzi/dyslexia-friendly-text-simplifier`](https://huggingface.co/elvisbakunzi/dyslexia-friendly-text-simplifier) (BART).
- **Code:** `alisa_pdf/simplify.py` — `simplify_text_chunked()` splits text by paragraph so each BART call stays within the tokenizer limit, then joins results.
- **Device:** Auto-selects MPS (Apple Silicon) → CUDA → CPU.
- **First run:** Weights download from Hugging Face (~533 MB). A Hugging Face token can improve download speed.

### ChromaDB — document index

- **Path:** `alisa_v2/chroma_db/`
- **Ingest:** After each successful `POST /simplify-pdf/`, `parse_text` writes `.txt` files under `ParsedText/`, then `populate_chroma` chunks and embeds them.
- **Embeddings:** Ollama `nomic-embed-text` via `get_embedding_function.py` (ingest) and `query_data.py` (inquire).
- **Cleanup:** `DELETE /library-document/{stem}` removes chunks whose metadata `source` matches the parsed `.txt` path.

### Ollama — RAG answers

- **Chat model:** `qwen2.5:7b-instruct` — generates answers from retrieved chunks and the user’s highlighted segment.
- **Embedding model:** `nomic-embed-text` — used for similarity search over ingested chunks.
- Ollama must be installed and running locally with both models pulled before inquire works.

---

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Health check |
| `POST` | `/simplify-pdf/` | Upload PDF; returns simplified PDF. Response header `X-Stored-Stem` identifies the server copy. |
| `POST` | `/inquire/` | JSON `{ "segment", "question" }` → `{ "answer" }` |
| `DELETE` | `/library-document/{stem}` | Remove server PDF, parsed text, and Chroma chunks for one upload |

Interactive docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) (when the server is running).

---

## Running on localhost

The app is intended for **local development only** for now. Deployment to a home server on the public internet is planned later.

### Prerequisites

- **Python 3.10+**
- **Ollama** with models:
  ```bash
  ollama pull nomic-embed-text
  ollama pull qwen2.5:7b-instruct
  ```
- **Tesseract** (optional; used if you extend OCR flows) — install system `tesseract` if using `pytesseract`.
- Enough disk/RAM for the BART model and Chroma index.

### 1. Install dependencies

From the **repository root** (`MZ07/`):

```bash
pip install -r alisa_pdf/requirements.txt
pip install -r alisa_v2/requirements.txt
```

### 2. Start Ollama

Ensure the Ollama daemon is running (e.g. Ollama desktop app or `ollama serve`).

### 3. Start the API

From the **repository root**:

```bash
uvicorn api:app --app-dir alisa_pdf --reload
```

Default URL: [http://127.0.0.1:8000](http://127.0.0.1:8000)

The first PDF simplification may take extra time while the Hugging Face model downloads.

### 4. Open the frontend

Open `alisa_frontend_demo/index.html` in a browser (double-click or “Open with” your browser).

If the browser blocks requests from `file://` to `http://127.0.0.1:8000`, serve the folder instead:

```bash
# Python 3
cd alisa_frontend_demo
python -m http.server 5500
```

Then visit [http://127.0.0.1:5500](http://127.0.0.1:5500) and confirm `API_BASE` in `index.html` still points to `http://127.0.0.1:8000`.

### 5. Typical workflow

1. Add a folder (sidebar **+**).
2. Upload a PDF.
3. Click **Simplify** — wait for the simplified PDF and server ingest.
4. Toggle **Original** / **Simplified**.
5. Highlight text → ask a question in the inquire modal.

---

## Project layout

```
MZ07/
├── alisa_frontend_demo/
│   └── index.html          # SPA: library UI, PDF.js, inquire modal
├── alisa_pdf/
│   ├── api.py              # FastAPI app
│   ├── simplify.py         # BART simplification
│   ├── remakePDF.py        # Rebuild PDF from simplified elements
│   └── requirements.txt
└── alisa_v2/
    ├── parse_text.py       # PDF → ParsedText/*.txt
    ├── populate_chroma.py  # Chunk + embed into Chroma
    ├── query_data.py       # RAG inquire (Ollama + Chroma)
    ├── get_embedding_function.py
    ├── UnparsedText/       # Stored uploads ({stem}.pdf)
    ├── ParsedText/         # Extracted text per stem
    ├── chroma_db/          # Vector store (generated)
    └── requirements.txt
```

---

## Deployment (planned)

This project will eventually run on a **home server** exposed to the internet. Until then, use the localhost instructions above. When deploying, you will need to:

- Point the frontend `API_BASE` at the public API URL.
- Run uvicorn (or a reverse proxy) with appropriate host/port and TLS.
- Ensure Ollama, Chroma persistence, and model weights are available on the server.
- Revisit CORS and authentication (currently `allow_origins=["*"]` for local dev).
