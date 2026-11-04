'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const crypto = require('node:crypto');

const execFileAsync = promisify(execFile);
const ROOT = path.join(__dirname, 'docs');
const PORT = Number(process.env.PORT || 9180);
const HOST = process.env.HOST || '127.0.0.1';
const TZ = 'Asia/Jerusalem';
const CACHE_MS = 60_000;
let cached = null;
let cachedAt = 0;
let pending = null;
let calendarId = '';

function parts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}
function dayKey(date = new Date()) { const p = parts(date); return `${p.year}-${p.month}-${p.day}`; }
function midnight(date) {
  const naive = Date.parse(`${date}T00:00:00Z`); let instant = naive;
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(instant));
    const represented = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    instant += naive - represented;
  }
  return new Date(instant);
}
function nextDay(date) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
function safeEqual(a, b) {
  const aa = Buffer.from(a || ''), bb = Buffer.from(b || '');
  return aa.length === bb.length && aa.length >= 24 && crypto.timingSafeEqual(aa, bb);
}
function auth(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') && safeEqual(value.slice(7), process.env.DISPLAY_KEY);
}
async function gog(args) {
  const {stdout} = await execFileAsync('/usr/local/bin/gog', [...args, '--json', '--results-only', '--no-input'], {
    timeout: 25_000, maxBuffer: 4 * 1024 * 1024,
    env: {...process.env, HOME: process.env.GOOGLE_HOME || '/home/ubuntu'}
  });
  return JSON.parse(stdout);
}
function list(value) { return Array.isArray(value) ? value : (value?.items || value?.results || []); }
async function events(date) {
  if (!calendarId) {
    const calendars = list(await gog(['calendar', 'calendars', '--max', '100']));
    const wanted = process.env.CALENDAR_NAME || 'לוז יומי';
    const calendar = calendars.find(c => c.summary === wanted || c.name === wanted);
    if (!calendar) throw new Error('calendar_not_found');
    calendarId = calendar.id;
  }
  const raw = list(await gog(['calendar', 'events', calendarId, '--from', midnight(date).toISOString(), '--to', midnight(nextDay(date)).toISOString(), '--all-pages', '--max', '250']));
  return raw.filter(e => e.status !== 'cancelled').map(e => ({
    title: e.summary || e.title || 'ללא כותרת',
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    allDay: Boolean(e.start?.date && !e.start?.dateTime)
  })).filter(e => e.start && e.end);
}
async function todoistPage(url, token) {
  const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(20_000)});
  if (!response.ok) throw new Error(`todoist_${response.status}`);
  return response.json();
}
async function todoistAll(url, token) {
  const out = []; let cursor = '';
  do {
    const u = new URL(url); if (cursor) u.searchParams.set('cursor', cursor);
    const page = await todoistPage(u, token);
    if (Array.isArray(page)) return out.concat(page);
    out.push(...(page.results || [])); cursor = page.next_cursor || '';
  } while (cursor);
  return out;
}
async function tasks() {
  const token = process.env.TODOIST_TOKEN;
  if (!token) throw new Error('todoist_not_configured');
  let project = process.env.INBOX_PROJECT_ID;
  if (!project) {
    const projects = await todoistAll('https://api.todoist.com/api/v1/projects', token);
    const inbox = projects.find(p => p.is_inbox_project || p.inbox_project);
    if (!inbox) throw new Error('inbox_not_found');
    project = inbox.id;
  }
  const items = await todoistAll(`https://api.todoist.com/api/v1/tasks?project_id=${encodeURIComponent(project)}`, token);
  return items.filter(t => !t.is_completed && !t.checked)
    .sort((a,b) => (b.priority || 1) - (a.priority || 1) || (a.child_order ?? a.order ?? 0) - (b.child_order ?? b.order ?? 0))
    .map(t => ({content: t.content, priority: t.priority || 1, due: t.due ? {date: t.due.date} : null}));
}
async function refresh() {
  const now = new Date(), date = dayKey(now);
  const result = {date, generatedAt: now.toISOString(), calendarName: process.env.CALENDAR_NAME || 'לוז יומי', tasks: [], events: [], errors: []};
  const [cal, todo] = await Promise.allSettled([events(date), tasks()]);
  if (cal.status === 'fulfilled') result.events = cal.value; else { console.error('Calendar refresh failed:', cal.reason?.code || 'unknown'); result.errors.push('calendar'); result.events = cached?.date === date ? cached.events : []; }
  if (todo.status === 'fulfilled') result.tasks = todo.value; else { console.error('Todoist refresh failed:', todo.reason?.message || 'unknown'); result.errors.push('todoist'); result.tasks = cached?.date === date ? cached.tasks : []; }
  cached = result; cachedAt = Date.now(); return result;
}
async function dashboard(force = false) {
  if (!force && cached && Date.now() - cachedAt < CACHE_MS) return cached;
  if (!pending) pending = refresh().finally(() => { pending = null; });
  return pending;
}
function headers(extra = {}) { return {'Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",...extra}; }
function send(res, status, body, type = 'application/json; charset=utf-8') { res.writeHead(status, headers({'Content-Type':type})); res.end(body); }
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/healthz') return send(res, 200, JSON.stringify({ok:true, configured:Boolean(process.env.DISPLAY_KEY && process.env.TODOIST_TOKEN)}));
    if (url.pathname === '/api/dashboard') {
      if (!auth(req)) return send(res, 401, JSON.stringify({error:'unauthorized'}));
      const value = await dashboard(url.searchParams.get('refresh') === '1');
      return send(res, 200, JSON.stringify(value));
    }
    let name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(ROOT, `.${name}`);
    if (!file.startsWith(`${ROOT}${path.sep}`)) return send(res, 403, 'Forbidden', 'text/plain');
    fs.readFile(file, (err, body) => err ? send(res, 404, 'Not found', 'text/plain') : send(res, 200, body, types[path.extname(file)] || 'application/octet-stream'));
  } catch { send(res, 500, JSON.stringify({error:'unavailable'})); }
});
if (require.main === module) server.listen(PORT, HOST, () => console.log(`Inkday listening on http://${HOST}:${PORT}`));

module.exports = {dayKey, midnight, nextDay, safeEqual, server};
