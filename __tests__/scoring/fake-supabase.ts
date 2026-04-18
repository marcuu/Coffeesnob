// Minimal in-memory Supabase-client stand-in for pipeline tests. Implements
// just the subset the pipeline uses: select/in/upsert/delete/count on named
// tables. Not a general-purpose fake — keep it scoped to pipeline needs.
//
// An integration test against a real Supabase instance is still required
// before shipping (see docs/scoring.md Section 7). This fake exercises the
// orchestration logic only.

export type Table = Record<string, unknown>;
export type Tables = Record<string, Table[]>;

type Filter = { column: string; op: "eq" | "in" | "lte"; value: unknown };
type UpsertOpts = { onConflict?: string };

export function createFakeSupabase(tables: Tables): {
  client: unknown;
  tables: Tables;
  reset: (t: Tables) => void;
} {
  const state: Tables = tables;

  function builder(tableName: string) {
    let filters: Filter[] = [];
    let selectCols: string | null = null;
    let countRequested: "exact" | null = null;
    let headMode = false;

    const api: Record<string, unknown> = {};

    api.select = (cols: string, opts?: { count?: "exact"; head?: boolean }) => {
      selectCols = cols;
      if (opts?.count) countRequested = opts.count;
      if (opts?.head) headMode = true;
      return api;
    };
    api.eq = (column: string, value: unknown) => {
      filters.push({ column, op: "eq", value });
      return api;
    };
    api.in = (column: string, values: unknown[]) => {
      filters.push({ column, op: "in", value: values });
      return api;
    };
    api.lte = (column: string, value: unknown) => {
      filters.push({ column, op: "lte", value });
      return api;
    };
    api.upsert = async (rows: Table[] | Table, _opts?: UpsertOpts) => {
      const arr = Array.isArray(rows) ? rows : [rows];
      const opts = _opts ?? {};
      const keys = (opts.onConflict ?? "id").split(",").map((k) => k.trim());
      const existing = state[tableName] ?? [];
      for (const row of arr) {
        const idx = existing.findIndex((e) =>
          keys.every((k) => (e as Record<string, unknown>)[k] === (row as Record<string, unknown>)[k]),
        );
        if (idx >= 0) existing[idx] = { ...existing[idx], ...row };
        else existing.push({ ...row });
      }
      state[tableName] = existing;
      return { data: arr, error: null };
    };
    api.delete = () => {
      return {
        lte: (column: string, value: unknown) => runDelete([...filters, { column, op: "lte", value }]),
        eq: (column: string, value: unknown) => runDelete([...filters, { column, op: "eq", value }]),
        in: (column: string, value: unknown[]) => runDelete([...filters, { column, op: "in", value }]),
        then: (onResolve: (v: unknown) => unknown) => runDelete(filters).then(onResolve),
      };
    };

    function runDelete(fs: Filter[]) {
      const before = state[tableName] ?? [];
      const after = before.filter((row) => !matches(row, fs));
      state[tableName] = after;
      return Promise.resolve({ data: null, error: null });
    }

    function matches(row: Table, fs: Filter[]): boolean {
      for (const f of fs) {
        const v = (row as Record<string, unknown>)[f.column];
        if (f.op === "eq" && v !== f.value) return false;
        if (f.op === "in" && !(f.value as unknown[]).includes(v)) return false;
        if (f.op === "lte") {
          if (typeof v !== typeof f.value) return false;
          if ((v as string | number) > (f.value as string | number)) return false;
        }
      }
      return true;
    }

    function run() {
      const rows = (state[tableName] ?? []).filter((r) => matches(r, filters));
      if (headMode) {
        return { data: null, error: null, count: rows.length };
      }
      if (countRequested === "exact") {
        return { data: rows, error: null, count: rows.length };
      }
      // Narrow to the requested columns (just structure; types stay loose).
      if (selectCols && selectCols !== "*") {
        const cols = selectCols.split(",").map((c) => c.trim());
        const out = rows.map((r) => {
          const o: Record<string, unknown> = {};
          for (const c of cols) o[c] = (r as Record<string, unknown>)[c];
          return o;
        });
        return { data: out, error: null };
      }
      return { data: rows, error: null };
    }

    // Make the builder thenable so `await sb.from(x).select()` resolves.
    (api as { then: unknown }).then = (onResolve: (v: unknown) => unknown) =>
      Promise.resolve(run()).then(onResolve);

    return api;
  }

  const client = {
    from: (name: string) => builder(name),
  };

  return {
    client,
    tables: state,
    reset(next: Tables) {
      for (const k of Object.keys(state)) delete state[k];
      for (const k of Object.keys(next)) state[k] = next[k];
    },
  };
}
