const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
export function createConsoleLogger(opts = {}) {
    const minLevel = LEVELS[opts.level ?? "info"];
    const prefix = opts.prefix ?? "";
    function shouldLog(level) {
        return LEVELS[level] >= minLevel;
    }
    function formatArgs(objOrMsg, msg) {
        const parts = [];
        if (prefix)
            parts.push(`[${prefix}]`);
        if (typeof objOrMsg === "string") {
            parts.push(objOrMsg);
            if (msg)
                parts.push(msg);
        }
        else {
            if (msg)
                parts.push(msg);
            if (Object.keys(objOrMsg).length > 0)
                parts.push(JSON.stringify(objOrMsg));
        }
        return parts;
    }
    return {
        info(objOrMsg, msg) {
            if (!shouldLog("info"))
                return;
            console.log(...formatArgs(objOrMsg, msg));
        },
        warn(objOrMsg, msg) {
            if (!shouldLog("warn"))
                return;
            console.warn(...formatArgs(objOrMsg, msg));
        },
        error(objOrMsg, msg) {
            if (!shouldLog("error"))
                return;
            console.error(...formatArgs(objOrMsg, msg));
        },
        debug(objOrMsg, msg) {
            if (!shouldLog("debug"))
                return;
            console.log(...formatArgs(objOrMsg, msg));
        },
    };
}
//# sourceMappingURL=console-logger.js.map