import { z } from "zod";

const selectionSchema = z.record(
  z.string().min(1).max(64),
  z.union([
    z.string().trim().max(200),
    z.array(z.string().trim().min(1).max(120)).max(20)
  ])
);

function invalidSelection(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function priceProductSelection(product, input) {
  const parsed = selectionSchema.safeParse(input ?? {});
  if (!parsed.success) throw invalidSelection("Choose valid product customizations.");

  const groups = Array.isArray(product.customizationOptions) ? product.customizationOptions : [];
  const groupsByKey = new Map(groups.map((group) => [group.key, group]));
  const selectedKeys = Object.keys(parsed.data);
  if (selectedKeys.some((key) => !groupsByKey.has(key))) {
    throw invalidSelection("One or more selected customizations are not available.");
  }

  let extraCents = 0;
  const savedSelection = {};
  for (const group of groups) {
    const value = parsed.data[group.key];
    if (group.type === "text") {
      if (value !== undefined) {
        if (typeof value !== "string" || value.length > (group.maxLength || 120)) {
          throw invalidSelection(`The ${group.label} is too long.`);
        }
        if (value) savedSelection[group.key] = value;
      } else if (group.required) {
        throw invalidSelection(`Please provide ${group.label.toLowerCase()}.`);
      }
      continue;
    }

    const selected = value === undefined ? [] : Array.isArray(value) ? value : [value];
    if (group.required && selected.length === 0) {
      throw invalidSelection(`Please choose ${group.label.toLowerCase()}.`);
    }
    if ((!group.multiple && selected.length > 1) || new Set(selected).size !== selected.length) {
      throw invalidSelection(`Choose valid ${group.label.toLowerCase()} options.`);
    }

    const choices = Array.isArray(group.choices) ? group.choices : [];
    for (const choiceName of selected) {
      const choice = choices.find((item) => item.name === choiceName);
      if (!choice) throw invalidSelection(`One or more ${group.label.toLowerCase()} options are unavailable.`, 409);
      extraCents += choice.priceCents || 0;
    }
    if (selected.length) savedSelection[group.key] = group.multiple ? selected : selected[0];
  }

  return {
    unitPriceCents: product.priceCents + extraCents,
    customization: Object.keys(savedSelection).length ? savedSelection : null
  };
}
