import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const HTML = readFileSync(
  new URL("../public/mediclinic-system.html", import.meta.url),
  "utf8"
);
const APP = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);

test("booking confirmation shows booking time, queue place, slot and finish", () => {
  assert.match(HTML, /data-booking-created/);
  assert.match(HTML, /data-booking-slot/);
  assert.match(HTML, /this number is your place in the queue/);
  assert.match(HTML, /Allocated slot and finish/);

  assert.match(APP, /function appointmentSlot\(value\)/);
  assert.match(APP, /allocation\.minutes/);
  assert.match(APP, /created\.textContent = appointment\.bookedAt/);
  assert.match(APP, /slot\.textContent =/);
});

test("my appointments repeats the queue place, booking time and slot", () => {
  assert.match(HTML, /<th>Queue, time &amp; slot<\/th>/);
  assert.match(APP, /"Queue #" \+ appointment\.appointmentNumber/);
  assert.match(APP, /"Booked " \+ formatDateTime\(appointment\.bookedAt\)/);
  assert.match(APP, /"Slot " \+ allocation\.range \+ " · finishes "/);
});

test("patient queue card also shows the live slot and finish time", () => {
  assert.match(
    APP,
    /"Your slot " \+ allocation\.range \+ " · finishes " \+ allocation\.finish/
  );
});

test("delay and cancellation notifications refresh the patient view", () => {
  assert.match(APP, /function handleIncomingNotification\(notification\)/);
  assert.match(APP, /showNotificationToast\(notification\)/);
  assert.match(APP, /void loadAppointments\(\);/);
  assert.match(APP, /void refreshPatientQueue\(\);/);
});
