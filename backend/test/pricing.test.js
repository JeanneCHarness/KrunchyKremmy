import test from "node:test";
import assert from "node:assert/strict";
import { quoteBuilder } from "../src/pricing.js";

function fakePrisma(options) {
  return {
    builderOption: {
      findMany: async ({ where }) => options.filter((option) =>
        where.id.in.includes(option.id) &&
        where.kind === option.kind &&
        option.active &&
        option.stock > 0
      )
    }
  };
}

const options = [
  { id: "base", kind: "waffle", groupKey: "base", name: "Belgian waffle", priceCents: 790, maxSelections: 1, active: true, stock: 9 },
  { id: "scoop", kind: "waffle", groupKey: "iceCream", name: "Vanilla", priceCents: 180, maxSelections: 2, active: true, stock: 9 },
  { id: "topping", kind: "waffle", groupKey: "toppings", name: "Cookie crumble", priceCents: 90, maxSelections: 5, active: true, stock: 9 },
  { id: "out", kind: "waffle", groupKey: "toppings", name: "Unavailable", priceCents: 100, maxSelections: 5, active: true, stock: 0 }
];

test("builder quote sums trusted option prices in cents", async () => {
  const quote = await quoteBuilder(fakePrisma(options), { kind: "waffle", optionIds: ["base", "scoop", "topping"] });
  assert.equal(quote.totalCents, 1060);
  assert.equal(quote.options.length, 3);
});

test("builder quote rejects unavailable options and selections without a base", async () => {
  await assert.rejects(
    quoteBuilder(fakePrisma(options), { kind: "waffle", optionIds: ["out"] }),
    { status: 409 }
  );
  await assert.rejects(
    quoteBuilder(fakePrisma(options), { kind: "waffle", optionIds: ["scoop"] }),
    { status: 400 }
  );
});

test("builder quote enforces configured group limits", async () => {
  const withSecondBase = [...options, { ...options[0], id: "base-2", name: "Second base" }];
  await assert.rejects(
    quoteBuilder(fakePrisma(withSecondBase), { kind: "waffle", optionIds: ["base", "base-2"] }),
    { status: 400 }
  );
});

test("waffle and sundae quotes require an ice cream flavor", async () => {
  await assert.rejects(
    quoteBuilder(fakePrisma(options), { kind: "waffle", optionIds: ["base"] }),
    { status: 400 }
  );
});
