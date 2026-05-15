from transformers import BartForConditionalGeneration, BartTokenizer
import torch
from unstructured.documents.elements import NarrativeText, Title, Text

# Load model and tokenizer
model = BartForConditionalGeneration.from_pretrained("elvisbakunzi/dyslexia-friendly-text-simplifier")
tokenizer = BartTokenizer.from_pretrained("elvisbakunzi/dyslexia-friendly-text-simplifier")

# Auto-detect device (MPS for Apple Silicon, CUDA for GPU, CPU fallback)
device = torch.device("mps") if torch.backends.mps.is_available() else torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")
model.to(device)
model.eval()

import pytesseract
from unstructured.partition.html import partition_html
from unstructured.partition.pptx import partition_pptx
from unstructured.partition.pdf import partition_pdf
from unstructured.partition.auto import partition


def normalize_pdf(filename: str, max_characters: int = 256):
    elements = partition_pdf(
        filename=filename,
        strategy="hi_res",
        extract_image_block_types=["Image"],
        extract_image_block_to_payload=True,
    )
    return elements


def simplify_text(text, max_length=256):
    # Basic cleanup to avoid degenerate behavior on whitespace-only inputs
    text = text.strip()
    if not text:
        return ""

    inputs = tokenizer(text, max_length=512, truncation=True, return_tensors='pt').to(device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_length=max_length,
            num_beams=4,
            length_penalty=0.8,
            early_stopping=True,
            no_repeat_ngram_size=2,
            do_sample=True,
            top_p=0.9,
            temperature=0.7,
        )

    return tokenizer.decode(outputs[0], skip_special_tokens=True)


def simplify_text_chunked(text, max_length=256):
    """
    Split text into paragraphs, simplify each independently, then rejoin.
    Avoids truncation when the full text would exceed the BART input limit.
    """
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    if not paragraphs:
        return text

    simplified_paragraphs = [simplify_text(p, max_length=max_length) for p in paragraphs]
    return "\n\n".join(simplified_paragraphs)


if __name__ == "__main__":
    filename = input("Enter the path to the PDF file you want to simplify: ")
    elements = normalize_pdf(filename, max_characters=256)
    for el in elements:
        text = str(el)
        simplified = simplify_text(text)
        print(simplified)
