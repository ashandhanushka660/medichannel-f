#!/usr/bin/env python3
"""Create a Word DOCX from the MediChannel Markdown report source.

Run with the temporary virtual environment:
  /tmp/opencode/docxenv/bin/python build_docx.py
"""

from pathlib import Path
import re

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "IT404050_ASSIGNMENT_2_FINAL_REPORT_SOURCE.md"
OUTPUT = HERE / "IT404050_ASSIGNMENT_2_FINAL_REPORT.docx"

BOLD_RE = re.compile(r"(\*\*.*?\*\*|`.*?`)")


def set_run_font(run, name="Calibri", size=10.5, bold=False, color=None):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold
    if color:
        run.font.color.rgb = RGBColor(*color)
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = rpr.makeelement(qn("w:rFonts"), {})
        rpr.append(rfonts)
    rfonts.set(qn("w:eastAsia"), name)


def add_rich_text(paragraph, text, size=10.5):
    for part in BOLD_RE.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            run = paragraph.add_run(part[2:-2])
            set_run_font(run, size=size, bold=True)
        elif part.startswith("`") and part.endswith("`"):
            run = paragraph.add_run(part[1:-1])
            set_run_font(run, name="Consolas", size=size)
        else:
            run = paragraph.add_run(part)
            set_run_font(run, size=size)


def add_code_block(doc, lines):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(6)
    run = paragraph.add_run("\n".join(lines))
    set_run_font(run, name="Consolas", size=8.5)


def split_row(line):
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def add_table(doc, rows):
    if len(rows) < 2:
        return
    header = split_row(rows[0])
    body = [split_row(row) for row in rows[2:]]
    table = doc.add_table(rows=1, cols=len(header))
    table.style = "Table Grid"
    hdr_cells = table.rows[0].cells
    for idx, value in enumerate(header):
        hdr_cells[idx].text = ""
        add_rich_text(hdr_cells[idx].paragraphs[0], value, size=9)
        for run in hdr_cells[idx].paragraphs[0].runs:
            run.bold = True
    for row in body:
        cells = table.add_row().cells
        for idx, value in enumerate(row[: len(header)]):
            cells[idx].text = ""
            add_rich_text(cells[idx].paragraphs[0], value, size=9)
    doc.add_paragraph()


def strip_html_block(lines):
    text = "\n".join(lines)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


def main():
    doc = Document()
    section = doc.sections[0]
    section.page_height = Inches(11.69)
    section.page_width = Inches(8.27)
    section.top_margin = Inches(0.8)
    section.bottom_margin = Inches(0.7)
    section.left_margin = Inches(0.75)
    section.right_margin = Inches(0.75)

    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)

    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    i = 0
    paragraph_buffer = []

    def flush_paragraph():
        nonlocal paragraph_buffer
        if paragraph_buffer:
            text = " ".join(part.strip() for part in paragraph_buffer)
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(6)
            add_rich_text(p, text)
            paragraph_buffer = []

    while i < len(lines):
        line = lines[i].rstrip()

        if not line.strip():
            flush_paragraph()
            i += 1
            continue

        if line.startswith("```"):
            flush_paragraph()
            i += 1
            code = []
            while i < len(lines) and not lines[i].startswith("```"):
                code.append(lines[i])
                i += 1
            i += 1
            add_code_block(doc, code)
            continue

        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|$", lines[i + 1].strip()):
            flush_paragraph()
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(lines[i])
                i += 1
            add_table(doc, rows)
            continue

        if line.startswith("<img "):
            flush_paragraph()
            match = re.search(r'src="([^"]+)"', line)
            if match:
                image_path = (HERE / match.group(1)).resolve()
                if image_path.exists():
                    p = doc.add_paragraph()
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    p.add_run().add_picture(str(image_path), width=Inches(6.3))
            i += 1
            continue

        if line.startswith("<div"):
            flush_paragraph()
            block = [line]
            while i + 1 < len(lines) and "</div>" not in block[-1]:
                i += 1
                block.append(lines[i])
            text = strip_html_block(block)
            if "page-break-after" in block[0]:
                doc.add_page_break()
            elif text:
                add_code_block(doc, text.splitlines())
            i += 1
            continue

        if line.startswith("# "):
            flush_paragraph()
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(line[2:].strip())
            set_run_font(run, name="Calibri", size=22, bold=True, color=(31, 58, 95))
            i += 1
            continue

        if line.startswith("## "):
            flush_paragraph()
            p = doc.add_heading(level=1)
            add_rich_text(p, line[3:].strip(), size=15)
            for run in p.runs:
                run.font.color.rgb = RGBColor(31, 58, 95)
            i += 1
            continue

        if line.startswith("### "):
            flush_paragraph()
            p = doc.add_heading(level=2)
            add_rich_text(p, line[4:].strip(), size=12)
            for run in p.runs:
                run.font.color.rgb = RGBColor(43, 122, 158)
            i += 1
            continue

        if re.match(r"^\s*-\s+", line):
            flush_paragraph()
            p = doc.add_paragraph(style="List Bullet")
            add_rich_text(p, re.sub(r"^\s*-\s+", "", line))
            i += 1
            continue

        if re.match(r"^\s*\d+\.\s+", line):
            flush_paragraph()
            p = doc.add_paragraph(style="List Number")
            add_rich_text(p, re.sub(r"^\s*\d+\.\s+", "", line))
            i += 1
            continue

        paragraph_buffer.append(line)
        i += 1

    flush_paragraph()
    doc.save(OUTPUT)
    print(f"DOCX written: {OUTPUT}")


if __name__ == "__main__":
    main()
