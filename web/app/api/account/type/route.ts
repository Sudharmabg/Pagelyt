import { userFromRequest } from "@/lib/auth";
import { getAccount, setAccountType, type AccountType } from "@/lib/scan/agency";

/* The signed-in user's plan and their answer to "Are you an agency?" (asked once after a scan).
   Browser sends: Authorization: Bearer <access token>. */
export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  try {
    return Response.json(await getAccount(user.id));
  } catch {
    return Response.json({ error: "Could not load your account." }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  let type: unknown;
  try {
    type = ((await req.json()) as { type?: unknown }).type;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (type !== "agency" && type !== "owner") return Response.json({ error: "Invalid answer." }, { status: 400 });
  try {
    await setAccountType(user.id, type as AccountType);
    return Response.json(await getAccount(user.id));
  } catch {
    return Response.json({ error: "Could not save your answer. Please try again." }, { status: 503 });
  }
}
