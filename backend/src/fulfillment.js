const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function failure(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function localDateTimeToUtc(date, time, timeZone) {
  if (!isValidTimeZone(timeZone)) throw failure("The configured business timezone is invalid.", 503);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!dateMatch || !timeMatch) throw failure("A valid local date and time are required.");
  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const target = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  let timestamp = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(timestamp), timeZone);
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    const difference = target - represented;
    timestamp += difference;
    if (difference === 0) break;
  }
  return new Date(timestamp);
}

export function dateWeekday(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw failure("A valid local date is required.");
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (parsed.toISOString().slice(0, 10) !== date) throw failure("A valid local date is required.");
  return parsed.getUTCDay();
}

export function generateScheduleSlots(schedule, date, now, minimumLeadMinutes, blackouts = []) {
  const weekday = dateWeekday(date);
  if (!Array.isArray(schedule.operatingDays) || !schedule.operatingDays.includes(weekday)) return [];
  const start = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(schedule.startTime);
  const end = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(schedule.endTime);
  const duration = Number(schedule.slotDurationMinutes);
  if (!start || !end || !Number.isInteger(duration) || duration < 1) {
    throw failure("The configured schedule is invalid.", 503);
  }
  const startMinute = Number(start[1]) * 60 + Number(start[2]);
  const endMinute = Number(end[1]) * 60 + Number(end[2]);
  if (endMinute <= startMinute) throw failure("The configured schedule end time must follow its start time.", 503);
  const slots = [];
  for (let minute = startMinute; minute + duration <= endMinute; minute += duration) {
    const startTime = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const endMinuteOfSlot = minute + duration;
    const endTime = `${String(Math.floor(endMinuteOfSlot / 60)).padStart(2, "0")}:${String(endMinuteOfSlot % 60).padStart(2, "0")}`;
    const startsAt = localDateTimeToUtc(date, startTime, schedule.timeZone);
    const endsAt = localDateTimeToUtc(date, endTime, schedule.timeZone);
    if (startsAt.getTime() < now.getTime() + minimumLeadMinutes * 60000) continue;
    if (startsAt.getTime() < now.getTime() + Number(schedule.cutoffMinutes || 0) * 60000) continue;
    if (blackouts.some((blackout) =>
      (!blackout.method || blackout.method === schedule.method) &&
      blackout.startsAt < endsAt && blackout.endsAt > startsAt
    )) continue;
    slots.push({ startsAt, endsAt });
  }
  return slots;
}

export function weekdayNames() {
  return WEEKDAYS;
}
