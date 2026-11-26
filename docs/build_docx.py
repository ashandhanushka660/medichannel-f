#!/usr/bin/env python3
"""Build a designed MediChannel Word report from the Markdown source.

Run with:
  /tmp/opencode/docxenv/bin/python build_docx.py

The PDF is exported from the generated DOCX so the two files match exactly.
"""

from __future__ import annotations

import html
import re
from pathlib import Path

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "IT404050_ASSIGNMENT_2_FINAL_REPORT_SOURCE.md"
OUTPUT = HERE / "IT404050_ASSIGNMENT_2_FINAL_REPORT.docx"
HERO_IMAGE = HERE.parent / "public/images/hero-doctor-1000.jpg"

NAVY = "142B45"
NAVY_2 = "1F3E5C"
TEAL = "1F7A8C"
PEACH = "E8734A"
PEACH_LIGHT = "F6A585"
GREY = "5B6B7B"
LIGHT_GREY = "F2F6F9"
PALE_TEAL = "E8F3F5"
WHITE = "FFFFFF"
DARK = "16283E"

BOLD_CODE_RE = re.compile(r"(\*\*.*?\*\*|`.*?`)")
PAGE_WIDTH = 6.77  # A4 width minus 0.75in margins each side


def colour(hex_value: str) -> RGBColor:
    return RGBColor.from_string(hex_value.replace("#", "").upper())


def style_run(run, size=10.5, bold=False, color=NAVY, name="Calibri", italic=False):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = colour(color)
    rpr = run._element.get_or_add_rPr()
    fonts = rpr.find(qn("w:rFonts"))
    if fonts is None:
        fonts = OxmlElement("w:rFonts")
        rpr.append(fonts)
    for attr in ("ascii", "hAnsi", "eastAsia", "cs"):
        fonts.set(qn("w:" + attr), name)


def shade(pr, fill: str) -> None:
    node = pr.find(qn("w:shd"))
    if node is None:
        node = OxmlElement("w:shd")
        pr.append(node)
    node.set(qn("w:val"), "clear")
    node.set(qn("w:color"), "auto")
    node.set(qn("w:fill"), fill)


def cell_shade(cell, fill: str) -> None:
    shade(cell._tc.get_or_add_tcPr(), fill)


def para_shade(paragraph, fill: str) -> None:
    shade(paragraph._p.get_or_add_pPr(), fill)


def _edge(parent, borders_tag: str, edge_tag: str, colour_hex: str, size: int) -> None:
    borders = parent.find(qn(borders_tag))
    if borders is None:
        borders = OxmlElement(borders_tag)
        parent.append(borders)
    edge = borders.find(qn(edge_tag))
    if edge is None:
        edge = OxmlElement(edge_tag)
        borders.append(edge)
    edge.set(qn("w:val"), "single")
    edge.set(qn("w:sz"), str(size))
    edge.set(qn("w:space"), "0")
    edge.set(qn("w:color"), colour_hex)


def cell_border(cell, edge: str, colour_hex: str, size: int = 6) -> None:
    _edge(cell._tc.get_or_add_tcPr(), "w:tcBorders", "w:" + edge, colour_hex, size)


def para_border(paragraph, edge: str, colour_hex: str, size: int = 10, space: int = 4) -> None:
    ppr = paragraph._p.get_or_add_pPr()
    _edge(ppr, "w:pBdr", "w:" + edge, colour_hex, size)
    borders = ppr.find(qn("w:pBdr"))
    element = borders.find(qn("w:" + edge))
    if element is not None:
        element.set(qn("w:space"), str(space))


def cell_margins(cell, top=90, start=120, bottom=90, end=120) -> None:
    tcpr = cell._tc.get_or_add_tcPr()
    margins = tcpr.find(qn("w:tcMar"))
    if margins is None:
        margins = OxmlElement("w:tcMar")
        tcpr.append(margins)
    for side, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = margins.find(qn("w:" + side))
        if node is None:
            node = OxmlElement("w:" + side)
            margins.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def repeat_header(row) -> None:
    trpr = row._tr.get_or_add_trPr()
    node = OxmlElement("w:tblHeader")
    node.set(qn("w:val"), "true")
    trpr.append(node)


def no_split(row) -> None:
    trpr = row._tr.get_or_add_trPr()
    trpr.append(OxmlElement("w:cantSplit"))


