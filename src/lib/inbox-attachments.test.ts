import { describe, expect, it } from "vitest";
import {
  canDropInboxFiles,
  dropFilesProblem,
  dropStoragePath,
  fileProblem,
  inboundContentType,
  inboundStoragePath,
  INBOX_FILE_LIMIT_LABEL,
  MAX_DROP_FILES,
  MAX_INBOX_FILE_BYTES,
  safeStorageName,
  sizeLabel,
  storageFolderFor,
  threadSubjectKey,
} from "./inbox-attachments";

const MB = 1024 * 1024;

describe("inbox attachments", () => {
  it("stores documents and masters using server-owned types", () => {
    expect(inboundContentType("Signed Agreement.PDF")).toBe("application/pdf");
    expect(inboundContentType("master.wav")).toBe("audio/wav");
    expect(inboundContentType("credits.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("refuses executable files and active web attachments", () => {
    for (const name of [
      "attack.exe",
      "attack.html",
      "attack.svg",
      "attack.js",
      "file",
      "file.constructor",
    ]) {
      expect(inboundContentType(name)).toBeNull();
    }
  });
  it("caps a file at 10 MB, and says so in the same words the copy uses", () => {
    expect(MAX_INBOX_FILE_BYTES).toBe(10 * MB);
    expect(INBOX_FILE_LIMIT_LABEL).toBe("10 MB");
    expect(fileProblem({ name: "master.wav", size: 10 * MB })).toBeNull();
    expect(fileProblem({ name: "master.wav", size: 10 * MB + 1 })).toContain("10 MB");
    expect(fileProblem({ name: "empty.pdf", size: 0 })).toContain("empty");
  });

  it("refuses a submission with no files, too many files, or one that is too big", () => {
    const small = { name: "a.pdf", size: 1024 };
    expect(dropFilesProblem([])).toContain("at least one file");
    expect(dropFilesProblem(Array.from({ length: MAX_DROP_FILES + 1 }, () => small))).toContain(
      `up to ${MAX_DROP_FILES} files`,
    );
    const files = [small, { name: "huge.mov", size: 40 * MB }];
    const problem = dropFilesProblem(files);
    // The refusal names the file, so someone with six files knows which one to send separately.
    expect(problem).toContain("huge.mov");
    expect(dropFilesProblem([small, { name: "b.pdf", size: 2 * MB }])).toBeNull();
  });

  it("keeps a filename from escaping its folder", () => {
    expect(safeStorageName("../../etc/passwd")).toBe("etc-passwd");
    expect(safeStorageName("Producer Agreement.pdf")).toBe("Producer-Agreement.pdf");
    expect(safeStorageName("")).toBe("file");
    expect(safeStorageName("...pdf")).toBe("pdf");
    // The extension is what staff look for, so a long name keeps its tail rather than its head.
    expect(safeStorageName(`${"a".repeat(200)}.pdf`).endsWith(".pdf")).toBe(true);
  });

  it("builds the same key for the same mail, so a retry overwrites instead of duplicating", () => {
    const one = inboundStoragePath({
      mailbox: "admin",
      messageKey: "<CABc123@mail.example.com>",
      index: 0,
      filename: "Split Sheet.pdf",
    });
    const again = inboundStoragePath({
      mailbox: "admin",
      messageKey: "CABc123@mail.example.com",
      index: 0,
      filename: "Split Sheet.pdf",
    });
    expect(one).toBe(again);
    expect(one).toMatch(/^inbound\/admin\/[A-Za-z0-9-]+\/00-Split-Sheet\.pdf$/);
    expect(one).not.toContain("..");
    // A second file in the same mail has its own key.
    expect(
      inboundStoragePath({ mailbox: "admin", messageKey: "x@y", index: 1, filename: "b.pdf" }),
    ).toMatch(/\/01-b\.pdf$/);
    // Contracts never share a folder with admin, so the ownership check in the receiver has something to check.
    expect(
      inboundStoragePath({ mailbox: "contracts", messageKey: "x@y", index: 0, filename: "b.pdf" }),
    ).toMatch(/^inbound\/contracts\//);
  });

  it("lets a super admin and a department lead file a file, and nobody else", () => {
    expect(canDropInboxFiles({ role: "super_admin" })).toBe(true);
    expect(canDropInboxFiles({ role: "department_lead" })).toBe(true);
    // The page is not a public door: an employee, HR and a signed-out visitor are all refused.
    expect(canDropInboxFiles({ role: "employee" })).toBe(false);
    expect(canDropInboxFiles({ role: "hr_admin" })).toBe(false);
    expect(canDropInboxFiles({ role: "member" })).toBe(false);
    expect(canDropInboxFiles(null)).toBe(false);
  });

  it("builds a drop key under the submission the server made", () => {
    const path = dropStoragePath({
      submissionId: "8d0b6b2e-1f4a-4c0f-9a5b-6d7e8f901234",
      index: 2,
      filename: "scan 1.pdf",
    });
    expect(path).toMatch(/^drop\/8d0b6b2e-1f4a-4c0f-9a5b-6d7e8f901234\/02-scan-1\.pdf$/);
  });

  it("falls back to a usable folder when a mail has no Message-ID", () => {
    expect(storageFolderFor("")).toBe("message");
    expect(storageFolderFor("<>")).toBe("message");
    expect(storageFolderFor("<a b/c>")).toBe("a-b-c");
  });

  it("joins a reply to its thread however the subject is written", () => {
    expect(threadSubjectKey("Re: Fwd: Producer Agreement")).toBe("producer agreement");
    expect(threadSubjectKey("RE:RE:  Producer   Agreement ")).toBe("producer agreement");
    expect(threadSubjectKey("Producer Agreement")).toBe("producer agreement");
  });

  it("shows a size the way a person reads it", () => {
    expect(sizeLabel(512)).toBe("512 B");
    expect(sizeLabel(2048)).toBe("2 KB");
    expect(sizeLabel(2.5 * MB)).toBe("2.5 MB");
    expect(sizeLabel(0)).toBe("");
    expect(sizeLabel(undefined)).toBe("");
  });
});
