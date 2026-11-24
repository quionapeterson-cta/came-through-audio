import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  activeKitKeys,
  autoBindKit,
  brandAccess,
  brandingPeriod,
  kitAllowance,
  kitFromRow,
  kitReady,
  usableKits,
  type BrandKit,
  type BrandUse,
  type PdfBrand,
} from "./brand-kit";
import { hasTier, serverTier } from "./plans";
import { getPaymentsEnvironment } from "./payments-env";

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
    // `id` is what a year bought before the subscription was stored is keyed by (`row:<id>`).
    db
      .from("purchases")
      .select("id, kind, created_at, details")
      .eq("user_id", userId)
      .eq("kind", "branding")
      .eq("environment", getPaymentsEnvironment()),
  ]);
  const list = (buys ?? []) as {
    id?: string;
    kind: string;
    created_at: string;
    details: Record<string, string>;
  }[];
  const t = serverTier(tier);
  const period = brandingPeriod(list);
  const until = period?.until ?? null;
  // The keys of the kit years running now: what a kit row must be linked to in order to be usable.
  return {
    access: brandAccess(t, until),
    until,
    renews: period?.renews ?? false,
    allowance: kitAllowance(t, list),
    tier: t,
    paid: activeKitKeys(list),
  };
}

/**
 * The owner's kit ready to draw (logo inlined), or null when it isn't allowed for this use or isn't set up yet.
 * With several kits, the one asked for if it's among the kits they can use now, else the first of those (see
 * `usableKits`: the included kit, then the newest paid ones).
 */
async function brandFor(
  db: Db,
  userId: string,
  use: BrandUse,
  kitId?: string | null,
): Promise<PdfBrand | null> {
  const { access, allowance, tier, paid } = await accessFor(db, userId);
  if (!access[use]) return null;
  // Only Catalog & Collaborate and Catalog Management may cut our footer off a download (founder, 2026-11-06); on any
  // lower plan a saved kit still prints it, whatever the kit row says.
  const mayDropFooter = hasTier(tier, "collaborate");
  const { data } = await db
    .from("brand_kits" as never)
    .select("*")
    .eq("user_id", userId)
    .order("created_at" as never, { ascending: true });
  let saved = ((data ?? []) as Record<string, unknown>[])
    .map((r) => kitFromRow(r as never))
    .filter((k): k is BrandKit => !!k);
  // One kit and a running year that names no kit: link it here too, so a download works even if the page never opened.
  const link = autoBindKit(saved, paid);
  if (link) {
    const { error } = await db
      .from("brand_kits" as never)
      .update({ paid_key: link.key } as never)
      .eq("id", link.kitId)
      .eq("user_id", userId);
    if (error) console.warn(`Kit ${link.kitId} could not be linked to ${link.key}`, error);
    else saved = saved.map((k) => (k.id === link.kitId ? { ...k, paidKey: link.key } : k));
  }
  const usable = usableKits(saved, Math.max(1, allowance), hasTier(tier, "management"), paid);
  const kit = usable.find((k) => k.id && k.id === kitId) ?? usable[0] ?? null;
  if (!kit || !kitReady(kit)) return null;
  let logo: PdfBrand["logo"] = null;
  if (kit.logoPath) {
    const { data: file } = await db.storage.from("brand-logos").download(kit.logoPath);
    if (file) {
      const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000)
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      logo = { dataUrl: `data:${type};base64,${btoa(bin)}` };
    }
  }
  const { logoPath: _path, ...rest } = kit;
  // Split sheets record who owns a song, so they always show the artist name (founder, 2026-10-27); a kit's business
  // or DBA name is for contracts only.
  if (use === "splits") {
    const { data: prof } = await db
      .from("profiles")
      .select("stage_name, onboarding")
      .eq("id", userId)
      .maybeSingle();
    const p = prof as {
      stage_name?: string | null;
      onboarding?: { stageName?: string } | null;
    } | null;
    const artist = (p?.onboarding?.stageName || p?.stage_name || "").trim();
    if (artist)
      return { ...rest, name: artist, logo, showFooter: mayDropFooter ? rest.showFooter : true };
  }
  return { ...rest, logo, showFooter: mayDropFooter ? rest.showFooter : true };
}

