# MediChannel Assignment 2 — Documentation Index

This index maps the brief's deliverables to the submitted files. All PDFs are valid and contain extractable text. No plaintext passwords, tokens, password hashes, `.env` values or real patient data are included.

| Brief deliverable | Submitted file | Notes |
|---|---|---|
| Group report PDF, 4,000–6,000 words | `IT404050_ASSIGNMENT_2_FINAL_REPORT.pdf` | 5,103 source words; 21 A4 pages; generated from `IT404050_ASSIGNMENT_2_FINAL_REPORT_SOURCE.md` |
| Editable group report | `IT404050_ASSIGNMENT_2_FINAL_REPORT.docx` | Same content as the PDF, with embedded evidence screenshots |
| Report source | `IT404050_ASSIGNMENT_2_FINAL_REPORT_SOURCE.md` | Single source of truth for DOCX and PDF generation |
| Architecture diagram | Section 4 of the final report | High-level browser/BFF/API/WS/database flow |
| ERD and database design | `../../be/docs/DATABASE_ERD.md`, `../../be/docs/schema.sql` | Mermaid ERD, constraints, indexes and encryption notes |
| API design | `../../be/docs/API_REFERENCE.md` | Endpoints, status codes, error envelope and WebSocket destinations |
| Security and encryption evidence | Section 8 of the final report and `../../verification/LIVE_VERIFICATION_REPORT.md` | Ciphertext at rest, decrypted doctor view, CORS and role denial |
| Real-time design | Section 10 of the final report and `../../be/docs/API_REFERENCE.md` | STOMP topics, permissions, chat, queue and notifications |
| Screenshots | `../../verification/evidence/`, `../../../medichannel-assignment2-qa/evidence/` | Embedded in the report and indexed in Section 15 |
| Deployment | Section 13 of the final report, `DEPLOYMENT_CHECKLIST.md`, `../../be/docs/DEPLOYMENT_GUIDE.md` | Current Vercel/Heroku/Supabase stack |
| 30+ test cases | `TEST_CASES_30.md` | 30-case table covering auth, CORS, BR, RT, audit and deployment |
| Live verification | `../../verification/LIVE_VERIFICATION_REPORT.md` | 40/40 E2E and 12/12 post-checks |
| Role user manuals | `USER_MANUALS.md` and Section 11/12 of the final report | Short manual for each role |
| Reflection | Section 16 of the final report | Design decisions, challenges and lessons |
| Member contributions | `PEER_ASSESSMENT.md` and Section 2 of the final report | Declared contributions; confidential form submitted separately via LMS |
| AI disclosure | Section 17 of the final report | OpenCode used for documentation, verification scripts and log analysis |
| Presentation slides | `PRESENTATION_SLIDES.md`, `PRESENTATION_SLIDES.pptx`, `PRESENTATION_SLIDES.pdf` | 10 slides in PowerPoint format and PDF |
| Backup demo recording | Link in report and slides | 8–10 minute recording supplied through Google Drive |
