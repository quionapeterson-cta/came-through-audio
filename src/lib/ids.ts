/**
 * A song's own id in `public.catalogs`. Royalty Inspector songs carry a different id (`h:<uuid>`, health-songs.ts), and that
 * prefix is not a uuid: sending it to Postgres as a catalog id failed the insert with "invalid input syntax for type uuid:
 * h:…" (founder, 2026-11-14). Anything that writes a catalog row checks here first, and an id that is not a catalog id means
 * "this song is not in My Catalog yet, insert it".
 *
 * The check is the Inspector prefix rather than a uuid shape, so a song the catalog already holds is always updated in
 * place, however its id was written.
 */
const INSPECTOR_PREFIX = "h:";

/** True when the id names a song in My Catalog, so a row can be updated by it. */
export const isCatalogId = (id: string | undefined): id is string => !!id && !id.startsWith(INSPECTOR_PREFIX);

/** The id to update, or nothing when the row has to be created: an Inspector id is never written as a catalog id. */
export const updateTarget = (id: string | undefined): string | undefined => (isCatalogId(id) ? id : undefined);
