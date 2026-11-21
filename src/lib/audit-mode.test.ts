import { describe, expect, it } from "vitest";
import { blankAudit, nextAuditHref, nextAuditSong, recordStop } from "./audit-mode";

describe("audit trail", () => {
  it("keeps the stops in screen order whatever order they were visited in", () => {
    let trail = blankAudit();
    trail = recordStop(
      trail,
      "catalog",
      "/workspace?tab=catalog&songId=a&focusField=isrc&trail=yes",
      "a",
    );
    trail = recordStop(trail, "report", "/workspace?tab=health&trail=yes", "a");
    trail = recordStop(trail, "checklist", "/workspace?tab=health&song=a&trail=yes", "a");
    expect(trail.order).toEqual(["report", "checklist", "catalog"]);
    expect(trail.songId).toBe("a");
  });

  it("updates a stop's address instead of adding it twice", () => {
    let trail = recordStop(
      blankAudit(),
      "catalog",
      "/workspace?tab=catalog&songId=a&focusField=isrc",
      "a",
    );
    trail = recordStop(trail, "catalog", "/workspace?tab=catalog&songId=b&focusField=iswc", "b");
    expect(trail.order).toEqual(["catalog"]);
    expect(trail.hrefs.catalog).toContain("songId=b");
  });

  it("walks the finding's songs in order and stops at the end", () => {
    const trail = {
      ...blankAudit(),
      queue: [{ id: "a", field: "isrc" }, { id: "b" }, { id: "c" }],
    };
    expect(nextAuditSong(trail)?.id).toBe("a");
    expect(nextAuditSong(trail, "a")?.id).toBe("b");
    expect(nextAuditSong(trail, "c")).toBeUndefined();
  });

  it("sends a song with a field to its form and one without to its checklist", () => {
    expect(nextAuditHref({ id: "a", field: "isrc" })).toBe(
      "/workspace?tab=catalog&songId=a&focusField=isrc&trail=yes#song-a",
    );
    expect(nextAuditHref({ id: "b" })).toBe("/workspace?tab=health&song=b&trail=yes");
  });
});
