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

function functionSource(name) {
  const start = APP_SOURCE.indexOf(`function ${name}(`);
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

function renderCta(session) {
  const label = { textContent: "" };
  const link = {
    href: "#doctors",
    querySelector(selector) {
      return selector === "[data-welcome-cta-label]" ? label : null;
    },
  };
  const document = {
    querySelectorAll(selector) {
      return selector === "[data-welcome-cta]" ? [link] : [];
    },
  };
  const HOME = {
    CUSTOMER: "index",
    DOCTOR: "doctor",
    MANAGER: "manager-d",
    ADMIN: "admin",
  };

  new Function(
    "document",
    "S",
    "HOME",
    `${functionSource("renderWelcomeCta")}\nrenderWelcomeCta();`
  )(document, session, HOME);

  return { href: link.href, label: label.textContent };
}

test("the welcome CTA starts as the guest doctor search", () => {
  assert.match(
    HTML_SOURCE,
    /<a href="#doctors" data-welcome-cta[^>]*><span data-welcome-cta-label>Find a doctor<\/span>/
  );

  const cta = renderCta(null);
  assert.equal(cta.label, "Find a doctor");
  assert.equal(cta.href, "#doctors");
});

test("the welcome CTA converts to Book a session after patient login", () => {
  const cta = renderCta({ role: "CUSTOMER" });
  assert.equal(cta.label, "Book a session");
  assert.equal(cta.href, "#index");
});

test("staff keep a role-appropriate welcome CTA", () => {
  const cta = renderCta({ role: "DOCTOR" });
  assert.equal(cta.label, "Go to dashboard");
  assert.equal(cta.href, "#doctor");
});

test("the rendered account view updates the welcome CTA", () => {
  assert.match(APP_SOURCE, /function renderWelcomeCta\(\)/);
  assert.match(APP_SOURCE, /renderWelcomeCta\(\);[\s\S]{0,240}data-roles/);
  assert.match(
    HTML_SOURCE,
    /<link rel="stylesheet" href="\/vendor\/mediclinic-tailwind\.css\?v=20261124e"/
  );
});
