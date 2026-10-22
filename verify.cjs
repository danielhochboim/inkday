const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/google-apps-script/Code.gs','utf8');
let property={DISPLAY_KEY:'a'.repeat(64),TODOIST_TOKEN:'private-token',INBOX_PROJECT_ID:'inbox'},requests=[];
const ctx={console,Date,JSON,Error,Number,String,encodeURIComponent,PropertiesService:{getScriptProperties:()=>({getProperty:k=>property[k]})},ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'js'},createTextOutput:text=>({setMimeType:()=>text})},ScriptApp:{getOAuthToken:()=> 'oauth'},Utilities:{formatDate:(d,tz,fmt)=>{if(fmt==='Z'){return new Intl.DateTimeFormat('en',{timeZone:tz,timeZoneName:'longOffset'}).formatToParts(d).find(p=>p.type==='timeZoneName').value.replace('GMT','').replace(':','');}return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}},UrlFetchApp:{fetch:(url,options)=>{requests.push(url);const body=url.includes('/calendar/')?{items:[{summary:'<script> & Hebrew עברית',start:{dateTime:'2026-10-22T09:00:00+03:00'},end:{dateTime:'2026-10-22T10:00:00+03:00'}},{status:'cancelled',start:{},end:{}}]}:url.includes('cursor=next')?{results:[{content:'Second',priority:4}],next_cursor:null}:{results:[{content:'First',priority:1}],next_cursor:'next'};return{getResponseCode:()=>200,getContentText:()=>JSON.stringify(body)};}}};
vm.createContext(ctx);vm.runInContext(source,ctx);
assert.match(ctx.doGet({parameter:{callback:'evil();',key:property.DISPLAY_KEY}}),/invalid_request/);
assert.match(ctx.doGet({parameter:{callback:'einkReceive',key:'wrong'}}),/unauthorized/);assert.equal(requests.length,0,'Unauthorized calls must never fetch private data');
const tasks=ctx.tasks_({getProperty:k=>property[k]});assert.equal(tasks.length,2);assert.equal(tasks[0].content,'Second');assert.ok(requests[1].includes('cursor=next'));
requests=[];let calendarRange;ctx.CalendarApp={getCalendarById:id=>({getEvents:(start,end)=>{calendarRange=[start,end];return[{getTitle:()=> 'Event',getStartTime:()=>new Date('2026-10-22T09:00:00+03:00'),getEndTime:()=>new Date('2026-10-22T10:00:00+03:00'),isAllDayEvent:()=>false}];}})};const events=ctx.events_('calendar','2026-10-22');assert.equal(events.length,1);assert.equal(events[0].start,'2026-10-22T06:00:00.000Z');assert.equal(calendarRange[0].toISOString(),'2026-10-21T21:00:00.000Z');assert.equal(calendarRange[1].toISOString(),'2026-10-22T21:00:00.000Z');
const spring=(ctx.midnight_('2026-03-28')-ctx.midnight_('2026-03-27'))/3600000;
const autumn=(ctx.midnight_('2026-10-26')-ctx.midnight_('2026-10-25'))/3600000;
assert.equal(spring,23,'Spring DST day');assert.equal(autumn,25,'Autumn DST day');
const escaped=ctx.output_({title:'</script>'},true);assert.ok(!escaped.includes('</script>'));
// Compile frontend without executing browser-specific code.
new vm.Script(fs.readFileSync(__dirname+'/docs/app.js','utf8'));
const manifest=JSON.parse(fs.readFileSync(__dirname+'/google-apps-script/appsscript.json','utf8'));assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/calendar.readonly'));assert.equal(manifest.oauthScopes.length,2);
console.log('PASS: auth gating, pagination, priority, calendar day boundaries, Israel DST, JSONP escaping, read-only scopes, JS syntax.');
