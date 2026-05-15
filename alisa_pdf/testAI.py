from transformers import BartForConditionalGeneration, BartTokenizer
import torch

# Load model and tokenizer
model = BartForConditionalGeneration.from_pretrained("elvisbakunzi/dyslexia-friendly-text-simplifier")
tokenizer = BartTokenizer.from_pretrained("elvisbakunzi/dyslexia-friendly-text-simplifier")

# Auto-detect device (MPS for Apple Silicon, CUDA for GPU, CPU fallback)
device = torch.device("mps") if torch.backends.mps.is_available() else torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")
model.to(device)

def simplify_text(text, max_length=256):
    inputs = tokenizer(text, max_length=512, truncation=True, return_tensors='pt').to(device)
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_length=max_length,
            num_beams=3,
            length_penalty=0.8,
            early_stopping=True,
            no_repeat_ngram_size=2
        )
    
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

# Example usage
complex_text = "The derivative represents the instantaneous rate of change of a function."
simplified = simplify_text(complex_text)
print(simplified)
# Output: "The derivative shows the immediate rate of change of a function."
