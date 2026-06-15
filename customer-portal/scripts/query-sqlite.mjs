import Database from 'better-sqlite3';
const db = new Database('/app/data/storage.sqlite');

try {
  console.log("--- API KEYS TABLE ---");
  const keys = db.prepare(`
    SELECT id, name, max_requests_per_day, max_requests_per_minute, max_requests_per_month, scopes 
    FROM api_keys
  `).all();
  console.log(JSON.stringify(keys, null, 2));
} catch (err) {
  console.error(err);
} finally {
  db.close();
}
