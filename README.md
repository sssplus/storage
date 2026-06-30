# PDF & DOC → Markdown Converter

A simple, dependency-minimal command-line tool to convert **PDF**, **DOC**, and **DOCX** files into clean **Markdown (.md)** files.

---

## Installation

```powershell
# Navigate to the project folder
cd C:\Users\Soumedhik\.gemini\antigravity\scratch\pdf-doc-to-markdown

# Install Python dependencies
pip install -r requirements.txt
```

> **Note for legacy `.doc` files**: These require **LibreOffice** to be installed.  
> Download from https://www.libreoffice.org/ and ensure `soffice` is on your PATH.  
> Alternatively, open the file in Word and save as `.docx` first.

---

## Usage

```
python converter.py <file_or_folder> [options]
```

### Arguments

| Argument | Description |
|---|---|
| `<file_or_folder>` | Path to a single file or a folder containing files to convert |
| `-o, --output <dir>` | Output directory for `.md` files (default: same folder as input) |
| `-r, --recursive` | Also search subdirectories |
| `--overwrite` | Overwrite existing `.md` files |

### Examples

```powershell
# Convert a single PDF
python converter.py report.pdf

# Convert a single DOCX, save to a specific folder
python converter.py document.docx -o C:\MyMarkdown

# Convert all PDFs and DOCXs in a folder
python converter.py C:\MyDocuments

# Recursively convert an entire directory tree, overwriting old results
python converter.py C:\MyDocuments -r --overwrite -o C:\MyMarkdown
```

---

## What It Converts

| Feature | PDF | DOCX |
|---|---|---|
| Headings (H1–H6) | ✅ (by font size heuristic) | ✅ (by Word style) |
| Bold / Italic | ✅ | ✅ |
| Strikethrough | — | ✅ |
| Bullet lists | — | ✅ |
| Numbered lists | — | ✅ |
| Nested lists | — | ✅ |
| Block quotes | — | ✅ |
| Code blocks | — | ✅ |
| Tables | — | ✅ |
| Page markers | ✅ (HTML comments) | — |

---

## Dependencies

| Package | Purpose | Install |
|---|---|---|
| `pymupdf` | PDF parsing | `pip install pymupdf` |
| `python-docx` | DOCX parsing | `pip install python-docx` |
| LibreOffice *(optional)* | Legacy `.doc` support | https://www.libreoffice.org |
