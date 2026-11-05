/**
 * The staff Idea Box (founder, 2026-11-05): any staff member can send an idea, paperwork, a video, music, a photo or a
 * project to a super admin. One place, one queue, and the same file limits everywhere, so nobody has to guess what
 * "too big" means. Files land in a private bucket; the super admin downloads them through a signed link.
 */

export const SUBMISSION_KINDS = ["idea", "paperwork", "video", "music", "photo", "project", "other"] as const;
export type SubmissionKind = (typeof SUBMISSION_KINDS)[number];

export const KIND_LABEL: Record<SubmissionKind, string> = {
  idea: "Idea",
  paperwork: "Paperwork",
  video: "Video",
  music: "Music",
  photo: "Photo",
  project: "Project",
  other: "Other",
};

/** What each kind should look like, in the words the form shows next to the picker. */
export const KIND_HINT: Record<SubmissionKind, string> = {
  idea: "A pitch, a campaign, a feature: a note and a document if you have one.",
  paperwork: "Contracts, forms, signed pages, invoices.",
  video: "A clip or a cut. Anything over 50 MB goes as a link instead.",
  music: "A song or a stem, MP3/WAV/AIFF.",
  photo: "Shots for social, a shoot or a press kit.",
  project: "A folder of work, a build, a finished deliverable.",
  other: "Anything that doesn't fit the rest.",
};

const MB = 1024 * 1024;

/** Per-kind ceiling. Supabase's own project limit is 50 MB, so nothing here can exceed it. */
export const KIND_LIMIT: Record<SubmissionKind, number> = {
  idea: 25 * MB,
  paperwork: 50 * MB,
  video: 50 * MB,
  music: 50 * MB,
  photo: 25 * MB,
  project: 50 * MB,
  other: 25 * MB,
};

/** The MIME types each kind accepts; the file input's `accept` is built from the same lists. */
export const KIND_TYPES: Record<SubmissionKind, readonly string[]> = {
  idea: ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"],
  paperwork: ["application/pdf", "image/png", "image/jpeg", "image/webp", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  music: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/aiff", "audio/mp4"],
  photo: ["image/png", "image/jpeg", "image/webp", "image/heic"],
  project: ["application/pdf", "application/zip", "image/png", "image/jpeg", "text/plain"],
  other: ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "application/zip"],
};

const EXTENSION: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "text/plain": ".txt",
  "application/zip": ".zip",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/aiff": ".aiff",
  "audio/mp4": ".m4a",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

export const ACCEPT_FOR = (kind: SubmissionKind) => KIND_TYPES[kind].map((t) => EXTENSION[t] ?? t).join(",");
export const limitLabel = (bytes: number) => `${Math.round((bytes / MB) * 10) / 10} MB`;

/** Why this file can't be sent as this kind, or null when it can. */
export function fileProblem(kind: SubmissionKind, file: { name: string; size: number; type: string }): string | null {
  if (!file.name?.trim()) return "Choose a file, or send the note on its own.";
  if (file.size <= 0) return "That file looks empty.";
  const limit = KIND_LIMIT[kind];
  if (file.size > limit) return `${KIND_LABEL[kind]} files can be up to ${limitLabel(limit)}. Anything bigger goes as a link.`;
  if (!KIND_TYPES[kind].includes(file.type)) {
    const ok = KIND_TYPES[kind].map((t) => EXTENSION[t] ?? t).join(", ");
    return `A ${KIND_LABEL[kind].toLowerCase()} needs one of: ${ok}.`;
  }
  return null;
}

/** A filename that can't break a storage key or escape the folder. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-{2,}/g, "-").replace(/^[-.]+/, "");
  return (cleaned || "file").slice(-80);
}

export const SUBMISSION_STATUS = ["new", "in_review", "done", "declined"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUS)[number];

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  new: "Waiting for a super admin",
  in_review: "Being looked at",
  done: "Done",
  declined: "Not taken forward",
};