def add_rich(paragraph, text: str, size=10.5, color=NAVY, bold_all=False):
    for part in BOLD_CODE_RE.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            style_run(paragraph.add_run(part[2:-2]), size=size, bold=True, color=color)
        elif part.startswith("`") and part.endswith("`"):
            style_run(paragraph.add_run(part[1:-1]), size=size - 0.5, color=TEAL, name="Consolas")
        else:
            style_run(paragraph.add_run(part), size=size, bold=bold_all, color=color)


def add_page_field(paragraph) -> None:
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    instr.text = "PAGE"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(end)
    style_run(run, size=8, color=GREY)


def configure_document(doc: Document) -> None:
    section = doc.sections[0]
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)
    section.top_margin = Inches(0.78)
    section.bottom_margin = Inches(0.72)
    section.left_margin = Inches(0.75)
    section.right_margin = Inches(0.75)
    section.header_distance = Inches(0.35)
    section.footer_distance = Inches(0.35)
    section.different_first_page_header_footer = True

    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.12

    header = section.header.paragraphs[0]
    header.paragraph_format.tab_stops.add_tab_stop(Inches(PAGE_WIDTH), WD_TAB_ALIGNMENT.RIGHT)
    style_run(header.add_run("MediChannel  |  IT404050 Assignment 2"), size=8, bold=True, color=GREY)
    style_run(header.add_run("\tFinal Report"), size=8, color=TEAL)
    para_border(header, "bottom", PEACH, 8, 4)

    footer = section.footer.paragraphs[0]
    footer.paragraph_format.tab_stops.add_tab_stop(Inches(PAGE_WIDTH), WD_TAB_ALIGNMENT.RIGHT)
    style_run(footer.add_run("Group MediChannel  ·  26 November 2026"), size=8, color=GREY)
    style_run(footer.add_run("\tPage "), size=8, color=GREY)
    add_page_field(footer)
    para_border(footer, "top", "D5DFE8", 6, 6)


def parse_metadata(lines: list[str]) -> tuple[str, str, dict[str, str]]:
    title = lines[0].removeprefix("# ").strip()
    subtitle = lines[2].removeprefix("## ").strip()
    meta: dict[str, str] = {}
    for line in lines[3:18]:
        match = re.match(r"^\*\*(.+?):\*\*\s*(.+)$", line.strip())
        if match:
            meta[match.group(1).strip()] = match.group(2).strip().strip("`").strip()
    return title, subtitle, meta


def build_cover(doc: Document, title: str, subtitle: str, meta: dict[str, str]) -> None:
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(10)
    para_border(spacer, "top", PEACH, 20, 0)

    banner = doc.add_table(rows=1, cols=1)
    banner.alignment = WD_TABLE_ALIGNMENT.CENTER
    banner.autofit = False
    cell = banner.cell(0, 0)
    cell.width = Inches(PAGE_WIDTH)
    cell_shade(cell, NAVY)
    cell_margins(cell, top=280, start=320, bottom=280, end=320)

    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(4)
    style_run(p.add_run("MediChannel"), size=31, bold=True, color=WHITE)
    p2 = cell.add_paragraph()
    style_run(p2.add_run("Hospital Channelling and Appointment System"), size=15, color=PEACH_LIGHT)
    p3 = cell.add_paragraph()
    p3.paragraph_format.space_before = Pt(10)
    style_run(p3.add_run(subtitle), size=10.5, color="D7E5F1")

    gap = doc.add_paragraph()
    gap.paragraph_format.space_after = Pt(10)

    info = doc.add_table(rows=1, cols=2)
    info.autofit = False
    info.alignment = WD_TABLE_ALIGNMENT.CENTER
    left, right = info.cell(0, 0), info.cell(0, 1)
    left.width = Inches(4.05)
    right.width = Inches(2.65)
    cell_margins(left, top=120, start=60, bottom=80, end=150)
    cell_margins(right, top=0, start=120, bottom=0, end=0)

    labels = [
        ("GROUP", meta.get("Group", "MediChannel")),
        ("MODULE", meta.get("Module", "IT404050 — Full Stack Development")),
        ("ASSIGNMENT", "Assignment 2 — Hospital Channelling and Appointment System"),
        ("BRIEF ISSUED", meta.get("Brief issue date", "5 November 2026")),
        ("DEADLINE", meta.get("Submission deadline", "5 December 2026")),
        ("REPORT DATE", meta.get("Report date", "26 November 2026")),
    ]
    for index, (label, value) in enumerate(labels):
        p = left.paragraphs[0] if index == 0 else left.add_paragraph()
        p.paragraph_format.space_after = Pt(7)
        style_run(p.add_run(label + "  "), size=7.5, bold=True, color=PEACH)
        style_run(p.add_run(value), size=9.5, color=NAVY)

    p = left.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    style_run(p.add_run("LIVE DEPLOYMENT"), size=7.5, bold=True, color=PEACH)
    for key in ("Live frontend", "Live API"):
        value = meta.get(key, "")
        chip = left.add_paragraph()
        chip.paragraph_format.space_after = Pt(4)
        para_shade(chip, LIGHT_GREY)
        style_run(chip.add_run(" " + value + " "), size=7.4, color=NAVY_2, name="Consolas")

    if HERO_IMAGE.exists():
        right.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        right.paragraphs[0].add_run().add_picture(str(HERO_IMAGE), width=Inches(2.55))
        cap = right.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        style_run(cap.add_run("Secure care, connected in real time"), size=7.5, italic=True, color=GREY)

    note = doc.add_paragraph()
    note.alignment = WD_ALIGN_PARAGRAPH.CENTER
    note.paragraph_format.space_before = Pt(16)
    style_run(note.add_run("Frontend  "), size=8, bold=True, color=TEAL)
    style_run(note.add_run(meta.get("Frontend repository", "")), size=8, color=GREY, name="Consolas")
    note2 = doc.add_paragraph()
    note2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    style_run(note2.add_run("Backend  "), size=8, bold=True, color=TEAL)
    style_run(note2.add_run(meta.get("Backend repository", "")), size=8, color=GREY, name="Consolas")
    note3 = doc.add_paragraph()
    note3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    style_run(note3.add_run("Backup demo recording  "), size=7.5, bold=True, color=TEAL)
    style_run(note3.add_run(meta.get("Backup demo recording", "")), size=7.5, color=GREY, name="Consolas")

    doc.add_page_break()


