import os

import pymupdf as fitz
from unstructured.partition.text import partition_text

_ROOT = os.path.dirname(os.path.abspath(__file__))
PARSED_DIR = os.path.join(_ROOT, "ParsedText")


def extract_with_pymupdf(filename: str) -> str:
    doc = fitz.open(filename)
    page_texts = []

    for page_num, page in enumerate(doc, start=1):
        text = page.get_text("text", sort=True)

        if text.strip():
            page_texts.append(f"--- Page {page_num} ---\n{text}")

    doc.close()
    return "\n\n".join(page_texts)


def normalize_pdf(filename: str):
    raw_text = extract_with_pymupdf(filename)
    elements = partition_text(text=raw_text)
    return raw_text, elements


def parse_text(filename: str) -> str:
    """Extract text from a PDF into ParsedText/ (raw + unstructured). Returns path to raw .txt."""
    base_name = os.path.splitext(os.path.basename(filename))[0]
    raw_text, elements = normalize_pdf(filename)

    os.makedirs(PARSED_DIR, exist_ok=True)

    raw_path = os.path.join(PARSED_DIR, f"{base_name}.txt")
    unstructured_path = os.path.join(PARSED_DIR, f"{base_name}_unstructured.txt")

    with open(raw_path, "w", encoding="utf-8") as f:
        f.write(raw_text)

    with open(unstructured_path, "w", encoding="utf-8") as f:
        for el in elements:
            f.write(f"[{type(el).__name__}] {str(el)}\n\n")

    return raw_path
