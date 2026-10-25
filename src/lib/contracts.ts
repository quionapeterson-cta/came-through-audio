import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/lib/email-layout";
import { trustedOrigin } from "@/lib/invite-limits";
import { requestBadgeCheck } from "@/lib/badge-events";

export type ContractStatus = "draft" | "sent" | "signed";

export type ContractParty = {
  id?: string;
  role: string;
  legalName: string;
  email: string;
  isOwner: boolean;
  invitedAt: string | null;
  signatureName: string;
  signatureHash: string;
  signedAt: string | null;
};

export type Contract = {
  id?: string;
  blueprint: string;
  title: string;
  catalogId: string | null;
  fields: Record<string, string>;
  body: string;
  status: ContractStatus;
  bodyHash: string;
  sentAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  parties: ContractParty[];
  /** Came Through Audio, LLC's own agreement (Admin → Company Contracts), kept out of the founder's personal vault. */
  isCompany?: boolean;
  /** A $3.99 generated contract: editable and sendable on any plan (set only by the payment webhook). */
  paid?: boolean;
};

export const emptyParty = (role: string, isOwner = false): ContractParty => ({
  role, legalName: "", email: "", isOwner, invitedAt: null, signatureName: "", signatureHash: "", signedAt: null,
});

type PartyRow = { id: string; role: string; legal_name: string; email: string; is_owner: boolean; position: number; invited_at: string | null; signature_name: string | null; signature_hash: string | null; signed_at: string | null };
type ContractRow = { id: string; blueprint: string; title: string; catalog_id: string | null; fields: Record<string, string> | null; body: string; status: ContractStatus; body_hash: string | null; sent_at: string | null; completed_at: string | null; updated_at: string; is_company?: boolean; paid_purchase_id?: string | null; contract_parties: PartyRow[] | null };

function fromRow(r: ContractRow): Contract {
  return {
    id: r.id, blueprint: r.blueprint, title: r.title, catalogId: r.catalog_id, fields: r.fields ?? {}, body: r.body, status: r.status,
    bodyHash: r.body_hash ?? "", sentAt: r.sent_at, completedAt: r.completed_at, updatedAt: r.updated_at, isCompany: !!r.is_company, paid: !!r.paid_purchase_id,
    parties: [...(r.contract_parties ?? [])].sort((a, b) => a.position - b.position).map((p) => ({
      id: p.id, role: p.role, legalName: p.legal_name, email: p.email, isOwner: p.is_owner, invitedAt: p.invited_at,
      signatureName: p.signature_name ?? "", signatureHash: p.signature_hash ?? "", signedAt: p.signed_at,
    })),
  };
}

/** Your own contracts, or with company: true, the company's (Admin). Filtered here so it works before the is_company column exists. */
export async function listContracts({ company = false } = {}): Promise<Contract[]> {
  const { data, error } = await supabase.from("contracts" as never).select("*, contract_parties(*)").order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ContractRow[]).map(fromRow).filter((c) => !!c.isCompany === company);
}

