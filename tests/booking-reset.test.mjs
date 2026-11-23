import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
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

function makeHarness() {
  const nodes = new Map();
  const node = (key, extras = {}) => {
    if (!nodes.has(key)) {
      nodes.set(key, { hidden: false, textContent: "", dataset: {}, ...extras });
    }
    return nodes.get(key);
  };

  const document = {
    querySelector: (selector) => node(selector),
  };
  const state = {
    booking: { appointmentId: "old-booking" },
    selectedSession: { sessionId: "old-session" },
  };
  const $ = (id) => document.querySelector(`#${id}`);

  const clearBookingPanel = new Function(
    "document",
    "state",
    "$",
    `${functionSource("clearBookingPanel")}\nreturn clearBookingPanel;`
  )(document, state, $);

  return { clearBookingPanel, document, node, state };
}

test("logout, expiry and invalid sessions all clear the booking panel", () => {
  assert.match(functionSource("clearBookingPanel"), /state\.booking = null/);
  assert.match(functionSource("clearBookingPanel"), /state\.selectedSession = null/);
  assert.match(functionSource("clearBookingPanel"), /data-booking-success/);
  assert.match(functionSource("logout"), /clearBookingPanel\(\)/);
  assert.match(functionSource("handleSessionExpired"), /clearBookingPanel\(\)/);
  assert.match(functionSource("setSession"), /clearBookingPanel\(\)/);
});

test("clearing the booking panel removes another patient's confirmation", () => {
  const { clearBookingPanel, node, state } = makeHarness();

  node("[data-booking-title]").textContent = "Book: Dr. Example";
  node("[data-booking-meta]").textContent = "Old date · Online · LKR 2,500";
  node("[data-booking-reference]").textContent = "ABC123";
  node("[data-booking-number]").textContent = "#1";
  node("[data-booking-estimate]").textContent = "Tomorrow 09:00";
  node("[data-booking-message]").textContent = "Paid by card. You’re ready when the doctor calls you.";
  node("#index-rs").value = "A private reason from the previous account";
  const pay = node("[data-booking-pay]", {
    hidden: true,
    disabled: false,
    dataset: { bookingPay: "old-booking" },
  });
  const go = node("[data-booking-goto]", { dataset: { bookingGoto: "1" } });

  clearBookingPanel();

  assert.equal(state.booking, null);
  assert.equal(state.selectedSession, null);
  assert.equal(node("[data-booking-title]").textContent, "Book a session");
  assert.equal(node("[data-booking-meta]").textContent, "Choose a session to continue.");
  assert.equal(node("[data-booking-form]").hidden, true);
  assert.equal(node("[data-booking-success]").hidden, true);
  assert.equal(node("[data-booking-reference]").textContent, "—");
  assert.equal(node("[data-booking-number]").textContent, "—");
  assert.equal(node("[data-booking-estimate]").textContent, "—");
  assert.equal(node("[data-booking-message]").textContent, "");
  assert.equal(node("#index-rs").value, "");
  assert.equal(node("[data-booking-error]").hidden, true);
  assert.equal(pay.hidden, true);
  assert.equal(pay.disabled, false);
  assert.deepEqual(pay.dataset, {});
  assert.deepEqual(go.dataset, {});
});
