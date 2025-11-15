# Dynamic ETL Backend (Node.js + Express + MongoDB)

This project accepts many file types (JSON, CSV, PDF, DOCX, TXT, HTML, XML, image via OCR), extracts text/JSON, stores raw payloads, dynamically infers schemas, normalizes records, and exposes simple APIs.

##
┌─────────────────────────────┐
│ 1. File Ingestion / Upload  │
│ - CSV, JSON, PDF, DOCX,     │
│   HTML, XML, Images          │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│ 2. Extraction (`extractFile`) │
│ - Determines file type (MIME│
│   or extension)             │
│ - Converts file to:          │
│   • JSON → JS object        │
│   • Text → string           │
│ - Handles errors gracefully │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│ 3. Store as RawRecord        │
│ - Payload = extracted JSON   │
│   or text                    │
│ - ingestedAt = timestamp     │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│ 4. Schema Inference          │
│ (`inferAndMaybeCreateVersion`) │
│ - Sample recent RawRecords   │
│ - Walk fields recursively    │
│ - Collect types & presence   │
│ - Build new schema object    │
│ - Compare with latest schema │
│   • If changed → create new  │
│     SchemaVersion             │
│   • Else → skip              │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│ 5. Normalization             │
│ (`normalizePending`)          │
│ - Fetch recent RawRecords     │
│ - Skip if NormalizedRecord    │
│   exists                      │
│ - Normalize payload:          │
│   • Arrays → CSV string       │
│   • Objects → JSON string     │
│   • Numeric strings → int     │
│   • Others → as-is            │
│ - Save as NormalizedRecord    │
│   with schemaVersion          │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│ 6. Final Output              │
│ - Normalized records ready   │
│   for analytics / ETL        │
│ - Schema versions track data │
│   structure over time        │
└─────────────────────────────┘


## Requirements
- Node.js (v16+ recommended)
- npm
- MongoDB (local or Atlas)
- (Optional but recommended) Tesseract OCR binary for better OCR performance:
  - macOS: `brew install tesseract`
  - Ubuntu/Debian: `sudo apt-get install tesseract-ocr`
  - Windows: install from the Tesseract project releases

## Setup
1. Copy this folder to your machine.
2. Install packages:
   ```bash
   npm install

