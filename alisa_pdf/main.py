from simplify import normalize_pdf, simplify_text
from remakePDF import export_to_pdf

filename = input("Enter the path to the PDF file you want to simplify: ")
elements = normalize_pdf(filename, max_characters=256)

export_to_pdf(elements, "simplified_output.pdf")