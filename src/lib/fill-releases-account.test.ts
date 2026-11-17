import { describe, expect, it } from "vitest";
import { rememberRelease, type ReleaseDb } from "./fill-releases-account";

type Row = { id: string; user_id: string; kind: string; name: string };
type Reply<T> = { data: T; error: { message: string } | null };

/**
 * A stand-in for supabase-js's `fill_releases` table: the handful of chains the release writes use, and the unique index's
 * rule (one row per account, kind and lower(btrim(name))) as an insert that can be refused by a row another tab wrote
 * first. The dialog's browser copy is not the real list, so these paths are what keep a typed release on the account.
 */
class FakeTable {
  rows: Row[] = [];
  inserts: Omit<Row, "id">[] = [];
  updates: { id: string; name: string }[] = [];
  /** The row another tab wrote first, so the insert meets the unique index instead of landing. */
  raced: Omit<Row, "id"> | null = null;
  private nextId = 1;

  from(_table: "fill_releases"): Query {
    return new Query(this);
  }

  /** @returns the saved row, or null when the unique index kept the other tab's row instead. */
  insert(row: Omit<Row, "id">): Row | null {
    this.inserts.push(row);
    if (this.raced) {
      this.rows.push({ id: `won-${this.nextId++}`, ...this.raced });
      return null;
    }
    const saved = { id: `row-${this.nextId++}`, ...row };
    this.rows.push(saved);
    return saved;
  }
}

class Query implements PromiseLike<Reply<Row[] | null>> {
  private mode: "read" | "insert" | "update" | "delete" = "read";
  private filters: [string, string][] = [];
  private ids: string[] = [];
  private patch: { name: string } | null = null;
  private row: Omit<Row, "id"> | null = null;

  constructor(private db: FakeTable) {}

  select(_columns: string): Query {
    return this;
  }

  insert(row: Omit<Row, "id">): Query {
    this.mode = "insert";
    this.row = row;
    return this;
  }

  update(patch: { name: string }): Query {
    this.mode = "update";
    this.patch = patch;
    return this;
  }

  delete(): Query {
    this.mode = "delete";
    return this;
  }

  eq(column: string, value: string): Query {
    this.filters.push([column, value]);
    return this;
  }

  in(_column: string, values: string[]): Query {
    this.ids = values;
    return this;
  }

  async single(): Promise<Reply<Row | null>> {
    const { data, error } = this.run();
    return { data: error ? null : (data?.[0] ?? null), error };
  }

  then<TResult1 = Reply<Row[] | null>, TResult2 = never>(
    onfulfilled?: ((value: Reply<Row[] | null>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }

  private matching(): Row[] {
    return this.db.rows.filter(
      (row) =>
        this.filters.every(([column, value]) => String(row[column as keyof Row]) === value) &&
        (!this.ids.length || this.ids.includes(row.id)),
    );
  }

  private run(): Reply<Row[] | null> {
    if (this.mode === "insert") {
      const saved = this.db.insert(this.row!);
      // The real index answers 23505; the message is not shown to anyone, only thrown on.
      return saved
        ? { data: [saved], error: null }
        : { data: null, error: { message: "duplicate key value violates unique constraint" } };
    }
    const matching = this.matching();
    if (this.mode === "update") {
      const name = this.patch!.name;
      matching.forEach((row) => {
        row.name = name;
        this.db.updates.push({ id: row.id, name });
      });
      return { data: matching, error: null };
    }
    if (this.mode === "delete") {
      this.db.rows = this.db.rows.filter((row) => !matching.includes(row));
      return { data: null, error: null };
    }
    return { data: matching, error: null };
  }
}

const account = (rows: Row[] = []) => {
  const table = new FakeTable();
  table.rows = rows;
  return { table, db: table as unknown as ReleaseDb };
};

describe("remembering a release with the account", () => {
  it("updates the row the account already has instead of adding a second copy", async () => {
    const { table, db } = account([{ id: "r1", user_id: "u1", kind: "EP", name: "afterglow" }]);
    const saved = await rememberRelease(db, "u1", { type: "EP", name: "Afterglow" });
    expect(saved).toEqual({ id: "r1", type: "EP", name: "Afterglow" });
    expect(table.inserts).toHaveLength(0);
    expect(table.updates).toEqual([{ id: "r1", name: "Afterglow" }]);
    expect(table.rows).toHaveLength(1);
  });

  it("adds the release when the account has none", async () => {
    const { table, db } = account();
    const saved = await rememberRelease(db, "u1", { type: "Single", name: "Not Again" });
    expect(saved).toEqual({ id: "row-1", type: "Single", name: "Not Again" });
    expect(table.rows).toEqual([{ id: "row-1", user_id: "u1", kind: "Single", name: "Not Again" }]);
  });

  it("hands back the row another tab wrote first rather than failing the save", async () => {
    const { table, db } = account();
    table.raced = { user_id: "u1", kind: "EP", name: "afterglow" };
    const saved = await rememberRelease(db, "u1", { type: "EP", name: "Afterglow" });
    expect(saved).toEqual({ id: "won-1", type: "EP", name: "afterglow" });
    expect(table.inserts).toHaveLength(1);
    expect(table.rows).toHaveLength(1);
  });

  it("never touches another account's row", async () => {
    const { table, db } = account([{ id: "r2", user_id: "u2", kind: "EP", name: "Afterglow" }]);
    const saved = await rememberRelease(db, "u1", { type: "EP", name: "Afterglow" });
    expect(saved.id).toBe("row-1");
    expect(table.updates).toHaveLength(0);
    expect(table.rows.map((row) => row.user_id)).toEqual(["u2", "u1"]);
  });
});
