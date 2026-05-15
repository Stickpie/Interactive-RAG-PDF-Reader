from unstructured.partition.html import partition_html
from unstructured.partition.pptx import partition_pptx
from unstructured.partition.pdf import partition_pdf

import magic
import pytesseract

from unstructured.partition.auto import partition

elements = partition(filename="test2.pdf")
print("\n\n".join([str(el) for el in elements]))