# 30-Case Submission Test Table

| # | Area | Test case | Steps | Expected result | Type | Status |
|---:|---|---|---|---|---|---|
| 1 | Auth | Patient login | Use LMS-supplied patient credentials | JWT cookie set; patient workspace loads | Manual | Pass |
| 2 | Auth | Doctor login | Use LMS-supplied doctor credentials | Doctor workspace loads | Manual | Pass |
| 3 | Auth | Manager login | Use LMS-supplied manager credentials | Manager workspace loads | Manual | Pass |
| 4 | Auth | Admin login | Use LMS-supplied admin credentials | Admin workspace loads | Manual | Pass |
| 5 | Auth | Wrong password | Submit incorrect password | 401; account lockout after limit | Automated | Pass |
| 6 | Auth | Forced password change | Reset staff password then log in | Forced-change response before normal access | Automated | Pass |
| 7 | CORS | Allowed Cloudflare origin | Send frontend origin to backend | Matching ACAO header | Manual | Pass |
| 8 | CORS | Allowed Vercel origin | Send Vercel origin to backend | Matching ACAO header | Manual | Pass |
| 9 | CORS | Attacker origin | Send random vercel.app origin | 403 / no ACAO | Manual | Pass |
| 10 | WebSocket | Allowed WSS handshake | Connect to /ws with valid ticket | 101 Switching Protocols | Manual | Pass |
| 11 | WebSocket | Disallowed origin | Connect with attacker origin | 403 Forbidden | Manual | Pass |
| 12 | WebSocket | Ticket replay | Reuse consumed ticket | Rejected | Automated | Pass |
| 13 | Booking | Future session only | Book past session | Rejected | Automated | Pass |
| 14 | Booking | Duplicate active booking | Book same session twice | Rejected | Automated | Pass |
| 15 | Booking | Capacity | Fill session beyond capacity | Rejected | Automated | Pass |
| 16 | Booking | Queue number monotonic | Cancel then book again | New number; no reuse | Automated | Pass |
| 17 | BR-07 | Late cancellation | Cancel less than 3 hours before start | Rejected | Automated | Pass |
| 18 | BR-07 | Paid cancellation | Cancel PAID appointment | Rejected | Automated | Pass |
| 19 | BR-07 | Blank reason | Cancel without reason | Rejected | Automated | Pass |
| 20 | BR-08 | Physical arrival gate | Start physical consult before ARRIVED | Rejected | Automated | Pass |
| 21 | BR-09 | Chat access gate | Open chat before IN_CONSULTATION | Rejected | Automated | Pass |
| 22 | RT-01 | Queue publish | Doctor calls next patient | Queue topic updates | Manual | Pass |
| 23 | RT-02 | Availability count | Cancel one booking | Availability increases; no number reuse | Automated | Pass |
| 24 | RT-04 | CALLED notification | Call patient | CALLED notification appears | Manual | Pass |
| 25 | RT-04 | Three-away notice | Third active patient reached | Three-away notice appears | Manual | Pass |
| 26 | Chat | Typing indicator | Type in consultation | Typing topic updates | Manual | Pass |
| 27 | Staff | Manager creates doctor | Use create account form with specialisation | Specialisation dropdown loads; doctor created | Manual | Pass |
| 28 | Admin | Audit login | Log in and view audit logs | LOGIN entry present | Manual | Pass |
| 29 | Admin | Consultation audit | Open consultation summary | VIEWED audit entry present | Manual | Pass |
| 30 | Deployment | Health endpoint | Open backend health URL | status=UP | Manual | Pass |
