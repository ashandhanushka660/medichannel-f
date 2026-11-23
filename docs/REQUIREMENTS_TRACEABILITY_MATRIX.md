# MediChannel — Requirements Traceability Matrix (IT404050 Assignment 2)

Brief source: `~/Documents/IT404050_Assignment_2_-_MediChannel_Brief.docx`. Original numbering preserved.

| Req ID | Description | Frontend | Backend | Database | Security/Auth | Test | Result |
|--------|-------------|----------|---------|----------|---------------|------|--------|
| BR-01 | Session: doctor, date, times, type, max patients 1–60, minutes 5–30, fee LKR, status; physical needs room, online doesn't | `public/mediclinic-system.html` session cards + create form | `DoctorSessionService`, `DoctorSessionController` | `doctor_sessions` table + CHECK constraints | MANAGER/ADMIN only create/edit | `DoctorSession*Tests`, smoke | PARTIAL (admin create session UI wired) |
| BR-02 | Doctor/room overlapping sessions forbidden | n/a | `DoctorSessionService` overlap check | DB trigger `no_overlap` | MANAGER | integration tests | PASS |
| BR-03 | Appointment numbers start at 1, unique, never reused, never exceed max, even concurrent | booking success card + client capacity check | `AppointmentService.book` + `BEFORE INSERT` trigger locking session row | `appointments.appointment_number` trigger | CUSTOMER | appointment API/integration tests, DB number allocation tests | PASS (local) |
| BR-04 | One active appointment per patient per session | booking form | `AppointmentService` + partial unique index | partial unique index | CUSTOMER | integration tests | PASS |
| BR-05 | Booking closes 1h before physical, 30m before online | session card disables Book | `AppointmentService` cutoff check | n/a | CUSTOMER | local runtime checks of both consultation types | PASS |
| BR-06 | Estimated time = start + (n-1)*minutes + delay | success card | `AppointmentService` estimate | n/a | n/a | local runtime booking check | PASS |
| BR-07 | Cancel unpaid until 3h before; cancelled kept | appointments page (BOOKED + PENDING only) | `AppointmentService.cancel` | status preserved | CUSTOMER owns | appointment API tests + UI contract tests | PASS |
| BR-08 | Status flow BOOKED→ARRIVED→IN_CONSULTATION→COMPLETED; NO_SHOW; online skips ARRIVED | appointments UI | `AppointmentService` transitions | status enum CHECK | role-gated | lifecycle tests | PASS |
| BR-09 | Consultation room opens only when doctor starts; only patient+doctor; read-only when ended | `public/mediclinic-app.js` consult view | `ChatService` + `ChatWebSocketController` | `chat_messages` | WS dest auth | WS interceptor + lifecycle tests | PASS (local) |
| BR-10 | NIC 9+V/X or 12 digits; phone 07XXXXXXXX; email+NIC unique; password 8–72 bytes with letter/number/symbol | register form + patient profile form | `AuthService`, `PasswordPolicy`, `PatientService` | unique constraints + HMAC lookup | public register / CUSTOMER profile | validation tests + UI contract tests | PASS |
| BR-11 | History never deleted; Asia/Colombo times; NUMERIC money | all history views | services | triggers + NUMERIC(10,2) | role-gated | integration tests | PASS |
| RT-01 | Live "now serving" number updates instantly | queue card (REST + WebSocket) | `SessionQueueService.broadcast` | n/a | WS /topic | local runtime verification + UI contract tests | PASS |
| RT-02 | Numbers left update live after booking/cancel | session cards + queue card | `SessionQueueService.broadcast` on book/cancel/pay | n/a | WS /topic | local runtime verification + UI contract tests | PASS |
| RT-03 | Private chat with typing + connection status, messages saved encrypted | consult view | `ChatService` + STOMP | encrypted `chat_messages` | WS auth | lifecycle + WS interceptor tests | PASS |
| RT-04 | Notifications: 3-away, called, delayed, cancelled, consultation started | toast + badge with direct consultation links | `NotificationService` | `notifications` | user queue | local runtime verification + UI contract tests | PASS |
| Auth | BCrypt, JWT 15m, HTTP-only cookie, lockout 5/15m, session restore | login/register forms, `mediclinic-api.js` | `SecurityConfig`, `JwtService`, `AccountLockout` | users | HttpOnly Secure cookie | `AuthControllerTest`, security tests | PASS |
| RBAC | 4 roles, server-side enforcement, IDOR protection | `data-roles` nav (UI only) | `SecurityConfig`, `AppointmentAccessPolicy` | role FK | all endpoints | `SecurityAuthorizationPostgresIntegrationTests` | PASS |
| Admin | create doctor/manager, list/search, activate/deactivate, reset password | admin view | `AdminPortalController` | users/doctors | ADMIN only | `AdminPortalPostgresIntegrationTests` + UI contract tests | PASS — reset password wired in admin panel |
| Manager | sessions, rooms, doctors, reception, payments, notices, feedback, reports, walk-in booking | manager view | `DoctorSessionController`, `AppointmentController`, `PaymentController`, `NoticeController`, `AdminController` | sessions/rooms/etc. | MANAGER | integration tests | PARTIAL — reports mostly static |
| Walk-in booking | reception registers an on-site patient and issues a queue number | manager reception dialog | `AdminController.bookWalkIn`, `AppointmentService.bookWalkIn` | users, patients, appointments | ADMIN/MANAGER | API client + UI contract tests | IMPLEMENTED |
| Patient requirements | book physical/online, view and cancel own visits, follow queue, join online consultation, read summary, give feedback, manage profile | index, appointments, consult and profile views | appointment, queue, chat, summary, review and patient-profile APIs | appointments, queue, chat, summaries, reviews, patients | CUSTOMER ownership enforced | patient flow contract tests + backend lifecycle tests | IMPLEMENTED |
| Consultation summary | doctor writes; patient reads; encrypted; access rules | consult view summary section | `ConsultationSummaryService` | `consultation_summaries` | ownership + role | `ConsultationLifecyclePostgresIntegrationTests` | PASS (ADMIN/MANAGER blocked via `isStaff` removal) |
| Audit log | logins, account changes, session cancels, consultation opens | admin view | `AuditLogService` | `audit_logs` (V9) | ADMIN read | controller tests | PARTIAL — coverage limited |
| Notices | publish/approve/hide/delete | manager view (removed from admin) | `NoticeController` | `notices` (V8) | role-gated | UI contract + integration tests | PARTIAL — manager CRUD wired; no browser E2E |
| Feedback | 1–5 rating, one per completed, moderation | feedback form, duplicate state disabled | `ReviewService` | `reviews` | role-gated | integration tests + patient flow contract tests | PASS |
| Payments | simulated, PENDING/PAID, CASH/CARD, no duplicates | pay button | `PaymentService` | `payments` | CUSTOMER owns | integration tests | PASS |
| Caching | TTL cache for public lists | none | none | n/a | n/a | n/a | NOT IMPLEMENTED |
| Encryption at rest | AES-256-GCM + HMAC lookup | n/a | `AttributeConverter`s | encrypted columns | env keys | `PatientDataProtectionServiceTests` | PASS |
| WS auth | JWT/ticket on CONNECT; sender from Principal | STOMP client | `WebSocketAuthorizationInterceptor` | n/a | ticket scope | `WebSocketSecurityInterceptorTests` | PASS |
| Concurrency | booking race safety | n/a | trigger locking | DB trigger | n/a | integration tests | PASS |
| Persistence | records survive restart | n/a | JPA | FKs/indexes | n/a | restart tests | PASS (local) |
| Deployment | Netlify + Render + Neon | netlify.toml | render.yaml | Flyway | env vars | smoke | PARTIAL — Netlify was 404 (fixed via plugin) |
| Testing/docs | 30+ test cases, ERD, report, slides | `npm test` contract suites | 64 backend `@Test` methods | n/a | n/a | frontend + backend suites | PASS — automated suites verified; manual E2E evidence is tracked separately |
---

