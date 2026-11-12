import { createHash } from "node:crypto";
import { z } from "zod";

const bookingCustomizationSchema = z.object({
  iceCreamFlavors: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  servingStyles: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  sundaeToppings: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  candyCategories: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  candySelections: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  colors: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  popcornFlavors: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  packaging: z.array(z.string().trim().min(1).max(80)).optional(),
  waffleTypes: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  sausageTypes: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  breadTypes: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  hotDogStyles: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  packageSizes: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  drinkFlavors: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  drinkPackaging: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  drinkServing: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  cupcakeFlavors: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  frostingFlavors: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  frostingColors: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  decorations: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  chickenStyles: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  portionSizes: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  chipPortions: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  spaghettiStyles: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  chickenPortions: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  spiceLevels: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  sides: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  drinkAddOns: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  cheeseOptions: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  toppings: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  sauces: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  customNotes: z.string().trim().max(1000).optional(),
  needsAssistance: z.boolean().default(false)
}).strict();

export const bookingSchema = z.object({
  idempotencyKey: z.string().refine(
    (value) => z.string().uuid().safeParse(value).success || /^[a-f0-9]{64}$/.test(value),
    "Expected a UUID or 256-bit lowercase hexadecimal key."
  ),
  eventTypeSlug: z.string().min(1).max(80),
  eventName: z.string().trim().max(120).optional(),
  otherEventType: z.string().trim().max(120).optional(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  timeZone: z.string().min(1).max(64),
  guestCount: z.number().int().min(1).max(5000),
  ageGroup: z.string().trim().max(80).optional(),
  packageId: z.string().optional(),
  services: z.array(z.object({
    serviceId: z.string().min(1),
    servings: z.number().int().min(1).max(5000),
    customization: bookingCustomizationSchema.default({})
  }).strict()).min(1).max(8),
  venueName: z.string().trim().max(160).optional(),
  venueType: z.enum(["PRIVATE_RESIDENCE", "EVENT_HALL", "HOTEL", "OFFICE", "SCHOOL", "OUTDOOR", "OTHER"]),
  address: z.string().trim().min(5).max(240),
  city: z.string().trim().min(2).max(120),
  region: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(32).optional(),
  setupType: z.enum(["INDOOR", "OUTDOOR", "UNSURE"]),
  accessInstructions: z.string().trim().max(1000).optional(),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.string().trim().email().max(254),
  customerPhone: z.string().trim().min(7).max(40),
  contactMethod: z.enum(["EMAIL", "PHONE", "TEXT"]),
  companyName: z.string().trim().max(160).optional(),
  specialRequests: z.string().trim().max(2000).optional(),
  budgetRange: z.string().trim().max(80).optional(),
  termsAccepted: z.literal(true),
  honeypot: z.string().max(0).optional()
}).strict();

export function bookingRequestHash(input) {
  const { idempotencyKey, ...payload } = input;
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function validateBookingTime(input, now = new Date()) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    startsAt <= now ||
    endsAt <= startsAt ||
    endsAt.getTime() - startsAt.getTime() > 16 * 60 * 60 * 1000
  ) {
    const error = new Error("Choose a future event date and a valid duration of 16 hours or less.");
    error.status = 400;
    throw error;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: input.timeZone }).format(startsAt);
  } catch {
    const error = new Error("Choose a valid time zone.");
    error.status = 400;
    throw error;
  }
  return { startsAt, endsAt };
}

export function validateServiceCustomization(customization, configuredOptions) {
  for (const [field, value] of Object.entries(customization)) {
    if (field === "needsAssistance" || field === "customNotes") continue;
    const allowed = configuredOptions && typeof configuredOptions === "object" ? configuredOptions[field] : null;
    if (!Array.isArray(allowed)) {
      const error = new Error("A requested customization is not configured for this service.");
      error.status = 400;
      throw error;
    }
    const requested = Array.isArray(value) ? value : value ? [value] : [];
    if (requested.some((item) => !allowed.includes(item))) {
      const error = new Error("One or more selected service options are no longer available.");
      error.status = 409;
      throw error;
    }
  }
}
