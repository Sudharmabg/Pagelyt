import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, bookingIcs, checkSettings, dayIn, freeSlots, sessionOf, tzOffset, zoned } from "./booking";
import { SESSIONS } from "../app/content";

test("zoned and tzOffset handle India and daylight saving", () => {
  assert.equal(tzOffset(Date.UTC(2026, 10, 20), "Asia/Kolkata"), 330);
  assert.equal(new Date(zoned("2026-11-20", "09:00", "Asia/Kolkata")).toISOString(), "2026-11-20T03:30:00.000Z");
  // New York: EDT (-4) in summer, EST (-5) in winter.
  assert.equal(new Date(zoned("2026-07-01", "09:00", "America/New_York")).toISOString(), "2026-07-01T13:00:00.000Z");
  assert.equal(new Date(zoned("2026-12-01", "09:00", "America/New_York")).toISOString(), "2026-12-01T14:00:00.000Z");
  assert.equal(dayIn(Date.UTC(2026, 10, 20, 20, 0), "Asia/Kolkata"), "2026-11-21");
});

test("freeSlots respects hours, notice, horizon, blocks and buffer", () => {
  const now = Date.UTC(2026, 10, 14, 0, 0); // 05:30 IST on the 14th
  const s = { ...DEFAULT_SETTINGS, notice_hours: 24, horizon_days: 3 };
  const all = freeSlots(s, 30, [], [], now);
  assert.ok(all.length > 0);
  for (const iso of all) {
    const t = Date.parse(iso);
    assert.ok(t >= now + 24 * 3600000, "within notice");
    assert.ok(t <= now + 3 * 86400000, "within horizon");
    const hm = new Date(t + 330 * 60000).toISOString().slice(11, 16);
    assert.ok(hm >= "09:00" && hm <= "21:30", `inside hours: ${hm}`);
  }
  // A 90-minute session cannot start at 21:00 (would end after 22:00).
  assert.ok(!freeSlots(s, 90, [], [], now).some((iso) => new Date(Date.parse(iso) + 330 * 60000).toISOString().slice(11, 16) > "20:30"));
  // Blocked day disappears.
  assert.ok(!freeSlots(s, 30, ["2026-11-16"], [], now).some((iso) => dayIn(Date.parse(iso), "Asia/Kolkata") === "2026-11-16"));
  // A booking 10:00-11:00 IST on the 16th with a 15 min buffer blocks 09:30 through 11:00 starts.
  const busy = [{ starts_at: "2026-11-16T04:30:00.000Z", ends_at: "2026-11-16T05:30:00.000Z" }];
  const left = freeSlots(s, 30, [], busy, now);
  for (const gone of ["2026-11-16T04:00:00.000Z", "2026-11-16T04:30:00.000Z", "2026-11-16T05:00:00.000Z", "2026-11-16T05:30:00.000Z"]) assert.ok(!left.includes(gone), gone);
  assert.ok(left.includes("2026-11-16T03:30:00.000Z")); // 09:00 ends 09:30, 30 min before (> 15 min buffer)
  assert.ok(left.includes("2026-11-16T06:00:00.000Z")); // 11:30
});

test("checkSettings validates input", () => {
  assert.ok("error" in checkSettings({ ...DEFAULT_SETTINGS, timezone: "Mars/Base" }));
  assert.ok("error" in checkSettings({ ...DEFAULT_SETTINGS, hours: { "1": [["10:00", "09:00"]] } }));
  assert.ok("error" in checkSettings({ ...DEFAULT_SETTINGS, buffer_min: 1.5 }));
  const ok = checkSettings({ ...DEFAULT_SETTINGS, hours: { "1": [["09:00", "12:00"]] } });
  assert.ok(!("error" in ok));
  assert.deepEqual(ok.hours["0"], []);
});

test("sessionOf accepts only the exact labels", () => {
  assert.equal(sessionOf(SESSIONS[1])?.minutes, 60);
  assert.equal(sessionOf("Free session · 600 min"), null);
});

test("bookingIcs is CRLF, folded and escaped", () => {
  const ics = bookingIcs({ id: "abc", starts_at: "2026-11-20T03:30:00.000Z", ends_at: "2026-11-20T04:00:00.000Z", session: SESSIONS[0], meet_url: "https://meet.example/x;y,z" }, { organizer: "a@b.c", attendee: "d@e.f" });
  assert.ok(ics.includes("DTSTART:20261120T033000Z\r\n"));
  assert.ok(ics.replace(/\r\n /g, "").includes("x\\;y\\,z"));
  for (const line of ics.split("\r\n")) assert.ok(line.length <= 75, line);
  assert.ok(bookingIcs({ id: "abc", starts_at: "2026-11-20T03:30:00.000Z", ends_at: "2026-11-20T04:00:00.000Z", session: SESSIONS[0], meet_url: null }, { organizer: "a@b.c", cancel: true }).includes("METHOD:CANCEL"));
});
