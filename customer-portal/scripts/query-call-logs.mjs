import Database from 'better-sqlite3';
const db = new Database('/app/data/storage.sqlite');

try {
  console.log("--- SCHEMA OF CALL_LOGS ---");
  const cols = db.prepare("PRAGMA table_info(call_logs)").all();
  console.log("Columns:", cols.map(c => c.name).join(', '));

  console.log("\n--- RECENT CALL LOGS ---");
  // Let's do a generic select first to get the columns right
  const callLogs = db.prepare(`
    SELECT * FROM call_logs
    ORDER BY id DESC
    LIMIT 5
  `).all();
  console.log(JSON.stringify(callLogs, null, 2));
} catch (err) {
  console.error(err);
} finally {
  db.close();
}
