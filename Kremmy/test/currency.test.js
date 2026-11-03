import test from "node:test";
import assert from "node:assert/strict";
import { formatNaira } from "../src/currency.js";

test("Naira formatting treats integer amounts as kobo", () => {
  assert.equal(formatNaira(12345), "₦123.45");
});
