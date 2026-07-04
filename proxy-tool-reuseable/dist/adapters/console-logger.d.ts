import type { Logger } from "../adapters.js";
export interface ConsoleLoggerOptions {
    level?: "debug" | "info" | "warn" | "error";
    prefix?: string;
}
export declare function createConsoleLogger(opts?: ConsoleLoggerOptions): Logger;
//# sourceMappingURL=console-logger.d.ts.map