def build_contents(doc: Document, headings: list[str]) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    style_run(p.add_run("CONTENTS"), size=19, bold=True, color=NAVY)
    para_border(p, "bottom", PEACH, 16, 6)

    sub = doc.add_paragraph()
    sub.paragraph_format.space_after = Pt(14)
    style_run(sub.add_run("Nineteen sections covering design, implementation, evidence and reflection"),
              size=9, italic=True, color=GREY)

    table = doc.add_table(rows=1, cols=2)
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    split = (len(headings) + 1) // 2
    columns = [headings[:split], headings[split:]]
    for column, cell in zip(columns, table.rows[0].cells):
        cell.width = Inches(PAGE_WIDTH / 2 - 0.1)
        cell_margins(cell, top=80, start=100, bottom=80, end=100)
        for index, heading in enumerate(column):
            para = cell.paragraphs[0] if index == 0 else cell.add_paragraph()
            para.paragraph_format.space_after = Pt(9)
            number, _, label = heading.partition(" ")
            style_run(para.add_run(number + "  "), size=9, bold=True, color=PEACH)
            style_run(para.add_run(label), size=9.5, color=NAVY)

    foot = doc.add_paragraph()
    foot.paragraph_format.space_before = Pt(16)
    style_run(foot.add_run("Evidence files and submission mapping: "), size=8.5, color=GREY)
    style_run(foot.add_run("DOCUMENTATION_INDEX.md"), size=8.5, bold=True, color=TEAL, name="Consolas")

    doc.add_page_break()


