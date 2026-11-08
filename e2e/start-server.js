import { rmSync } from 'node:fs';

const databasePath = '/tmp/plc-status-playwright.db';
for (const suffix of ['', '-shm', '-wal']) rmSync(`${databasePath}${suffix}`, { force: true });

Object.assign(process.env, {
  PORT: '4173',
  DB_PATH: databasePath,
  APP_USER: 'ui-admin',
  APP_PASSWORD: 'ui-test-password',
  MFA_ENCRYPTION_KEY: '22'.repeat(32),
  SEED_DEMO_DATA: 'true',
  DEMO_DATA_LIMIT: '24',
  NODE_ENV: 'test'
});

const { startServer } = await import('../server.js');
await startServer();
