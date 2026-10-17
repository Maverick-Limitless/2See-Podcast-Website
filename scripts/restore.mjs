#!/usr/bin/env node
/** Restores the database from a backup, verifying it before swapping in. */
import {
  DATABASE_PATH, existsSync, mkdirSync, copyFileSync, renameSync, resolve, dirname, DatabaseSync
} from './_db-lib.mjs';

const source = resolve(process.argv[2] ?? '');
if (!process.argv[2] || !existsSync(source)) {
  console.error('Usage: npm run db:restore -- <backup-file>');
  process.exit(1);
}
mkdirSync(dirname(DATABASE_PATH), { recursive: true });

if (!existsSync(DATABASE_PATH)) {
  copyFileSync(source, DATABASE_PATH);
  console.log(`Restored ${source} → ${DATABASE_PATH}`);
  process.exit(0);
}

const temp = `${DATABASE_PATH}.restoring`;
copyFileSync(source, temp);
const probe = new DatabaseSync(temp);
const check = probe.prepare('PRAGMA integrity_check').get();
probe.close();
if (!check || check.integrity_check !== 'ok') {
  console.error('The backup failed its integrity check; nothing was changed.');
  process.exit(1);
}
renameSync(temp, DATABASE_PATH);
console.log(`Restored ${source} → ${DATABASE_PATH}`);
console.log('Restart the server so open handles reopen the new file.');
