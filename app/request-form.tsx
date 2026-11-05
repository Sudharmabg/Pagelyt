"use client";

import { Arrow } from "./arrow";

import { useState } from "react";
import { CONTACT_EMAIL } from "./site-config";

type Kind = "consultation" | "contact";

const SLOTS = [
  "Quick Website Consultation · 30 min · ₹499",
  "Technical Website Consultation · 60 min · ₹999",
  "Website Growth Strategy · 90 min · ₹1,499",
];

/* No backend yet: the form opens the visitor's email app with the details filled in. */
export function RequestForm({ kind }: { kind: Kind }) {
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "").trim();
    const email = String(f.get("email") || "").trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
      setErr("Please enter your name and a valid email address.");
      return;
    }
    setErr("");
    const lines = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Website: ${String(f.get("site") || "").trim() || "Not given"}`,
      kind === "consultation" ? `Session: ${String(f.get("slot") || "")}` : "",
      kind === "consultation" ? `Preferred time: ${String(f.get("when") || "").trim() || "Flexible"}` : "",
      "",
      String(f.get("msg") || "").trim(),
    ].filter((l, i, a) => l || i === a.length - 2 || i === a.length - 1);
    const subject = kind === "consultation" ? "Consultation request" : "Message from the Pagelyt website";
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    setSent(true);
  };

  if (sent)
    return (
      <div className="rq rq-done" role="status">
        <h3>Almost there.</h3>
        <p>
          Your email app should have opened with your details filled in. Press send and we will reply within one
          business day. If nothing opened, write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <button className="btn ghost" onClick={() => setSent(false)}>
          Edit my details
        </button>
      </div>
    );

  return (
    <form className="rq" onSubmit={onSubmit} noValidate>
      <h3>{kind === "consultation" ? "Request a consultation" : "Send us a message"}</h3>
      <label>
        Your name
        <input name="name" autoComplete="name" required />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Website <span>(optional)</span>
        <input name="site" inputMode="url" placeholder="https://yourwebsite.com" />
      </label>
      {kind === "consultation" && (
        <>
          <label>
            Session
            <select name="slot" defaultValue={SLOTS[0]}>
              {SLOTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Preferred day and time <span>(optional)</span>
            <input name="when" placeholder="For example, weekday mornings IST" />
          </label>
        </>
      )}
      <label>
        {kind === "consultation" ? "What would you like help with?" : "How can we help?"}
        <textarea name="msg" rows={4} />
      </label>
      {err && (
        <p className="rq-err" role="alert">
          {err}
        </p>
      )}
      <button className="btn" type="submit">
        {kind === "consultation" ? "Request my consultation" : "Send message"} <Arrow />
      </button>
    </form>
  );
}
