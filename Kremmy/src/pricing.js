import { z } from "zod";

const allowedGroups = {
  waffle: new Set(["base", "iceCream", "toppings", "sauces", "extras"]),
  sundae: new Set(["base", "iceCream", "toppings", "sauces"]),
  candy: new Set(["base", "toppings"]),
  popcorn: new Set(["base", "toppings"]),
  "cotton-candy": new Set(["base", "iceCream", "toppings", "sauces"]),
  "ice-cream-cone": new Set(["base", "iceCream", "toppings", "sauces"])
};

export const builderSelectionSchema = z.object({
  kind: z.enum(["waffle", "sundae", "candy", "popcorn", "cotton-candy", "ice-cream-cone"]),
  optionIds: z.array(z.string().min(1)).min(1).max(16)
});

export async function quoteBuilder(prisma, selection) {
  const parsed = builderSelectionSchema.safeParse(selection);
  if (!parsed.success) {
    const error = new Error("Choose valid options for your treat.");
    error.status = 400;
    throw error;
  }
  const options = await prisma.builderOption.findMany({
    where: { id: { in: parsed.data.optionIds }, kind: parsed.data.kind, active: true, stock: { gt: 0 } }
  });
  if (options.length !== new Set(parsed.data.optionIds).size) {
    const error = new Error("One or more selected options are unavailable.");
    error.status = 409;
    throw error;
  }
  const selectedGroups = new Map();
  for (const option of options) {
    const group = selectedGroups.get(option.groupKey) || [];
    group.push(option);
    selectedGroups.set(option.groupKey, group);
  }
  for (const [groupKey, groupOptions] of selectedGroups) {
    if (!allowedGroups[parsed.data.kind].has(groupKey)) {
      const error = new Error(`The ${groupKey} selection is not valid for this treat.`);
      error.status = 400;
      throw error;
    }
    const limit = Math.min(...groupOptions.map((option) => option.maxSelections));
    if (groupOptions.length > limit) {
      const error = new Error(`You have selected too many ${groupKey} options.`);
      error.status = 400;
      throw error;
    }
  }
  if (!options.some((option) => option.groupKey === "base")) {
    const error = new Error("Choose a base before adding your treat.");
    error.status = 400;
    throw error;
  }
  if (["waffle", "sundae"].includes(parsed.data.kind) && !options.some((option) => option.groupKey === "iceCream")) {
    const error = new Error("Choose at least one ice cream flavor.");
    error.status = 400;
    throw error;
  }
  return {
    kind: parsed.data.kind,
    optionIds: options.map((option) => option.id),
    options: options.map(({ id, groupKey, name, priceCents }) => ({ id, groupKey, name, priceCents })),
    totalCents: options.reduce((total, option) => total + option.priceCents, 0)
  };
}
