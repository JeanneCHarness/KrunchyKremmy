import test from "node:test";
import assert from "node:assert/strict";
import { priceProductSelection } from "../src/catalog-customization.js";

const product = {
  priceCents: 500,
  customizationOptions: [
    { key: "flavor", label: "Flavor", required: true, multiple: false, choices: [{ name: "Vanilla", priceCents: 0 }, { name: "Chocolate", priceCents: 50 }] },
    { key: "toppings", label: "Toppings", multiple: true, choices: [{ name: "Sprinkles", priceCents: 25 }, { name: "Berries", priceCents: 75 }] },
    { key: "message", label: "Message", type: "text", maxLength: 40 }
  ]
};

test("product customizations use configured prices and are preserved", () => {
  assert.deepEqual(priceProductSelection(product, {
    flavor: "Chocolate", toppings: ["Sprinkles"], message: "Happy birthday"
  }), {
    unitPriceCents: 575,
    customization: { flavor: "Chocolate", toppings: ["Sprinkles"], message: "Happy birthday" }
  });
});

test("product customizations reject missing required, unconfigured, and tampered options", () => {
  assert.throws(() => priceProductSelection(product, {}), { status: 400 });
  assert.throws(() => priceProductSelection(product, { flavor: "Pistachio" }), { status: 409 });
  assert.throws(() => priceProductSelection(product, { flavor: "Vanilla", forged: "free" }), { status: 400 });
});

test("products without customizations retain their base price", () => {
  assert.deepEqual(priceProductSelection({ priceCents: 300 }, undefined), {
    unitPriceCents: 300,
    customization: null
  });
});
