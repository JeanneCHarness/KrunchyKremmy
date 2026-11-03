import test from "node:test";
import assert from "node:assert/strict";
import {
  dateWeekday,
  generateScheduleSlots,
  isValidTimeZone,
  localDateTimeToUtc
} from "../src/fulfillment.js";

test("business local times convert using the configured timezone", () => {
  assert.equal(isValidTimeZone("Africa/Lagos"), true);
  assert.equal(localDateTimeToUtc("2026-01-05", "09:30", "Africa/Lagos").toISOString(), "2026-01-05T08:30:00.000Z");
  assert.equal(isValidTimeZone("not/a-timezone"), false);
});

test("schedule slots respect business weekdays, lead time, cutoff and blackouts", () => {
  const schedule = {
    method: "DELIVERY",
    timeZone: "Africa/Lagos",
    operatingDays: [1],
    startTime: "09:00",
    endTime: "12:00",
    slotDurationMinutes: 60,
    cutoffMinutes: 30
  };
  const now = new Date("2026-01-05T06:00:00.000Z");
  const slots = generateScheduleSlots(schedule, "2026-01-05", now, 120, [{
    method: "DELIVERY",
    startsAt: new Date("2026-01-05T09:00:00.000Z"),
    endsAt: new Date("2026-01-05T10:00:00.000Z")
  }]);

  assert.deepEqual(slots.map(({ startsAt, endsAt }) => [startsAt.toISOString(), endsAt.toISOString()]), [
    ["2026-01-05T08:00:00.000Z", "2026-01-05T09:00:00.000Z"],
    ["2026-01-05T10:00:00.000Z", "2026-01-05T11:00:00.000Z"]
  ]);
  assert.deepEqual(generateScheduleSlots(schedule, "2026-01-06", now, 0), []);
});

test("date validation rejects impossible dates", () => {
  assert.equal(dateWeekday("2026-01-05"), 1);
  assert.throws(() => dateWeekday("2026-02-31"), /valid local date/);
  assert.throws(() => localDateTimeToUtc("2026-01-05", "24:00", "Africa/Lagos"), /valid local date and time/);
});
