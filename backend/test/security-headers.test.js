import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

process.env.DATABASE_URL ||= "postgresql://user:password@localhost:5432/security-test";
const { default: app } = await import("../src/app.js");

test("Express responses do not disclose server or framework headers", async (context) => {
  const server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/security-header-probe`);
  assert.equal(response.headers.get("x-powered-by"), null);
  assert.equal(response.headers.get("server"), null);
  assert.equal(response.headers.get("x-aspnet-version"), null);
  assert.equal(response.headers.get("x-runtime"), null);
});
