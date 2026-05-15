"""
Measure simplification quality: for each PDF in ../TestFiles, run normalize_pdf +
export_to_pdf (same as production), then compare extracted text from original vs
simplified using lexical overlap (ROUGE), length ratios, and readability (Flesch).

Run from repo root or alisa_pdf:
  python alisa_pdf/outputAccuracy.py
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

# Project paths
_ALISA_PDF = Path(__file__).resolve().parent
_REPO_ROOT = _ALISA_PDF.parent
_TEST_FILES = _REPO_ROOT / "TestFiles"

sys.path.insert(0, str(_ALISA_PDF))

import pymupdf as fitz
import textstat
from rouge_score import rouge_scorer

from simplify import normalize_pdf
from remakePDF import export_to_pdf


def document_category(filename: str) -> str:
    """Map TestFiles names to the three document types in the folder."""
    lower = filename.lower()
    if "labmanual" in lower or "lab_manual" in lower:
        return "Lab manual"
    if "microimm" in lower:
        return "Microbiology / immunology"
    if "dmz" in lower:
        return "DMZ / networking"
    return "Other"


def extract_text_pdf(path: Path) -> str:
    doc = fitz.open(path)
    parts = []
    for page in doc:
        t = page.get_text("text", sort=True)
        if t.strip():
            parts.append(t)
    doc.close()
    return "\n\n".join(parts).strip()


def normalize_for_rouge(text: str) -> str:
    return " ".join(text.split())


def run_metrics(original: str, simplified: str) -> dict:
    ref = normalize_for_rouge(original)
    hyp = normalize_for_rouge(simplified)
    out: dict = {
        "rouge1_f1": None,
        "rouge2_f1": None,
        "rougeL_f1": None,
        "word_ratio": None,
        "char_ratio": None,
        "flesch_orig": None,
        "flesch_simp": None,
        "flesch_delta": None,
    }
    if not ref or not hyp:
        return out

    scorer = rouge_scorer.RougeScorer(
        ["rouge1", "rouge2", "rougeL"], use_stemmer=True
    )
    # Reference = original, hypothesis = simplified (lexical overlap after rewrite)
    scores = scorer.score(ref, hyp)
    out["rouge1_f1"] = scores["rouge1"].fmeasure
    out["rouge2_f1"] = scores["rouge2"].fmeasure
    out["rougeL_f1"] = scores["rougeL"].fmeasure

    w_o = len(ref.split())
    w_s = len(hyp.split())
    c_o = len(ref)
    c_s = len(hyp)
    out["word_ratio"] = (w_s / w_o) if w_o else None
    out["char_ratio"] = (c_s / c_o) if c_o else None

    try:
        fo = textstat.flesch_reading_ease(ref)
        fs = textstat.flesch_reading_ease(hyp)
        out["flesch_orig"] = fo
        out["flesch_simp"] = fs
        out["flesch_delta"] = fs - fo
    except Exception:
        pass

    return out


def fmt(x: float | None, nd: int = 3) -> str:
    if x is None:
        return "—"
    return f"{x:.{nd}f}"


def main() -> None:
    if not _TEST_FILES.is_dir():
        print(f"TestFiles folder not found: {_TEST_FILES}", file=sys.stderr)
        sys.exit(1)

    pdfs = sorted(_TEST_FILES.glob("*.pdf"))
    if not pdfs:
        print(f"No PDFs in {_TEST_FILES}", file=sys.stderr)
        sys.exit(1)

    rows: list[list[str]] = []
    headers = [
        "Document type",
        "File",
        "ROUGE-1 F1",
        "ROUGE-2 F1",
        "ROUGE-L F1",
        "Word ratio (simp/orig)",
        "Char ratio (simp/orig)",
        "Flesch (orig)",
        "Flesch (simp)",
        "Δ Flesch",
    ]

    for pdf_path in pdfs:
        cat = document_category(pdf_path.name)
        err = ""
        try:
            elements = normalize_pdf(str(pdf_path))
            with tempfile.NamedTemporaryFile(
                suffix=".pdf", delete=False, dir=_ALISA_PDF
            ) as tmp:
                out_path = tmp.name
            try:
                export_to_pdf(elements, out_path)
                orig_text = extract_text_pdf(pdf_path)
                simp_text = extract_text_pdf(Path(out_path))
                m = run_metrics(orig_text, simp_text)
                rows.append(
                    [
                        cat,
                        pdf_path.name,
                        fmt(m["rouge1_f1"]),
                        fmt(m["rouge2_f1"]),
                        fmt(m["rougeL_f1"]),
                        fmt(m["word_ratio"]),
                        fmt(m["char_ratio"]),
                        fmt(m["flesch_orig"], 1),
                        fmt(m["flesch_simp"], 1),
                        fmt(m["flesch_delta"], 1),
                    ]
                )
            finally:
                try:
                    os.unlink(out_path)
                except OSError:
                    pass
        except Exception as e:
            rows.append(
                [
                    cat,
                    pdf_path.name,
                    "—",
                    "—",
                    "—",
                    "—",
                    "—",
                    "—",
                    "—",
                    "—",
                ]
            )
            print(f"Warning {pdf_path.name}: {e}", file=sys.stderr)

    # Pretty table
    try:
        from tabulate import tabulate

        print(tabulate(rows, headers=headers, tablefmt="github"))
    except ImportError:
        col_w = [22, 28, 10, 10, 10, 18, 18, 12, 12, 10]
        def pad(s: str, w: int) -> str:
            s = s[: w - 1] + "…" if len(s) >= w else s
            return s.ljust(w)

        line = " | ".join(pad(h, w) for h, w in zip(headers, col_w))
        print(line)
        print(" | ".join("-" * w for w in col_w))
        for row in rows:
            print(" | ".join(pad(str(c), w) for c, w in zip(row, col_w)))

    print()
    print(
        "Notes: ROUGE F1 = lexical overlap (original vs simplified text); "
        "strong paraphrasing lowers ROUGE but can still be a good simplification. "
        "Word/char ratio < 1 means shorter output. "
        "Higher Flesch = easier to read; Δ Flesch > 0 suggests improved readability."
    )


if __name__ == "__main__":
    main()
