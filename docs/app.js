'use strict';
(() => {
 const $ = id => document.getElementById(id);
 const TZ='Asia/Jerusalem';
 const query=new URLSearchParams(location.search), params=new URLSearchParams(location.hash.slice(1));
 const isDisplay=query.get('display')==='1';
 let demo=query.get('demo')==='1', data=null, lastError='', inFlight=false;
 let config={endpoint:params.get('endpoint')||'',key:params.get('key')||''};
 if(isDisplay)document.body.classList.add('display');
 const text=(el,value)=>{value=String(value??'');el.textContent=/[\u0590-\u05ff]/.test(value)&&(/[a-zA-Z]/.test(value)||/\p{Extended_Pictographic}/u.test(value))?'\u200f'+value:value;};
 const node=(tag,cls,value)=>{const el=document.createElement(tag);el.className=cls||'';if(value!==undefined)text(el,value);return el;};
 const parts=d=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 const dayKey=d=>{const p=parts(d);return `${p.year}-${p.month}-${p.day}`;};
 const minute=d=>{const p=parts(d);return +p.hour*60+ +p.minute;};
 const clock=d=>new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);
 const clear=id=>$(id).replaceChildren();
 function sample(){
  const p=parts(new Date()), base=`${p.year}-${p.month}-${p.day}`, offset=new Intl.DateTimeFormat('en',{timeZone:TZ,timeZoneName:'longOffset'}).formatToParts(new Date()).find(x=>x.type==='timeZoneName').value.replace('GMT','')||'+00:00';
  const at=(h,m=0)=>`${base}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00${offset}`;
  return {generatedAt:new Date().toISOString(),date:base,calendarName:'לוז יומי',events:[{title:'זמן לעצמי',start:at(7),end:at(8)},{title:'עבודה והתמקדות',start:at(8),end:at(16)},{title:'הפסקה ונשימה',start:at(16),end:at(17)},{title:'לימודים',start:at(17),end:at(19)},{title:'ארוחת ערב',start:at(19),end:at(20)},{title:'זמן חופשי',start:at(20),end:at(23)}],tasks:[{content:'לתכנן את שלוש המשימות החשובות',priority:4},{content:'לקרוא פרק בספר',priority:1},{content:'לסדר את פינת העבודה',priority:1},{content:'לעשות הליכה קצרה',priority:2},{content:'לעבור על חומר הלימוד',priority:1},{content:'להכין משהו טעים לערב',priority:1}],errors:[]};
 }
 function render(){
  const now=new Date(), today=dayKey(now), mins=minute(now);
  text($('clock'),clock(now));$('clock').dateTime=now.toISOString();
  text($('date'),new Intl.DateTimeFormat('he-IL',{timeZone:TZ,weekday:'long',day:'numeric',month:'long'}).format(now));
  text($('dayProgress'),`${Math.round(mins/1440*100)}% מהיום מאחוריך`);
  document.body.classList.toggle('demo',demo);
  if(!data){renderTimeline([],now,mins);return;}
  const sourceErrors=Array.isArray(data.errors)?data.errors:[];
  const wrongDay=data.date!==today;
  const events=wrongDay?[]:(data.events||[]).filter(e=>e.allDay||(Number.isFinite(Date.parse(e.start))&&Number.isFinite(Date.parse(e.end))&&Date.parse(e.end)>Date.parse(e.start))).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  const timed=events.filter(e=>!e.allDay), active=timed.filter(e=>Date.parse(e.start)<=now&&Date.parse(e.end)>now), next=timed.find(e=>Date.parse(e.start)>now);
  text($('focusLabel'),demo?'הדגמה':active.length?'עכשיו':'זמן פנוי');
  const current=active[0];
  if(wrongDay){text($('focusTitle'),'ממתין לנתוני היום');text($('focusSubtitle'),'נתוני היומן הקודמים אינם מוצגים');}
  else if(sourceErrors.includes('calendar')){text($('focusTitle'),'היומן לא זמין כרגע');text($('focusSubtitle'),'מנסה להתחבר שוב אוטומטית');}
  else if(current){text($('focusTitle'),current.title);text($('focusSubtitle'),`${clock(new Date(current.start))}–${clock(new Date(current.end))}${active.length>1?` · עוד ${active.length-1} במקביל`:''}`);}
  else {text($('focusTitle'),next?'רגע פנוי לפני '+next.title:'כל הזמן הזה שלך');text($('focusSubtitle'),next?'האירוע הבא מתחיל ב־'+clock(new Date(next.start)):'אין עוד אירועים מתוזמנים להיום');}
  $('remaining').replaceChildren();
  const boundary=current?Date.parse(current.end):next?Date.parse(next.start):null;
  if(boundary&&!wrongDay&&!sourceErrors.includes('calendar')){ $('remaining').append(node('b','',Math.ceil((boundary-now)/60000)),node('span','',current?'דקות נותרו':'דקות עד אז'));}
  clear('allDay');const allDay=events.filter(e=>e.allDay);if(allDay.length)$('allDay').append(node('div','all-day','כל היום · '+allDay.map(e=>e.title).join(' · ')));
  clear('events');const remaining=timed.filter(e=>Date.parse(e.start)>now);const shown=remaining.slice(0,allDay.length?2:3);
  text($('eventCount'),`${remaining.length} אירועים`);
  if(!shown.length)$('events').append(node('p','empty',sourceErrors.includes('calendar')?'שגיאה בחיבור ליומן':wrongDay?'ממתין לרענון היומן':'היומן פנוי להמשך היום'));
  shown.forEach(e=>{const isActive=Date.parse(e.start)<=now;const row=node('div','event'+(isActive?' active':'')),copy=node('div','event-copy');row.append(node('time','event-time',clock(new Date(e.start))));const title=node('div','event-title',e.title);title.title=e.title;copy.append(title,node('div','event-meta',`${isActive?'עכשיו · ':''}עד ${clock(new Date(e.end))}`));row.append(copy);$('events').append(row);});
  if(remaining.length>shown.length&&shown.length){text($('eventCount'),`ועוד ${remaining.length-shown.length} בהמשך`);}
  clear('tasks');const tasks=Array.isArray(data.tasks)?data.tasks:[];
  const pages=Math.max(1,Math.ceil(tasks.length/4)),page=Math.floor(Date.now()/300000)%pages;
  text($('taskCount'),`${tasks.length} פתוחות`);text($('taskPages'),pages>1?`${page+1} / ${pages}`:'');
  if(!tasks.length)$('tasks').append(node('p','empty',sourceErrors.includes('todoist')?'שגיאה בחיבור למשימות':'הכול מסודר. אין משימות נכנסות.'));
  tasks.slice(page*4,page*4+4).forEach(t=>{const row=node('div','task'+(t.priority>=3?' high':'')),label=node('span','task-title',t.content);label.title=t.content;row.append(node('span','checkbox'),label);if(t.due?.date){const due=t.due.date.slice(0,10);if(due<=today)row.append(node('span','due',due<today?'באיחור':'היום'));} $('tasks').append(row);});
  renderTimeline(timed,now,mins);
  const age=(now-Date.parse(data.generatedAt))/60000;
  const warnings=[demo?'נתוני הדגמה בלבד':null,lastError||null,...sourceErrors.map(s=>s==='calendar'?'שגיאת יומן':'שגיאת משימות'),wrongDay?'נתוני יום קודם':age>15?'הנתונים לא מעודכנים':null].filter(Boolean);
  text($('status'),warnings.length?warnings.join(' · '):'');
  text($('updated'),'עדכון נתונים '+clock(new Date(data.generatedAt)));
 }
 function renderTimeline(events,now,mins){
  const track=$('timeline');track.replaceChildren();const elapsed=node('div','elapsed');elapsed.style.width=mins/1440*100+'%';track.append(elapsed);
  const today=dayKey(now),lanes=[-1,-1];events.forEach(e=>{const s=dayKey(new Date(e.start))<today?0:minute(new Date(e.start)),end=dayKey(new Date(e.end))>today?1440:minute(new Date(e.end));if(end<=s)return;let lane=lanes.findIndex(x=>x<=s);if(lane<0)lane=1;lanes[lane]=Math.max(lanes[lane],end);const block=node('div','time-block'+(Date.parse(e.start)<=now&&Date.parse(e.end)>now?' current':''));block.style.left=s/1440*100+'%';block.style.width=(end-s)/1440*100+'%';block.style.top=lane*8+'px';block.title=`${e.title} ${clock(new Date(e.start))}–${clock(new Date(e.end))}`;track.append(block);});
  const marker=node('div','now-line');marker.style.left=Math.min(99.7,mins/1440*100)+'%';marker.title='עכשיו '+clock(now);track.append(marker);
 }
 async function load(){
  if(demo){data=sample();lastError='';render();return;}
  if(!config.endpoint||!config.key){data=null;render();text($('status'),'לא מחובר · פתח חיבור חשבונות');return;}
  if(inFlight)return;inFlight=true;
  try{const result=await jsonp(config);if(result.error)throw Error(result.error==='unauthorized'?'מפתח התצוגה שגוי':'החיבור לא הושלם');if(!Array.isArray(result.tasks)||!Array.isArray(result.events)||!result.generatedAt||!result.date)throw Error('תגובה לא תקינה');
   // Retain the last successful source on partial failures; never turn a fetch failure into an empty Inbox.
   const errors=result.errors||[];if(data&&data.date===result.date){if(errors.includes('todoist'))result.tasks=data.tasks;if(errors.includes('calendar'))result.events=data.events;}
   data=result;lastError='';
  }catch(error){lastError=error.message||'אין חיבור';if(!data){text($('focusTitle'),'לא הצלחנו לעדכן');text($('focusSubtitle'),'בדוק את כתובת הסקריפט ואת מפתח התצוגה');text($('status'),lastError);}}
  finally{inFlight=false;render();if(!data)text($('status'),lastError);}
 }
 function validEndpoint(value){const u=new URL(value);if(u.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)||u.search||u.hash)throw Error('יש להזין כתובת פריסה של Google Apps Script המסתיימת ב־/exec');return u.href;}
 function jsonp(cfg){return new Promise((resolve,reject)=>{let url;try{url=new URL(validEndpoint(cfg.endpoint));}catch(e){reject(e);return;}url.searchParams.set('key',cfg.key);url.searchParams.set('callback','einkReceive');url.searchParams.set('_',Date.now());const script=document.createElement('script');const cleanup=()=>{clearTimeout(timer);script.remove();delete window.einkReceive;};const timer=setTimeout(()=>{cleanup();reject(Error('החיבור ארך יותר מדי זמן'));},25000);window.einkReceive=result=>{cleanup();resolve(result);};script.onerror=()=>{cleanup();reject(Error('לא ניתן להגיע לסקריפט'));};script.src=url.href;script.referrerPolicy='no-referrer';document.head.append(script);});}
 function setup(){ $('endpoint').value=config.endpoint;$('displayKey').value=config.key;$('setup').showModal();}
 $('settingsButton').onclick=setup;$('closeSetup').onclick=()=>$('setup').close();$('refreshButton').onclick=load;
 $('demoButton').onclick=()=>{demo=!demo;data=null;load();};
 $('setupForm').onsubmit=async e=>{e.preventDefault();try{const endpoint=validEndpoint($('endpoint').value.trim()),key=$('displayKey').value.trim();if(key.length<24)throw Error('מפתח התצוגה צריך להכיל לפחות 24 תווים');config={endpoint,key};demo=false;data=null;const url=new URL(location.href);url.search='?display=1';url.hash=new URLSearchParams(config).toString();$('displayUrl').value=url.href;$('linkLabel').hidden=false;text($('setupError'),'הכתובת מוכנה. שמור אותה והדבק אותה ב־Seeedash.');await load();}catch(error){text($('setupError'),error.message);}};
 function resize(){document.documentElement.style.setProperty('--scale',Math.min(1,(innerWidth-24)/800));}addEventListener('resize',resize);resize();
 render();load();setInterval(render,15000);setInterval(load,300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
 // Public, deterministic helpers for boundary tests without exposing credentials.
 window.Inkday={dayKey,minute,validEndpoint};
})();
