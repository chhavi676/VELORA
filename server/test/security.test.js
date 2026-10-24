import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app } from "../src/app.js";
import { requireRole } from "../src/middleware/auth.js";

// These tests run without external credentials or a live database.
test("unknown routes return JSON 404 without exposing stack traces", async () => {
  const response = await request(app).get("/not-a-route");
  assert.equal(response.status, 404);
  assert.equal(response.body.error, "Route not found");
  assert.equal("stack" in response.body, false);
});

test("protected profile endpoint rejects missing bearer token", async () => {
  const response = await request(app).get("/api/auth/me");
  assert.equal(response.status, 401);
  assert.match(response.body.error, /Bearer access token/i);
});

test("role middleware denies unauthenticated and unauthorized users", async () => {
  const run = (req, res) => new Promise((resolve) => requireRole("admin") (req, { status(code) { this.code = code; return this; }, json(body) { resolve({ code: this.code, body }); } }, () => resolve({ code: 200 })));
  assert.equal((await run({}, {})).code, 401);
  assert.equal((await run({ userProfile: { role: "customer" } }, {})).code, 403);
  assert.equal((await run({ userProfile: { role: "admin" } }, {})).code, 200);
});

test("JSON parser rejects malformed JSON", async () => {
  const response = await request(app).post("/api/auth/profiles/x/role").set("Content-Type", "application/json").send("{oops");
  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Malformed JSON body.");
});

test("API sends security headers and does not expose Express fingerprint", async () => {
  const response = await request(app).get("/api/health");
  assert.equal(response.status, 503);
  assert.equal(response.headers["x-powered-by"], undefined);
  assert.ok(response.headers["x-content-type-options"]);
  assert.ok(response.headers["x-frame-options"]);
});
