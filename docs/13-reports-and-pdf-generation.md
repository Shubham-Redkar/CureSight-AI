# 13. Reports and PDF Generation

The Clinical Reports system provides clinicians with a static, highly readable summary of an individual wound assessment, suitable for export to Electronic Health Records (EHR) or patient handoffs.

## Data Retrieval
When a user navigates to the Reports page, the React UI queries `GET /api/reports`. 
This endpoint securely queries PostgreSQL for all `Assessment` records that have a status of either `"COMPLETED"` or `"VERIFIED"`.

The endpoint executes a deep Prisma relation query (`include: { wound: { include: { patient: true } } }`), ensuring the frontend receives the assessment along with its parent wound location and patient demographic information in one single payload.

## PDF Generation Workflow

CureSight AI generates PDFs entirely on the client side without relying on complex backend PDF libraries (like Puppeteer or PDFKit).

1. **Trigger**: The clinician clicks "Download PDF".
2. **Data Fetch**: The UI queries `/api/reports/:id` to fetch the complete assessment JSON.
3. **Hidden Template Mount**: React renders `<PdfReportTemplate>` off-screen using the fetched data.
4. **HTML to Canvas**: `html2canvas` traverses the rendered DOM of the template, capturing it as a static image buffer.
5. **Canvas to PDF**: `jsPDF` wraps the captured image into an A4-sized PDF document.
6. **Download**: The browser triggers a local file download.

## Important Considerations & Fixes

- **The `oklch` Rendering Issue**: Modern CSS frameworks (like Tailwind v4) heavily utilize `oklch()` color functions. The `html2canvas` library historically fails to parse this, causing PDF generation to silently crash. The `<PdfReportTemplate>` is deliberately written using strict, inline `#HEX` codes and avoids generic Tailwind color utility classes to ensure robust PDF generation.
- **Disclaimers**: The PDF strictly injects disclaimers regarding the AI's role (decision support, not autonomous diagnosis) and clearly identifies if the physical measurements were derived from a "Demonstration Calibration" scale.
