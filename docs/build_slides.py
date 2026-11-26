#!/usr/bin/env python3
"""Build a designed MediChannel PowerPoint deck from PRESENTATION_SLIDES.md.

Run with:
  /tmp/opencode/docxenv/bin/python build_slides.py

The exact Markdown slide lines are also written into speaker notes so no
original wording is lost while the visible slides use custom layouts.
"""

from __future__ import annotations

import re
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "PRESENTATION_SLIDES.md"
OUTPUT = HERE / "PRESENTATION_SLIDES.pptx"
HERO_IMAGE = HERE.parent / "public/images/hero-doctor-1000.jpg"
WELCOME_IMAGE = HERE.parent.parent.parent / "verification/evidence/prod-welcome-live-stats.png"
CIPHER_IMAGE = HERE.parent.parent.parent / "verification/evidence/db-ciphertext-redacted-evidence.png"

NAVY = RGBColor(0x12, 0x2B, 0x45)
NAVY_2 = RGBColor(0x1E, 0x3E, 0x5C)
TEAL = RGBColor(0x1F, 0x7A, 0x8C)
PEACH = RGBColor(0xE8, 0x73, 0x4A)
PEACH_LIGHT = RGBColor(0xF6, 0xA5, 0x85)
MINT = RGBColor(0xE8, 0xF3, 0xF5)
CLOUD = RGBColor(0xF6, 0xF9, 0xFC)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GREY = RGBColor(0x5B, 0x6B, 0x7B)
LIGHT = RGBColor(0xD7, 0xE0, 0xE8)
LIGHT_GREY = RGBColor(0xEE, 0xF3, 0xF7)

SLIDE_W = 13.333
SLIDE_H = 7.5


def parse_slides() -> list[dict]:
    slides: list[dict] = []
    current: dict | None = None
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


def set_notes(slide, slide_data: dict) -> None:
    text = slide_data["title"] + "\n" + "\n".join(slide_data["lines"])
    slide.notes_slide.notes_text_frame.text = text


def box(slide, x, y, w, h, fill, rounded=False, line=None, line_width=1.0):
    shape_type = MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE
    shape = slide.shapes.add_shape(shape_type, Inches(x), Inches(y), Inches(w), Inches(h))
    if rounded:
        shape.adjustments[0] = 0.09
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.width = Pt(line_width)
    return shape


def circle(slide, x, y, diameter, fill, line=None):
    shape = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(diameter), Inches(diameter))
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
    return shape


def arrow(slide, x, y, w, h, fill=PEACH):
    shape = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.fill.background()
    return shape


def text(slide, x, y, w, h, content, size=14, color=NAVY, bold=False,
         align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, font="Calibri",
         italic=False, margin=0.0):
    shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = shape.text_frame
    frame.word_wrap = True
    frame.vertical_anchor = valign
    frame.margin_left = Inches(margin)
    frame.margin_right = Inches(margin)
    frame.margin_top = Inches(margin / 2)
    frame.margin_bottom = Inches(margin / 2)
    for index, line in enumerate(content.split("\n")):
        para = frame.paragraphs[0] if index == 0 else frame.add_paragraph()
        para.alignment = align
        para.space_after = Pt(3)
        para.line_spacing = 1.05
        run = para.add_run()
        run.text = line
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.italic = italic
        run.font.name = font
        run.font.color.rgb = color
    return shape


def chip(slide, x, y, w, h, label, fill=MINT, color=NAVY, size=9, bold=False, rounded=True):
    box(slide, x, y, w, h, fill, rounded=rounded)
    text(slide, x + 0.07, y + 0.01, w - 0.14, h - 0.02, label, size=size, color=color,
         bold=bold, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)


