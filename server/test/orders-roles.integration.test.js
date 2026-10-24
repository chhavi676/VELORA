// Integration test for checkout, stock handling and role enforcement.
// Uses a fake Supabase /auth/v1/user endpoint so the REAL requireAuth middleware runs.
// Database: MONGODB_TEST_URI if set, otherwise an in-memory MongoDB (mongodb-memory-server).
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import request from "supertest";
import mongoose from "mongoose";

const USERS = {
  "tok-admin": { id: "u-admin", email: "admin@test.dev", full_name: "Ada Admin" },
  "tok-cust": { id: "u-cust", email: "cust@test.dev", full_name: "Cora Customer" },
  "tok-cust2": { id: "u-cust2", email: "cust2@test.dev", full_name: "Cal Customer" },
  "tok-designer": { id: "u-designer", email: "designer@test.dev", full_name: "Dee Designer" },
  "tok-designer2": { id: "u-designer2", email: "designer2@test.dev", full_name: "Dan Designer" }
};

let fake, mongo, app, UserProfile, Product, Order;
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const shipping = { fullName: "Cora C", phone: "9876543210", line1: "12 Test Road", city: "Sonipat", state: "Haryana", postalCode: "131001" };

before(async () => {
  fake = http.createServer((req, res) => {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const u = USERS[token];
    res.setHeader("Content-Type", "application/json");
    if (req.url.startsWith("/auth/v1/user") && u) {
      res.end(JSON.stringify({ id: u.id, aud: "authenticated", email: u.email, email_confirmed_at: "2026-01-01T00:00:00Z", user_metadata: { full_name: u.full_name }, app_metadata: {} }));
    } else { res.statusCode = 401; res.end(JSON.stringify({ message: "invalid" })); }
  });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  process.env.SUPABASE_URL = `http://127.0.0.1:${fake.address().port}`;
  process.env.SUPABASE_PUBLISHABLE_KEY = "test-key";

  let uri = process.env.MONGODB_TEST_URI;
  if (!uri) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    mongo = await MongoMemoryServer.create();
    uri = mongo.getUri();
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await mongoose.connection.dropDatabase();

  ({ app } = await import("../src/app.js"));
  UserProfile = (await import("../src/models/UserProfile.js")).default;
  Product = (await import("../src/models/Product.js")).default;
  Order = (await import("../src/models/Order.js")).default;

  // Sign everyone in once so profiles exist, then promote roles directly in the DB (as an operator would).
  for (const t of Object.keys(USERS)) await request(app).get("/api/auth/me").set(bearer(t));
  await UserProfile.updateOne({ supabaseUserId: "u-admin" }, { role: "admin" });
  await UserProfile.updateMany({ supabaseUserId: { $in: ["u-designer", "u-designer2"] } }, { role: "designer" });
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
  fake?.close();
});

const mk = (over = {}) => Product.create({ slug: `p-${Math.random().toString(36).slice(2, 8)}`, name: "Test Piece", designer: "Studio Test", category: "Dresses", price: 50000, description: "x", images: [{ url: "https://example.com/a.jpg" }], inventory: 5, sizes: ["S", "M"], ...over });

test("new users are customers and can read their profile", async () => {
  const r = await request(app).get("/api/auth/me").set(bearer("tok-cust"));
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, "customer");
});

test("checkout requires sign-in", async () => {
  const p = await mk();
  const r = await request(app).post("/api/orders").send({ items: [{ productId: String(p._id), size: "M", quantity: 1 }], shipping });
  assert.equal(r.status, 401);
});

test("order uses DB prices (ignores browser price), reserves stock, and appears in My Orders", async () => {
  const p = await mk({ price: 50000, inventory: 5 });
  const r = await request(app).post("/api/orders").set(bearer("tok-cust"))
    .send({ items: [{ productId: String(p._id), size: "M", quantity: 2, price: 1, unitPrice: 1 }], shipping, paymentMethod: "cod" });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.order.total, 100000);
  assert.equal(r.body.order.items[0].unitPrice, 50000);
  assert.match(r.body.order.orderNumber, /^VEL-/);
  assert.equal((await Product.findById(p._id)).inventory, 3);
  const mine = await request(app).get("/api/orders/mine").set(bearer("tok-cust"));
  assert.equal(mine.body.length >= 1, true);
  const other = await request(app).get("/api/orders/mine").set(bearer("tok-cust2"));
  assert.equal(other.body.length, 0, "another customer must not see these orders");
});

