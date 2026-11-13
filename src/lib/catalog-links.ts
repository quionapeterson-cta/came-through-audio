/**
 * One way to send someone from a diagnostic to the exact field in My Catalog (founder, 2026-11-14).
 *
 * Every "Edit in My Catalog" / "Fix in Catalog" link used to land on the song with nothing pointed at, or pointed at the
 * ISRC whatever had actually gone wrong. The rule is now global: a fix link names the song **and** the field, so the
 * workspace opens that entry and the field is scrolled to and lit (`.cta-diagnostic-target`, see
 * `useFocusHighlight.tsx`). The parameter names are the contract `workspace.tsx` and `MetadataUploader` already read —
 * this helper only builds them, in one place, so a new card can never invent its own spelling.
 */
export type CatalogField =
  | "isrc"
  | "title"
  | "artist"
  | "version"
  | "retired"
  | "release"
  | "releaseDate"
  | "rightsStart"
  | "rightsEnd";

/** How the fix bar names the field it is pointing at. */
export const CATALOG_FIELD_LABEL: Record<string, string> = {
  isrc: "ISRC",
  title: "title",
  artist: "artist",
  version: "version",
  retired: "retired ISRC",
  release: "release",
  releaseDate: "release date",
  rightsStart: "rights start",
  rightsEnd: "rights end",
};

/** What the link is asking the member to do once the field is in front of them. */
export type CatalogAction = "adopt" | "dual_isrc" | "add-version" | "review";

export type CatalogLink = {
  trackId: string;
  field: CatalogField | string;
  /** The agency's own code, so the fix bar can offer to apply it. */
  agencyIsrc?: string | undefined;
  /** The agency's own version name, so an Add Version link can offer it instead of making the member retype it. */
  agencyVersion?: string | undefined;
  /** Every version the list names under one title, so four listed versions are four choices, never just the first. */
  agencyVersions?: string[] | undefined;
  action?: CatalogAction | string | undefined;
};

/** `/workspace?tab=catalog&songId=…#song-<id>` — the address My Catalog opens a song's form from. */
export function catalogHref({
  trackId,
  field,
  agencyIsrc,
  agencyVersion,
  agencyVersions,
  action,
}: CatalogLink): string {
  const p = new URLSearchParams({ tab: "catalog", songId: trackId, focusField: field });
  if (agencyIsrc) p.set("agencyIsrc", agencyIsrc);
  if (agencyVersion) p.set("agencyVersion", agencyVersion);
  if (agencyVersions?.length) p.set("agencyVersions", agencyVersions.join("|"));
  if (action) p.set("action", action);
  return `/workspace?${p.toString()}#song-${trackId}`;
}
