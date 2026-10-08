import base64
import io
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.pagesizes import letter
from reportlab.platypus import KeepTogether
from simplify import simplify_text_chunked
from xml.sax.saxutils import escape

def export_to_pdf(elements, output_path="simplified_output.pdf"):
    """
    Reconstruct a simplified PDF using extracted elements.
    Keeps content grouped by original page number.
    """

    doc = SimpleDocTemplate(output_path, pagesize=letter)
    story = []

    styles = getSampleStyleSheet()

    # Custom readable style
    simplified_style = ParagraphStyle(
        'SimplifiedStyle',
        parent=styles['Normal'],
        fontSize=12,
        leading=16,
        spaceAfter=10
    )

    # Group elements by page number
    pages = {}
    for e in elements:
        page_num = getattr(e.metadata, "page_number", 1)
        if page_num not in pages:
            pages[page_num] = []
        pages[page_num].append(e)

    # Process pages in order
    for page_number in sorted(pages.keys()):
        page_content = []

        for e in pages[page_number]:

            # ---- IMAGE ELEMENTS ----
            if hasattr(e.metadata, "image_base64") and e.metadata.image_base64:
                try:
                    image_bytes = base64.b64decode(e.metadata.image_base64)
                    image_stream = io.BytesIO(image_bytes)

                    img = Image(image_stream)
                    img._restrictSize(5 * inch, 6 * inch)

                    page_content.append(img)
                    page_content.append(Spacer(1, 0.3 * inch))

                except Exception as img_error:
                    print(f"Error decoding image on page {page_number}: {img_error}")
            
            # ---- TEXT ELEMENTS ----
            elif hasattr(e, "text") and e.text:
                simplified = simplify_text_chunked(e.text)

                safe_simplified = escape(str(simplified)).replace("\n", "<br/>")

                para = Paragraph(safe_simplified, simplified_style)
                page_content.append(para)
                page_content.append(Spacer(1, 0.2 * inch))

        # Add everything from this page together
        story.append(KeepTogether(page_content))

        # Add page break unless last page
        if page_number != sorted(pages.keys())[-1]:
            story.append(PageBreak())

    doc.build(story)

    print(f"Simplified PDF saved to: {output_path}")
