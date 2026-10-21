/**
 * A stand-in for the Supabase client in server-action tests. Every query is recorded as a Call
 * (table, operation, payload, filters) and answered by the test's `respond` function, so a test can
 * set up what the database returns and then assert exactly what was written.
 */

export type Op = "select" | "insert" | "update" | "upsert" | "delete" | "rpc";
export type Filter = [method: string, ...args: unknown[]];
export type Call = { table: string; op: Op; payload?: unknown; columns?: string; filters: Filter[] };
export type Result = { data?: unknown; error?: { message: string } | null; count?: number | null };
export type Respond = (call: Call) => Result | undefined;

const FILTERS = ["eq", "neq", "is", "not", "in", "like", "or", "gte", "lt", "order", "limit"] as const;

export function fakeSupabase(respond: Respond = () => undefined) {
  const calls: Call[] = [];

  function builder(table: string) {
    const call: Call = { table, op: "select", filters: [] };
    let single = false;
    const run = (): Result => {
      calls.push(call);
      const result = respond(call) ?? {};
      const data = result.data ?? (single ? null : call.op === "select" ? [] : null);
      return { data, error: result.error ?? null, count: result.count ?? null };
    };
    const chain: Record<string, unknown> = {
      select(columns?: string) {
        // select() after a write returns the written rows; the operation stays the write.
        if (call.op === "select") call.columns = columns;
        return chain;
      },
      insert(payload: unknown) {
        Object.assign(call, { op: "insert", payload });
        return chain;
      },
      update(payload: unknown) {
        Object.assign(call, { op: "update", payload });
        return chain;
      },
      upsert(payload: unknown) {
        Object.assign(call, { op: "upsert", payload });
        return chain;
      },
      delete() {
        call.op = "delete";
        return chain;
      },
      maybeSingle() {
        single = true;
        return Promise.resolve(run());
      },
      single() {
        single = true;
        return Promise.resolve(run());
      },
      then(resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    for (const name of FILTERS) {
      chain[name] = (...args: unknown[]) => {
        call.filters.push([name, ...args]);
        return chain;
      };
    }
    return chain;
  }

  const client = {
    from: (table: string) => builder(table),
    rpc: (fn: string, args: unknown) => {
      const call: Call = { table: fn, op: "rpc", payload: args, filters: [] };
      calls.push(call);
      const result = respond(call) ?? {};
      return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
    },
  };

  /** The recorded calls for one table and operation, in order. */
  const find = (table: string, op: Op) => calls.filter((c) => c.table === table && c.op === op);
  return { client, calls, find };
}

/** True when a call was filtered by column = value. */
export const filteredBy = (call: Call, column: string, value: unknown) =>
  call.filters.some(([method, col, v]) => method === "eq" && col === column && v === value);
