import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../src/app.js";
import Product from "../src/models/Product.js";
import RunwayShow from "../src/models/RunwayShow.js";
import ModelProfile from "../src/models/ModelProfile.js";

let mongo;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { serverSelectionTimeoutMS: 10000 });
  await Promise.all([Product.deleteMany({}), RunwayShow.deleteMany({}), ModelProfile.deleteMany({})]);
  await Product.create({ slug: "test-coat", name: "Test Coat", designer: "Studio Test", category: "Outerwear", price: 1200, description: "Test product", images: [{ url: "https://example.com/coat.jpg" }], inventory: 2, isPublished: true });
  await Product.create({ slug: "hidden-coat", name: "Hidden Coat", designer: "Studio Test", category: "Outerwear", price: 1500, description: "Unpublished product", images: [{ url: "https://example.com/hidden.jpg" }], isPublished: false });
  await RunwayShow.create({ slug: "test-show", title: "Test Show", designer: "Studio Test", city: "Paris", season: "AW 2026", showDate: new Date("2026-09-01"), coverImage: "https://example.com/show.jpg", isPublished: true });
  await ModelProfile.create({ slug: "test-model", displayName: "Test Model", portraitUrl: "https://example.com/model.jpg", specialties: ["Runway"], isPublished: true, isDemoProfile: true });
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test("health endpoint reports live database connection", async () => {
  const response = await request(app).get("/api/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.database, "connected");
});

test("product API returns published products only and escapes regex metacharacters", async () => {
  const all = await request(app).get("/api/products");
  assert.equal(all.status, 200);
  assert.equal(all.body.length, 1);
  assert.equal(all.body[0].slug, "test-coat");
  const search = await request(app).get("/api/products?search=%5B.*%5D");
  assert.equal(search.status, 200);
  assert.equal(search.body.length, 0);
});

test("runway and model APIs expose published records", async () => {
  const shows = await request(app).get("/api/shows");
  const models = await request(app).get("/api/models");
  assert.equal(shows.status, 200);
  assert.equal(shows.body[0].title, "Test Show");
  assert.equal(models.status, 200);
  assert.equal(models.body[0].name, "Test Model");
});