test("insufficient stock is rejected and earlier lines in the same order are rolled back", async () => {
  const a = await mk({ inventory: 5 });
  const b = await mk({ inventory: 1 });
  const r = await request(app).post("/api/orders").set(bearer("tok-cust"))
    .send({ items: [{ productId: String(a._id), size: "S", quantity: 2 }, { productId: String(b._id), size: "S", quantity: 3 }], shipping });
  assert.equal(r.status, 409);
  assert.equal((await Product.findById(a._id)).inventory, 5, "stock for line 1 must be restored");
  assert.equal((await Product.findById(b._id)).inventory, 1);
});

test("two simultaneous orders for the last unit: exactly one succeeds", async () => {
  const p = await mk({ inventory: 1 });
  const body = { items: [{ productId: String(p._id), size: "M", quantity: 1 }], shipping };
  const [x, y] = await Promise.all([
    request(app).post("/api/orders").set(bearer("tok-cust")).send(body),
    request(app).post("/api/orders").set(bearer("tok-cust2")).send(body)
  ]);
  assert.deepEqual([x.status, y.status].sort(), [201, 409]);
  assert.equal((await Product.findById(p._id)).inventory, 0);
});

test("validation: missing size, bad quantity, bad PIN, unpublished product", async () => {
  const p = await mk();
  const hidden = await mk({ isPublished: false });
  const send = (items, ship = shipping) => request(app).post("/api/orders").set(bearer("tok-cust")).send({ items, shipping: ship });
  assert.equal((await send([{ productId: String(p._id), size: "", quantity: 1 }])).status, 400);
  assert.equal((await send([{ productId: String(p._id), size: "M", quantity: 0 }])).status, 400);
  assert.equal((await send([{ productId: String(p._id), size: "M", quantity: 99 }])).status, 400);
  assert.equal((await send([{ productId: String(p._id), size: "M", quantity: 1 }], { ...shipping, postalCode: "12" })).status, 400);
  assert.equal((await send([{ productId: String(hidden._id), size: "M", quantity: 1 }])).status, 400);
  assert.equal((await send([])).status, 400);
  assert.equal((await Product.findById(p._id)).inventory, 5, "failed orders must not consume stock");
});

test("customer can cancel own order and stock is restored; others cannot", async () => {
  const p = await mk({ inventory: 4 });
  const o = await request(app).post("/api/orders").set(bearer("tok-cust")).send({ items: [{ productId: String(p._id), size: "S", quantity: 3 }], shipping });
  assert.equal((await Product.findById(p._id)).inventory, 1);
  assert.equal((await request(app).patch(`/api/orders/${o.body.order.id}/cancel`).set(bearer("tok-cust2"))).status, 409);
  const c = await request(app).patch(`/api/orders/${o.body.order.id}/cancel`).set(bearer("tok-cust"));
  assert.equal(c.status, 200);
  assert.equal(c.body.order.status, "cancelled");
  assert.equal((await Product.findById(p._id)).inventory, 4);
  assert.equal((await request(app).patch(`/api/orders/${o.body.order.id}/cancel`).set(bearer("tok-cust"))).status, 409, "cannot cancel twice / double-restock");
  assert.equal((await Product.findById(p._id)).inventory, 4);
});

test("admin-only endpoints reject customers and designers, allow admin", async () => {
  for (const path of ["/api/orders", "/api/admin/summary", "/api/admin/users"]) {
    assert.equal((await request(app).get(path).set(bearer("tok-cust"))).status, 403, path);
    assert.equal((await request(app).get(path).set(bearer("tok-designer"))).status, 403, path);
    assert.equal((await request(app).get(path)).status, 401, path);
    assert.equal((await request(app).get(path).set(bearer("tok-admin"))).status, 200, path);
  }
  const s = await request(app).get("/api/admin/summary").set(bearer("tok-admin"));
  assert.equal(s.body.users.admin, 1);
  assert.ok(s.body.orders.count >= 1);
});

test("admin moves an order through its lifecycle; cancelled is final; cancel restocks", async () => {
  const p = await mk({ inventory: 3 });
  const o = await request(app).post("/api/orders").set(bearer("tok-cust")).send({ items: [{ productId: String(p._id), size: "S", quantity: 2 }], shipping });
  const id = o.body.order.id;
  assert.equal((await request(app).patch(`/api/orders/${id}/status`).set(bearer("tok-cust")).send({ status: "shipped" })).status, 403);
  assert.equal((await request(app).patch(`/api/orders/${id}/status`).set(bearer("tok-admin")).send({ status: "bogus" })).status, 400);
  const shipped = await request(app).patch(`/api/orders/${id}/status`).set(bearer("tok-admin")).send({ status: "shipped" });
  assert.equal(shipped.body.order.status, "shipped");
  assert.equal(shipped.body.order.customer.email, "cust@test.dev");
  const delivered = await request(app).patch(`/api/orders/${id}/status`).set(bearer("tok-admin")).send({ status: "delivered" });
  assert.equal(delivered.body.order.paymentStatus, "paid");
  const o2 = await request(app).post("/api/orders").set(bearer("tok-cust")).send({ items: [{ productId: String(p._id), size: "S", quantity: 1 }], shipping });
  assert.equal((await Product.findById(p._id)).inventory, 0); // 3 - 2 (delivered order) - 1 (this order)
  await request(app).patch(`/api/orders/${o2.body.order.id}/status`).set(bearer("tok-admin")).send({ status: "cancelled" });
  assert.equal((await Product.findById(p._id)).inventory, 1); // the cancelled unit returns to stock
  assert.equal((await request(app).patch(`/api/orders/${o2.body.order.id}/status`).set(bearer("tok-admin")).send({ status: "placed" })).status, 409);
});

