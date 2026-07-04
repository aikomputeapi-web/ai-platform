import type { DbAdapter, Logger } from "../adapters.js";
export interface SqliteDb {
    prepare(sql: string): {
        run(...params: unknown[]): {
            changes: number;
        };
        get(...params: unknown[]): Record<string, unknown> | undefined;
        all(...params: unknown[]): Record<string, unknown>[];
        transaction<T>(fn: () => T): T;
    };
    exec(sql: string): void;
}
export declare function createSqliteAdapter(db: SqliteDb, log: Logger, namePrefix?: string): DbAdapter;
//# sourceMappingURL=sqlite-adapter.d.ts.map