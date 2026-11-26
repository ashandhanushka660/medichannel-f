#!/usr/bin/env python3
"""Build the MediChannel final report DOCX and PDF from one Markdown source."""

from pathlib import Path
import html

import markdown

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "IT404050_ASSIGNMENT_2_FINAL_REPORT_SOURCE.md"
HTML_OUT = HERE / "IT404050_ASSIGNMENT_2_FINAL_REPORT.html"

CSS = """
@page { size: A4; margin: 20mm 18mm 18mm 18mm; }
body { font-family: "Liberation Sans", Arial, sans-serif; font-size: 10.5pt; line-height: 1.35; color: #111827; }
h1 { font-size: 22pt; color: #1f3a5f; margin: 0 0 10pt 0; text-align: center; }
h2 { font-size: 15pt; color: #1f3a5f; border-bottom: 1px solid #9ca3af; padding-bottom: 4pt; margin-top: 18pt; }
h3 { font-size: 12pt; color: #2b7a9e; margin-top: 12pt; }
p { margin: 6pt 0; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9pt; }
th, td { border: 1px solid #9ca3af; padding: 5pt; vertical-align: top; }
th { background: #e5e7eb; color: #111827; }
pre { background: #f3f4f6; border: 1px solid #d1d5db; padding: 8pt; font-family: "Liberation Mono", monospace; font-size: 8.5pt; white-space: pre-wrap; }
code { font-family: "Liberation Mono", monospace; font-size: 9pt; }
img { max-width: 100%; border: 1px solid #d1d5db; margin: 6pt 0; }
strong { color: #111827; }
"""


def main() -> None:
    source = SOURCE.read_text(encoding="utf-8")
    body = markdown.markdown(
        source,
        extensions=["tables", "fenced_code", "toc"],
        extension_configs={"toc": {"title": "Contents", "toc_depth": "2-3"}},
    )
    document = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>MediChannel — IT404050 Assignment 2 Final Report</title>
<style>{CSS}</style>
</head>
<body>
{body}
</body>
</html>
"""
    HTML_OUT.write_text(document, encoding="utf-8")
    print(f"HTML written: {HTML_OUT}")
    print(f"Source words: {len(source.split())}")


if __name__ == "__main__":
    main()
