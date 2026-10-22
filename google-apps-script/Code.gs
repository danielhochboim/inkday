/** Inkday read-only data bridge. Keep credentials in Script Properties, never in this file. */
const INKDAY_TZ = 'Asia/Jerusalem';
const DEFAULT_CALENDAR_ID = ''; // Set CALENDAR_ID privately in Script Properties.

function doGet(e) {
 const p=PropertiesService.getScriptProperties();
 const callback=e&&e.parameter&&e.parameter.callback;
 // Only this one fixed callback is allowed. No arbitrary JS callback injection.
 if(callback!=='einkReceive')return output_({error:'invalid_request'},false);
 const expected=p.getProperty('DISPLAY_KEY');
 if(!expected||expected.length<24||!e.parameter.key||!equal_(expected,e.parameter.key))return output_({error:'unauthorized'},true);
 try{return output_(dashboard_(),true);}catch(error){return output_({error:'unavailable'},true);}
}
function equal_(a,b){let diff=a.length^b.length;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^(b.charCodeAt(i)||0);return diff===0;}
function output_(value,jsonp){let body=JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');return ContentService.createTextOutput(jsonp?'einkReceive('+body+');':body).setMimeType(jsonp?ContentService.MimeType.JAVASCRIPT:ContentService.MimeType.JSON);}
function dashboard_(){
 const now=new Date(),date=Utilities.formatDate(now,INKDAY_TZ,'yyyy-MM-dd');
 const p=PropertiesService.getScriptProperties(),calendarId=p.getProperty('CALENDAR_ID')||DEFAULT_CALENDAR_ID;
 const cache=CacheService.getScriptCache(),cacheKey='inkday-v1-'+date+'-'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,calendarId+'|'+(p.getProperty('TODOIST_TOKEN')||''))).slice(0,22);
 const saved=cache.get(cacheKey);if(saved)return JSON.parse(saved);
 const result={date:date,generatedAt:now.toISOString(),calendarName:'לוז יומי',tasks:[],events:[],errors:[]};
 try{result.events=events_(calendarId,date);}catch(error){result.errors.push('calendar');}
 try{result.tasks=tasks_(p);}catch(error){result.errors.push('todoist');}
 if(!result.errors.length)cache.put(cacheKey,JSON.stringify(result),60);
 return result;
}
/** UTC conversion uses the offset at the target midnight, including Israel DST boundaries. */
function midnight_(date){const naive=Date.parse(date+'T00:00:00Z');let instant=naive;for(let i=0;i<3;i++){const z=Utilities.formatDate(new Date(instant),INKDAY_TZ,'Z'),sign=z[0]==='-'?-1:1,offset=sign*(Number(z.slice(1,3))*60+Number(z.slice(3,5)))*60000;instant=naive-offset;}return new Date(instant);}
function events_(id,date){
 const calendar=CalendarApp.getCalendarById(id);if(!calendar)throw Error('Calendar unavailable');
 const next=new Date(date+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);const endDate=next.toISOString().slice(0,10);
 return calendar.getEvents(midnight_(date),midnight_(endDate)).map(e=>({title:e.getTitle()||'ללא כותרת',start:e.getStartTime().toISOString(),end:e.getEndTime().toISOString(),allDay:e.isAllDayEvent()}));
}
function tasks_(p){
 const token=p.getProperty('TODOIST_TOKEN');if(!token)throw Error('not configured');
 let project=p.getProperty('INBOX_PROJECT_ID');
 if(!project){const projects=pages_('https://api.todoist.com/api/v1/projects',token);const inbox=projects.find(x=>x.is_inbox_project||x.inbox_project);if(!inbox)throw Error('Inbox not found');project=inbox.id;}
 const tasks=pages_('https://api.todoist.com/api/v1/tasks?project_id='+encodeURIComponent(project),token);
 return tasks.filter(t=>!t.is_completed&&!t.checked).sort((a,b)=>(b.priority||1)-(a.priority||1)||(a.child_order??a.order??0)-(b.child_order??b.order??0)).map(t=>({content:t.content,priority:t.priority||1,due:t.due?{date:t.due.date}:null}));
}
function pages_(url,token){let cursor='',items=[];do{const page=get_(url+(cursor?(url.includes('?')?'&':'?')+'cursor='+encodeURIComponent(cursor):''),token);if(Array.isArray(page))return items.concat(page);items=items.concat(page.results||[]);cursor=page.next_cursor||'';}while(cursor);return items;}
function get_(url,token){const response=UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+token},muteHttpExceptions:true});if(response.getResponseCode()!==200)throw Error('Upstream unavailable');return JSON.parse(response.getContentText());}
/** Run once in the editor to authorize and check both data sources; logs contain no task/event titles. */
function checkConnection(){const result=dashboard_();console.log(JSON.stringify({date:result.date,tasks:result.tasks.length,events:result.events.length,errors:result.errors}));}
/** Run once, then copy DISPLAY_KEY from Project Settings > Script properties. */
function createDisplayKey(){const p=PropertiesService.getScriptProperties();if(!p.getProperty('DISPLAY_KEY'))p.setProperty('DISPLAY_KEY',Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,''));}
