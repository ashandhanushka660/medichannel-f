#!/usr/bin/env python3
"""Build MediChannel PPTX slides from PRESENTATION_SLIDES.md."""

from pathlib import Path
import re

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "PRESENTATION_SLIDES.md"
OUTPUT = HERE / "PRESENTATION_SLIDES.pptx"

NAVY = RGBColor(31, 58, 95)
BLUE = RGBColor(43, 122, 158)
PEACH = RGBColor(232, 115, 74)
GREY = RGBColor(75, 85, 99)


def add_box(slide, left, top, width, height, fill):
    shape = slide.shapes.add_shape(1, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.fill.background()
    return shape


def add_text(slide, left, top, width, height, text, size=18, bold=False, color=NAVY,
             align=PP_ALIGN.LEFT, font="Calibri"):
    box = slide.shapes.add_textbox(left, top, width, height)
    frame = box.text_frame
    frame.word_wrap = True
    frame.vertical_anchor = MSO_ANCHOR.TOP
    p = frame.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.name = font
    run.font.color.rgb = color
    return box


def add_bullets(slide, left, top, width, height, bullets):
    box = slide.shapes.add_textbox(left, top, width, height)
    frame = box.text_frame
    frame.word_wrap = True
    for idx, item in enumerate(bullets):
        p = frame.paragraphs[0] if idx == 0 else frame.add_paragraph()
        p.level = 0
        p.space_after = Pt(8)
        run = p.add_run()
        run.text = ("• " if not re.match(r"^\d+\.", item) else "") + item
        run.font.size = Pt(16)
        run.font.name = "Calibri"
        run.font.color.rgb = GREY
    return box


def parse_slides():
    slides = []
    current = None
    for raw in SOURCE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("# MediChannel"):
            continue
        if line.startswith("## Slide "):
            title = re.sub(r"^## Slide \d+ —\s*", "", line)
            current = {"title": title, "lines": []}
            slides.append(current)
        elif current is not None:
            current["lines"].append(line)
    return slides


def main():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank = prs.slide_layouts[6]

    for number, slide_data in enumerate(parse_slides(), start=1):
        slide = prs.slides.add_slide(blank)
        bg = slide.background.fill
        bg.solid()
        bg.fore_color.rgb = RGBColor(255, 255, 255)

        add_box(slide, 0, 0, Inches(13.333), Inches(0.18), PEACH)
        add_box(slide, 0, Inches(7.32), Inches(13.333), Inches(0.18), NAVY)

        if number == 1:
            add_box(slide, Inches(0.9), Inches(1.3), Inches(11.5), Inches(4.8), NAVY)
            add_text(slide, Inches(1.3), Inches(1.9), Inches(10.7), Inches(1.2),
                     slide_data["title"], size=34, bold=True, color=RGBColor(255, 255, 255),
                     align=PP_ALIGN.CENTER)
            body = "\n".join(slide_data["lines"])
            add_text(slide, Inches(1.5), Inches(3.3), Inches(10.3), Inches(2.2),
                     body, size=16, color=RGBColor(229, 231, 235), align=PP_ALIGN.CENTER)
        else:
            add_text(slide, Inches(0.7), Inches(0.45), Inches(11.9), Inches(0.7),
                     slide_data["title"], size=28, bold=True, color=NAVY)
            add_box(slide, Inches(0.75), Inches(1.2), Inches(2.2), Inches(0.06), BLUE)
            bullets = [re.sub(r"^[-*]\s*", "", line) for line in slide_data["lines"]]
            add_bullets(slide, Inches(0.8), Inches(1.5), Inches(11.7), Inches(5.4), bullets)

        add_text(slide, Inches(12.2), Inches(7.0), Inches(0.7), Inches(0.3),
                 str(number), size=10, color=GREY, align=PP_ALIGN.RIGHT)

    prs.save(OUTPUT)
    print(f"PPTX written: {OUTPUT} ({len(prs.slides.__iter__.__self__._sldIdLst)} slides)")


if __name__ == "__main__":
    main()