/** One contract by id, personal or company, for refreshing the open editor. */
export async function getContract(id: string): Promise<Contract | null> {
  const { data, error } = await supabase.from("contracts" as never).select("*, contract_parties(*)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as unknown as ContractRow) : null;
}

/** Saves a draft and its parties. Sent and signed contracts are frozen by the database, so only drafts come here. */
export async function saveContract(c: Contract): Promise<Contract> {
  const row = { blueprint: c.blueprint, title: c.title.trim() || "Untitled contract", catalog_id: c.catalogId, fields: c.fields, body: c.body };
  let id = c.id;
  if (id) {
    const { error } = await supabase.from("contracts" as never).update({ ...row, updated_at: new Date().toISOString() } as never).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("contracts" as never).insert((c.isCompany ? { ...row, is_company: true } : row) as never).select("id").single();
    if (error) throw new Error(c.isCompany && /is_company/.test(error.message) ? "Company contracts need the latest database update. Run migration 20261022170000 in the Supabase SQL editor." : error.message);
    id = (data as { id: string }).id;
  }
  const keep = new Set(c.parties.map((p) => p.id).filter(Boolean));
  const { data: current, error: curErr } = await supabase.from("contract_parties" as never).select("id").eq("contract_id", id);
  if (curErr) throw curErr;
  const remove = ((current ?? []) as { id: string }[]).map((r) => r.id).filter((pid) => !keep.has(pid));
  if (remove.length) {
    const { error } = await supabase.from("contract_parties" as never).delete().in("id", remove);
    if (error) throw error;
  }
  for (const [position, p] of c.parties.entries()) {
    const fields = { role: p.role.trim(), legal_name: p.legalName.trim(), email: p.email.trim(), position };
    const { error } = p.id
      ? await supabase.from("contract_parties" as never).update(fields as never).eq("id", p.id)
      : await supabase.from("contract_parties" as never).insert({ ...fields, contract_id: id, is_owner: p.isOwner } as never);
    if (error) throw error;
  }
  const { data, error } = await supabase.from("contracts" as never).select("*, contract_parties(*)").eq("id", id).single();
  if (error) throw error;
  requestBadgeCheck();
  return fromRow(data as unknown as ContractRow);
}

/** Locks the text (the database stores its SHA-256) and opens signing. */
export async function sendContract(id: string) {
  const { error } = await supabase.rpc("send_contract" as never, { _contract_id: id } as never);
  if (error) throw error;
  requestBadgeCheck();
}

export async function reopenContract(id: string) {
  const { error } = await supabase.rpc("reopen_contract" as never, { _contract_id: id } as never);
  if (error) throw error;
}

export async function deleteContract(id: string) {
  const { error } = await supabase.from("contracts" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function markInvited(partyId: string) {
  await supabase.from("contract_parties" as never).update({ invited_at: new Date().toISOString() } as never).eq("id", partyId);
}

export type ContractInvite = {
  party_id: string; contract_id: string; title: string; blueprint: string; body: string; body_hash: string;
  status: ContractStatus; sent_at: string | null; completed_at: string | null;
  legal_name: string; role: string; signed_at: string | null; can_sign: boolean;
  /** Company agreements opened by private link: the signer's title for the Company signature block. */
  company_title?: string;
  parties: { name: string; role: string; signed_at: string | null; signature_name: string | null; signature_hash: string | null }[];
};

export async function getContractInvite(partyId: string): Promise<ContractInvite | null> {
  const { data, error } = await supabase.rpc("get_contract_invite" as never, { _party_id: partyId } as never);
  if (error) throw error;
  return data as unknown as ContractInvite | null;
}

/** Typed e-signature. The database writes the time stamp and SHA-256 hash, so neither can be forged from the browser. */
export async function signContract(partyId: string, typedName: string) {
  const { error } = await supabase.rpc("sign_contract" as never, { _party_id: partyId, _signature_name: typedName } as never);
  if (error) throw error;
  requestBadgeCheck();
}

export type ReceivedContract = { party_id: string; title: string; role: string; status: ContractStatus; signed_at: string | null; sent_at: string | null; completed_at: string | null };

/** Contracts other people sent to this user, for their vault. */
export async function listReceivedContracts(): Promise<ReceivedContract[]> {
  const { data, error } = await supabase.rpc("my_contract_invites" as never);
  if (error) throw error;
  return (data ?? []) as unknown as ReceivedContract[];
}

/** Shared links always open the live site, never a Lovable editor preview (which needs a Lovable login). */
export const contractLink = (partyId: string) => `${trustedOrigin(window.location.origin, SITE_URL)}/contract/${partyId}`;

export const isValidEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());

const templateKey = (blueprintId: string) => `company_template_${blueprintId}`;

/** Super admins' own wording for company templates, by blueprint id (site_settings; staff-readable, super-admin-writable). */
export async function loadCompanyTemplates(): Promise<Record<string, string>> {
  const { data } = await supabase.from("site_settings").select("id, content").like("id", "company_template_%");
  const out: Record<string, string> = {};
  for (const r of data ?? []) {
    const body = (r.content as { body?: unknown } | null)?.body;
    if (typeof body === "string" && body.trim()) out[r.id.replace("company_template_", "")] = body;
  }
  return out;
}

/** Saves a company template's wording for every future contract from it. An empty body goes back to the original. */
export async function saveCompanyTemplate(blueprintId: string, body: string) {
  const { error } = body.trim()
    ? await supabase.from("site_settings").upsert({ id: templateKey(blueprintId), content: { body } as never, updated_at: new Date().toISOString() })
    : await supabase.from("site_settings").delete().eq("id", templateKey(blueprintId));
  if (error) throw new Error("Couldn't save the template.");
}
