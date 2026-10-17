#!/usr/bin/env node
/** Writes a consistent, timestamped backup without stopping the server. */
import {
  DATABASE_PATH, BACKUP_DIR, stamp, existsSync, mkdirSync, statSync, DatabaseSync, join
} from './_db-lib.mjs';

if (!existsSync(DATABASE_PATH)) {
  console.error(`No database at ${DATABASE_PATH} to back up.`);
  process.exit(1);
}
mkdirSync(BACKUP_DIR, { recursive: true });
const target = join(BACKUP_DIR, `${stamp()}.db`);
const db = new DatabaseSync(DATABASE_PATH);
db.prepare('VACUUM INTO ?').run(target);
db.close();
console.log(`Backup written: ${target} (${(statSync(target).size / 1024).toFixed(1)} kB)`);
