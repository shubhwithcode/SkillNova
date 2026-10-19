"""
SkillNova - extract_resume.py

Node.js <-> Python interface (documented):
  Node runs:    python python_service/extract_resume.py <path-to-pdf>
  Python prints ONE JSON object to stdout and exits:
    success case: {"ok": true,  "text": "...", "pages": 2,
                   "emails": [...], "links": [...], "sections": [...]}
    error case:   {"ok": false, "error": "human-readable reason"}

Only text EXTRACTION happens here (pdfplumber). Scoring and feedback
happen in the Node backend so there is one documented scoring method.
The uploaded file is never executed - it is only read as a PDF.
"""

import json
import re
import sys


SECTION_KEYWORDS = {
    "education": ["education", "academic", "qualification"],
    "skills": ["skills", "technical skills", "technologies"],
    "projects": ["projects", "project work", "academic projects"],
    "experience": ["experience", "internship", "work history", "employment"],
    "achievements": ["achievements", "accomplishments", "awards"],
    "certifications": ["certifications", "certificates", "courses"],
    "contact": ["contact", "phone", "email"],
}


def extract(pdf_path: str) -> dict:
    try:
        import pdfplumber
    except ImportError:
        return {"ok": False, "error": "pdfplumber is not installed. Run: pip install pdfplumber"}

    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages = len(pdf.pages)
            text_parts = []
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                text_parts.append(page_text)
            text = "\n".join(text_parts).strip()
    except Exception as exc:  # corrupted / encrypted / not a real PDF
        return {"ok": False, "error": f"Could not read the PDF: {exc}"}

    if len(text) < 100:
        return {
            "ok": False,
            "error": (
                "No readable text found in this PDF. It may be a scanned image "
                "or an empty file. Please upload a text-based PDF resume."
            ),
        }

    lower = text.lower()

    emails = sorted(set(re.findall(r"[\w.+-]+@[\w-]+\.[\w.]+", text)))
    links = sorted(set(re.findall(r"(?:https?://|www\.)[^\s|)\]}>,]+", text)))
    # linkedin/github without protocol are common on resumes
    links += sorted(set(re.findall(r"(?:linkedin\.com|github\.com)/[^\s|)\]}>,]+", lower)))
    links = sorted(set(links))

    sections = [
        name
        for name, keywords in SECTION_KEYWORDS.items()
        if any(k in lower for k in keywords)
    ]

    return {
        "ok": True,
        "text": text[:20000],  # cap so huge PDFs cannot flood the backend
        "pages": pages,
        "emails": emails[:5],
        "links": links[:10],
        "sections": sections,
    }


def main() -> None:
    if len(sys.argv) != 2:
        print(json.dumps({"ok": False, "error": "Usage: extract_resume.py <pdf-path>"}))
        sys.exit(1)

    result = extract(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
