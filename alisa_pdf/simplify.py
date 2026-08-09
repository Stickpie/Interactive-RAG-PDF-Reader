from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import torch
from unstructured.partition.pdf import partition_pdf

MODEL_ID = "Stickpie/inkling-flan-t5-simplifier"

# Load model and tokenizer
simplification_model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID)
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)

# Auto-detect device (MPS for Apple Silicon, CUDA for GPU, CPU fallback)
DEVICE = (
    torch.device("mps")
    if torch.backends.mps.is_available()
    else torch.device("cuda")
    if torch.cuda.is_available()
    else torch.device("cpu")
)
simplification_model.to(DEVICE)
simplification_model.eval()


def normalize_pdf(filename: str, max_characters: int = 256):
    elements = partition_pdf(
        filename=filename,
        strategy="hi_res",
        extract_image_block_types=["Image"],
        extract_image_block_to_payload=True,
    )
    return elements


def simplify_text(text: str) -> str:
    # Basic cleanup to avoid degenerate behavior on whitespace-only inputs
    text = text.strip()
    if not text:
        return ""

    inputs = tokenizer(
        "simplify: " + text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
    ).to(DEVICE)

    with torch.inference_mode():
        output_ids = simplification_model.generate(
            **inputs,
            max_new_tokens=128,
            num_beams=4,
            early_stopping=True,
        )

    return tokenizer.decode(
        output_ids[0],
        skip_special_tokens=True,
    )


def simplify_text_chunked(text: str) -> str:
    """
    Split text into paragraphs, simplify each independently, then rejoin.
    Avoids truncation when the full text would exceed the tokenizer input limit.
    """
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    if not paragraphs:
        return text

    simplified_paragraphs = [simplify_text(p) for p in paragraphs]
    return "\n\n".join(simplified_paragraphs)


if __name__ == "__main__":
    filename = input("Enter the path to the PDF file you want to simplify: ")
    elements = normalize_pdf(filename, max_characters=256)
    for el in elements:
        text = str(el)
        simplified = simplify_text(text)
        print(simplified)
