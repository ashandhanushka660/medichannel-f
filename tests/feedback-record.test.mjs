import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);
const API_SOURCE = readFileSync(
  new URL("../public/mediclinic-api.js", import.meta.url),
  "utf8"
);
const HTML_SOURCE = readFileSync(
  new URL("../public/mediclinic-system.html", import.meta.url),
  "utf8"
);

function functionSource(name) {
  const asyncStart = APP_SOURCE.indexOf(`async function ${name}(`);
  const plainStart = APP_SOURCE.indexOf(`function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : plainStart;
  assert.ok(start >= 0, `${name} was not found`);

  let depth = 0;
  let started = false;
  for (let i = start; i < APP_SOURCE.length; i += 1) {
    const char = APP_SOURCE[i];
    if (char === "{") {
      depth += 1;
      started = true;
    } else if (char === "}") {
      depth -= 1;
      if (started && depth === 0) {
        return APP_SOURCE.slice(start, i + 1);
      }
    }
  }
  throw new Error(`Unterminated function: ${name}`);
}

function makeHarness(role = "CUSTOMER") {
  const nodes = new Map();
  const node = (key, extras = {}) => {
    if (!nodes.has(key)) {
      nodes.set(key, { hidden: false, textContent: "", ...extras });
    }
    return nodes.get(key);
  };

  const form = node("[data-feedback-form]");
  form.querySelector = (selector) =>
    selector === "button[type=submit]"
      ? node("button[type=submit]", { disabled: false })
      : null;

  const document = {
    querySelector: (selector) => (selector === "#consult-rt"
      ? node("#consult-rt", { value: "4", disabled: false })
      : selector === "#consult-fc"
        ? node("#consult-fc", { value: "Helpful doctor", disabled: false })
        : node(selector)),
  };

  const state = {
    consult: {
      appointment: {
        appointmentId: "appointment-77",
        sessionId: "session-1",
        status: "COMPLETED",
      },
      summary: {
        diagnosis: "Tension headache",
        prescription: "Rest and hydration",
      },
    },
    myReviews: [],
    submittedFeedbackIds: new Set(),
    doctor: {
      sessions: [{ sessionId: "session-1", doctorId: "doctor-1" }],
    },
  };

  const calls = [];
  const MC = {
    submitReview: async (...args) => {
      calls.push(["submitReview", ...args]);
      return {
        reviewId: "review-1",
        appointmentId: "appointment-77",
        rating: 4,
        comment: "Helpful doctor",
        moderationStatus: "APPROVED",
        createdAt: "2026-11-23T10:00:00Z",
      };
    },
    myReviews: async () => {
      calls.push(["myReviews"]);
      return state.myReviews;
    },
    doctorSessions: async () => {
      calls.push(["doctorSessions"]);
      return state.doctor.sessions;
    },
    doctorReviews: async (doctorId) => {
      calls.push(["doctorReviews", doctorId]);
      return {
        doctorId,
        averageRating: 4.5,
        reviewCount: 1,
        reviews: state.myReviews,
      };
    },
  };

  const sandbox = {
    document,
    state,
    S: { role },
    MC,
    $: (id) => document.querySelector(`#${id}`),
    setStatus: (target, message) => {
      if (target) {
        target.textContent = message || "";
        target.hidden = !message;
      }
    },
    formatDateTime: () => "23 Nov 2026",
  };

  const source = [
    "findConsultationReview",
    "hasConsultationFeedback",
    "renderFeedbackRecord",
    "updateConsultSummaryLine",
    "markFeedbackSubmitted",
    "submitFeedback",
    "doctorIdForConsultation",
    "loadConsultationReviewState",
  ].map(functionSource).join("\n\n");

  const api = new Function(
    ...Object.keys(sandbox),
    `${source}\nreturn { submitFeedback, loadConsultationReviewState };`
  )(...Object.values(sandbox));

  return { api, calls, document, node, state };
}