/** Where the signed-in user's kit applies, and when the add-on ends, for Profile → Brand kit. */
export const getBrandAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { access, until, renews, allowance, paid, tier } = await accessFor(db, context.userId);
    const { data } = await db
      .from("brand_kits" as never)
      .select("id, paid_key")
      .eq("user_id", context.userId)
      .order("created_at" as never, { ascending: true });
    let kits = (data ?? []) as { id: string; paid_key: string | null }[];
    // Their only kit with an unlinked running year: link it now, so the locked screen unlocks by itself after paying.
    const link = autoBindKit(
      kits.map((k) => ({ id: k.id, paidKey: k.paid_key })),
      paid,
    );
    if (link) {
      const { error } = await db
        .from("brand_kits" as never)
        .update({ paid_key: link.key } as never)
        .eq("id", link.kitId)
        .eq("user_id", context.userId);
      if (error) console.warn(`Kit ${link.kitId} could not be linked to ${link.key}`, error);
      else kits = kits.map((k) => (k.id === link.kitId ? { ...k, paid_key: link.key } : k));
    }
    // Which saved kits can print right now, so the page can offer to renew a kit that is outside the allowance.
    const usableIds = usableKits(
      kits.map((k) => ({ id: k.id, paidKey: k.paid_key })),
      Math.max(1, allowance),
      hasTier(tier, "management"),
      paid,
    ).map((k) => k.id);
    return {
      ...access,
      addOnUntil: until?.toISOString() ?? null,
      addOnRenews: renews,
      allowance,
      usableIds,
    };
  });

/**
 * Links a running paid year to the kit it was bought for (founder, 2026-11-19). Called after a new kit is created, so a
 * year bought with no kit named fills that kit's slot; and after a kit's year is renewed for that kit, so the link moves
 * from the old subscription to the new one. The browser names a kit it owns and nothing else, and the server refuses a
 * kit that already has a running year of its own.
 */
export const bindKitYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kitId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: row } = await db
      .from("brand_kits" as never)
      .select("id, paid_key")
      .eq("id", data.kitId)
      .eq("user_id", context.userId)
      .maybeSingle();
    const kit = row as { id: string; paid_key: string | null } | null;
    if (!kit) return { bound: false };
    const { data: buys } = await db
      .from("purchases")
      .select("kind, created_at, details")
      .eq("user_id", context.userId)
      .eq("kind", "branding")
      .eq("environment", getPaymentsEnvironment());
    const active = activeKitKeys(
      (buys ?? []) as { kind: string; created_at: string; details: Record<string, string> }[],
    );
    // Already linked to a year that is still running: nothing to move.
    if (kit.paid_key && active.has(kit.paid_key)) return { bound: false };
    const { data: all } = await db
      .from("brand_kits" as never)
      .select("paid_key")
      .eq("user_id", context.userId);
    const taken = new Set(
      ((all ?? []) as { paid_key: string | null }[])
        .map((r) => r.paid_key)
        .filter((k): k is string => !!k),
    );
    const free = [...active].find((key) => !taken.has(key));
    if (!free) return { bound: false };
    const { error } = await db
      .from("brand_kits" as never)
      .update({ paid_key: free } as never)
      .eq("id", kit.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { bound: true };
  });

/** The signed-in user's own kit for a split sheet, contract or catalog download. */
export const getMyBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        use: z.enum(["splits", "contracts", "lyrics", "catalog", "lab"]),
        kitId: z.string().uuid().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    brandFor(await admin(), context.userId, data.use, data.kitId),
  );

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
    const { data: row } = await db
      .from("contracts" as never)
      .select("*")
      .eq("id", data.contractId)
      .maybeSingle();
    const k = row as { user_id: string; is_company: boolean; brand_kit_id?: string | null } | null;
    if (!k || k.is_company) return null;
    if (k.user_id !== context.userId) {
      const email = ((context.claims as { email?: string }).email ?? "").trim().toLowerCase();
      const { data: parties } = await db
        .from("contract_parties" as never)
        .select("email")
        .eq("contract_id", data.contractId);
      if (
        !email ||
        !((parties ?? []) as { email: string }[]).some(
          (p) => p.email.trim().toLowerCase() === email,
        )
      )
        return null;
    }
    return brandFor(db, k.user_id, "contracts", k.brand_kit_id);
  });