def content_slide(prs, kicker: str, title: str, number: int, section: str):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = CLOUD
    box(slide, 0, 0, SLIDE_W, 0.13, NAVY)
    box(slide, 0, 0, 3.1, 0.13, PEACH)
    circle(slide, 0.55, 0.42, 0.34, TEAL)
    text(slide, 0.59, 0.455, 0.26, 0.24, "M", size=10, color=WHITE, bold=True,
         align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
    text(slide, 1.0, 0.43, 7.0, 0.25, "MEDICHANNEL  /  " + kicker.upper(), size=9,
         color=TEAL, bold=True, valign=MSO_ANCHOR.MIDDLE)
    text(slide, 0.58, 0.83, 11.9, 0.62, title, size=27, color=NAVY, bold=True)
    box(slide, 0.59, 1.52, 1.5, 0.055, PEACH)
    text(slide, 10.9, 0.43, 1.9, 0.25, section.upper(), size=8, color=GREY,
         align=PP_ALIGN.RIGHT, valign=MSO_ANCHOR.MIDDLE)

    box(slide, 0, 7.22, SLIDE_W, 0.28, NAVY)
    text(slide, 0.55, 7.26, 8.0, 0.2, "IT404050  ·  Group Assignment 2  ·  26 November 2026",
         size=7.5, color=LIGHT, valign=MSO_ANCHOR.MIDDLE)
    text(slide, 12.1, 7.26, 0.7, 0.2, f"{number:02d}", size=8, color=PEACH_LIGHT,
         bold=True, align=PP_ALIGN.RIGHT, valign=MSO_ANCHOR.MIDDLE)
    return slide


def slide_title_cover(prs, data):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = NAVY
    box(slide, 0, 0, SLIDE_W, 0.15, PEACH)
    box(slide, 0, 0, 0.22, SLIDE_H, TEAL)

    chip(slide, 0.85, 0.75, 3.35, 0.42, "IT404050  ·  GROUP ASSIGNMENT 2",
         fill=NAVY_2, color=PEACH_LIGHT, size=10, bold=True)
    text(slide, 0.85, 1.45, 7.4, 1.05, "MediChannel", size=48, color=WHITE, bold=True)
    text(slide, 0.87, 2.52, 7.2, 0.9, "Hospital Channelling and\nAppointment System",
         size=24, color=PEACH_LIGHT, bold=True)
    box(slide, 0.88, 3.55, 2.0, 0.06, PEACH)
    text(slide, 0.87, 3.8, 7.0, 0.4, "Group MediChannel  ·  26 November 2026", size=13, color=LIGHT)

    text(slide, 0.87, 4.65, 7.3, 0.3, "LIVE PRODUCTION", size=9, color=PEACH, bold=True)
    box(slide, 0.85, 5.02, 7.35, 0.52, NAVY_2, rounded=True)
    text(slide, 1.05, 5.06, 6.95, 0.44,
         "Frontend  medichannel-f-p3z5.vercel.app/mediclinic-system.html#welcome",
         size=9.5, color=WHITE, valign=MSO_ANCHOR.MIDDLE)
    box(slide, 0.85, 5.68, 7.35, 0.52, NAVY_2, rounded=True)
    text(slide, 1.05, 5.72, 6.95, 0.44,
         "API  evening-plains-20028-0ce7ee55df0f.herokuapp.com",
         size=9.5, color=WHITE, valign=MSO_ANCHOR.MIDDLE)

    if HERO_IMAGE.exists():
        box(slide, 8.55, 0.9, 4.25, 3.85, PEACH, rounded=True)
        slide.shapes.add_picture(str(HERO_IMAGE), Inches(8.72), Inches(1.07),
                                 width=Inches(3.91))
        text(slide, 8.72, 4.42, 3.9, 0.25, "Secure care, connected in real time",
             size=9, color=WHITE, italic=True, align=PP_ALIGN.CENTER)

    for index, (number, label) in enumerate([("40", "doctors"), ("15", "specialisations"), ("50", "sessions")]):
        x = 8.72 + index * 1.32
        box(slide, x, 5.05, 1.2, 1.25, NAVY_2, rounded=True)
        text(slide, x, 5.17, 1.2, 0.5, number, size=22, color=PEACH_LIGHT, bold=True,
             align=PP_ALIGN.CENTER)
        text(slide, x, 5.72, 1.2, 0.35, label, size=8, color=LIGHT, align=PP_ALIGN.CENTER)

    box(slide, 0, 7.25, SLIDE_W, 0.25, PEACH)
    set_notes(slide, data)
    return slide


def slide_problem(prs, data):
    slide = content_slide(prs, "Problem and solution", "From paper register to live platform", 2, "01 · Context")
    box(slide, 0.6, 1.85, 5.85, 0.45, RGBColor(0xFB, 0xE8, 0xDF), rounded=True)
    text(slide, 0.78, 1.9, 5.5, 0.33, "BEFORE  ·  MANUAL PROCESS", size=10, color=RGBColor(0xA8, 0x4E, 0x2C), bold=True)
    problems = ["phone bookings", "paper register", "duplicate numbers", "invisible queue",
                "personal messaging apps", "mass calls for cancellations", "spreadsheet patient data"]
    for index, item in enumerate(problems):
        col, row = index % 2, index // 2
        x = 0.6 + col * 3.0
        y = 2.45 + row * 0.82
        box(slide, x, y, 2.82, 0.68, WHITE, rounded=True, line=LIGHT)
        circle(slide, x + 0.12, y + 0.2, 0.28, RGBColor(0xFB, 0xE8, 0xDF))
        text(slide, x + 0.15, y + 0.235, 0.22, 0.2, str(index + 1), size=8,
             color=RGBColor(0xA8, 0x4E, 0x2C), bold=True, align=PP_ALIGN.CENTER)
        text(slide, x + 0.52, y + 0.12, 2.15, 0.45, item, size=10.5, color=NAVY,
             valign=MSO_ANCHOR.MIDDLE)

    box(slide, 6.85, 1.85, 5.85, 0.45, MINT, rounded=True)
    text(slide, 7.03, 1.9, 5.5, 0.33, "MEDICHANNEL  ·  SECURE PLATFORM", size=10, color=TEAL, bold=True)
    solutions = ["booking", "live queues", "online consultation", "payment", "notices", "feedback", "reports"]
    for index, item in enumerate(solutions):
        col, row = index % 2, index // 2
        x = 6.85 + col * 3.0
        y = 2.45 + row * 0.82
        box(slide, x, y, 2.82, 0.68, WHITE, rounded=True, line=LIGHT)
        circle(slide, x + 0.12, y + 0.2, 0.28, TEAL)
        text(slide, x + 0.15, y + 0.235, 0.22, 0.2, "✓", size=9, color=WHITE,
             bold=True, align=PP_ALIGN.CENTER)
        text(slide, x + 0.52, y + 0.12, 2.15, 0.45, item, size=10.5, color=NAVY,
             valign=MSO_ANCHOR.MIDDLE)

    box(slide, 0.6, 5.85, 12.1, 0.95, NAVY, rounded=True)
    outcomes = ["Faster patient flow", "Privacy by design", "Auditable staff actions", "Live on free hosting"]
    for index, item in enumerate(outcomes):
        x = 0.85 + index * 3.0
        text(slide, x, 6.02, 2.75, 0.3, item, size=11, color=WHITE, bold=True,
             align=PP_ALIGN.CENTER)
        if index < 3:
            box(slide, x + 2.83, 6.05, 0.02, 0.45, RGBColor(0x3E, 0x5A, 0x76))
    set_notes(slide, data)
    return slide


def slide_team(prs, data):
    slide = content_slide(prs, "Team", "Team and responsibilities", 3, "02 · People")
    members = [
        ("PD", "P.A. Dhanushka", "WCM/24/B1/26", "wcm24b126-hue",
         "Team leader; database, authentication/roles, encryption, integration", TEAL),
        ("BV", "B. Vinojan", "WCM/24/B2/29", "LkMadMan",
         "WebSockets, role pages, feedback and notices", PEACH),
        ("SK", "S. Kapilan", "SIS/24/B1/07", "—",
         "Database, authentication/roles, encryption", NAVY_2),
        ("MF", "M.H.M. Fahim", "WCM/24/B2/12", "Fahim10001",
         "Database, authentication/roles, encryption", TEAL),
        ("HH", "H.M. Hasfak", "SIS/24/B2/19", "Hasfak7",
         "Caching, deployment, live testing, report, slides and rehearsal", PEACH),
    ]
    positions = [(0.62, 1.9), (4.72, 1.9), (8.82, 1.9), (2.67, 4.15), (6.77, 4.15)]
    for (initials, name, student_id, github, responsibility, accent), (x, y) in zip(members, positions):
        box(slide, x, y, 3.88, 2.0, WHITE, rounded=True, line=LIGHT)
        box(slide, x, y, 0.09, 2.0, accent)
        circle(slide, x + 0.28, y + 0.26, 0.6, accent)
        text(slide, x + 0.28, y + 0.39, 0.6, 0.3, initials, size=12, color=WHITE,
             bold=True, align=PP_ALIGN.CENTER)
        text(slide, x + 1.0, y + 0.26, 2.65, 0.35, name, size=13, color=NAVY, bold=True)
        text(slide, x + 1.0, y + 0.62, 2.65, 0.25, student_id, size=9, color=GREY)
        text(slide, x + 1.0, y + 0.88, 2.65, 0.25, "@" + github, size=9, color=TEAL)
        box(slide, x + 0.28, y + 1.22, 3.3, 0.02, LIGHT)
        text(slide, x + 0.28, y + 1.35, 3.3, 0.5, responsibility, size=9.5, color=NAVY)

    box(slide, 0.62, 6.45, 12.08, 0.5, MINT, rounded=True)
    text(slide, 0.85, 6.52, 11.6, 0.32,
         "Every member will explain their own work during the presentation and Q&A.",
         size=10.5, color=TEAL, bold=True, align=PP_ALIGN.CENTER)
    set_notes(slide, data)
    return slide


def slide_architecture(prs, data):
    slide = content_slide(prs, "Architecture", "System architecture", 4, "03 · Design")
    text(slide, 0.62, 1.78, 12.0, 0.3,
         "Browser → Next.js App Router and BFF route handlers → Spring Boot REST API → PostgreSQL",
         size=11, color=GREY, bold=True)

    stages = [
        (0.62, "Browser", "React / static visual twin", TEAL),
        (3.75, "Next.js BFF", "App Router route handlers", NAVY_2),
        (6.88, "Spring Boot", "REST API  /api/v1", TEAL),
        (10.01, "PostgreSQL", "Supabase database", NAVY_2),
    ]
    for x, title, subtitle, accent in stages:
        box(slide, x, 2.35, 2.7, 1.35, WHITE, rounded=True, line=LIGHT)
        box(slide, x, 2.35, 2.7, 0.08, accent)
        text(slide, x + 0.15, 2.58, 2.4, 0.35, title, size=14, color=NAVY, bold=True,
             align=PP_ALIGN.CENTER)
        text(slide, x + 0.15, 3.0, 2.4, 0.45, subtitle, size=9.5, color=GREY,
             align=PP_ALIGN.CENTER)
    for x in (3.4, 6.53, 9.66):
        arrow(slide, x, 2.82, 0.28, 0.35, PEACH)

    chip(slide, 3.8, 3.92, 2.6, 0.42, "HTTPS  ·  HTTP-only Secure __Host- cookie",
         fill=MINT, color=TEAL, size=8.5)
    chip(slide, 6.95, 3.92, 2.6, 0.42, "server-side API_URL  ·  bearer JWT",
         fill=MINT, color=TEAL, size=8.5)

    box(slide, 6.88, 4.7, 5.83, 1.1, NAVY, rounded=True)
    text(slide, 7.1, 4.85, 5.4, 0.3, "STOMP / WebSocket  /ws", size=13, color=WHITE, bold=True)
    text(slide, 7.1, 5.18, 5.4, 0.45,
         "WSS ticket → queue, chat and notification topics", size=10, color=PEACH_LIGHT)
    arrow(slide, 8.15, 3.75, 0.3, 0.85, PEACH)

    for index, (name, colour) in enumerate([("Vercel", TEAL), ("Heroku", PEACH), ("Supabase", NAVY_2)]):
        chip(slide, 0.62 + index * 2.0, 4.72, 1.85, 0.48, name, fill=colour, color=WHITE, size=10, bold=True)
    text(slide, 0.62, 5.4, 5.7, 0.6,
         "JWT remains in an HTTP-only Secure __Host- cookie; the browser never stores the bearer token.",
         size=9.5, color=GREY)
    text(slide, 0.62, 6.15, 5.8, 0.3,
         "Deployed with Vercel frontend, Heroku backend and Supabase PostgreSQL.",
         size=9.5, color=GREY, bold=True)
    set_notes(slide, data)
    return slide


def slide_database(prs, data):
    slide = content_slide(prs, "Database", "Database design and ERD", 5, "04 · Data")
    text(slide, 0.62, 1.78, 12.0, 0.3,
         "PostgreSQL with UUID keys, foreign keys, CHECK constraints, partial indexes and Flyway migrations",
         size=11, color=GREY, bold=True)

    box(slide, 0.62, 2.3, 6.0, 4.15, WHITE, rounded=True, line=LIGHT)
    box(slide, 0.62, 2.3, 6.0, 0.08, TEAL)
    text(slide, 0.88, 2.55, 2.0, 0.7, "14", size=38, color=TEAL, bold=True)
    text(slide, 1.95, 2.78, 3.8, 0.35, "core tables", size=13, color=NAVY, bold=True)
    tables = ["users", "patients", "specialisations", "doctors", "rooms", "doctor_sessions", "appointments",
              "consultation_summaries", "chat_messages", "payments", "reviews", "notifications", "notices", "audit_logs"]
    for index, table_name in enumerate(tables):
        col, row = index // 7, index % 7
        x = 0.9 + col * 2.75
        y = 3.42 + row * 0.41
        box(slide, x, y, 2.55, 0.33, MINT if col == 0 else LIGHT_GREY, rounded=True)
        text(slide, x + 0.08, y + 0.025, 2.4, 0.26, table_name, size=8.5,
             color=NAVY, valign=MSO_ANCHOR.MIDDLE)

    cards = [
        ("Constraints", "UUID primary keys, foreign keys, unique and CHECK constraints, partial indexes.", TEAL),
        ("Appointment trigger", "Row-locking trigger allocates queue numbers; no duplicate or reused numbers.", PEACH),
        ("Flyway 29", "Live migration version. Seed data is fictional only.", NAVY_2),
    ]
    for index, (title, description, accent) in enumerate(cards):
        y = 2.3 + index * 1.42
        box(slide, 6.95, y, 5.76, 1.24, WHITE, rounded=True, line=LIGHT)
        box(slide, 6.95, y, 0.09, 1.24, accent)
        text(slide, 7.25, y + 0.16, 5.15, 0.32, title, size=13, color=NAVY, bold=True)
        text(slide, 7.25, y + 0.55, 5.15, 0.55, description, size=10, color=GREY)
    set_notes(slide, data)
    return slide


def slide_security(prs, data):
    slide = content_slide(prs, "Security", "Security and encryption evidence", 6, "05 · Trust")
    cards = [
        ("A", "AES-256-GCM", "Random IV for every personal and clinical field.", TEAL),
        ("H", "HMAC + bcrypt", "HMAC-SHA256 email/NIC lookup hashes; bcrypt cost 12 passwords.", PEACH),
        ("J", "JWT + lockout", "Role and token-version claims; five failed logins lock for 15 minutes.", NAVY_2),
        ("C", "Exact origins", "CORS and WSS allow only the production and preview Vercel origins.", TEAL),
        ("V", "Live ciphertext", "v1: prefix at rest; decrypted name visible only to treating doctor.", PEACH),
        ("4", "Role denial", "Patient receives 403 for doctor and manager endpoints.", NAVY_2),
    ]
    for index, (letter, title, description, accent) in enumerate(cards):
        col, row = index % 3, index // 3
        x = 0.62 + col * 4.1
        y = 1.95 + row * 1.75
        box(slide, x, y, 3.85, 1.55, WHITE, rounded=True, line=LIGHT)
        circle(slide, x + 0.22, y + 0.22, 0.48, accent)
        text(slide, x + 0.22, y + 0.325, 0.48, 0.25, letter, size=11, color=WHITE,
             bold=True, align=PP_ALIGN.CENTER)
        text(slide, x + 0.82, y + 0.22, 2.8, 0.35, title, size=12, color=NAVY, bold=True)
        text(slide, x + 0.25, y + 0.75, 3.35, 0.65, description, size=9.5, color=GREY)

    box(slide, 0.62, 5.65, 12.09, 1.15, NAVY, rounded=True)
    text(slide, 0.9, 5.82, 11.5, 0.32, "LIVE EVIDENCE", size=9, color=PEACH_LIGHT, bold=True)
    text(slide, 0.9, 6.14, 11.5, 0.45,
         "v1: ciphertext at rest  →  decrypted name visible only to treating doctor  ·  patient role probes return 403",
         size=11, color=WHITE)
    set_notes(slide, data)
    return slide


def slide_rules(prs, data):
    slide = content_slide(prs, "Rules and real-time", "Booking rules and real-time behaviour", 7, "06 · Behaviour")
    box(slide, 0.62, 1.85, 6.0, 0.45, MINT, rounded=True)
    text(slide, 0.82, 1.91, 5.6, 0.3, "BR-01 — BR-11", size=11, color=TEAL, bold=True)
    text(slide, 0.65, 2.42, 5.9, 0.5,
         "session fields, no overlap, unique queue numbers, one active booking, cutoffs, estimate formula, "
         "cancellation, status flow, consultation room, validation and history protection",
         size=9.5, color=GREY)
    br_items = ["session fields", "no overlap", "unique numbers", "one active booking", "cutoffs",
                "estimate formula", "cancellation", "status flow", "consultation room", "validation", "history protection"]
    for index, item in enumerate(br_items):
        col, row = index % 2, index // 2
        x = 0.62 + col * 3.05
        y = 3.05 + row * 0.52
        box(slide, x, y, 2.9, 0.42, WHITE if index % 2 == 0 else LIGHT_GREY, rounded=True, line=LIGHT)
        text(slide, x + 0.12, y + 0.06, 2.65, 0.28, f"BR-{index + 1:02d}  {item}", size=8.5,
             color=NAVY, valign=MSO_ANCHOR.MIDDLE)
    chip(slide, 0.62, 6.05, 5.9, 0.48, "Physical −60 min  ·  Online −30 min  ·  Break 11:00–13:00",
         fill=PEACH, color=WHITE, size=10, bold=True)

    box(slide, 6.95, 1.85, 5.76, 0.45, RGBColor(0xFB, 0xE8, 0xDF), rounded=True)
    text(slide, 7.15, 1.91, 5.4, 0.3, "RT-01 — RT-04", size=11,
         color=RGBColor(0xA8, 0x4E, 0x2C), bold=True)
    rt_items = [
        ("RT-01", "Live now-serving number", TEAL),
        ("RT-02", "Live availability after booking or cancellation", PEACH),
        ("RT-03", "Private encrypted chat with typing indicator and connection status", NAVY_2),
        ("RT-04", "Called, three-away, consultation-started, delayed and cancelled notifications", TEAL),
    ]
    for index, (code, description, accent) in enumerate(rt_items):
        y = 2.5 + index * 1.0
        box(slide, 6.95, y, 5.76, 0.85, WHITE, rounded=True, line=LIGHT)
        box(slide, 6.95, y, 0.09, 0.85, accent)
        text(slide, 7.2, y + 0.08, 1.0, 0.25, code, size=9, color=accent, bold=True)
        text(slide, 7.2, y + 0.34, 5.2, 0.42, description, size=9.5, color=NAVY)
    set_notes(slide, data)
    return slide


def slide_demo(prs, data):
    slide = content_slide(prs, "Demo", "Live demo path", 8, "07 · Walkthrough")
    steps = [
        "Open the production Vercel frontend and show live counters.",
        "Register a fictional patient and complete the profile.",
        "Book one physical and one online appointment; show queue numbers.",
        "Sign in as doctor; accept, check in, start consultations and chat.",
        "Complete consultations and publish summaries.",
        "Show patient 403 denial for manager/doctor endpoints.",
        "Cancel an empty future session and show the patient notification.",
        "Show v1: ciphertext in the database and the decrypted doctor view.",
    ]
    for index, step in enumerate(steps):
        col, row = index // 4, index % 4
        x = 0.62 + col * 6.15
        y = 1.95 + row * 1.12
        box(slide, x, y, 5.85, 0.94, WHITE, rounded=True, line=LIGHT)
        circle(slide, x + 0.2, y + 0.2, 0.52, TEAL if col == 0 else PEACH)
        text(slide, x + 0.2, y + 0.325, 0.52, 0.25, str(index + 1), size=12, color=WHITE,
             bold=True, align=PP_ALIGN.CENTER)
        text(slide, x + 0.9, y + 0.17, 4.75, 0.62, step, size=10.5, color=NAVY,
             valign=MSO_ANCHOR.MIDDLE)
        if row < 3:
            box(slide, x + 0.44, y + 0.94, 0.03, 0.18, LIGHT)
    box(slide, 0.62, 6.55, 12.09, 0.42, MINT, rounded=True)
    text(slide, 0.85, 6.61, 11.6, 0.28,
         "Fictional patient data only  ·  live production URLs  ·  no passwords or real records",
         size=9.5, color=TEAL, bold=True, align=PP_ALIGN.CENTER)
    set_notes(slide, data)
    return slide


def slide_testing(prs, data):
    slide = content_slide(prs, "Testing", "Testing and evidence", 9, "08 · Verification")
    metrics = [
        ("88", "backend tests", TEAL),
        ("114", "frontend unit checks", NAVY_2),
        ("54", "smoke checks", PEACH),
        ("40/40", "live E2E", TEAL),
        ("12/12", "post-E2E", NAVY_2),
    ]
    for index, (number, label, accent) in enumerate(metrics):
        x = 0.62 + index * 2.45
        box(slide, x, 1.95, 2.25, 1.55, WHITE, rounded=True, line=LIGHT)
        box(slide, x, 1.95, 2.25, 0.08, accent)
        text(slide, x, 2.2, 2.25, 0.62, number, size=27, color=accent, bold=True,
             align=PP_ALIGN.CENTER)
        text(slide, x + 0.1, 2.92, 2.05, 0.35, label, size=9.5, color=GREY,
             align=PP_ALIGN.CENTER)

    box(slide, 0.62, 3.75, 7.35, 2.6, WHITE, rounded=True, line=LIGHT)
    text(slide, 0.9, 3.95, 6.8, 0.35, "30-CASE TEST TABLE", size=12, color=NAVY, bold=True)
    categories = [
        ("Authentication and lockout", 6, TEAL),
        ("CORS and WebSocket", 6, PEACH),
        ("Booking and BR rules", 8, NAVY_2),
        ("Real-time", 5, TEAL),
        ("Admin and audit", 3, PEACH),
        ("Deployment", 2, NAVY_2),
    ]
    for index, (label, count, accent) in enumerate(categories):
        y = 4.45 + index * 0.29
        text(slide, 0.9, y, 3.7, 0.22, label, size=8.5, color=GREY)
        box(slide, 4.65, y + 0.04, 2.5, 0.13, LIGHT_GREY, rounded=True)
        box(slide, 4.65, y + 0.04, 2.5 * count / 8, 0.13, accent, rounded=True)
        text(slide, 7.25, y - 0.01, 0.4, 0.22, str(count), size=8.5, color=NAVY, bold=True)

    if CIPHER_IMAGE.exists():
        box(slide, 8.25, 3.75, 4.46, 2.6, WHITE, rounded=True, line=LIGHT)
        slide.shapes.add_picture(str(CIPHER_IMAGE), Inches(8.42), Inches(3.92), width=Inches(4.12))
        text(slide, 8.42, 5.92, 4.1, 0.28, "Redacted ciphertext evidence", size=8.5,
             color=GREY, italic=True, align=PP_ALIGN.CENTER)

    text(slide, 0.62, 6.52, 12.0, 0.42,
         "Required 30-case table is provided in TEST_CASES_30.md  ·  all live E2E runs used fictional patients",
         size=9.5, color=GREY)
    set_notes(slide, data)
    return slide


def slide_conclusion(prs, data):
    slide = content_slide(prs, "Conclusion", "Deployment, reflection and conclusion", 10, "09 · Close")
    for index, (name, accent) in enumerate([("Supabase PostgreSQL", NAVY_2), ("Heroku Spring Boot", PEACH), ("Vercel Next.js", TEAL)]):
        x = 0.62 + index * 2.95
        chip(slide, x, 1.95, 2.6, 0.62, name, fill=accent, color=WHITE, size=10, bold=True)
        if index < 2:
            arrow(slide, x + 2.66, 2.11, 0.24, 0.3, GREY)

    details = [
        "Production frontend commit 00bfe0d; backend commit a555f11, Heroku release v58",
        "Caffeine TTL cache, no-store personal data, compression and exact-origin CORS",
        "AI disclosure: OpenCode assisted documentation, verification scripts and log analysis; all work was reviewed by the group",
    ]
    for index, detail in enumerate(details):
        y = 2.85 + index * 0.72
        box(slide, 0.62, y, 7.1, 0.6, WHITE, rounded=True, line=LIGHT)
        text(slide, 0.82, y + 0.08, 6.7, 0.44, detail, size=9.5, color=NAVY,
             valign=MSO_ANCHOR.MIDDLE)

    if WELCOME_IMAGE.exists():
        box(slide, 8.05, 2.85, 4.66, 2.25, WHITE, rounded=True, line=LIGHT)
        slide.shapes.add_picture(str(WELCOME_IMAGE), Inches(8.22), Inches(3.02), width=Inches(4.32))
        text(slide, 8.22, 4.7, 4.3, 0.25, "Production welcome page with live counters",
             size=8.5, color=GREY, italic=True, align=PP_ALIGN.CENTER)

    box(slide, 0.62, 5.35, 12.09, 1.1, NAVY, rounded=True)
    text(slide, 0.9, 5.52, 11.5, 0.35,
         "Secure, live, role-based full-stack system with evidence for every brief criterion.",
         size=14, color=WHITE, bold=True)
    text(slide, 0.9, 5.95, 11.5, 0.32,
         "Backup 8–10 minute demo recording: drive.google.com/drive/u/1/folders/1D7_RV90haVzTvYngc10b0ECImY1iPta7",
         size=8.5, color=PEACH_LIGHT)
    set_notes(slide, data)
    return slide


def main() -> None:
    slides_data = parse_slides()
    prs = Presentation()
    prs.slide_width = Inches(SLIDE_W)
    prs.slide_height = Inches(SLIDE_H)

    builders = [
        slide_title_cover, slide_problem, slide_team, slide_architecture,
        slide_database, slide_security, slide_rules, slide_demo,
        slide_testing, slide_conclusion,
    ]
    for data, builder in zip(slides_data, builders):
        builder(prs, data)

    prs.save(OUTPUT)
    print(f"PPTX written: {OUTPUT} ({len(prs.slides)} slides)")

    # Verify that every source line survives in speaker notes.
    def normalise(value: str) -> str:
        return re.sub(r"[\s`]+", "", value).lower()

    all_notes = normalise("\n".join(
        slide.notes_slide.notes_text_frame.text for slide in prs.slides
    ))
    missing = []
    for data in slides_data:
        for line in data["lines"]:
            cleaned = re.sub(r"^(?:[-*]\s*|\d+\.\s+)", "", line)
            if normalise(cleaned) not in all_notes:
                missing.append(cleaned)
    print(f"Source lines preserved in notes: {sum(len(d['lines']) for d in slides_data) - len(missing)}"
          f"/{sum(len(d['lines']) for d in slides_data)}")
    if missing:
        print("WARNING: missing lines:", missing)


if __name__ == "__main__":
    main()
