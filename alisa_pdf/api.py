from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.background import BackgroundTask
import io
import json
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_FOLDER = os.path.dirname(os.path.abspath(__file__))
ALISA_V2 = os.path.abspath(os.path.join(BASE_FOLDER, "..", "alisa_v2"))
UNPARSED_DIR = os.path.abspath(os.path.join(ALISA_V2, "UnparsedText"))
INQUIRE_STATE_PATH = os.path.join(ALISA_V2, "inquire_state.json")


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


@app.post("/api/simplify")
async def simplify_text_endpoint(req: TextRequest):
    simplified = simplify_text_chunked(req.text)
    return {"simplified": simplified, "confidence": 1.0}


@app.post("/api/ocr")
async def ocr_image(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    text = pytesseract.image_to_string(image)
    if not text.strip():
        return {"text": "", "error": "No text detected in image"}
    return {"text": text.strip()}


def cleanup_files(*paths):
    for path in paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
        except Exception:
            pass


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
            from parse_text import parse_text as parse_pdf_to_parsed_text
            from populate_chroma import load_documents, split_documents, add_to_chroma

            parse_pdf_to_parsed_text(stored_path)
            documents = load_documents()
            if documents:
                chunks = split_documents(documents)
                add_to_chroma(chunks)
        except Exception as e:
            print("Parse / Chroma ingest after simplify failed:")
            traceback.print_exc()
            print(e)

        return FileResponse(
            path=output_path,
            filename="simplified_output.pdf",
            media_type="application/pdf",
            background=BackgroundTask(cleanup_files, input_path, output_path),
        )

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
