#!/usr/bin/env python3
"""Generate an IEEE-style PDF from the project white paper markdown."""

from __future__ import annotations

import html
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parent
INPUT_MD = ROOT / "EVALUATE_YOURSELF_IEEE_WHITE_PAPER.md"
OUTPUT_PDF = ROOT / "EVALUATE_YOURSELF_IEEE_WHITE_PAPER.pdf"


def build_styles():
    styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            alignment=TA_CENTER,
            spaceAfter=6,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=12,
            alignment=TA_CENTER,
            textColor=colors.black,
            spaceAfter=6,
        ),
        "section": ParagraphStyle(
            "Section",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=13,
            alignment=TA_LEFT,
            spaceBefore=8,
            spaceAfter=4,
        ),
        "subsection": ParagraphStyle(
            "Subsection",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            alignment=TA_LEFT,
            spaceBefore=6,
            spaceAfter=3,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            alignment=TA_JUSTIFY,
            spaceAfter=4,
        ),
        "index_terms": ParagraphStyle(
            "IndexTerms",
            parent=styles["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=9,
            leading=12,
            alignment=TA_JUSTIFY,
            spaceAfter=5,
        ),
        "reference": ParagraphStyle(
            "Reference",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            alignment=TA_LEFT,
            leftIndent=8,
            spaceAfter=2,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            alignment=TA_LEFT,
        ),
    }


def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(7.5 * inch, 0.35 * inch, f"Page {doc.page}")
    canvas.restoreState()


def p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(html.escape(text), style)


def markdown_to_story(md_path: Path):
    styles = build_styles()
    story = []
    lines = md_path.read_text(encoding="utf-8").splitlines()

    in_references = False
    bullet_items = []
    title_seen = False
    subtitle_count = 0

    def flush_bullets():
        nonlocal bullet_items
        if not bullet_items:
            return
        flow = ListFlowable(
            [ListItem(p(item, styles["bullet"])) for item in bullet_items],
            bulletType="bullet",
            leftPadding=14,
            bulletFontName="Helvetica",
            bulletFontSize=8,
            bulletOffsetY=1,
        )
        story.append(flow)
        story.append(Spacer(1, 4))
        bullet_items = []

    for raw_line in lines:
        line = raw_line.rstrip()
        stripped = line.strip()

        if not stripped:
            flush_bullets()
            if story and not isinstance(story[-1], Spacer):
                story.append(Spacer(1, 3))
            continue

        if stripped.startswith("- "):
            bullet_items.append(stripped[2:].strip())
            continue

        flush_bullets()

        if stripped.startswith("# "):
            title_text = stripped[2:].strip()
            if not title_seen:
                story.append(p(title_text, styles["title"]))
                title_seen = True
            else:
                story.append(p(title_text, styles["section"]))
            continue

        if stripped.startswith("## "):
            heading = stripped[3:].strip()
            in_references = heading.lower() == "references"
            story.append(p(heading, styles["section"]))
            continue

        if stripped.startswith("### "):
            story.append(p(stripped[4:].strip(), styles["subsection"]))
            continue

        if not title_seen:
            story.append(p(stripped, styles["title"]))
            title_seen = True
            continue

        if subtitle_count < 2 and not stripped.startswith("Abstract"):
            story.append(p(stripped, styles["subtitle"]))
            subtitle_count += 1
            continue

        if stripped.startswith("Index Terms"):
            story.append(p(stripped, styles["index_terms"]))
            continue

        if in_references and stripped.startswith("["):
            story.append(p(stripped, styles["reference"]))
        else:
            story.append(p(stripped, styles["body"]))

    flush_bullets()
    return story


def main():
    if not INPUT_MD.exists():
        raise FileNotFoundError(f"Missing source markdown: {INPUT_MD}")

    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=letter,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.6 * inch,
        title="Evaluate Yourself IEEE White Paper",
        author="Evaluate Yourself Project Team",
    )

    story = markdown_to_story(INPUT_MD)
    doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
    print(f"Generated: {OUTPUT_PDF}")


if __name__ == "__main__":
    main()
