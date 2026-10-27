import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean };

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "cta-staging-gate",
    maxAge: 60 * 60 * 24 * 14,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function matches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const getGateStatus = createServerFn({ method: "GET" }).handler(async () => {
  // Gate is off when no passcode is configured (e.g. after public launch).
  if (!process.env["SITE_PASSWORD"]) return { unlocked: true };
  const session = await useSession<GateSession>(sessionConfig());
  return { unlocked: !!session.data.unlocked };
});

export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => ({ password: String(data?.password ?? "").slice(0, 200) }))
  .handler(async ({ data }) => {
    const expected = process.env["SITE_PASSWORD"];
    if (!expected) return { ok: true as const };
    if (!matches(data.password, expected)) return { ok: false as const };
    const session = await useSession<GateSession>(sessionConfig());
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

/** Pre-launch until the site passcode is removed at launch: company agreements drop their confidentiality section then. */
export const getLaunchStatus = createServerFn({ method: "GET" }).handler(async () => ({ prelaunch: !!process.env["SITE_PASSWORD"] }));