test("submitted feedback is shown in the consultation summary and feedback card", async () => {
  assert.match(HTML_SOURCE, /data-feedback-record/);
  assert.match(HTML_SOURCE, /data-feedback-record-title/);
  assert.match(HTML_SOURCE, /data-feedback-rating/);
  assert.match(HTML_SOURCE, /data-feedback-comment/);
  assert.match(HTML_SOURCE, /data-feedback-state/);
  assert.match(APP_SOURCE, /const saved = await MC\.submitReview/);
  assert.match(
    APP_SOURCE,
    /renderFeedbackRecord\(review \|\| findConsultationReview\(appointmentId\)\)/
  );

  const { api, calls, node } = makeHarness();

  await api.submitFeedback();

  assert.deepEqual(calls[0], ["submitReview", "appointment-77", 4, "Helpful doctor"]);
  assert.equal(node("button[type=submit]").disabled, true);
  assert.equal(node("button[type=submit]").textContent, "Feedback submitted");
  assert.match(node("[data-feedback-status]").textContent, /Thank you/);
  assert.equal(node("[data-feedback-record]").hidden, false);
  assert.equal(node("[data-feedback-record-title]").textContent, "Your feedback");
  assert.equal(node("[data-feedback-rating]").textContent, "4/5 · ★★★★☆");
  assert.match(node("[data-feedback-comment]").textContent, /Helpful doctor/);
  assert.equal(
    node("[data-consult-summary-line]").textContent,
    "Consultation summary published. Your feedback has been recorded."
  );
});

test("an existing review from reviews/me is shown when the consultation opens", async () => {
  const { api, calls, node, state } = makeHarness();
  state.myReviews = [
    {
      reviewId: "review-9",
      appointmentId: "appointment-77",
      rating: 5,
      comment: "Excellent care",
      moderationStatus: "APPROVED",
    },
  ];

  await api.loadConsultationReviewState("appointment-77");

  assert.deepEqual(calls[0], ["myReviews"]);
  assert.equal(node("[data-feedback-record]").hidden, false);
  assert.equal(node("[data-feedback-rating]").textContent, "5/5 · ★★★★★");
  assert.match(node("[data-feedback-comment]").textContent, /Excellent care/);
  assert.equal(node("button[type=submit]").textContent, "Feedback submitted");
  assert.equal(
    node("[data-consult-summary-line]").textContent,
    "Consultation summary published. Your feedback has been recorded."
  );
});

test("the doctor sees the patient feedback for the open consultation right away", async () => {
  assert.match(API_SOURCE, /doctorReviews\(doctorId\)/);
  assert.match(API_SOURCE, /doctors\/.*\/reviews/);
  assert.match(APP_SOURCE, /function syncReviewNotification\(notification\)/);
  assert.match(APP_SOURCE, /type\.includes\("REVIEW"\)/);
  assert.match(APP_SOURCE, /syncReviewNotification\(notification\)/);
  assert.match(APP_SOURCE, /void loadConsultationReviewState\(appointmentId\)/);

  const { api, calls, node, state } = makeHarness("DOCTOR");
  state.myReviews = [
    {
      reviewId: "review-doctor-1",
      appointmentId: "appointment-77",
      doctorId: "doctor-1",
      rating: 4,
      comment: "Very helpful consultation",
      moderationStatus: "APPROVED",
      createdAt: "2026-11-23T11:00:00Z",
    },
  ];

  await api.loadConsultationReviewState("appointment-77");

  assert.deepEqual(calls[0], ["doctorReviews", "doctor-1"]);
  assert.equal(node("[data-feedback-record]").hidden, false);
  assert.equal(node("[data-feedback-record-title]").textContent, "Patient feedback");
  assert.equal(node("[data-feedback-rating]").textContent, "4/5 · ★★★★☆");
  assert.match(node("[data-feedback-comment]").textContent, /Very helpful consultation/);
  assert.equal(node("[data-feedback-status]").textContent, "Patient feedback has been recorded.");
  assert.equal(
    node("[data-consult-summary-line]").textContent,
    "Consultation summary published. Patient feedback has been recorded."
  );
});
