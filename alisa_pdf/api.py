from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.background import BackgroundTask
import io
import json
import re
import shutil
import os
import sys
import tempfile
import traceback
import uuid

import pytesseract
from PIL import Image

from simplify import normalize_pdf, simplify_text_chunked
from remakePDF import export_to_pdf

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://192.168.12.5:8080",
    "http://192.168.12.10:8000",
    "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Stored-Stem"],
)

BASE_FOLDER = os.path.dirname(os.path.abspath(__file__))
ALISA_V2 = os.path.abspath(os.path.join(BASE_FOLDER, "..", "alisa_v2"))
UNPARSED_DIR = os.path.abspath(os.path.join(ALISA_V2, "UnparsedText"))
PARSED_DIR = os.path.abspath(os.path.join(ALISA_V2, "ParsedText"))
CHROMA_PATH = os.path.abspath(os.path.join(ALISA_V2, "chroma_db"))
INQUIRE_STATE_PATH = os.path.join(ALISA_V2, "inquire_state.json")

# Stored PDF basename without extension: 32-hex uuid + underscore + original name (no path chars).
STORED_STEM_RE = re.compile(r"^[a-f0-9]{32}_[^\\/:*?\"<>|]+$", re.IGNORECASE)


class TextRequest(BaseModel):
    text: str


class InquireBody(BaseModel):
    segment: str = ""
    question: str


def _stored_upload_path(original_filename: str) -> str:
    base = os.path.basename(original_filename).strip() or "upload.pdf"
    if not base.lower().endswith(".pdf"):
        base = base + ".pdf"
    safe = f"{uuid.uuid4().hex}_{base}"
    return os.path.join(UNPARSED_DIR, safe)


@app.get("/")
async def root():
    return {"message": "API is running. Open /docs to test PDF upload."}

def cleanup_files(*paths):
    for path in paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
        except Exception:
            pass


def _delete_chroma_chunks_for_source(parsed_txt_path: str) -> None:
    """Remove Chroma chunks whose document source matches the given ParsedText .txt path."""
    try:
        sys.path.insert(0, ALISA_V2)
        from get_embedding_function import get_embedding_function
        from langchain_chroma import Chroma

        if not os.path.exists(CHROMA_PATH):
            return

        target = os.path.normcase(os.path.abspath(parsed_txt_path))
        db = Chroma(
            persist_directory=CHROMA_PATH,
            embedding_function=get_embedding_function(),
        )
        batch = db.get(include=["metadatas"])
        ids = batch.get("ids") or []
        metas = batch.get("metadatas") or []
        to_delete = []
        for doc_id, meta in zip(ids, metas):
            if not meta:
                continue
            src = meta.get("source")
            if not src:
                continue
            if os.path.normcase(os.path.abspath(str(src))) == target:
                to_delete.append(doc_id)
        if to_delete:
            db.delete(ids=to_delete)
    except Exception:
        traceback.print_exc()


@app.delete("/library-document/{stem}")
async def delete_library_document(stem: str):
    """
    Delete server-side unparsed PDF, ParsedText pair, and matching Chroma chunks for one upload.
    `stem` is the basename without extension under UnparsedText/ (see X-Stored-Stem on simplify-pdf).
    """
    if not STORED_STEM_RE.match(stem):
        raise HTTPException(status_code=400, detail="Invalid document stem.")

    unparsed_pdf = os.path.join(UNPARSED_DIR, stem + ".pdf")
    parsed_txt = os.path.join(PARSED_DIR, stem + ".txt")
    parsed_unstructured = os.path.join(PARSED_DIR, stem + "_unstructured.txt")

    had_any = (
        os.path.isfile(unparsed_pdf)
        or os.path.isfile(parsed_txt)
        or os.path.isfile(parsed_unstructured)
    )

    _delete_chroma_chunks_for_source(parsed_txt)

    cleanup_files(unparsed_pdf, parsed_txt, parsed_unstructured)

    return JSONResponse(
        {
            "ok": True,
            "stem": stem,
            "note": "Files removed if present; Chroma entries removed by source match.",
            "had_files": had_any,
        }
    )


@app.post("/simplify-pdf/")
async def simplify_pdf(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF.")

    input_fd = None
    output_fd = None
    input_path = None
    output_path = None

    try:
        input_fd, input_path = tempfile.mkstemp(suffix=".pdf", dir=BASE_FOLDER)
        output_fd, output_path = tempfile.mkstemp(suffix=".pdf", dir=BASE_FOLDER)

        os.close(input_fd)
        os.close(output_fd)

        # Save uploaded file
        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        os.makedirs(UNPARSED_DIR, exist_ok=True)
        stored_path = _stored_upload_path(file.filename)
        shutil.copy2(input_path, stored_path)

        elements = normalize_pdf(input_path)
        export_to_pdf(elements, output_path)

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            raise HTTPException(status_code=500, detail="Output PDF was not created correctly.")

        try:
            sys.path.insert(0, ALISA_V2)
            from parse_text import parse_text as parse_text
            from populate_chroma import load_documents, split_documents, add_to_chroma

            parse_text(stored_path)
            documents = load_documents()
            if documents:
                chunks = split_documents(documents)
                add_to_chroma(chunks)
        except Exception as e:
            print("Parse / Chroma ingest after simplify failed:")
            traceback.print_exc()
            print(e)

        stored_stem = os.path.splitext(os.path.basename(stored_path))[0]
        response = FileResponse(
            path=output_path,
            filename="simplified_output.pdf",
            media_type="application/pdf",
            background=BackgroundTask(cleanup_files, input_path, output_path),
        )
        response.headers["X-Stored-Stem"] = stored_stem
        return response

    except HTTPException:
        cleanup_files(input_path, output_path)
        raise

    except Exception as e:
        cleanup_files(input_path, output_path)
        print("ERROR in /simplify-pdf/:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error while processing PDF: {str(e)}")

    finally:
        await file.close()


@app.post("/inquire/")
async def inquire(body: InquireBody):
    if not body.question or not body.question.strip():
        raise HTTPException(status_code=400, detail="Question is required.")

    os.makedirs(ALISA_V2, exist_ok=True)
    with open(INQUIRE_STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(
            {"segment": body.segment or "", "question": body.question.strip()},
            f,
            ensure_ascii=False,
        )

    try:
        sys.path.insert(0, ALISA_V2)
        from query_data import run_inquire_from_state_file

        answer = run_inquire_from_state_file()
        return JSONResponse({"answer": answer})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Inquire failed: {str(e)}",
        )