test("product management: customers blocked; designers limited to their own; admin can edit all", async () => {
  const body = { name: "Designer Gown", category: "Dresses", price: 75000, description: "Made by a designer", inventory: 4, sizes: "S, M, L", images: [{ url: "https://example.com/g.jpg" }], isFeatured: true, createdBy: "hacker", designerVerified: true };
  assert.equal((await request(app).post("/api/products").set(bearer("tok-cust")).send(body)).status, 403);
  const created = await request(app).post("/api/products").set(bearer("tok-designer")).send(body);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.deepEqual(created.body.sizes, ["S", "M", "L"]);
  assert.equal(created.body.designer, "Dee Designer", "defaults to the designer's name");
  const doc = await Product.findById(created.body.id);
  assert.equal(doc.isFeatured, false, "designers cannot self-feature");
  assert.equal(doc.designerVerified, false, "designerVerified cannot be set from the request body");
  const me = await UserProfile.findOne({ supabaseUserId: "u-designer" });
  assert.equal(String(doc.createdBy), String(me._id), "createdBy comes from the session, not the body");

  // Ownership
  const id = created.body.id;
  const own = await request(app).patch(`/api/products/${id}`).set(bearer("tok-designer")).send({ price: 80000, inventory: 9, isPublished: false });
  assert.equal(own.status, 200);
  assert.equal(own.body.price, 80000);
  assert.equal(own.body.isPublished, false);
  assert.equal((await request(app).patch(`/api/products/${id}`).set(bearer("tok-designer2")).send({ price: 1 })).status, 403);
  assert.equal((await request(app).patch(`/api/products/${id}`).set(bearer("tok-cust")).send({ price: 1 })).status, 403);
  assert.equal((await request(app).patch(`/api/products/${id}`).set(bearer("tok-designer")).send({ price: -5 })).status, 400);
  assert.equal((await request(app).patch(`/api/products/${id}`).set(bearer("tok-admin")).send({ isFeatured: true })).status, 200);

  // Lists
  const mineD = await request(app).get("/api/products/manage/list").set(bearer("tok-designer"));
  assert.equal(mineD.body.every((x) => x.createdBy === String(me._id)), true);
  const mineD2 = await request(app).get("/api/products/manage/list").set(bearer("tok-designer2"));
  assert.equal(mineD2.body.length, 0);
  const all = await request(app).get("/api/products/manage/list").set(bearer("tok-admin"));
  assert.ok(all.body.length > mineD.body.length);
  assert.equal((await request(app).get("/api/products/manage/list").set(bearer("tok-cust"))).status, 403);

  // Unpublished products are hidden publicly
  assert.equal((await request(app).get(`/api/products/${created.body.slug}`)).status, 404);
  await request(app).patch(`/api/products/${id}`).set(bearer("tok-designer")).send({ isPublished: true });
  const pub = await request(app).get(`/api/products/${created.body.slug}`);
  assert.equal(pub.status, 200);
  assert.deepEqual(pub.body.sizes, ["S", "M", "L"]);
  assert.equal("createdBy" in pub.body, false, "public payload must not expose owner ids");
});

test("admin can assign roles; cannot grant admin", async () => {
  const target = await UserProfile.findOne({ supabaseUserId: "u-cust2" });
  assert.equal((await request(app).patch(`/api/auth/profiles/${target._id}/role`).set(bearer("tok-cust")).send({ role: "designer" })).status, 403);
  assert.equal((await request(app).patch(`/api/auth/profiles/${target._id}/role`).set(bearer("tok-admin")).send({ role: "admin" })).status, 400);
  const ok = await request(app).patch(`/api/auth/profiles/${target._id}/role`).set(bearer("tok-admin")).send({ role: "model" });
  assert.equal(ok.body.user.role, "model");
});
