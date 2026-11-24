import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);
const HTML_SOURCE = readFileSync(
  new URL("../public/mediclinic-system.html", import.meta.url),
  "utf8"
);
const API_SOURCE = readFileSync(
  new URL("../public/mediclinic-api.js", import.meta.url),
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

function node(tag) {
  return {
    tag,
    className: "",
    textContent: "",
    hidden: false,
    dataset: {},
    children: [],
    append(...items) {
      this.children.push(...items);
    },
    replaceChildren(...items) {
      this.children = items;
    },
  };
}

function text(nodeValue) {
  return [nodeValue.textContent || ""]
    .concat((nodeValue.children || []).map(text))
    .join(" ");
}

function makeDirectoryHarness(session) {
  const list = node("div");
  const status = node("p");
  const document = {
    querySelector(selector) {
      if (selector === "[data-directory-list]") return list;
      if (selector === "[data-directory-status]") return status;
      return null;
    },
  };
  const el = (tag, className, textValue) => {
    const item = node(tag);
    if (className) item.className = className;
    if (textValue !== undefined && textValue !== null) {
      item.textContent = String(textValue);
    }
    return item;
  };
  const badge = (label) => el("span", "", label);
  const state = {
    directory: {
      items: [],
      loaded: false,
      loading: false,
      poll: null,
      filters: {
        q: "",
        specialisationId: "",
        availability: "",
        consultationType: "",
      },
    },
  };

  const render = new Function(
    "document",
    "el",
    "badge",
    "doctorDisplayName",
    "money",
    "formatTime",
    "S",
    "state",
    "CLINIC_HOURS",
    "SLOT_MINUTES",
    `${functionSource("doctorDisplayName")}
${functionSource("money")}
${functionSource("formatTime")}
${functionSource("directoryAvailability")}
${functionSource("directoryAttendance")}
${functionSource("filteredDirectoryItems")}
${functionSource("renderDoctorDirectory")}
return { renderDoctorDirectory, filteredDirectoryItems };`
  )(document, el, badge, null, null, null, session, state, 8, 5);

  return { list, render: render.renderDoctorDirectory, state, status, text };
}

const liveDoctor = {
  doctorId: "doctor-1",
  doctorName: "Dr. Rajini Kanth",
  firstName: "Rajini",
  lastName: "Kanth",
  specialisation: "Cardiology",
  specialisationId: "cardiology",
  consultationFee: 2500,
  available: true,
  roomNumber: "A-12",
  roomName: "Consultation A",
  defaultStartTime: "07:00:00",
  defaultEndTime: "16:00:00",
  defaultHours: 8,
  sessionId: "session-1",
  sessionDate: "2026-11-23",
  startTime: "07:00:00",
  endTime: "16:00:00",
  consultationType: "PHYSICAL",
  sessionStatus: "IN_PROGRESS",
  nowServing: 3,
  nextNumber: 4,
  remainingAppointments: 2,
  maxAppointments: 6,
};

test("the guest dashboard is a dedicated public view before the session dashboard", () => {
  assert.match(HTML_SOURCE, /<section data-view="doctors" data-title="Hospital doctors"/);
  assert.match(HTML_SOURCE, /data-directory-list/);
  assert.match(HTML_SOURCE, /data-directory-status/);
  assert.match(HTML_SOURCE, /id="directory-q"/);
  assert.match(HTML_SOURCE, /id="directory-sp"/);
  assert.match(HTML_SOURCE, /id="directory-availability"/);
  assert.match(HTML_SOURCE, /id="directory-type"/);
  assert.match(HTML_SOURCE, /<option value="ONLINE">Online<\/option>/);
  assert.match(HTML_SOURCE, /<option value="PHYSICAL">Physical<\/option>/);
  assert.match(APP_SOURCE, /consultationType: type \? type\.value : ""/);
  assert.match(HTML_SOURCE, /<a href="#login" data-guest-only[^>]*>Log in to book<\/a>/);
  assert.match(HTML_SOURCE, /<a href="#doctors"[^>]*>Hospital doctors<\/a>/);
  assert.match(
    APP_SOURCE,
    /id === "index" && !S[\s\S]{0,160}id: "doctors"/
  );
  assert.match(APP_SOURCE, /await MC\.doctorDirectory\(\)/);
  assert.match(
    APP_SOURCE,
    /closest\("\[data-directory-doctor\]"\)[\s\S]{0,300}\$\("index-q"\)/
  );
  assert.match(API_SOURCE, /doctorDirectory\(\) \{\s*return request\("public\/doctors"\);/);
});

test("guest cards show availability, room, fee, hours, attendance and live queue", () => {
  const harness = makeDirectoryHarness(null);
  harness.state.directory.items = [liveDoctor];

  harness.render();

  const cardText = text(harness.list);
  for (const expected of [
    "Dr. Rajini Kanth",
    "Cardiology",
    "Room A-12",
    "LKR 2,500",
    "07:00–16:00",
    "8 hours",
    "5 min per patient",
    "Physical · in consultation",
    "Now serving",
    "#3",
    "#4",
    "Log in to book",
    "Register",
  ]) {
    assert.ok(cardText.includes(expected), `missing ${expected}`);
  }
});

test("signed-in patients are sent from the directory to the unchanged session dashboard", () => {
  const session = { role: "CUSTOMER" };
  const harness = makeDirectoryHarness(session);
  harness.state.directory.items = [liveDoctor];

  harness.render();

  const links = harness.list.children[0].children
    .flatMap((child) => child.children || [])
    .filter((child) => child.tag === "a");

  const sessionLink = links.find((link) => link.textContent === "Book a session");
  assert.ok(sessionLink);
  assert.equal(sessionLink.href, "#index");
  assert.ok(links.every((link) => link.href !== "#login"));
});

test("consultation type filters the guest roster by online or physical attending", () => {
  const harness = makeDirectoryHarness(null);
  harness.state.directory.items = [
    liveDoctor,
    {
      ...liveDoctor,
      doctorId: "doctor-3",
      doctorName: "Dr. Online Doctor",
      firstName: "Online",
      lastName: "Doctor",
      consultationType: "ONLINE",
    },
  ];

  harness.state.directory.filters.consultationType = "PHYSICAL";
  harness.render();
  assert.equal(harness.list.children.length, 1);
  assert.ok(text(harness.list).includes("Dr. Rajini Kanth"));

  harness.state.directory.filters.consultationType = "ONLINE";
  harness.render();
  assert.equal(harness.list.children.length, 1);
  assert.ok(text(harness.list).includes("Dr. Online Doctor"));

  harness.state.directory.filters.consultationType = "";
  harness.render();
  assert.equal(harness.list.children.length, 2);
});

test("unavailable doctors stay visible with no live session", () => {
  const harness = makeDirectoryHarness(null);
  harness.state.directory.items = [{
    ...liveDoctor,
    doctorId: "doctor-2",
    available: false,
    roomNumber: null,
    roomName: null,
    sessionId: null,
    sessionStatus: null,
    consultationType: null,
    nowServing: null,
    nextNumber: null,
    remainingAppointments: 0,
  }];

  harness.render();

  const cardText = text(harness.list);
  assert.ok(cardText.includes("Unavailable"));
  assert.ok(cardText.includes("Allocated per session"));
  assert.ok(cardText.includes("Not attending right now"));
  assert.ok(cardText.includes("07:00–16:00"));
});
