import type { InboxMailbox } from "./inbox-mailboxes";

/**
 * Files that stay with an inbox message (founder, 2026-11-17): 10 MB per file, kept as long as the message is, in the
 * private `admin-inbox` bucket.
 *
 * Two things arrive here. Mail to admin@ and contracts@, whose attachments the Cloudflare Email Worker hands over one at
 * a time; and files a super admin or department lead puts on the "Send us a file" page for a business contact, which
 * never touches email at all.
 *
 * The limits live here and nowhere else, so the worker, the page, the receiver and the panel all mean the same number.
 * Nothing in this module may import a server-only module: the page and the panel both read it.
 */

/** The private bucket the files live in. Nothing is ever served from it without a signed link. */
export const INBOX_BUCKET = "admin-inbox";

const MB = 1024 * 1024;

/**
 * The founder's cap (2026-11-17): 10 MB per file. A mail's attachments share Cloudflare's 25 MiB message limit, so this
 * covers an ordinary contract, split sheet, master or press photo without letting one message fill the bucket.
 */
export const MAX_INBOX_FILE_BYTES = 10 * MB;

/** How many files the "Send us a file" page takes in one go. */
export const MAX_DROP_FILES = 5;

/**
 * Who may file a file (founder, 2026-11-17): the page is not public. It is the B2B door into the inbox, so a super admin
 * or a department lead opens it and enters the business contact's own details; a reply goes to that contact.
 *
 * The server checks the same list before it stores a byte, so hiding the form is not the rule.
 */
export const INBOX_FILE_DROP_ROLES = ["super_admin", "department_lead"] as const;

/** How the copy names who may file one, so the page and the server's refusal say the same thing. */
export const INBOX_FILE_DROP_LABEL = "super admin or department lead";

/** Whether this staff member may open the page and file a file. */
export function canDropInboxFiles(access: { role: string } | null | undefined): boolean {
  return !!access && (INBOX_FILE_DROP_ROLES as readonly string[]).includes(access.role);
}

/** The cap as the copy says it: one place, so a page never promises a different size than the server enforces. */
export const INBOX_FILE_LIMIT_LABEL = "10 MB";

/** A file's size in the words the panel and the page use. */
export function sizeLabel(bytes?: number): string {
  if (typeof bytes !== "number" || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** A filename that cannot escape its folder or break a storage key. Keeps the extension, which is what staff look for. */
export function safeStorageName(name: string): string {
  const cleaned = (name || "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+/, "");
  return (cleaned || "file").slice(-80);
}

/**
 * A mail's Message-ID (or another stable seam) as a folder name: the same mail retried by the worker lands on the same
 * keys, so an upload can overwrite itself instead of leaving a second copy behind.
 */
export function storageFolderFor(seed: string): string {
  const cleaned = (seed || "")
    .replace(/^</, "")
    .replace(/>$/, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned || "message";
}

/** Where one attachment of a received mail lives. Deterministic: the same message and file always name the same key. */
export function inboundStoragePath(input: {
  mailbox: InboxMailbox;
  messageKey: string;
  index: number;
  filename: string;
}): string {
  const index = Number.isFinite(input.index) ? Math.max(0, Math.trunc(input.index)) : 0;
  return `inbound/${input.mailbox}/${storageFolderFor(input.messageKey)}/${String(index).padStart(2, "0")}-${safeStorageName(input.filename)}`;
}

/** Where one file of a "Send us a file" submission lives. The submission id is server-made, so nothing is guessed. */
export function dropStoragePath(input: {
  submissionId: string;
  index: number;
  filename: string;
}): string {
  const index = Number.isFinite(input.index) ? Math.max(0, Math.trunc(input.index)) : 0;
  return `drop/${storageFolderFor(input.submissionId)}/${String(index).padStart(2, "0")}-${safeStorageName(input.filename)}`;
}

/** Why this file cannot be kept, or null when it can. The name alone is still recorded either way. */
export function fileProblem(file: { name: string; size: number }): string | null {
  if (!file.name?.trim()) return "That file has no name, so it can't be kept.";
  if (file.size <= 0) return `${file.name} looks empty.`;
  if (file.size > MAX_INBOX_FILE_BYTES)
    return `${file.name} is over ${INBOX_FILE_LIMIT_LABEL}, so it can't be kept. Send it as a link instead.`;
  return null;
}

/** Why these files cannot be sent through the page, or null when they can. */
export function dropFilesProblem(files: { name: string; size: number }[]): string | null {
  if (!files.length) return "Choose at least one file.";
  if (files.length > MAX_DROP_FILES)
    return `Send up to ${MAX_DROP_FILES} files at a time. Anything more, send in a second go.`;
  for (const file of files) {
    const problem = fileProblem(file);
    if (problem) return problem;
  }
  return null;
}

/**
 * The subject a thread is matched on: Re:/Fwd: stripped (however many are stacked), spaces collapsed, case folded.
 * A reply keeps the subject, so this is what joins it to its conversation when References are missing.
 *
 * It lives here because both the inbound receiver and the file page open threads: two copies of this rule would quietly
 * split one correspondent into two conversations.
 */
export function threadSubjectKey(subject: string): string {
  return subject
    .replace(/^\s*((re|fw|fwd)\s*:\s*)+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 200);
}

/**
 * The file kinds an inbound email may leave in the inbox, by extension, each with the content type it is stored under.
 * The sender's declared type is never trusted: an executable, script or web page is refused, and an allowed file is
 * stored as the type its extension names, so a renamed HTML page can't be served back as a page.
 */
const INBOUND_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  tif: "image/tiff",
  tiff: "image/tiff",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/mp4",
  webm: "video/webm",
  zip: "application/zip",
};

/** The content type to store an inbound attachment under, or null when its kind is not accepted. */
export function inboundContentType(filename: string): string | null {
  const ext = /\.([a-z0-9]+)$/i.exec(filename.trim())?.[1]?.toLowerCase();
  return ext ? (INBOUND_TYPES[ext] ?? null) : null;
}
