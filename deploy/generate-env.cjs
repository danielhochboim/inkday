'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const dir = '/etc/inkday', file = `${dir}/inkday.env`;
if (fs.existsSync(file)) process.exit(0);
fs.mkdirSync(dir, {recursive:true, mode:0o700});
const key = crypto.randomBytes(32).toString('hex');
fs.writeFileSync(file, `DISPLAY_KEY=${key}\nTODOIST_TOKEN=\nCALENDAR_NAME="לוז יומי"\nGOOGLE_HOME=/home/ubuntu\nHOST=127.0.0.1\nPORT=9180\n`, {mode:0o600, flag:'wx'});
fs.chmodSync(file, 0o600);
