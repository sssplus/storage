"""
Flask web app — PDF / DOC / DOCX  →  Markdown
Run:  python app.py
Open: http://localhost:5000
"""

import os
import sys
import tempfile
from pathlib import Path
from flask import Flask, request, send_file, render_template, jsonify

# ── bring in conversion logic from converter.py ──────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))
from converter import pdf_to_markdown, docx_to_markdown, doc_to_markdown

# ── app setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024   # 50 MB limit

ALLOWED = {".pdf", ".doc", ".docx"}

# ── routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/convert", methods=["POST"])
def convert():
    if "file" not in request.files:
        return jsonify(error="No file received."), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify(error="Empty filename."), 400

    suffix = Path(f.filename).suffix.lower()
    if suffix not in ALLOWED:
        return jsonify(error=f"Unsupported format '{suffix}'. Use PDF, DOC or DOCX."), 415

    # Save upload to a temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        f.save(tmp.name)
        tmp_path = Path(tmp.name)

    try:
        if suffix == ".pdf":
            md_text = pdf_to_markdown(tmp_path)
        elif suffix == ".docx":
            md_text = docx_to_markdown(tmp_path)
        else:
            md_text = doc_to_markdown(tmp_path)
    except Exception as exc:
        tmp_path.unlink(missing_ok=True)
        return jsonify(error=str(exc)), 500

    tmp_path.unlink(missing_ok=True)

    # Write markdown to another temp file and stream it back
    stem = Path(f.filename).stem
    out_tmp = tempfile.NamedTemporaryFile(
        delete=False, suffix=".md", mode="w", encoding="utf-8"
    )
    out_tmp.write(md_text)
    out_tmp.close()

    return send_file(
        out_tmp.name,
        as_attachment=True,
        download_name=stem + ".md",
        mimetype="text/markdown",
    )


# ── run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)
