"""
SkillNova - tests/make_test_pdf.py
Builds a tiny valid one-page PDF (no extra libraries needed) so the
resume extraction pipeline can be tested offline:
    python tests/make_test_pdf.py tests/fixtures/sample_resume.pdf
"""

import sys


def build_pdf(lines):
    # Simple one-page PDF with Helvetica text, correct xref offsets.
    content_parts = ["BT /F1 12 Tf 50 760 Td 16 TL"]
    for line in lines:
        safe = line.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
        content_parts.append(f"({safe}) Tj T*")
    content_parts.append("ET")
    stream = "\n".join(content_parts).encode("latin-1")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for index, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{index} 0 obj\n".encode() + body + b"\nendobj\n"

    xref_pos = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n"
    ).encode()
    return bytes(out)


RESUME_LINES = [
    "Priya Sharma",
    "Email: priya.sharma@example.com | github.com/priyasharma",
    "Education: MCA, TIMSCDR Mumbai, 2027 - CGPA 8.4",
    "Skills: HTML, CSS, JavaScript, Node.js, Express.js, MySQL, REST APIs, Git",
    "Projects: Built a placement portal with Node.js and MySQL for 300 users,",
    "improved page load time by 40%. Created a React quiz app with 20+ screens.",
    "Experience: Web development intern at a Mumbai startup for 3 months.",
    "Achievements: Won 1st prize among 50 teams in a college hackathon.",
    "Certifications: freeCodeCamp Responsive Web Design.",
]

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "tests/fixtures/sample_resume.pdf"
    with open(target, "wb") as handle:
        handle.write(build_pdf(RESUME_LINES))
    print("Wrote", target)