def split_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def add_styled_table(doc: Document, rows: list[str]) -> None:
    header = split_row(rows[0])
    body = [split_row(row) for row in rows[2:]]
    if not header:
        return

    table = doc.add_table(rows=1, cols=len(header))
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    weights = []
    for index in range(len(header)):
        longest = max([len(header[index])] + [len(row[index]) for row in body if index < len(row)])
        weights.append(max(7, min(longest, 46)))
    total = sum(weights)
    widths = [PAGE_WIDTH * weight / total for weight in weights]

    for index, value in enumerate(header):
        cell = table.rows[0].cells[index]
        cell.width = Inches(widths[index])
        cell_shade(cell, NAVY)
        cell_margins(cell, top=80, start=90, bottom=80, end=90)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        para = cell.paragraphs[0]
        para.paragraph_format.space_after = Pt(0)
        add_rich(para, value, size=8.5, color=WHITE, bold_all=True)
        for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
            cell_border(cell, edge, "D7E0E8", 4)
    repeat_header(table.rows[0])
    no_split(table.rows[0])

    for row_index, row in enumerate(body):
        cells = table.add_row().cells
        fill = WHITE if row_index % 2 else LIGHT_GREY
        for index, value in enumerate(row[: len(header)]):
            cell = cells[index]
            cell.width = Inches(widths[index])
            cell_shade(cell, fill)
            cell_margins(cell, top=70, start=90, bottom=70, end=90)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            para = cell.paragraphs[0]
            para.paragraph_format.space_after = Pt(0)
            add_rich(para, value, size=8.3, color=NAVY)
            for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
                cell_border(cell, edge, "D7E0E8", 4)
        no_split(table.rows[-1])

    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def add_code_card(doc: Document, lines: list[str], dark=True, label: str | None = None) -> None:
    table = doc.add_table(rows=1, cols=1)
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    cell.width = Inches(PAGE_WIDTH)
    cell_shade(cell, DARK if dark else PALE_TEAL)
    cell_margins(cell, top=130, start=160, bottom=130, end=160)
    cell_border(cell, "left", PEACH, 22)
    cell_border(cell, "top", "D7E0E8", 4)
    cell_border(cell, "bottom", "D7E0E8", 4)

    first = True
    if label:
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(5)
        style_run(p.add_run(label.upper()), size=8, bold=True, color=PEACH_LIGHT if dark else TEAL)
        first = False
    for line in lines:
        p = cell.paragraphs[0] if first else cell.add_paragraph()
        first = False
        p.paragraph_format.space_after = Pt(0)
        style_run(p.add_run(line or " "), size=8.2, color="E8F0F7" if dark else NAVY, name="Consolas")
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def add_metric_strip(doc: Document) -> None:
    metrics = [
        ("40", "visiting doctors"),
        ("15", "specialisations"),
        ("50", "sessions this week"),
        ("40/40", "live E2E checks"),
    ]
    table = doc.add_table(rows=1, cols=4)
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for cell, (number, label) in zip(table.rows[0].cells, metrics):
        cell.width = Inches(PAGE_WIDTH / 4)
        cell_shade(cell, PALE_TEAL)
        cell_margins(cell, top=120, start=60, bottom=100, end=60)
        cell_border(cell, "top", PEACH, 18)
        cell_border(cell, "left", WHITE, 12)
        cell_border(cell, "right", WHITE, 12)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        style_run(p.add_run(number), size=19, bold=True, color=NAVY)
        p2 = cell.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p2.paragraph_format.space_after = Pt(0)
        style_run(p2.add_run(label), size=8, color=GREY)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def add_callout(doc: Document, title: str, lines: list[str]) -> None:
    table = doc.add_table(rows=1, cols=1)
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    cell.width = Inches(PAGE_WIDTH)
    cell_shade(cell, "FFF4EE")
    cell_margins(cell, top=110, start=160, bottom=110, end=160)
    cell_border(cell, "left", PEACH, 20)
    cell_border(cell, "top", "F1D9CC", 4)
    cell_border(cell, "bottom", "F1D9CC", 4)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(5)
    style_run(p.add_run(title.upper()), size=8.5, bold=True, color=PEACH)
    for line in lines:
        para = cell.add_paragraph()
        para.paragraph_format.space_after = Pt(3)
        add_rich(para, line, size=9.3, color=NAVY)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def add_heading(doc: Document, text: str, level: int) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14 if level == 1 else 10)
    p.paragraph_format.space_after = Pt(7 if level == 1 else 5)
    p.paragraph_format.keep_with_next = True
    if level == 1:
        para_border(p, "left", PEACH, 20, 8)
        style_run(p.add_run("  " + text), size=15, bold=True, color=NAVY)
        para_border(p, "bottom", "D7E0E8", 6, 4)
    else:
        style_run(p.add_run(text), size=11.5, bold=True, color=TEAL)


def add_image(doc: Document, path: Path) -> None:
    if not path.exists():
        return
    table = doc.add_table(rows=1, cols=1)
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    cell.width = Inches(PAGE_WIDTH)
    cell_margins(cell, top=80, start=80, bottom=80, end=80)
    for edge in ("top", "left", "bottom", "right"):
        cell_border(cell, edge, "D7E0E8", 6)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(str(path), width=Inches(6.25))


def strip_html_block(block: list[str]) -> list[str]:
    text = "\n".join(block)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    return [line.strip() for line in text.splitlines() if line.strip()]


