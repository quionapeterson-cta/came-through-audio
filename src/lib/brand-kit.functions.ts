import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { brandAccess, brandingUntil, kitAllowance, kitFromRow, kitReady, type BrandUse, type PdfBrand } from "./brand-kit";
import { getPaymentsEnvironment } from "./payments-env";
import type { Tier } from "./plans";

/**
 * Personal Branding for PDFs. The server decides whether a user's brand kit may replace the Came Through Audio header
 * (their plan and verified add-on purchases), so saving a kit, or editing the page, can't switch it on.
 */
async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

type Db = Awaited<ReturnType<typeof admin>>;

/** Where this user's brand kit may be used right now. */
async function accessFor(db: Db, userId: string) {
  const [{ data: tier }, { data: buys }] = await Promise.all([
    db.rpc("user_tier" as never, { _uid: userId } as never),
    db.from("purchases").select("kind, created_at, details").eq("user_id", userId).eq("kind", "branding").eq("environment", getPaymentsEnvironment()),
  ]);
  const list = (buys ?? []) as { kind: string; created_at: string; details: Record<string, string> }[];
  const t = ((tier as unknown as string) || "free") as Tier;
  const until = brandingUntil(list);
  return { access: brandAccess(t, until), until, allowance: kitAllowance(t, list) };
}

/**
 * The owner's kit ready to draw (logo inlined), or null when it isn't allowed for this use or isn't set up yet.
 * With several kits, the one asked for if it's among the kits they can use now (their oldest first), else the first.
 */
async function brandFor(db: Db, userId: string, use: BrandUse, kitId?: string | null): Promise<PdfBrand | null> {
  const { access, allowance } = await accessFor(db, userId);
  if (!access[use]) return null;
  const { data } = await db.from("brand_kits" as never).select("*").eq("user_id", userId).order("created_at" as never, { ascending: true });
  const usable = ((data ?? []) as Record<string, unknown>[]).slice(0, Math.max(1, allowance)).map((r) => kitFromRow(r as never));
  const kit = usable.find((k) => k?.id && k.id === kitId) ?? usable[0] ?? null;
  if (!kit || !kitReady(kit)) return null;
  let logo: PdfBrand["logo"] = null;
  if (kit.logoPath) {
    const { data: file } = await db.storage.from("brand-logos").download(kit.logoPath);
    if (file) {
      const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      logo = { dataUrl: `data:${type};base64,${btoa(bin)}` };
    }
  }
  const { logoPath: _path, ...rest } = kit;
  return { ...rest, logo };
}

/** Where the signed-in user's kit applies, and when the add-on ends, for Profile → Brand kit. */
export const getBrandAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { access, until, allowance } = await accessFor(await admin(), context.userId);
    return { ...access, addOnUntil: until?.toISOString() ?? null, allowance };
  });

/** The signed-in user's own kit for a split sheet or contract they download. */
export const getMyBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ use: z.enum(["splits", "contracts"]), kitId: z.string().uuid().nullish() }).parse(d))
  .handler(async ({ data, context }) => brandFor(await admin(), context.userId, data.use, data.kitId));

/**
 * The sender's kit on a contract someone sent: for the owner or a party signed in with the party's email. Company
 * agreements always carry the Came Through Audio header.
 */
export const getContractBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contractId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    // "*" so this works before the brand_kit_id column exists.
    const { data: row } = await db.from("contracts" as never).select("*").eq("id", data.contractId).maybeSingle();
    const k = row as { user_id: string; is_company: boolean; brand_kit_id?: string | null } | null;
    if (!k || k.is_company) return null;
    if (k.user_id !== context.userId) {
      const email = ((context.claims as { email?: string }).email ?? "").trim().toLowerCase();
      const { data: parties } = await db.from("contract_parties" as never).select("email").eq("contract_id", data.contractId);
      if (!email || !((parties ?? []) as { email: string }[]).some((p) => p.email.trim().toLowerCase() === email)) return null;
    }
    return brandFor(db, k.user_id, "contracts", k.brand_kit_id);
  });
