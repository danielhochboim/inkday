'use strict';
const fs = require('node:fs');
const env = Object.fromEntries(fs.readFileSync('/etc/inkday/inkday.env', 'utf8').split(/\r?\n/).filter(Boolean).map(line => {
  const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')];
}));
if (!env.DISPLAY_KEY || env.DISPLAY_KEY.length < 24) throw new Error('DISPLAY_KEY is missing');
const file = '/home/ubuntu/inkday-sensecraft-url.txt';
fs.writeFileSync(file, `https://inkday.58319427.xyz/?display=1#key=${encodeURIComponent(env.DISPLAY_KEY)}\n`, {mode:0o600});
fs.chownSync(file, 1001, 1001);
fs.chmodSync(file, 0o600);
console.log(file);
