'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const envFile = '/etc/inkday/inkday.env';
const keyring = '/home/ubuntu/.config/gogcli/keyring';
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, 'Z');
const backup = `/home/ubuntu/.config/gogcli/keyring-backup-${stamp}`;
const entries = fs.readdirSync(keyring).filter(name => name.startsWith('token:'));
fs.mkdirSync(backup, {mode: 0o700});
for (const name of entries) fs.renameSync(path.join(keyring, name), path.join(backup, name));
const password = crypto.randomBytes(32).toString('hex');
let env = fs.readFileSync(envFile, 'utf8');
const line = `GOG_KEYRING_PASSWORD=${password}`;
env = /^GOG_KEYRING_PASSWORD=.*$/m.test(env) ? env.replace(/^GOG_KEYRING_PASSWORD=.*$/m, line) : `${env.trimEnd()}\n${line}\n`;
fs.writeFileSync(envFile, env, {mode: 0o600});
fs.chmodSync(envFile, 0o600);
console.log(`Backed up ${entries.length} encrypted token file(s) to ${backup}`);
