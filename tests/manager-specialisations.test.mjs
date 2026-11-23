import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SOURCE = readFileSync(
  new URL("../public/mediclinic-app.js", import.meta.url),
  "utf8"
);

test("manager dashboard loads specialisations for the create-account form", () => {
  const managerBranch = SOURCE.match(
    /id === "manager"\) \{([\s\S]{0,400}?)void loadManagerSessions\(\);/
  );
  assert.ok(managerBranch, "manager navigation branch was not found");
  assert.match(
    managerBranch[1],
    /void loadAdminSpecialisations\(\);/,
    "manager view must populate the specialisation dropdown"
  );
});

test("specialisation load failures leave the dropdown retryable", () => {
  const catchBlock = SOURCE.match(
    /async function loadAdminSpecialisations\(\)[\s\S]{0,2600}?\n    \} catch \(error\) \{([\s\S]{0,900}?)\n    \}/
  );
  assert.ok(catchBlock, "specialisation loader catch block was not found");
  assert.doesNotMatch(
    catchBlock[1],
    /dataset\.loaded = "true"/,
    "failed loads must not mark the select permanently loaded"
  );
  assert.match(catchBlock[1], /click to retry/i);
});