def main() -> None:
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    title, subtitle, meta = parse_metadata(lines)

    doc = Document()
    configure_document(doc)
    build_cover(doc, title, subtitle, meta)

    page_break_index = next(
        (index for index, line in enumerate(lines) if "page-break-after" in line),
        len(lines) - 1,
    )
    body_lines = lines[page_break_index + 1:]
    headings = [
        line[3:].strip()
        for line in body_lines
        if line.startswith("## ")
    ]
    build_contents(doc, headings)

    index = 0
    paragraph_buffer: list[str] = []

    def flush() -> None:
        nonlocal paragraph_buffer
        if paragraph_buffer:
            text = " ".join(part.strip() for part in paragraph_buffer)
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            p.paragraph_format.space_after = Pt(7)
            add_rich(p, text)
            paragraph_buffer = []

    while index < len(body_lines):
        line = body_lines[index].rstrip()

        if not line.strip():
            flush()
            index += 1
            continue

        if line.startswith("```"):
            flush()
            index += 1
            code: list[str] = []
            while index < len(body_lines) and not body_lines[index].startswith("```"):
                code.append(body_lines[index])
                index += 1
            index += 1
            label = "ERD relationships (Mermaid source)" if code and code[0].strip() == "erDiagram" else None
            add_code_card(doc, code, dark=True, label=label)
            continue

        if line.startswith("|") and index + 1 < len(body_lines) and re.match(
            r"^\|[\s:|-]+\|$", body_lines[index + 1].strip()
        ):
            flush()
            rows: list[str] = []
            while index < len(body_lines) and body_lines[index].strip().startswith("|"):
                rows.append(body_lines[index])
                index += 1
            add_styled_table(doc, rows)
            continue

        if line.startswith("<img "):
            flush()
            match = re.search(r'src="([^"]+)"', line)
            if match:
                add_image(doc, (HERE / match.group(1)).resolve())
            index += 1
            continue

        if line.startswith("<div"):
            flush()
            block = [line]
            while index + 1 < len(body_lines) and "</div>" not in block[-1]:
                index += 1
                block.append(body_lines[index])
            content = strip_html_block(block)
            if "page-break-after" in block[0]:
                doc.add_page_break()
            elif content:
                is_dark = "SELECT left" in "\n".join(content) or "ciphertext" in "\n".join(content).lower()
                add_code_card(doc, content, dark=is_dark, label=None)
            index += 1
            continue

        if line.startswith("## "):
            flush()
            add_heading(doc, line[3:].strip(), 1)
            index += 1
            continue

        if line.startswith("### "):
            flush()
            add_heading(doc, line[4:].strip(), 2)
            index += 1
            continue

        if line.startswith("# "):
            flush()
            index += 1
            continue

        if re.match(r"^\s*-\s+", line):
            flush()
            p = doc.add_paragraph(style="List Bullet")
            p.paragraph_format.space_after = Pt(4)
            add_rich(p, re.sub(r"^\s*-\s+", "", line))
            index += 1
            continue

        if re.match(r"^\s*\d+\.\s+", line):
            flush()
            p = doc.add_paragraph(style="List Number")
            p.paragraph_format.space_after = Pt(4)
            add_rich(p, re.sub(r"^\s*\d+\.\s+", "", line))
            index += 1
            continue

        if line.startswith("**Figure ") and line.endswith("**"):
            flush()
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(10)
            style_run(p.add_run(line[2:-2]), size=8.5, italic=True, color=GREY)
            index += 1
            continue

        if line.startswith("This report documents the complete design"):
            flush()
            add_metric_strip(doc)
            add_callout(
                doc,
                "Evidence guardrails",
                [
                    "Live evidence was captured on 26 November 2026 from the production Vercel frontend, "
                    "Heroku API and Supabase PostgreSQL.",
                    "All patient records created for verification are fictional. No passwords, tokens, "
                    "hashes, environment values or real medical data appear in this report.",
                ],
            )

        if line.startswith("A database evidence extract is shown below."):
            flush()
            add_callout(
                doc,
                "Redacted evidence policy",
                [
                    "Database extracts show only the `v1:` ciphertext prefix and length. The same fictional "
                    "patient is shown in decrypted form only through the treating doctor API.",
                ],
            )

        paragraph_buffer.append(line)
        index += 1

    flush()
    doc.save(OUTPUT)
    print(f"DOCX written: {OUTPUT}")


if __name__ == "__main__":
    main()