## Final verification addendum — 23 November 2026

The table above is the original traceability snapshot. The following items were verified in the final redeployment cycle:

| Area | Final status | Evidence |
| --- | --- | --- |
| Manager create-account specialisation dropdown | PASS | `tests/manager-specialisations.test.mjs`; manager view now calls `loadAdminSpecialisations()` |
| Public demo credentials | REMOVED | No `data-fill-login` elements remain in `mediclinic-system.html`; credentials are supplied only via the LMS form |
| CORS for Vercel + VPS/Cloudflare frontends | PASS | Exact origins in `APP_FRONTEND_ORIGIN`; wildcard Vercel origin removed |
| WSS handshake | PASS | `101 Switching Protocols` for allowed origins, `403` for attacker origins |
| BFF secure cookie login | PASS | `__Host-medichannel_token` with `Secure; HttpOnly; SameSite=lax` |
| Caching | IMPLEMENTED | Caffeine TTL cache in backend service layer plus cacheable public responses |
| Submission artefacts | PASS | Final report PDF, slides PDF, 30-case test table, role manuals, peer assessment, demo script |

The current evidence-based mark is recorded in
[`IT404050_ASSIGNMENT_2_FINAL_REPORT.md`](./IT404050_ASSIGNMENT_2_FINAL_REPORT.md).
