'use strict';
/* ============================================================
   원빈의 iPhone — UI / 모션 / 게임 진행
   (대사·기록 데이터는 data.js)
   ============================================================ */

/* ---------- 互动脚本（如果 data 里没定义，用空数组兜底，避免报错） ---------- */
if(typeof CHAT_TIMES==='undefined')var CHAT_TIMES={};
const $=s=>document.querySelector(s);
const SCREEN=$('#screen'),APP=$('#appL'),HOME=$('#homeL'),LOCK=$('#lockL'),OV=$('#ov'),PLAYER=$('#player');
const base=Date.now();let timeOffset=0;
const elapsed=()=>(Date.now()-base)/1000+timeOffset;

/* ---------- 人物 / 会话辅助 ---------- */
// PEOPLE / AUTO_CHAT 等由 data.js 提供；这里做一层防御
function personOf(n){return (typeof PEOPLE!=='undefined'&&PEOPLE[n])||null}
function avatarOf(n){const p=personOf(n);return p&&p.avatar?p.avatar:null}
function isLiveChat(n){return AUTO_ON&&!!LIVE_PARTNER_CLI&&n===LIVE_PARTNER_CLI}

/* ---------- 状态 ---------- */
let view='lock',curDark=true,SC=1,lastRect=null,animTok=0,firstOpen=true,pendingOpen=null;
/* 互动开关：data.js 里 AUTO_CHAT=false 时，聊天全部只读 */
const AUTO_ON=(typeof AUTO_CHAT!=='undefined')&&!!AUTO_CHAT;
const LIVE_PARTNER_CLI=(typeof LIVE_PARTNER!=='undefined'&&LIVE_PARTNER)?LIVE_PARTNER:null;
let pincode='',noteId=0,selectedDay=17,calMonth=10,chatId='',videoIndex=0,mailId=0,missOnly=false,safSearch=false;
let unread=(function(){const o={};if(typeof PEOPLE!=='undefined')Object.entries(PEOPLE).forEach(([n,p])=>{if(p&&p.unread)o[n]=p.unread});return o})();
let soheeUnread=0,todayChat=[],incoming=0,replyStage=0,lineIdx=0,typing=false,pendingText='',replyBusy=false;
let alarmStates=Array(7).fill(true),readMail=new Set(),nowSong=-1,flashOn=false;
let callState='',phoneDone=false,declined=0,callStart=0,callPrev='',nextCallAt=0,ringIv=null,ringTo=null,capIdx=-1,extraCalls=[];
let askedCall=false,callName=LIVE_PARTNER_CLI||'',callTimers=[],busySent=false,declineSent=false,rbIv=null;
/* 生日卡片文案：BIRTHDAY 填 'today' 就显示「今天」，否则算还有几天 */
function bdayNoteBody(){
  const d=new Date(); const md=[d.getMonth()+1,d.getDate()];
  const B=(typeof BIRTHDAY!=='undefined')?BIRTHDAY:null;
  if(!B||B==='today')return fmtMD(md[0],md[1])+' · '+t('bdayToday');
  let y=d.getFullYear();
  let target=new Date(y,B.month-1,B.day);
  if(target<new Date(y,d.getMonth(),d.getDate()))target=new Date(y+1,B.month-1,B.day);
  const days=Math.round((target-new Date(y,d.getMonth(),d.getDate()))/86400000);
  return fmtMD(B.month,B.day)+' · '+(days===0?t('bdayToday'):(days===1?t('bdayTomorrow'):t('inDays',days)));
}
let lockNotes=(typeof EXTRA_LOCK_NOTES!=='undefined'&&EXTRA_LOCK_NOTES.length)?EXTRA_LOCK_NOTES.map(x=>({title:x[0],body:x[1],app:'kakao',time:t('now')})):[{title:t('bdayTitle'),body:bdayNoteBody(),app:'rem',time:t('now')}];

/* ---------- 工具函数 ---------- */
const pad=n=>String(n).padStart(2,'0');
const esc=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const clock12=()=>{const d=new Date();return((d.getHours()%12)||12)+':'+pad(d.getMinutes())};
function ampm(min){return fmtTime(min)}
const nowMin=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()};
const nowAmpm=()=>ampm(nowMin());
function relRect(el){const s=SCREEN.getBoundingClientRect(),r=el.getBoundingClientRect();return{x:(r.left-s.left)/SC,y:(r.top-s.top)/SC,w:r.width/SC,h:r.height/SC}}
const vib=p=>{try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};
const t_=t;const T={duration:460,easing:'cubic-bezier(.32,.72,0,1)'};
function devRadius(){return document.getElementById('phone').classList.contains('mob')?0:56}

/* ---------- 图标（自绘，非官方 Logo） ---------- */
const g=(p,o='')=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${o}>${p}</svg>`;
const G={
 /* 微信用到的两个小图标 */
 qr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3"/></svg>',
 star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z"/></svg>',
 chevL:`<svg viewBox="0 0 12 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2 2 10l8 8"/></svg>`,
 chevR:`<svg class="chev" viewBox="0 0 8 13"><path d="m1.5 1.5 5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 chevRb:g('<path d="m9 5 7 7-7 7"/>'),chevLb:g('<path d="m15 5-7 7 7 7"/>'),
 search:g('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
 plus:g('<path d="M12 5v14M5 12h14"/>'),
 dots:g('<circle cx="12" cy="12" r="9.2"/><circle cx="8" cy="12" r=".8" fill="currentColor"/><circle cx="12" cy="12" r=".8" fill="currentColor"/><circle cx="16" cy="12" r=".8" fill="currentColor"/>'),
 dotsH:g('<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>'),
 menu:g('<path d="M4 7h16M4 12h16M4 17h16"/>'),
 gear:g('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/><circle cx="12" cy="12" r="6.4"/>'),
 person:g('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'),
 chat:g('<path d="M12 4C7 4 3 7.1 3 11c0 2.4 1.5 4.5 3.9 5.8L6 20.5l4-2.4c.6.1 1.3.1 2 .1 5 0 9-3.1 9-7.1S17 4 12 4Z"/>'),
 chatPlus:g('<path d="M12 4C7 4 3 7.1 3 11c0 2.4 1.5 4.5 3.9 5.8L6 20.5l4-2.4c.6.1 1.3.1 2 .1 5 0 9-3.1 9-7.1S17 4 12 4Z"/><path d="M12 8.5v5M9.5 11h5"/>'),
 openchat:g('<circle cx="12" cy="12" r="8.5"/><path d="M8 12.5c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.4"/>'),
 bag:g('<path d="M5 8h14l-1 12H6Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>'),
 clock:g('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
 star:g('<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/>'),
 contacts:g('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9.5" r="3"/><path d="M6.8 18c.9-2.4 2.9-3.6 5.2-3.6s4.3 1.2 5.2 3.6"/>'),
 keypad:g('<g fill="currentColor" stroke="none"><circle cx="6" cy="5" r="1.7"/><circle cx="12" cy="5" r="1.7"/><circle cx="18" cy="5" r="1.7"/><circle cx="6" cy="11" r="1.7"/><circle cx="12" cy="11" r="1.7"/><circle cx="18" cy="11" r="1.7"/><circle cx="6" cy="17" r="1.7"/><circle cx="12" cy="17" r="1.7"/><circle cx="18" cy="17" r="1.7"/><circle cx="12" cy="22" r="1.5"/></g>'),
 voicemail:g('<circle cx="6.5" cy="12" r="3.5"/><circle cx="17.5" cy="12" r="3.5"/><path d="M6.5 15.5h11"/>'),
 info:g('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".7" fill="currentColor"/>'),
 compose:g('<path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/><path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/>'),
 filter:g('<circle cx="12" cy="12" r="9"/><path d="M8 10h8M9.5 13h5M11 16h2"/>'),
 share:g('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v9h12v-9"/>'),
 heart:g('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>'),
 trash:g('<path d="M5 7h14M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>'),
 book:g('<path d="M4 5.5C6 4.5 9 4.5 12 6c3-1.5 6-1.5 8-.5V19c-2-1-5-1-8 .5-3-1.5-6-1.5-8-.5Z"/><path d="M12 6v13.5"/>'),
 tabs:g('<rect x="4" y="4" width="11" height="11" rx="2"/><path d="M9 20h9a2 2 0 0 0 2-2V9"/>'),
 mic:g('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
 globe:g('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.8 3.5 5.8 3.5 9s-1 6.2-3.5 9c-2.5-2.8-3.5-5.8-3.5-9s1-6.2 3.5-9Z"/>'),
 smile:g('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1.8 2 5.2 2 7 0"/><circle cx="9" cy="10" r=".9" fill="currentColor"/><circle cx="15" cy="10" r=".9" fill="currentColor"/>'),
 plusSq:g('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8v8M8 12h8"/>'),
 arrowUp:g('<path d="M12 19V5M6 11l6-6 6 6"/>'),
 home:g('<path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4Z"/>'),
 reels:g('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M3.5 8.5h17M9 3.5l2.5 5M14.5 3.5 17 8.5"/><path d="m10 12 5 2.8-5 2.8Z"/>'),
 bell:g('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
 send:g('<path d="M21 3 10 14"/><path d="M21 3 14.5 21l-4.5-7-7-4.5Z"/>'),
 comment:g('<path d="M12 3.5a8.5 8.5 0 1 0 4.3 15.8l4.2 1.2-1.2-4.2A8.5 8.5 0 0 0 12 3.5Z"/>'),
 grid:g('<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/>'),
 tag:g('<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><circle cx="12" cy="10" r="3"/><path d="M7.5 18c.9-2 2.5-3 4.5-3s3.6 1 4.5 3"/>'),
 bookmark:g('<path d="M6 3.5h12v17l-6-4-6 4Z"/>'),
 camera:g('<path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4Z"/><circle cx="12" cy="13" r="3.5"/>'),
 flash:g('<path d="M8.5 3h7l-1 5h-5Z"/><path d="M9.5 8h5v11a2.5 2.5 0 0 1-5 0Z"/><path d="M12 11.5v2.5"/>'),
 photo:g('<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>'),
 video:g('<rect x="3" y="6.5" width="13" height="11" rx="2"/><path d="m16 10.5 5-3v9l-5-3"/>'),
 list:g('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".9" fill="currentColor"/><circle cx="4.5" cy="12" r=".9" fill="currentColor"/><circle cx="4.5" cy="18" r=".9" fill="currentColor"/>'),
 inbox:g('<path d="M3.5 13.5 6 5h12l2.5 8.5V19h-17Z"/><path d="M3.5 13.5H9a3 3 0 0 0 6 0h5.5"/>'),
 check:g('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.7L16 9.5"/>'),
 pen:g('<path d="m14.5 5.5 4 4L8 20H4v-4Z"/>'),
 alarm:g('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5M4.5 5 7 3M19.5 5 17 3"/>'),
 stopwatch:g('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M12 2.5V6"/>'),
 timer:g('<circle cx="12" cy="12" r="8.5"/><path d="M12 12 8 8"/>'),
 musicNote:'<svg viewBox="0 0 24 24"><path d="M17 3v11.5a3 3 0 1 1-2-2.8V7.3l-6 1.4v8a3 3 0 1 1-2-2.8V5.5Z"/></svg>',
 playF:'<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5Z"/></svg>',
 pauseF:'<svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
 fwdF:'<svg viewBox="0 0 32 24"><path d="M2 4.5v15l12-7.5Z"/><path d="M15 4.5v15l12-7.5Z"/></svg>',
 bwdF:'<svg viewBox="0 0 32 24"><path d="M30 4.5v15l-12-7.5Z"/><path d="M17 4.5v15L5 12Z"/></svg>',
 handset:'<svg viewBox="0 0 24 24"><path d="M6.6 3.2c.6-.3 1.4-.1 1.8.5l1.9 3c.4.6.3 1.4-.2 1.9l-1.4 1.3a12.4 12.4 0 0 0 5.4 5.4l1.3-1.4c.5-.5 1.3-.6 1.9-.2l3 1.9c.6.4.8 1.2.5 1.8l-.9 1.9c-.5 1-1.6 1.6-2.7 1.4C10 19.6 4.4 14 3.3 6.8c-.2-1.1.4-2.2 1.4-2.7Z"/></svg>',
 speaker:'<svg viewBox="0 0 24 24"><path d="M3.5 9h4l5-4.5v15l-5-4.5h-4Z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
 muteF:'<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M4 4l16 16" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
 videoF:'<svg viewBox="0 0 24 24"><rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="m16.5 10.5 5-3v9l-5-3Z"/></svg>',
 plusF:'<svg viewBox="0 0 24 24"><path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7Z"/></svg>',
 keypadF:'<svg viewBox="0 0 24 24"><g><circle cx="6" cy="5" r="1.8"/><circle cx="12" cy="5" r="1.8"/><circle cx="18" cy="5" r="1.8"/><circle cx="6" cy="11" r="1.8"/><circle cx="12" cy="11" r="1.8"/><circle cx="18" cy="11" r="1.8"/><circle cx="6" cy="17" r="1.8"/><circle cx="12" cy="17" r="1.8"/><circle cx="18" cy="17" r="1.8"/></g></svg>',
 bellF:'<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><circle cx="12" cy="20.5" r="2"/></svg>',
 msgF:'<svg viewBox="0 0 24 24"><path d="M12 4C7 4 3 7.1 3 11c0 2.4 1.5 4.5 3.9 5.8L6 20.5l4-2.4c.6.1 1.3.1 2 .1 5 0 9-3.1 9-7.1S17 4 12 4Z"/></svg>',
 shift:'<svg viewBox="0 0 24 24" width="22" fill="none" stroke="#000" stroke-width="1.7" stroke-linejoin="round"><path d="M12 4 4 12.5h4.5V20h7v-7.5H20Z"/></svg>',
 bksp:'<svg viewBox="0 0 26 20" width="26" fill="none" stroke="#000" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M8 3h15v14H8l-6-7Z"/><path d="m12 7 6 6M18 7l-6 6"/></svg>',
 sil:'<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4.3" fill="#fff"/><path d="M3.8 22c.6-4.4 4-7 8.2-7s7.6 2.6 8.2 7Z" fill="#fff"/></svg>',
 calSm:g('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
 sun:'<svg viewBox="0 0 24 24" width="24"><circle cx="12" cy="12" r="5" fill="#ffd60a"/><g stroke="#ffd60a" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></g></svg>',
 moon:'<svg viewBox="0 0 24 24" width="24"><path d="M15.5 3.5A8.5 8.5 0 1 0 20.5 15 7 7 0 0 1 15.5 3.5Z" fill="#fff"/></svg>',
 pcloud:'<svg viewBox="0 0 24 24" width="24"><circle cx="9" cy="9" r="4.2" fill="#ffd60a"/><path d="M8 19.5h9.5a3.5 3.5 0 0 0 .3-7A5 5 0 0 0 8.4 11 4.3 4.3 0 0 0 8 19.5Z" fill="#fff"/></svg>',
 cloud:'<svg viewBox="0 0 24 24" width="24"><path d="M7 19h10.5a4 4 0 0 0 .4-8A5.6 5.6 0 0 0 7.2 9.2 5 5 0 0 0 7 19Z" fill="#fff"/></svg>',
};
const APPS={maps:'지도',instagram:'Instagram',photos:'照片',mail:'Mail',calendar:'캘린더',clock:'시계',notes:'메모',weather:'날씨',settings:'설정',phone:'电话',safari:'Safari',kakao:'聊天',music:'음악'};
function appIcon(id){
 const L=(a,b,c,d)=>`<linearGradient id="${a}" x1="0" y1="${d?1:0}" x2="${d?1:0}" y2="${d?0:1}"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
 const W=(defs,body)=>`<svg viewBox="0 0 60 60"><defs>${defs}</defs>${body}</svg>`;
 switch(id){
 case'instagram':
 case'weibo':return W('',`<rect width="60" height="60" fill="#ff8200"/>
  <g fill="#fff"><ellipse cx="25" cy="35" rx="14" ry="11"/><ellipse cx="25" cy="35" rx="6.4" ry="5.1"/></g>
  <circle cx="25" cy="35" r="2.7" fill="#ff8200"/>
  <g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round">
   <path d="M40 15.5c4.4 0 8 3.5 8 7.8 0 2.2-1 4-2.6 4.6"/>
   <path d="M41 22.5c1.6 0 2.9 1.3 2.9 2.9"/>
   <path d="M43.5 9c6.6 0 12 5.3 12 11.9 0 3.2-1.4 5.8-3.6 7"/>
  </g>`);
 case'photos':{let p='';for(let i=0;i<10;i++)p+=`<ellipse cx="30" cy="18.2" rx="4.4" ry="10.5" fill="#fff" transform="rotate(${i*36} 30 30)"/>`;return W(L('gp','#9bdcff','#d8f1ff'),`<rect width="60" height="60" fill="url(#gp)"/>${p}<circle cx="30" cy="30" r="7.2" fill="#ffc83d"/><circle cx="30" cy="30" r="7.2" fill="none" stroke="#f0a500" stroke-width="1"/>`)}
 case'mail':return W(L('gm','#3fb0ff','#0a6cf5'),`<rect width="60" height="60" fill="url(#gm)"/><rect x="11.5" y="18" width="37" height="25" rx="3.5" fill="#fff"/><path d="M12.5 20 30 32.5 47.5 20" fill="none" stroke="#1676f3" stroke-width="2.4" stroke-linejoin="round"/>`);
 case'calendar':return W('',`<rect width="60" height="60" fill="#fff"/><text x="30" y="17.5" text-anchor="middle" font-size="${wdLong(2026,10,17).length>5?8:9.5}" font-weight="600" fill="#ff3b30" font-family="-apple-system,Pretendard,sans-serif">${wdLong(2026,10,17)}</text><text x="30" y="47" text-anchor="middle" font-size="31" font-weight="300" fill="#111" font-family="-apple-system,Pretendard,sans-serif">17</text>`);
 case'clock':{const d=new Date(),h=d.getHours()%12,m=d.getMinutes();let t='';for(let i=0;i<12;i++)t+=`<path d="M30 8.5v${i%3?2.6:3.8}" stroke="#111" stroke-width="${i%3?1:1.6}" transform="rotate(${i*30} 30 30)"/>`;
  return W('',`<rect width="60" height="60" fill="#000"/><circle cx="30" cy="30" r="24" fill="#fff"/>${t}<path d="M30 30V17" stroke="#111" stroke-width="2.6" stroke-linecap="round" transform="rotate(${h*30+m/2} 30 30)"/><path d="M30 30V11.5" stroke="#111" stroke-width="1.8" stroke-linecap="round" transform="rotate(${m*6} 30 30)"/><path d="M30 34V11" stroke="#ff9500" stroke-width="1" transform="rotate(${(m*6+90)%360} 30 30)"/><circle cx="30" cy="30" r="1.8" fill="#ff9500"/>`)}
 case'notes':return W(L('gn','#ffe27a','#ffc933'),`<rect width="60" height="60" fill="#fff"/><rect width="60" height="17" fill="url(#gn)"/><g stroke="#d9d9de" stroke-width="1.2"><path d="M8 27h44M8 35h44M8 43h44M8 51h44"/></g><g fill="#cfcfd4"><circle cx="10" cy="17" r=".9"/><circle cx="14" cy="17" r=".9"/><circle cx="18" cy="17" r=".9"/><circle cx="22" cy="17" r=".9"/><circle cx="26" cy="17" r=".9"/><circle cx="30" cy="17" r=".9"/><circle cx="34" cy="17" r=".9"/><circle cx="38" cy="17" r=".9"/><circle cx="42" cy="17" r=".9"/><circle cx="46" cy="17" r=".9"/><circle cx="50" cy="17" r=".9"/></g>`);
 case'weather':return W(L('gw','#53b5ff','#1f6fe0'),`<rect width="60" height="60" fill="url(#gw)"/><circle cx="23" cy="23" r="9.5" fill="#ffd84a"/><path d="M19 45h21.5a7.5 7.5 0 0 0 .6-15 10 10 0 0 0-19.2 3.2A6 6 0 0 0 19 45Z" fill="#fff"/>`);
 case'settings':return W(L('gs','#a7adb6','#6d727b'),`<rect width="60" height="60" fill="url(#gs)"/><circle cx="30" cy="30" r="17" fill="none" stroke="#e9eaee" stroke-width="7" stroke-dasharray="4.4 4.5"/><circle cx="30" cy="30" r="14" fill="#878c95" stroke="#e9eaee" stroke-width="3.2"/><circle cx="30" cy="30" r="5.5" fill="none" stroke="#e9eaee" stroke-width="3"/><g stroke="#e9eaee" stroke-width="2.4"><path d="M30 17.5v7M30 35.5v7M17.5 30h7M35.5 30h7"/></g>`);
 case'phone':return W(L('gph','#65f38f','#28c253'),`<rect width="60" height="60" fill="url(#gph)"/><g transform="translate(12 12) scale(1.5)" fill="#fff">${G.handset.replace(/<\/?svg[^>]*>/g,'')}</g>`);
 case'safari':return W(L('gsa','#3aa8ff','#0f5fe0'),`<rect width="60" height="60" fill="#fff"/><circle cx="30" cy="30" r="21" fill="url(#gsa)"/><g fill="none" stroke="#fff" stroke-width="1.6" opacity=".95"><ellipse cx="30" cy="30" rx="8.5" ry="21"/><path d="M9 30h42M12 19.5h36M12 40.5h36M30 9v42"/></g>`);
 case'kakao':return W('',`<rect width="60" height="60" fill="#07c160"/><g fill="#fff"><ellipse cx="25" cy="25" rx="11.5" ry="9.6"/><path d="M18.5 32.2 16 38l6-3.2Z"/><ellipse cx="37.5" cy="34.5" rx="9.2" ry="7.8"/><path d="M43.6 40.4 45.6 45l-4.8-2.6Z"/></g><g fill="#07c160"><circle cx="20.8" cy="23" r="1.85"/><circle cx="28.4" cy="23" r="1.85"/><circle cx="34.4" cy="33" r="1.5"/><circle cx="40.4" cy="33" r="1.5"/></g>`);
 case'weibo':return W('',`<rect width="60" height="60" fill="#ff8200"/><g fill="#fff"><ellipse cx="26" cy="34" rx="13" ry="10.5"/><ellipse cx="26" cy="34" rx="6.2" ry="5"/><circle cx="26" cy="34" r="2.6"/><path d="M38 16.5c4.6-.4 8.4 3 8.6 7.4.1 2.4-1 4.2-2.6 4.6-1.3.3-2.4-.6-2.5-2-.1-1.8 1-3 2.3-3.3l-.5-2.4c-2.6.3-4.6 2.5-4.6 5.2 0 1.4.5 2.6 1.3 3.5l-2 1.5c-1.3-1.3-2.1-3.1-2.1-5.2 0-3.9 2.9-7.1 6.6-7.4Z" opacity=".95"/><path d="M40.6 8.2c6.6-.6 12.1 4.3 12.4 10.7.2 3.5-1.4 6.1-3.8 6.7-1.9.4-3.5-.9-3.7-2.9-.2-2.6 1.5-4.4 3.4-4.8l-.7-3.4c-3.8.5-6.7 3.7-6.7 7.6 0 2 .8 3.8 2 5.1l-2.9 2.2c-1.9-1.9-3-4.5-3-7.4 0-5.7 4.2-10.4 9.6-10.8Z" opacity=".9"/></g>`);
 case'music':return W(L('gmu','#ff6f86','#fa2b47'),`<rect width="60" height="60" fill="url(#gmu)"/><g transform="translate(11 10) scale(1.55)" fill="#fff">${G.musicNote.replace(/<\/?svg[^>]*>/g,'')}</g>`);
 case'maps':return W('',`<rect width="60" height="60" fill="#e9f2df"/><path d="M0 38 60 22v12L0 50Z" fill="#fff"/><path d="M24 0h9L27 60h-9Z" fill="#ffd966"/><path d="M0 12c14 6 30-4 60 6V0H0Z" fill="#bfe3a5"/><path d="M42 60c0-8 10-10 18-12v12Z" fill="#9fd0f5"/><path d="M40 14a8 8 0 0 0-8 8c0 6 8 14 8 14s8-8 8-14a8 8 0 0 0-8-8Z" fill="#ff3b30"/><circle cx="40" cy="22" r="3" fill="#fff"/>`);
 case'rem':return W('',`<rect width="60" height="60" fill="#fff"/><circle cx="16" cy="19" r="4.5" fill="#007aff"/><circle cx="16" cy="31" r="4.5" fill="#ff3b30"/><circle cx="16" cy="43" r="4.5" fill="#ff9500"/><g stroke="#d6d6db" stroke-width="2"><path d="M25 19h24M25 31h24M25 43h24"/></g>`);
 }return''}

/* ---------- 音效（WebAudio 合成） ---------- */
let AC=null;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();return AC}
function tone(f,t0,dur,vol=.12,type='sine'){const a=ac();if(!a)return;const t=a.currentTime+t0,o=a.createOscillator(),gn=a.createGain();o.type=type;o.frequency.value=f;gn.gain.setValueAtTime(0,t);gn.gain.linearRampToValueAtTime(vol,t+.008);gn.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(gn).connect(a.destination);o.start(t);o.stop(t+dur+.05)}
function sfx(k){if(k==='key')tone(2400,0,.025,.035,'triangle');else if(k==='msg'){tone(1046,0,.22,.09);tone(1397,.1,.32,.09)}else if(k==='send'){tone(620,0,.07,.05);tone(930,.05,.09,.05)}else if(k==='unlock'){tone(1300,0,.05,.04,'triangle');tone(1700,.04,.05,.03,'triangle')}else if(k==='lock')tone(500,0,.06,.05,'triangle')}
function ringOnce(){[[784,0],[988,.2],[1175,.4],[988,.6],[784,1.0],[988,1.2],[1175,1.4],[1319,1.6]].forEach(([f,t])=>{tone(f,t,.35,.11);tone(f*2,t,.18,.03)})}
document.addEventListener('pointerdown',()=>ac(),{once:true});

/* ---------- 状态栏 / 灵动岛 ---------- */
function setStatus(dark){curDark=!!dark;$('#sb').classList.toggle('light',curDark);$('#hb').classList.toggle('light',curDark)}
const ART=songs.map(x=>x[3]||'');
const ARTIST=songs.map(x=>x[1]||'');
function updateIsland(){typeof updateCrumb==='function'&&updateCrumb();const on=nowSong>=0&&!PLAYER.paused&&!['music','lock','pin'].includes(view)&&!OV.querySelector('.np,.call,.viewer');const il=$('#island');il.classList.toggle('act',on);if(on){const a=ART[nowSong];il.querySelector('.ia').style.backgroundImage=a?`url(${a})`:'linear-gradient(135deg,#ff9a9e,#fa2d48)'}}

/* ============================================================
   锁屏 / 密码
   ============================================================ */
function ncardHTML(n){const ic=n.app==='kakao'?`<div class="ni" style="position:relative;overflow:visible"><img src="${IMG.partnerAvatar}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;display:block"><span style="position:absolute;right:-4px;bottom:-4px;width:18px;height:18px;border-radius:5px;overflow:hidden;border:1.5px solid rgba(255,255,255,.9)">${appIcon('kakao')}</span></div>`:`<div class="ni">${appIcon(n.app)}</div>`;
 return `${ic}<div class="nt"><div class="nh"><span>${esc(n.title)}</span><small>${n.time}</small></div><div class="nb">${esc(n.body)}</div></div>`}
function renderLock(){
 $('#lkc').innerHTML=`<div class="lk-date">${fmtLockDate()}</div><div class="lk-time" id="lkt">${clock12()}</div>
 <div class="lk-langw"><button class="lk-lang" onclick="event.stopPropagation();openLangSheet()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.8 3.5 5.8 3.5 9s-1 6.2-3.5 9c-2.5-2.8-3.5-5.8-3.5-9s1-6.2 3.5-9Z"/></svg>${(window.LANGS||[]).find(l=>l[0]===LANG)?.[1]||''}</button></div>
 <div class="lk-notes">${lockNotes.map((n,i)=>`<button class="ncard" data-i="${i}" onclick="lockNoteTap(${i},event)">${ncardHTML(n)}</button>`).join('')}</div>
 <button class="lk-btn" style="left:46px;${flashOn?'background:#fff;color:#000':''}" onclick="event.stopPropagation();flashOn=!flashOn;vib(15);renderLock()">${G.flash.replace('<svg','<svg width="24" height="24" style="color:'+(flashOn?'#000':'#fff')+'"')}</button>
 <button class="lk-btn" style="right:46px" onclick="event.stopPropagation();vib(15);this.animate([{transform:'scale(1.2)'},{transform:'none'}],250)">${G.camera.replace('<svg','<svg width="24" height="24" style="color:#fff"')}</button>
 <div class="lk-hint">${t('swipeUp')}</div>`}
function openLangSheet(){vib(10);const d=document.createElement('div');d.id='langSheet';
 d.innerHTML=`<div class="ls-g"><div class="ls-h">Language · 언어</div>${(window.LANGS||[]).map(l=>`<button class="${l[0]===LANG?'on':''}" data-l="${l[0]}">${l[1]}${l[0]===LANG?' ✓':''}</button>`).join('')}</div><button class="ls-c">${t('cancel')}</button>`;
 const close=()=>{d.animate([{opacity:1},{opacity:0}],{duration:200}).onfinish=()=>d.remove()};
 d.onclick=e=>{e.stopPropagation();const b=e.target.closest('[data-l]');if(b){if(b.dataset.l===LANG)return close();setLang(b.dataset.l);return}if(e.target===d||e.target.closest('.ls-c'))close()};
 d.addEventListener('pointerdown',e=>e.stopPropagation());
 $('#phone').appendChild(d);d.animate([{opacity:0},{opacity:1}],{duration:200});d.querySelector('.ls-g').animate([{transform:'translateY(60px)'},{transform:'none'}],{duration:320,easing:'cubic-bezier(.2,.9,.25,1)'})}
function lockNoteTap(i,e){e.stopPropagation();if(lockNotes[i].app==='kakao')pendingOpen='chat';goPin()}
(function lockDrag(){const el=$('#lkc');let y0=null,dy=0,moved=false;
 el.addEventListener('pointerdown',e=>{if(view!=='lock'||e.target.closest('button'))return;y0=e.clientY;dy=0;moved=false;el.setPointerCapture(e.pointerId)});
 el.addEventListener('pointermove',e=>{if(y0===null)return;dy=Math.min(0,(e.clientY-y0)/SC);if(Math.abs(dy)>6)moved=true;el.style.transform=`translateY(${dy}px)`;el.style.opacity=1+dy/500;$('#wall').style.filter=`blur(${Math.min(24,-dy/8)}px) brightness(${1-Math.min(.38,-dy/700)})`});
 el.addEventListener('pointerup',e=>{if(y0===null)return;const d=dy;y0=null;$('#wall').style.filter='';
  if(d<-70||!moved&&!e.target.closest('button')){goPin(d)}else{el.animate([{transform:`translateY(${d}px)`,opacity:1+d/500},{transform:'none',opacity:1}],{duration:350,easing:'cubic-bezier(.2,1.3,.4,1)'});el.style.transform='';el.style.opacity=''}});
})();
function goPin(fromDy=0){view='pin';pincode='';const lk=$('#lkc');lk.animate([{transform:`translateY(${fromDy}px)`,opacity:Math.max(0,1+fromDy/500)},{transform:'translateY(-120px)',opacity:0}],{duration:380,easing:'cubic-bezier(.3,.7,.2,1)',fill:'forwards'});
 lk.style.transform='';lk.style.opacity='';lk.style.pointerEvents='none';$('#wall').classList.add('dim');renderPin();const p=$('#pinL');p.style.display='flex';p.animate([{opacity:0,transform:'translateY(40px)'},{opacity:1,transform:'none'}],{duration:420,easing:'cubic-bezier(.2,.9,.25,1)'})}
const PL=['','ABC','DEF','GHI','JKL','MNO','PQRS','TUV','WXYZ'];
function renderPin(){$('#pinL').innerHTML=`<div class="pt">${t('enterPass')}</div><div class="pdots" id="pdots">${[0,1,2,3].map(i=>`<i class="${i<pincode.length?'on':''}"></i>`).join('')}</div>
 <div class="pkeys">${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="pk" onpointerdown="pinPress('${n}',this)"><b>${n}</b><small>${PL[n-1]}</small></button>`).join('')}<span></span><button class="pk" onpointerdown="pinPress('0',this)"><b>0</b><small></small></button><span></span></div>
 <div class="pbot"><button onclick="vib(10)">${t('emergency')}</button><button id="pcancel" onclick="pinCancelOrDel()">${pincode?t('delete'):t('cancel')}</button></div>`}
function pinDots(){$('#pdots').innerHTML=[0,1,2,3].map(i=>`<i class="${i<pincode.length?'on':''}"></i>`).join('');$('#pcancel').textContent=pincode?t('delete'):t('cancel')}
function pinPress(n,el){if(pincode.length>=4)return;el.classList.add('dn');setTimeout(()=>el.classList.remove('dn'),90);sfx('key');vib(8);pincode+=n;pinDots();
 if(pincode.length===4){if(pincode===(typeof PIN_CODE!=='undefined'?PIN_CODE:'1121')){setTimeout(unlock,140)}else{setTimeout(()=>{const d=$('#pdots');d.classList.remove('shake');void d.offsetWidth;d.classList.add('shake');vib([60,40,60]);setTimeout(()=>{pincode='';pinDots()},420)},120)}}}
function pinCancelOrDel(){if(pincode){pincode=pincode.slice(0,-1);pinDots();return}pinCancel()}
function pinCancel(){view='lock';const p=$('#pinL');p.animate([{opacity:1},{opacity:0,transform:'translateY(30px)'}],{duration:300}).onfinish=()=>p.style.display='none';
 const lk=$('#lkc');lk.getAnimations().forEach(a=>a.cancel());lk.style.pointerEvents='';lk.animate([{transform:'translateY(-120px)',opacity:0},{transform:'none',opacity:1}],{duration:450,easing:'cubic-bezier(.2,.9,.25,1)'});$('#wall').classList.remove('dim')}
function unlock(){sfx('unlock');view='home';$('#wall').classList.remove('dim');
 LOCK.animate([{opacity:1},{opacity:0}],{duration:300,fill:'forwards'}).onfinish=()=>{LOCK.style.visibility='hidden';$('#pinL').style.display='none';$('#lkc').getAnimations().forEach(a=>a.cancel());$('#lkc').style.pointerEvents=''};
 renderHome();HOME.style.visibility='visible';HOME.animate([{transform:'scale(1.18)',opacity:0},{transform:'none',opacity:1}],{duration:560,easing:'cubic-bezier(.2,.9,.22,1)'});
 [...HOME.querySelectorAll('.app,.widget')].forEach((el,i)=>el.animate([{transform:'scale(.7)',opacity:0},{transform:'none',opacity:1}],{duration:520,delay:30+i*14,easing:'cubic-bezier(.2,1.1,.3,1)',fill:'backwards'}));
 setStatus(true);if(pendingOpen){pendingOpen=null;setTimeout(()=>{chatId=LIVE_PARTNER_CLI;openApp('chat',HOME.querySelector('.app[data-app="kakao"] .icon'))},520)}}

/* ============================================================
   主屏
   ============================================================ */
function badgeOf(id){if(id==='phone')return 3+declined;if(id==='mail')return[0,1].filter(i=>!readMail.has(i)).length;if(id==='kakao')return Object.values(unread).reduce((a,b)=>a+b,0)+soheeUnread;return 0}
function appBtn(id){const b=badgeOf(id);return `<button class="app" data-app="${id}" onclick="openApp('${id}',this.firstElementChild)"><div class="icon"><div class="ic">${appIcon(id)}</div>${b?`<span class="bdg">${b}</span>`:''}</div><span class="lbl">${t('app_'+id)}</span></button>`}
function renderHome(){
 HOME.innerHTML=`<div class="hgrid">
  <button class="widget wcal" data-app="calendar" onclick="openApp('calendar',this)"><div class="wd">${wdLong(2026,10,17)}</div><div class="wn">17</div>${(events[17]||[]).map(x=>`<div class="we">${esc(x)}<small>${t('allDay')}</small></div>`).join('')}</button>
  <button class="widget wwx" data-app="weather" onclick="openApp('weather',this)"><div class="c">${t('seoul')} ➚</div><div class="tp">18°</div><span style="position:absolute;top:14px;right:14px">${G.sun}</span><div class="ds">${t('mostlySunny')}<small>${t('hiLo')}</small></div></button>
  ${['instagram','photos','mail','calendar','clock','notes','weather','settings','maps'].map(appBtn).join('')}
 </div><button class="spot" onclick="this.animate([{transform:'translateX(-50%) scale(1)'},{transform:'translateX(-50%) scale(1.08)'},{transform:'translateX(-50%) scale(1)'}],300)">${G.search.replace('<svg','<svg width="13" height="13"')}${t('search')}</button>
 <div class="dock">${['phone','safari','kakao','music'].map(appBtn).join('')}</div>`}

/* ============================================================
   页面切换引擎
   ============================================================ */
const PARENT={note:'notes',chat:'kakao',maild:'mail',reel:'instagram',screentime:'settings'};
const rootOf=v=>PARENT[v]||v;
function viewDark(){if(['lock','pin','home'].includes(view))return true;const p=APP.lastElementChild;return!!(p&&p.dataset.dark)}
function wireScroll(pg){const sc=pg.querySelector('.scroll');if(sc)sc.addEventListener('scroll',()=>pg.classList.toggle('scrolled',sc.scrollTop>38),{passive:true})}
function show(id,anim='swap'){
 const old=[...APP.children];old.forEach(o=>{o.querySelectorAll('video').forEach(v=>v.pause())});
 if(PLAYER.dataset.voice&&!(id==='chat')){PLAYER.pause()}
 view=id;const v=VIEWS[id]();const pg=document.createElement('div');pg.className='pg '+(v.cls||'');pg.innerHTML=v.html;pg.dataset.view=id;pg.dataset.dark=v.dark?'1':'';
 if(anim==='pop')APP.insertBefore(pg,APP.firstChild);else APP.appendChild(pg);
 setStatus(v.dark);wireScroll(pg);
 const done=()=>old.forEach(o=>o.remove());
 if(anim==='push'){pg.classList.add('pushed');pg.animate([{transform:'translateX(100%)'},{transform:'none'}],T);old.forEach(o=>o.animate([{transform:'none',filter:'brightness(1)'},{transform:'translateX(-28%)',filter:'brightness(.92)'}],T));setTimeout(done,T.duration)}
 else if(anim==='pop'){pg.animate([{transform:'translateX(-28%)',filter:'brightness(.92)'},{transform:'none',filter:'brightness(1)'}],T);old.forEach(o=>{o.classList.add('pushed');o.animate([{transform:'none'},{transform:'translateX(100%)'}],{...T,fill:'forwards'})});setTimeout(done,T.duration)}
 else done();
 v.init&&v.init(pg);updateIsland();return pg}
function zoomFrames(r){const W=SCREEN.clientWidth,H=SCREEN.clientHeight,s=r.w/W,iy=Math.max(0,(H-r.h/s)/2),dx=r.x+r.w/2-W/2,dy=r.y+r.h/2-H/2;
 return[{transform:`translate(${dx}px,${dy}px) scale(${s})`,clipPath:`inset(${iy}px 0px round ${15/s}px)`,opacity:.25},{transform:'translate(0px,0px) scale(1)',clipPath:`inset(0px 0px round ${devRadius()}px)`,opacity:1}]}
function openApp(id,el){if(callState)return;if(view!=='home'){return}
 lastRect=el?relRect(el):null;APP.innerHTML='';show(id,'none');const tok=++animTok;
 APP.style.visibility='visible';APP.getAnimations().forEach(a=>a.cancel());
 APP.animate(zoomFrames(lastRect||{x:166,y:396,w:60,h:60}),{duration:540,easing:'cubic-bezier(.2,.9,.22,1)'});
 HOME.animate([{transform:'none',opacity:1},{transform:'scale(1.1)',opacity:0}],{duration:400,easing:'ease-in'}).onfinish=()=>{if(tok===animTok&&view!=='home')HOME.style.visibility='hidden'};
 if(firstOpen){firstOpen=false;setTimeout(()=>{$('#hb').classList.add('pulse');setTimeout(()=>$('#hb').classList.remove('pulse'),3400)},900)}}
function closeApp(){if(callState||['home','lock','pin'].includes(view))return;
 const root=rootOf(view);if(PLAYER.dataset.voice)PLAYER.pause();
 view='home';renderHome();HOME.style.visibility='visible';setStatus(true);
 const icon=HOME.querySelector(`.app[data-app="${root}"] .icon`);const r=icon?relRect(icon):{x:166,y:396,w:60,h:60};
 const tok=++animTok;APP.getAnimations().forEach(a=>a.cancel());
 const a=APP.animate(zoomFrames(r).reverse(),{duration:460,easing:'cubic-bezier(.3,.75,.2,1)',fill:'forwards'});
 a.onfinish=()=>{if(tok!==animTok)return;APP.style.visibility='hidden';APP.querySelectorAll('video').forEach(v=>v.pause());APP.innerHTML='';a.cancel()};
 HOME.animate([{transform:'scale(1.1)',opacity:0},{transform:'none',opacity:1}],{duration:460,easing:'cubic-bezier(.2,.9,.22,1)'});updateIsland()}
function push(id){show(id,'push')}
function back(){if(PARENT[view])show(PARENT[view],'pop');else closeApp()}
function hbAction(){if(callState)return;const vw=OV.querySelector('.viewer');if(vw)return closeViewer();if(OV.querySelector('.np'))return closeNP();
 if(view==='lock')return goPin();if(view==='pin')return;if(view==='home')return HOME.animate([{transform:'none'},{transform:'scale(.97)'},{transform:'none'}],250);closeApp()}
(function hbGesture(){const hb=$('#hb');let y0=null;hb.addEventListener('pointerdown',e=>{y0=e.clientY;hb.setPointerCapture(e.pointerId)});hb.addEventListener('pointerup',e=>{if(y0===null)return;y0=null;hbAction()})})();
(function edgeBack(){let x0=null,y0=0,pg=null;SCREEN.addEventListener('pointerdown',e=>{const r=SCREEN.getBoundingClientRect();if(!PARENT[view]||(e.clientX-r.left)/SC>22)return;x0=e.clientX;y0=e.clientY;pg=APP.lastElementChild});
 SCREEN.addEventListener('pointermove',e=>{if(x0===null)return;const dx=Math.max(0,(e.clientX-x0)/SC);if(pg)pg.style.transform=`translateX(${dx}px)`});
 SCREEN.addEventListener('pointerup',e=>{if(x0===null)return;const dx=(e.clientX-x0)/SC;x0=null;if(pg)pg.style.transform='';if(dx>90)back()})})();
/* 뒤로가기: 状态바 '◀ 홈' + 브라우저/안드로이드 뒤로 버튼 + Backspace + 마우스 뒤로 버튼 */
function goBack(){if(callState)return;const ls=document.getElementById('langSheet');if(ls){ls.remove();return}
 if(OV.querySelector('.viewer'))return closeViewer();if(OV.querySelector('.np'))return closeNP();
 if(['lock','pin','home'].includes(view)){if(view==='pin')pinCancel();return}back()}
function updateCrumb(){const on=!['lock','pin','home'].includes(view)&&!callState;$('#sb').classList.toggle('crumb',on)}
$('#sbk').innerHTML=`<svg viewBox="0 0 7 12"><path d="M6 1 1 6l5 5"/></svg>${t('home')}`;
$('#sbk').addEventListener('click',e=>{e.stopPropagation();if(callState)return;if(OV.querySelector('.viewer'))closeViewer();if(OV.querySelector('.np'))closeNP();closeApp()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')hbAction();else if(e.key==='Backspace'&&!e.target.closest('input,textarea')){e.preventDefault();goBack()}});
document.addEventListener('mouseup',e=>{if(e.button===3){e.preventDefault();goBack()}});
try{history.pushState({wb:1},'');addEventListener('popstate',()=>{goBack();history.pushState({wb:1},'')})}catch(e){}

/* ---------- 通用模板 ---------- */
function navHTML(o){return `<div class="nav ${o.solid?'solid':''}">${o.back!==undefined?`<button class="nb-back" onclick="${o.backFn||'back()'}">${G.chevL}${o.back}</button>`:(o.left||'<span></span>')}<div class="nb-title">${o.title||''}</div><div class="nb-right">${o.right||''}</div></div>`}
function tabbar(items,on,cls=''){return `<div class="tabbar ${cls}">${items.map(([ic,l],i)=>`<button class="${i===on?'on':''}">${G[ic]||ic}<span>${l}</span></button>`).join('')}</div>`}
const sw=(on,fn)=>`<button class="sw ${on?'on':''}" onclick="this.classList.toggle('on');vib(8);${fn||''}"></button>`;

/* ============================================================
   各 App 界面
   ============================================================ */
const VIEWS={};

/* --- 메모 --- */
function noteDate(d,full){const [y,m,dd]=d.split('-').map(Number);if(full)return fmtYMD(y,m,dd);if(d==='2026-10-17')return fmtTime(14*60+14);if(d==='2026-10-16')return t('yesterday');const diff=(new Date(2026,9,17)-new Date(y,m-1,dd))/864e5;if(diff<7)return wdLong(y,m,dd);return fmtNum(y,m,dd)}
const noteRow=(n,i)=>`<button class="row tap" onclick="noteId=${i};push('note')"><b>${esc(n[0])}</b><small><em>${noteDate(n[3])}</em>${esc(n[1])}</small></button>`;
VIEWS.notes=()=>({cls:'grouped notes-pg',html:navHTML({title:t('app_notes'),back:t('folders'),right:G.dots})+`<div class="scroll"><h1 class="lt">${t('app_notes')}</h1><div class="srch">${G.search}${t('search')}</div>
 <div class="gh" style="margin-top:8px">📌 ${t('pinned')}</div><div class="group note-l">${notes.slice(0,4).map((n,i)=>noteRow(n,i)).join('')}</div>
 <div class="gh">${t('notesSec')}</div><div class="group note-l">${notes.slice(4).map((n,i)=>noteRow(n,i+4)).join('')}</div></div>
 <div class="toolbar"><span style="width:24px"></span><span style="color:#000;align-self:center;font-size:11px">${t('nNotes',notes.length)}</span>${G.compose}</div>`});
VIEWS.note=()=>{const n=notes[noteId];return{cls:'notes-pg',html:navHTML({title:'',back:t('app_notes'),right:G.share+G.dots,solid:false})+`<div class="scroll"><div class="note-v"><div class="nd">${noteDate(n[3],true)}</div><h2>${esc(n[0])}</h2>${esc(n[2])}</div></div><div class="toolbar">${G.check}${G.camera}${G.pen}${G.compose}</div>`}};

/* --- 캘린더 --- */
function calEvents(){if(calMonth===11)return selectedDay===21?['🎂 '+t('bdayEvent')]:[];return events[selectedDay]||[]}
VIEWS.calendar=()=>{const nov=calMonth===11,first=nov?0:4,days=nov?30:31;let c='';for(let i=0;i<first;i++)c+='<div></div>';
 for(let d=1;d<=days;d++){const dow=(first+d-1)%7,has=nov?d===21:!!events[d],td=!nov&&d===17;c+=`<button class="cal-d ${td?'td':''} ${d===selectedDay?'sel':''} ${dow===0||dow===6?'we':''}" onclick="selectedDay=${d};show('calendar')"><span>${d}</span>${has?'<i></i>':''}</button>`}
 const ev=calEvents().map(x=>{const m=x.split(' · ');return `<div class="evt"><span class="bar" style="background:${x.startsWith('🎂')?'#ff9500':'#af52de'}"></span><b>${esc(m[0])}</b><small>${m[1]||t('allDay')}</small></div>`}).join('')||`<div class="evt muted">${t('noEvents')}</div>`;
 return{html:navHTML({title:'',back:fmtYear(2026),backFn:'closeApp()',right:G.list+G.search+G.plus})+`<div class="scroll" style="padding-bottom:120px"><div style="display:flex;justify-content:space-between;align-items:center;margin:0 16px 8px"><h1 class="lt" style="margin:0">${fmtMonth(calMonth)}</h1><span style="display:flex;gap:26px;color:var(--blue)"><button style="width:22px" onclick="calNav(-1)">${G.chevLb}</button><button style="width:22px" onclick="calNav(1)">${G.chevRb}</button></span></div>
 <div class="cal-g cal-w">${wdNarrow().map(w=>`<div>${w}</div>`).join('')}</div><div class="cal-g" id="calg">${c}</div><div style="border-top:.5px solid var(--sep);margin-top:4px;padding-top:4px">${ev}</div></div>
 <div class="tabbar" style="color:#ff3b30">${[t('today'),t('calendars'),t('inbox')].map(x=>`<button style="color:#ff3b30;font-size:16px;justify-content:center">${x}</button>`).join('')}</div>`}};
function calNav(d){const n=calMonth+d;if(n<10||n>11)return;calMonth=n;selectedDay=n===11?21:17;const pg=show('calendar');pg.querySelector('#calg').animate([{transform:`translateX(${d*40}%)`,opacity:0},{transform:'none',opacity:1}],{duration:350,easing:'cubic-bezier(.2,.9,.25,1)'})}

/* --- 시계 --- */
VIEWS.clock=()=>({cls:'dark',dark:true,html:`<div class="nav" style="color:#ff9f0a"><button style="color:#ff9f0a;font-size:17px;justify-self:start;padding-left:8px">${t('edit')}</button><div class="nb-title">${t('alarm')}</div><div class="nb-right" style="color:#ff9f0a">${G.plus}</div></div><div class="scroll"><h1 class="lt">${t('alarm')}</h1>
 <div style="margin:10px 16px 4px;font-size:15px;font-weight:600;display:flex;gap:6px;align-items:center">${t('sleepWake')}</div><div style="padding:8px 16px 14px;color:#8e8e93;font-size:15px;border-bottom:.5px solid rgba(255,255,255,.15)">${t('noAlarm')} <span style="float:right;color:#ff9f0a">${t('setUp')}</span></div>
 <div style="margin:18px 16px 4px;font-size:15px;font-weight:600">${t('other')}</div>
 ${Array.from({length:7},(_,i)=>`<div class="alarm ${alarmStates[i]?'':'off'}"><div><div class="at">${(p=>p.before?`<small>${p.dp}</small>${p.tm}`:`${p.tm}<small style="margin-left:4px">${p.dp}</small>`)(alarmParts(7,i))}</div><div class="al">${t('alarmLabel')}</div></div>${sw(alarmStates[i],`alarmStates[${i}]=!alarmStates[${i}];this.closest('.alarm').classList.toggle('off',!alarmStates[${i}])`)}</div>`).join('')}</div>
 ${tabbar([['globe',t('worldClock')],['alarm',t('alarm')],['stopwatch',t('stopwatch')],['timer',t('timer')]],1).replace('class="on"','class="on" style="color:#ff9f0a"')}`});

/* --- 电话 --- */
function callWhen(s){if(s.startsWith('오늘 ')){const [h,m]=s.slice(3).split(':').map(Number);return ampm(h*60+m)}if(s.startsWith('今天 ')){const [h,m]=s.slice(3).split(':').map(Number);return ampm(h*60+m)}const w=s.split(' ')[0];if(w==='어제'||w==='昨天')return t('yesterday');return s.replace('오늘','今天')}
const callNameDisp=n=>n.replace(/^(.+?)( \(\d+\))?$/,(m,a,b)=>dn(a)+(b||''));
VIEWS.phone=()=>{const all=[...extraCalls,...calls].filter(c=>!missOnly||c[2]==='부재중');
 return{html:`<div class="nav"><button style="color:var(--blue);font-size:17px;justify-self:start;padding-left:8px">${t('edit')}</button><div class="seg"><button class="${missOnly?'':'on'}" onclick="missOnly=false;show('phone')">${t('all')}</button><button class="${missOnly?'on':''}" onclick="missOnly=true;show('phone')">${t('missed')}</button></div><span></span></div>
 <div class="scroll"><h1 class="lt">${t('recents')}</h1><div class="srch">${G.search}${t('search')}</div>
 ${all.map(c=>`<div class="prow ${c[2]==='부재중'?'miss':''}" style="cursor:pointer" onclick="dial('${esc(c[0].replace(/ \(\d+\)$/,''))}')"><span class="pi">${c[2]==='발신'?'<svg viewBox="0 0 24 24"><path d="M6.6 3.2c.6-.3 1.4-.1 1.8.5l1.9 3c.4.6.3 1.4-.2 1.9l-1.4 1.3a12.4 12.4 0 0 0 5.4 5.4l1.3-1.4c.5-.5 1.3-.6 1.9-.2l3 1.9c.6.4.8 1.2.5 1.8l-.9 1.9c-.5 1-1.6 1.6-2.7 1.4C10 19.6 4.4 14 3.3 6.8c-.2-1.1.4-2.2 1.4-2.7Z"/></svg>':''}</span><div class="pn"><b>${esc(callNameDisp(c[0]))}</b><small>${t('mobile')}</small></div><span class="pd">${callWhen(c[1])}</span><span class="inf">${G.info}</span></div>`).join('')}</div>
 ${tabbar([['star',t('favorites')],['clock',t('recents')],['contacts',t('contacts')],['keypad',t('keypad')],['voicemail',t('voicemail')]],1)}`}};

/* --- 聊天 --- */
const GROUP_PATTERN=(typeof window.GROUP_PATTERN!=='undefined'&&window.GROUP_PATTERN)||/群|组|通知|公告/;
const isGroup=n=>GROUP_PATTERN.test(n);
const MEMBERS=(typeof window.GROUP_MEMBERS!=='undefined'&&window.GROUP_MEMBERS)||{};
function lastDate(n){const d=((chatData[n]||[]).filter(x=>x[1]==='date').slice(-1)[0]||[''])[0];return d}
function dateKey(n){if(n===LIVE_PARTNER_CLI)return 9999;const l=lastDate(n);const m=String(l).match(/(\d+)\s*[월月]\s*(\d+)/);return m?+m[1]*100+ +m[2]:0}
const mediaLabels={};
/* 由配置生成 mediaLabels：CHAT_IMAGES / CHAT_AUDIO 里的方括号标记直接变成图片/语音气泡 */
(function(){if(typeof CHAT_IMAGES!=='undefined')Object.entries(CHAT_IMAGES).forEach(([k,v])=>mediaLabels[k]={kind:'image',src:v});
 if(typeof CHAT_AUDIO!=='undefined')Object.entries(CHAT_AUDIO).forEach(([k,v])=>mediaLabels[k]={kind:'audio',src:v.src,dur:v.dur,label:v.label})})();
function previewText(s,grp){const m=mediaLabels[s];if(m)return m.kind==='image'?t('photo'):t('voiceMsg');const b=s.match(/^\[(.+)\]$/);if(b)return /기프티콘/.test(b[1])?t('giftSent'):/파일/.test(b[1])&&!/영상/.test(b[1])?t('fileColon')+fileInfo(b[1])[0]:/영상/.test(b[1])?t('video'):t('photo');return grp?s.replace(/^.+?: /,''):s}
function avatarFor(name,group){
 const a=avatarOf(name);if(a)return '<img src="'+a+'" alt="">';
 if(name===LIVE_PARTNER_CLI)return '<img src="'+IMG.partnerAvatar+'" alt="">';
 if(group)return `<svg viewBox="0 0 24 24"><circle cx="8.5" cy="9" r="3" fill="#fff"/><circle cx="15.5" cy="9" r="3" fill="#fff"/><path d="M2.5 19c.4-3 2.9-5 6-5s5.6 2 6 5ZM9.5 19c.4-3 2.9-5 6-5s5.6 2 6 5Z" fill="#fff"/></svg>`;
 return G.sil}
function otherUnread(){return Object.entries(unread).filter(([k])=>k!==chatId).reduce((a,[,b])=>a+b,0)+(chatId===LIVE_PARTNER_CLI?0:soheeUnread)}
/* 聊天列表 = PEOPLE 里的名字 ∩ chatData 里有记录的（按 PEOPLE 的顺序） */
const chatNames=(function(){
 const pk=typeof PEOPLE!=='undefined'?Object.keys(PEOPLE):[];
 const ck=Object.keys(chatData||{});
 const both=pk.filter(n=>ck.includes(n));
 const onlyCk=ck.filter(n=>!pk.includes(n));
 return both.length?both.concat(onlyCk):ck;
})();
/* ========== 微信 App ========== */
/* 微信底部四栏图标 */
G.wxChat='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.2 3C5.2 3 2 5.7 2 9c0 1.9 1.1 3.6 2.8 4.7l-.7 2.1 2.4-1.2c.8.2 1.7.3 2.7.3h.6c-.1-.5-.2-1-.2-1.5 0-3.3 3.2-6 7.1-6h.5C16.5 4.8 13.2 3 9.2 3Zm-2.4 3.3a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Zm4.8 0a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z"/><path d="M22 13.5c0-2.8-2.7-5-6.1-5s-6.1 2.2-6.1 5 2.7 5 6.1 5c.7 0 1.4-.1 2.1-.3l2 1-.6-1.7c1.6-.9 2.6-2.3 2.6-4Zm-8.2-1.3a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm4.2 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z"/></svg>';
G.wxContacts='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.5-4 3.5-6.4 7.5-6.4s7 2.4 7.5 6.4"/></svg>';
G.wxDiscover='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z" fill="currentColor" stroke="none"/></svg>';
G.wxMe='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.4"/><path d="M5 20.5c.6-3.7 3.4-5.9 7-5.9s6.4 2.2 7 5.9"/></svg>';

/* 微信四栏 tabbar */
function wxTabbar(on){
 const items=[['wxChat',t('wxChatTab')],['wxContacts',t('wxContactsTab')],['wxDiscover',t('wxDiscoverTab')],['wxMe',t('wxMeTab')]];
 return `<div class="wxc-tab">${items.map(([ic,l],i)=>`<button class="${i===on?'on':''}" onclick="event.stopPropagation();${i===1?'wxContacts()':i===2?'wxDiscover()':i===3?'wxMe()':'wxChats()'}">${G[ic]}<span>${l}</span></button>`).join('')}</div>`}

VIEWS.kakao=()=>{const list=chatNames.slice().sort((a,b)=>dateKey(b)-dateKey(a));
 return{cls:'wxc',html:`<div class="wxc-h"><b>${t('wxChatTab')}</b><span>${G.search}${G.chatPlus}</span></div><div class="scroll">${list.map(n=>{const arr=chatData[n]||[];let last=arr.filter(x=>x[1]!=='date').slice(-1)[0],time=fmtLabel(lastDate(n)),cnt=unread[n]||0;
  if(n===LIVE_PARTNER_CLI&&todayChat.length){last=todayChat[todayChat.length-1];time=last[2];cnt=soheeUnread}
  return `<button class="crow" onclick="chatId=${esc(JSON.stringify(n))};push('chat')"><div class="av">${avatarFor(n,isGroup(n))}</div><div style="flex:1;min-width:0"><div class="cn">${esc(dn(n))}${MEMBERS[n]?`<small>${MEMBERS[n]}</small>`:''}</div><div class="cp">${last?esc(previewText(last[0],isGroup(n))):''}</div></div><div class="cm"><span class="ct">${time}</span>${cnt?`<span class="kbdg">${cnt}</span>`:''}</div></button>`}).join('')}</div>
 ${wxTabbar(0)}`}};
/* 微信其余三栏 */
function wxChats(){if(view!=='kakao')show('kakao')}
function wxContacts(){chatId='';push('wxcontacts')}
function wxDiscover(){chatId='';push('wxdiscover')}
function wxMe(){chatId='';push('wxme')}

/* 通讯录：按首字母分组列 PEOPLE */
VIEWS.wxcontacts=()=>{
 const names=chatNames.slice();
/* 中文首字 -> 拼音首字母（够用即可，查不到就归到 #） */
const PY_INIT=(function(){
 const g='A阿啊爱安按昂奥 B八巴白百柏班包宝北贝本毕边卞别宾波卜步 C才蔡曹岑柴常超晁车陈成程池迟储楚褚川崔 D戴单邓狄刁丁董窦杜段 E鄂 F樊范方房费丰封冯伏符福付傅 G甘高葛耿龚勾古谷顾管桂郭 H哈海韩杭郝何贺洪侯胡花华黄霍 J姬吉纪季贾简江姜蒋焦金靳景 K康柯孔寇 L赖蓝郎劳乐雷冷黎李厉连廉梁廖林凌刘柳龙娄卢鲁陆路吕罗 M马麦满毛茅梅孟米苗缪闵明莫牟穆 N那南倪聂宁牛农 O欧 P潘庞裴彭皮平蒲 Q戚齐祁钱强乔秦邱裘曲屈瞿 R冉饶任荣阮 S萨桑沙山单商邵佘申沈盛施石史舒帅双司宋苏宿孙 T谈谭汤唐陶滕田童涂 W万汪王危韦卫魏温文翁巫邬吴伍武 X奚习夏鲜项萧谢辛邢熊修徐许薛 Y严言阎颜燕杨姚叶易殷尹应尤于余俞虞禹郁喻元袁岳 Z臧曾翟詹张章赵甄郑钟周朱诸祝庄卓邹祖'
   .split(' ');
 const m={};
 g.forEach(sec=>{const L=sec[0];[...sec.slice(1)].forEach(ch=>{m[ch]=L})});
 return m;
})();
function pyInit(ch){if(!ch)return '#';if(/[a-zA-Z]/.test(ch))return ch.toUpperCase();return PY_INIT[ch]||'#'}

 const groups={};names.forEach(n=>{const k=pyInit([...dn(n)][0]);groups[k]=groups[k]||[];groups[k].push(n)});
 const keys=Object.keys(groups).sort();
 return{cls:'wxc',html:`<div class="wxc-h"><b>${t('wxContactsTab')}</b><span>${G.person.replace('<svg','<svg width="19" height="19"')}</span></div>
 <div class="scroll"><button class="wxc-cell" onclick="vib(8)"><span class="wc-ic" style="background:#fa9d3b">${G.person.replace('<svg','<svg style="width:19px;height:19px;stroke:#fff;fill:none"')}</span><span class="wc-t">新的朋友</span></button>
 ${keys.map(k=>`<div class="wxc-gt">${esc(k)}</div>${groups[k].map(n=>`<button class="wxc-cell" onclick="chatId=${esc(JSON.stringify(n))};push('chat')"><img class="wc-av" src="${avatarOf(n)||''}" onerror="this.style.display='none'"><span class="wc-t">${esc(dn(n))}</span></button>`).join('')}`).join('')}
 <div style="height:20px"></div></div>${wxTabbar(1)}`}};

/* 发现 */
VIEWS.wxdiscover=()=>{
 const rows=[['朋友圈','wxMoments','#3b7ef2',`${avatarOf(chatNames[0])?`<img src="${avatarOf(chatNames[0])}" class="wc-av" style="width:22px;height:22px">`:''}`],
  ['扫一扫','wxScan','#4a90d9',''],['看一看','wxLook','#f5a623',''],['搜一搜','wxSearch2','#f57c00',''],
  ['视频号','wxVideo','#ff5c39',''],['直播','wxLive','#ff3b30',''],['购物','wxShop','#e94b4b',''],['游戏','wxGame','#4caf50','']];
 return{cls:'wxc',html:`<div class="wxc-h"><b>${t('wxDiscoverTab')}</b><span></span></div>
 <div class="scroll"><div style="height:10px"></div>
 <div class="wxc-group">${rows.slice(0,1).map(r=>wxRow(r)).join('')}</div>
 <div class="wxc-group">${rows.slice(1,4).map(r=>wxRow(r)).join('')}</div>
 <div class="wxc-group">${rows.slice(4,6).map(r=>wxRow(r)).join('')}</div>
 <div class="wxc-group">${rows.slice(6).map(r=>wxRow(r)).join('')}</div>
 </div>${wxTabbar(2)}`}};
function wxRow([label,icon,color,extra]){
 const ico=`<span class="wc-ic" style="background:${color}">${extra||(G[icon]||'')}</span>`;
 return `<button class="wxc-cell" onclick="vib(8)">${ico}<span class="wc-t">${esc(label)}</span><span class="wc-ch">${G.chevR}</span></button>`}

/* 我 */
VIEWS.wxme=()=>{
 const rows=[[t('wxPay'),'#4caf50','wxPay'],[t('wxFav'),'#f5a623','wxFav'],[t('wxAlbum'),'#4a90d9','wxAlbum'],[t('wxCards'),'#4a90d9','wxCards'],[t('wxEmoji'),'#f5a623','wxEmoji'],[t('wxSettings'),'#7c8794','wxSettings2']];
 return{cls:'wxc',html:`<div class="wxc-h"><b>${t('wxMeTab')}</b><span></span></div>
 <div class="scroll"><div style="height:10px"></div>
 <div class="wxc-group"><button class="wxc-cell" style="padding:16px 14px" onclick="vib(8)">
   <img class="wc-av" style="width:58px;height:58px;border-radius:8px" src="media/ig_avatar.jpg" onerror="this.style.display='none'">
   <span style="flex:1"><span class="wc-t" style="font-size:18px;font-weight:600">${esc(OWNER)}</span><span style="display:block;font-size:12.5px;color:#999;margin-top:5px">${t('wxId')}: ${esc(OWNER)}</span></span>
   <span class="wc-ch">${G.qr.replace('<svg','<svg style="width:17px;height:17px"')}${G.chevR}</span></button></div>
 <div class="wxc-group">${rows.map(([l,c,ic])=>`<button class="wxc-cell" onclick="vib(8)"><span class="wc-ic" style="background:${c}">${(G[ic]||G.star)}</span><span class="wc-t">${esc(l)}</span><span class="wc-ch">${G.chevR}</span></button>`).join('')}</div>
 <div style="height:30px"></div></div>${wxTabbar(3)}`}};

const AUD_DUR=new Proxy({},{get:(_,k)=>{const A=typeof CHAT_AUDIO!=='undefined'?CHAT_AUDIO:{};const key=Object.keys(A).find(x=>A[x].src===k);return(key&&A[key].dur)||'0:10'}})
function fileInfo(n){return(typeof CHAT_FILES!=='undefined'&&CHAT_FILES[n])||[n,'']}
function bubble(s){const m=mediaLabels[s];
 if(m&&m.kind==='image')return `<div class="bb img" onclick="event.stopPropagation();openViewerSrc('${m.src}',this.firstElementChild)"><img src="${m.src}" alt=""></div>`;
 if(m&&m.kind==='audio'){let w='';for(let i=0;i<20;i++)w+=`<i style="height:${5+Math.round(Math.abs(Math.sin(i*1.7+s.length))*15)}px;animation-delay:-${(i%5)*.13}s"></i>`;return `<div class="bb aud" data-src="${m.src}" onclick="event.stopPropagation();playChatAudio(this)"><span class="pl">${G.playF}</span><span class="wv">${w}</span><span class="du">${AUD_DUR[m.src]||'0:10'}</span></div>`}
 const _tag=s.match(/^\[(.+)\]$/);if(_tag){const n=_tag[1];
  if(typeof CHAT_FILES!=='undefined'&&CHAT_FILES[_tag[0]]){const f=CHAT_FILES[_tag[0]];return `<div class="bb file"><span class="fi">${f[0].split('.').pop().toUpperCase()}</span><div><div class="fn">${esc(f[0])}</div><div class="fs">${f[1]}</div></div></div>`}
  if(/기프티콘/.test(n))return `<div class="bb gift"><div class="gt">🍵</div><div class="gb"><b>${t('giftArrived')}</b>${t('giftItem')}</div><div class="gbtn">${t('giftCheck')}</div></div>`;
  if(/파일/.test(n)&&!/영상/.test(n)){const f=fileInfo(n);return `<div class="bb file"><span class="fi">${f[0].split('.').pop().toUpperCase()}</span><div><div class="fn">${esc(f[0])}</div><div class="fs">${t('expired')} · ${f[1]}</div></div></div>`}
  const vid=/영상/.test(n);return `<div class="bb exp">${vid?G.video:G.photo}<span>${vid?t('expVideo'):t('expPhoto')}</span></div>`}
 return `<div class="bb">${esc(s)}</div>`}
function fullDate(l){return fmtLabel(l,true)}
function chatItems(id){const arr=id===LIVE_PARTNER_CLI?[...chatData[id],...(todayChat.length?[['今天','date'],...todayChat]:[])]:(chatData[id]||[]);const grp=isGroup(id);const items=[];let tm=0;
 const TT=CHAT_TIMES[id]||[];let cTm=60*9+7;arr.forEach((m,i)=>{if(m[1]==='date'){items.push({date:m[0]});return}
  let text=m[0],sender=id===LIVE_PARTNER_CLI?LIVE_PARTNER_CLI:id;if(grp&&m[1]==='them'){const mm=text.match(/^(.+?): ([\s\S]*)$/);if(mm){sender=mm[1];text=mm[2]}}
  if(TT[i]!=null){tm=TT[i];cTm=TT[i]}else{cTm+=1+Math.floor(Math.random()*2);tm=cTm}items.push({who:m[1],text,sender,time:m[2]||ampm(tm),rd:m[3]==='rd'})});return items}
function chatMsgs(id){const it=chatItems(id),grp=isGroup(id);let o='';
 it.forEach((x,i)=>{if(x.date){o+=`<div class="dpill"><span>${G.calSm.replace('<svg','<svg width="12" height="12"')}${fullDate(x.date)}</span></div>`;return}
  const p=it[i-1],n=it[i+1];const first=!p||p.date||p.who!==x.who||p.sender!==x.sender;const last=!n||n.date||n.who!==x.who||n.sender!==x.sender||n.time!==x.time;const me=x.who==='me';
  const tm=last?`<div class="tm">${x.rd?'<span class="rd">1</span>':''}<span>${x.time}</span></div>`:(x.rd?'<div class="tm"><span class="rd">1</span></div>':'');
  o+=`<div class="ln ${me?'me':'th'} ${first?'first':''}">${!me&&first?`<div class="sav">${avatarFor(x.sender)}</div>`:''}<div class="col" style="${me?'align-items:flex-end':''}">${!me&&first&&grp?`<div class="who">${esc(dn(x.sender))}</div>`:''}<div class="wrap">${me?tm+bubble(x.text):bubble(x.text)+tm}</div></div></div>`});return o}
VIEWS.chat=()=>{const live=isLiveChat(chatId);
 return{cls:'chat',html:`<div class="chat-h"><button class="bk" onclick="back()">${G.chevL}</button><div class="nm">${esc(dn(chatId))}${MEMBERS[chatId]?`<small>${MEMBERS[chatId]}</small>`:''}</div><div class="rt">${G.dotsH}</div></div>
 <div class="msgs" id="msgs" onclick="closeKbd()">${chatMsgs(chatId)}</div>
 ${live?`<div class="cin safe" id="cin">${G.plusSq}<div class="fld ph" id="fld" onclick="event.stopPropagation();tapInput()">${t('msgInput')}</div>${G.smile}<button class="snd" id="snd" onclick="sendLine()">${G.arrowUp}</button></div><div class="kbd" id="kbd">${kbdHTML()}</div>`
  :`<div class="cin safe ro"><span>${t('readOnlyChat')}</span></div>`}`,
 init:()=>{if(chatId===LIVE_PARTNER_CLI)soheeUnread=0;else unread[chatId]=0;typing=false;pendingText='';scrollChat()}}}
function scrollChat(smooth){const b=$('#msgs');if(!b)return;if(smooth)b.scrollTo({top:b.scrollHeight,behavior:'smooth'});else b.scrollTop=b.scrollHeight}
function refreshChat(pop){const b=$('#msgs');if(!b||view!=='chat')return;b.innerHTML=chatMsgs(chatId);scrollChat();if(pop){const l=b.lastElementChild&&b.lastElementChild.querySelector('.bb');if(l)l.classList.add('pop')}}
function playChatAudio(el){const src=el.dataset.src;document.querySelectorAll('.bb.aud').forEach(x=>{x.classList.remove('playing');x.querySelector('.pl').innerHTML=G.playF});
 if(PLAYER.dataset.voice===src&&!PLAYER.paused){PLAYER.pause();return}nowSong=-1;PLAYER.src=src;PLAYER.dataset.voice=src;PLAYER.play().then(()=>{el.classList.add('playing');el.querySelector('.pl').innerHTML=G.pauseF}).catch(()=>{});
 PLAYER.onended=()=>{el.classList.remove('playing');el.querySelector('.pl').innerHTML=G.playF;delete PLAYER.dataset.voice}}
/* 키보드 + 자동 타이핑 */
const KR=[['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'],['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'],['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ']];
const KB_LAT=['qwertyuiop'.split(''),'asdfghjkl'.split(''),'zxcvbnm'.split('')];
const KB_TH=[['ๆ','ไ','ำ','พ','ะ','ั','ี','ร','น','ย','บ','ล'],['ฟ','ห','ก','ด','เ','้','่','า','ส','ว','ง'],['ผ','ป','แ','อ','ิ','ื','ท','ม','ใ','ฝ']];
const KB_JA=[['あ','か','さ'],['た','な','は'],['ま','や','ら'],['小','わ','、']];
function kbdHTML(){const k=c=>`<div class="key" data-k="${c}" data-c="${c}">${c}</div>`;let rows;
 if(LANG==='ja'){const side=['⌫','空白','改行','🌐'];rows=KB_JA.map((r,i)=>`<div class="kr"><div class="key sp" style="max-width:none;flex:1" data-k="${i===0?'→':i===1?'abc':i===2?'あいう':'☺'}">${i===0?'→':i===1?'ABC':i===2?'あいう':'☺'}</div>${r.map(c=>`<div class="key" style="max-width:none;flex:1.3;font-size:20px" data-k="${c}" data-c="${c}">${c}</div>`).join('')}<div class="key sp" style="max-width:none;flex:1;font-size:14px" data-k="${['⌫','space','ret','emo'][i]}">${side[i]==='⌫'?G.bksp:side[i]}</div></div>`).join('');
  return `<div class="kin" onclick="event.stopPropagation();kbdTap(event)">${rows}<div class="kbot">${G.globe}${G.mic}</div></div>`}
 const R=LANG==='ko'?KR:LANG==='th'?KB_TH:KB_LAT;
 return `<div class="kin" onclick="event.stopPropagation();kbdTap(event)"><div class="kr">${R[0].map(k).join('')}</div><div class="kr" style="padding:0 ${R[1].length<10?20:3}px">${R[1].map(k).join('')}</div>
 <div class="kr"><div class="key sp" data-k="⇧">${G.shift}</div><span style="width:6px"></span>${R[2].map(k).join('')}<span style="width:6px"></span><div class="key sp" data-k="⌫">${G.bksp}</div></div>
 <div class="kr"><div class="key sp" data-k="123" style="font-size:16px">123</div><div class="key sp" data-k="emo" style="font-size:20px">🙂</div><div class="key wide" data-k="space">${t('space')}</div><div class="key ret" data-k="ret">${t('ret')}</div></div>
 <div class="kbot">${G.globe}${G.mic}</div></div>`}
function openKbd(){const k=$('#kbd');if(!k||k.classList.contains('open'))return;k.classList.add('open');$('#cin').classList.remove('safe');const t0=performance.now();(function f(){scrollChat();if(performance.now()-t0<420)requestAnimationFrame(f)})()}
function closeKbd(){const k=$('#kbd');if(!k||!k.classList.contains('open'))return;k.classList.remove('open');$('#cin').classList.add('safe')}
function pressKey(k){const el=document.querySelector(`#kbd [data-k="${k}"]`);if(!el)return;el.classList.add('dn');if(!el.classList.contains('sp')&&!el.classList.contains('wide')&&!el.classList.contains('ret'))el.classList.add('pv');sfx('key');setTimeout(()=>el.classList.remove('dn','pv'),95)}
function kbdTap(e){const k=e.target.closest('.key');if(!k)return;pressKey(k.dataset.k);vib(5);tapInput()}
const CHO=['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'],JUNG=['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'],JONG=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const VS={'ㅘ':'ㅗㅏ','ㅙ':'ㅗㅐ','ㅚ':'ㅗㅣ','ㅝ':'ㅜㅓ','ㅞ':'ㅜㅔ','ㅟ':'ㅜㅣ','ㅢ':'ㅡㅣ'},FS={'ㄳ':'ㄱㅅ','ㄵ':'ㄴㅈ','ㄶ':'ㄴㅎ','ㄺ':'ㄹㄱ','ㄻ':'ㄹㅁ','ㄼ':'ㄹㅂ','ㄽ':'ㄹㅅ','ㄾ':'ㄹㅌ','ㄿ':'ㄹㅍ','ㅀ':'ㄹㅎ','ㅄ':'ㅂㅅ'},DBL={'ㄲ':'ㄱ','ㄸ':'ㄷ','ㅃ':'ㅂ','ㅆ':'ㅅ','ㅉ':'ㅈ','ㅒ':'ㅐ','ㅖ':'ㅔ'};
const KK=j=>DBL[j]?['⇧',DBL[j]]:[j];
function jamoSteps(str){const st=[];let done='';for(const ch of str){const c=ch.charCodeAt(0);
 if(c>=0xAC00&&c<=0xD7A3){const s=c-0xAC00,ci=Math.floor(s/588),vi=Math.floor(s%588/28),ti=s%28,cp=(v,t)=>String.fromCharCode(0xAC00+ci*588+v*28+t);
  st.push({k:KK(CHO[ci]),t:done+CHO[ci]});const v=VS[JUNG[vi]];if(v){st.push({k:[v[0]],t:done+cp(JUNG.indexOf(v[0]),0)});st.push({k:[v[1]],t:done+cp(vi,0)})}else st.push({k:KK(JUNG[vi]),t:done+cp(vi,0)});
  if(ti){const f=FS[JONG[ti]];if(f){st.push({k:[f[0]],t:done+cp(vi,JONG.indexOf(f[0]))});st.push({k:[f[1]],t:done+cp(vi,ti)})}else st.push({k:KK(JONG[ti]),t:done+cp(vi,ti)})}done+=ch}
 else{done+=ch;st.push({k:ch===' '?['space']:/[ㄱ-ㅣ]/.test(ch)?KK(ch):[],t:done})}}return st}
const JA_ROW={};[['あ','あいうえおぁぃぅぇぉ'],['か','かきくけこがぎぐげご'],['さ','さしすせそざじずぜぞ'],['た','たちつてとだぢづでどっ'],['な','なにぬねの'],['は','はひふへほばびぶべぼぱぴぷぺぽ'],['ま','まみむめも'],['や','やゆよゃゅょ'],['ら','らりるれろ'],['わ','わをんゎー'],['、','、。？！?!…〜']].forEach(([k,s])=>[...s].forEach(c=>JA_ROW[c]=k));
const rnd=a=>a[Math.floor(Math.random()*a.length)];
function keysFor(ch){if(ch===' ')return['space'];
 if(LANG==='ja'){let c=ch;const cc=c.charCodeAt(0);if(cc>=0x30A1&&cc<=0x30F6)c=String.fromCharCode(cc-0x60);if(JA_ROW[c])return[JA_ROW[c]];if(/[一-鿿]/.test(ch))return[rnd(['あ','か','さ','た','な','は','ま','や','ら']),'space'];return[]}
 if(LANG==='th'){return KB_TH.flat().includes(ch)?[ch]:[]}
 if(LANG==='zh'&&/[一-鿿]/.test(ch)){const l='qwertyuiopasdfghjklzxcvbnm';return[rnd(l),rnd(l),'space']}
 const base=ch.normalize('NFD')[0];const lo=base.toLowerCase();if(/[a-z]/.test(lo))return base!==lo?['⇧',lo]:[lo];return[]}
function genSteps(str){const st=[];let done='';for(const ch of str){done+=ch;st.push({k:keysFor(ch),t:done})}return st}
function setField(txt,cursor){const f=$('#fld');if(!f)return;if(!txt&&!cursor){f.className='fld ph';f.textContent=t('msgInput');return}f.className='fld';f.innerHTML=esc(txt)+(cursor?'<span class="cur"></span>':'')}
function canType(){return AUTO_ON&&chatId===LIVE_PARTNER_CLI&&todayChat.filter(x=>x[1]==='them').length>=2&&replyStage<(typeof liveReplies!=='undefined'?liveReplies.length:0)&&!typing&&!pendingText&&!replyBusy}
function tapInput(){openKbd();if(!canType()){setField(pendingText,true);return}typeLine(liveReplies[replyStage].mine[lineIdx])}
function typeLine(line){typing=true;const steps=LANG==='ko'?jamoSteps(line):genSteps(line);let i=0;setField('',true);
 (function step(){if(view!=='chat'){typing=false;return}if(i>=steps.length){typing=false;pendingText=line;const s=$('#snd');if(s)s.classList.add('on');return}
  const s=steps[i++];s.k.forEach((k,j)=>setTimeout(()=>pressKey(k),j*45));setField(s.t,true);setTimeout(step,(LANG==='ko'?60:85)+Math.random()*70+(s.k.length>1?s.k.length*45:0)+(s.k[0]==='space'?60:0))})()}
function sendLine(){if(!pendingText)return;const stage=liveReplies[replyStage];todayChat.push([pendingText,'me',nowAmpm(),'rd']);pendingText='';sfx('send');vib(10);setField('',false);$('#snd').classList.remove('on');refreshChat(true);lineIdx++;
 if(lineIdx<stage.mine.length){setTimeout(()=>{if(view==='chat'&&chatId===LIVE_PARTNER_CLI&&$('#kbd.open'))typeLine(stage.mine[lineIdx])},500);return}
 replyStage++;lineIdx=0;replyBusy=true;const them=stage.them.slice();
 setTimeout(()=>{todayChat.forEach(x=>{if(x[3]==='rd')x[3]=''});refreshChat()},900);
 let t=1500;them.forEach((msg,k)=>{const typingDur=700+msg.length*55;setTimeout(()=>showTyping(),t);t+=typingDur;setTimeout(()=>{hideTyping();deliverSohee(msg)},t);t+=350});
 setTimeout(()=>{replyBusy=false},t+50)}
function showTyping(){if(!(view==='chat'&&chatId===LIVE_PARTNER_CLI))return;const b=$('#msgs');if(!b||$('#typ'))return;b.insertAdjacentHTML('beforeend',`<div class="ln th first" id="typ"><div class="sav">${avatarFor(LIVE_PARTNER_CLI)}</div><div class="col"><div class="who">${esc(dn(LIVE_PARTNER_CLI))}</div><div class="wrap"><div class="bb typing pop"><i></i><i></i><i></i></div></div></div></div>`);scrollChat(true)}
function hideTyping(){const t=$('#typ');if(t)t.remove()}
function deliverSohee(text){todayChat.push([text,'them',nowAmpm()]);
 if(view==='chat'&&chatId===LIVE_PARTNER_CLI){refreshChat(true);tone(1318,0,.12,.05)}
 else{soheeUnread++;notify(text);if(view==='kakao')show('kakao');if(view==='home')renderHome()}}
function incomingMsg(text){if(view==='chat'&&chatId===LIVE_PARTNER_CLI){showTyping();setTimeout(()=>{hideTyping();deliverSohee(text)},1500)}else deliverSohee(text)}

/* --- 알림 배너 --- */
function notify(body){sfx('msg');vib([30,60,30]);
 if(view==='lock'||view==='pin'){lockNotes.unshift({title:LIVE_PARTNER_CLI,body,app:'kakao',time:t('now')});renderLock();const c=document.querySelector('.lk-notes .ncard');if(c)c.animate([{transform:'translateY(-30px) scale(.9)',opacity:0},{transform:'none',opacity:1}],{duration:500,easing:'cubic-bezier(.2,1.2,.4,1)'});return}
 OV.querySelectorAll('.banner').forEach(b=>b.remove());const b=document.createElement('div');b.className='banner';b.innerHTML=`<div class="ncard">${ncardHTML({title:LIVE_PARTNER_CLI,body,app:'kakao',time:t('now')})}</div>`;OV.appendChild(b);
 b.animate([{transform:'translateY(-140%) scale(.96)'},{transform:'none'}],{duration:620,easing:'cubic-bezier(.2,1.25,.35,1)'});
 let y0=null,dy=0,mv=false;const hide=()=>{if(!b.isConnected)return;b.animate([{transform:`translateY(${Math.min(0,dy)}px)`},{transform:'translateY(-150%)'}],{duration:320,easing:'ease-in',fill:'forwards'}).onfinish=()=>b.remove()};
 const tm=setTimeout(hide,5600);
 b.addEventListener('pointerdown',e=>{y0=e.clientY;mv=false;b.setPointerCapture(e.pointerId)});
 b.addEventListener('pointermove',e=>{if(y0===null)return;dy=(e.clientY-y0)/SC;if(Math.abs(dy)>5)mv=true;b.style.transform=`translateY(${dy<0?dy:dy*.25}px)`});
 b.addEventListener('pointerup',()=>{if(y0===null)return;y0=null;clearTimeout(tm);if(dy<-30){hide();return}b.style.transform='';if(!mv){b.remove();openSohee(b)}})}
function openSohee(el){if(callState)return;chatId=LIVE_PARTNER_CLI;if(view==='home'){openApp('chat',el.querySelector?el:null);return}if(view==='chat'&&chatId===LIVE_PARTNER_CLI)return;if(['lock','pin'].includes(view))return;push('chat')}

/* --- Safari --- */
VIEWS.safari=()=>{if(safSearch)return{cls:'saf',html:`<div style="position:absolute;top:54px;left:0;right:0;padding:6px 14px;display:flex;gap:12px;align-items:center;z-index:3"><div class="srch" style="margin:0;flex:1;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.08);height:40px">${G.search}<span style="color:#000">|</span><span>${t('searchWeb')}</span></div><button style="color:var(--blue);font-size:17px" onclick="safSearch=false;show('safari')">${t('cancel')}</button></div>
 <div class="scroll" style="padding-top:112px"><div style="display:flex;justify-content:space-between;margin:0 16px 8px"><b style="font-size:20px">${t('recentSearches')}</b><span style="color:var(--blue)">${t('clear')}</span></div><div class="group srec">${searches.map(s=>`<div class="row" style="--inset:44px">${G.clock.replace('<svg','<svg width="18" height="18" style="color:#8e8e93;flex:none"')}<span>${esc(s)}</span></div>`).join('')}</div></div>`,init:pg=>pg.querySelector('.srec').animate([{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'none'}],{duration:300})};
 const fav=[['sf_portal','#2a5bd7'],['sf_acad','#1e8e5a'],['sf_lib','#8b5a2b'],['sf_elearn','#d9480f'],['sf_pe','#4b6cb7'],['sf_mail','#5e5ce6'],['sf_news','#34c759'],['app_maps','#ff9f0a']].map(([k,c])=>[[...t(k)][0].toUpperCase(),t(k),c]);
 return{cls:'saf',html:`<div class="scroll"><div class="sh" style="font-size:22px">${t('favoritesSf')}</div><div class="favs">${fav.map(f=>`<div class="fav"><i style="color:${f[2]}">${f[0]}</i>${f[1]}</div>`).join('')}</div>
 <div class="sh" style="font-size:22px;margin-top:28px">${t('privacyReport')}</div><div class="group" style="padding:14px 16px;display:flex;gap:12px;align-items:center;font-size:15px"><span style="font-size:26px">🛡️</span><span>${t('privacyText')}</span></div>
 <div class="sh" style="font-size:22px;margin-top:28px">${t('readingList')}</div><div class="group"><div class="row muted" style="font-size:15px">${t('readingEmpty')}</div></div></div>
 <div class="sbar"><button class="ad" style="width:100%" onclick="safSearch=true;show('safari')"><b>${t('aa')}</b><span style="flex:1;text-align:center">${t('searchWeb')}</span>${G.mic.replace('<svg','<svg width="18" height="18"')}</button><div class="tb">${G.chevLb.replace('<svg','<svg class="dis"')}${G.chevRb.replace('<svg','<svg class="dis"')}${G.share}${G.book}${G.tabs}</div></div>`}};

/* --- Mail --- */
function mailDate(s){const m=s.match(/^(\d+)\/(\d+)$/);if(m)return fmtNum(2026,+m[1],+m[2]);if(s==='2025')return fmtNum(2025,12,2);if(s==='어제')return t('yesterday');return s}
VIEWS.mail=()=>({html:navHTML({title:t('inbox'),back:t('mailboxes'),backFn:'closeApp()',right:t('edit')})+`<div class="scroll"><h1 class="lt">${t('inbox')}</h1><div class="srch">${G.search}${t('search')}</div>
 ${emails.map((e,i)=>`<button class="mrw" onclick="mailId=${i};readMail.add(${i});push('maild')"><span class="dot ${i<2&&!readMail.has(i)?'':'r'}"></span><div class="bd"><div class="l1"><b>${esc(e[0])}</b><span>${mailDate(e[3])}${G.chevR}</span></div><div class="sj">${esc(e[1])}</div><div class="pv">${esc(e[2])}</div></div></button>`).join('')}</div>
 <div class="toolbar">${G.filter}<span style="color:#000;font-size:11px;text-align:center;align-self:center">${t('updatedNow')}</span>${G.compose}</div>`});
VIEWS.maild=()=>{const e=emails[mailId],school=![2,4].includes(mailId);const body=school?t('mailSchool',e[0],e[2]):t('mailShop',e[2]);
 return{html:navHTML({title:'',back:t('inbox'),right:'',solid:false})+`<div class="scroll"><div class="mail-d"><div class="hd"><span class="ini">${esc(e[0][0])}</span><div style="flex:1"><b>${esc(e[0])}</b><small>${t('toMe')}</small></div><small class="muted">${mailDate(e[3])}</small></div><h2>${esc(e[1])}</h2><div class="bd">${esc(body)}</div></div></div><div class="toolbar">${G.trash}${G.bookmark}${G.share.replace('M12 3v12M8 7l4-4 4 4','M9 15 4 10l5-5M4 10h10a6 6 0 0 1 6 6v3')}${G.compose}</div>`}};

/* --- 照片 --- */
const allPhotos=[];photoSections.forEach(s=>s[1].forEach(n=>allPhotos.push({src:'photos/'+n,sec:s[0],sub:s[2]})));
 let STORY_I=-1;
if(typeof STORY!=='undefined'&&STORY&&STORY.src){STORY_I=allPhotos.length;allPhotos.push({src:STORY.src,thumb:STORY.thumb||STORY.src,sec:STORY.date,sub:t('screenshot','21:41')})}
VIEWS.photos=()=>{let k=0;return{html:`<div class="nav"><span></span><div class="nb-title">${t('library')}</div><div class="nb-right">${G.search}<span>${t('select')}</span></div></div><div class="scroll" style="padding-bottom:120px"><h1 class="lt">${t('library')}</h1><div class="muted" style="margin:-6px 16px 10px;font-size:15px">${t('nPhotos',allPhotos.length)}</div>
 ${photoSections.map(s=>`<div class="ph-sec">${fmtLabel(s[0])}</div><div class="ph-grid">${s[1].map(n=>`<button data-pi="${k}" onclick="openViewer(${k++},this.firstElementChild)"><img src="photos/${n}" loading="lazy" alt=""></button>`).join('')}</div>`).join('')}
 ${STORY_I>=0?`<div class="ph-sec" style="margin-top:12px">${fmtLabel(STORY.date)}</div><div class="ph-grid"><button data-pi="${STORY_I}" onclick="openViewer(${STORY_I},this.firstElementChild)"><img src="${STORY.thumb||STORY.src}" alt=""></button></div>`:''}</div>
 <div class="phtabs"><button>${t('years')}</button><button>${t('months')}</button><button class="on">${t('allPhotos')}</button></div>`,init:pg=>{const sc=pg.querySelector('.scroll');sc.scrollTop=0}}};
/* 照片 뷰어 */
let vList=allPhotos,vIdx=0;
function fitRect(nw,nh){const W=SCREEN.clientWidth,H=SCREEN.clientHeight,s=Math.min(W/nw,H/nh);const w=nw*s,h=nh*s;return{x:(W-w)/2,y:(H-h)/2,w,h}}
function placeImg(img){const f=fitRect(img.naturalWidth||1,img.naturalHeight||1);Object.assign(img.style,{left:f.x+'px',top:f.y+'px',width:f.w+'px',height:f.h+'px'});return f}
function flipFrom(img,r,f){const s=Math.max(r.w/f.w,r.h/f.h),ix=Math.max(0,(f.w*s-r.w)/2/s),iy=Math.max(0,(f.h*s-r.h)/2/s);return{transform:`translate(${r.x+r.w/2-(f.x+f.w/2)}px,${r.y+r.h/2-(f.y+f.h/2)}px) scale(${s})`,clipPath:`inset(${iy}px ${ix}px round ${8/s}px)`}}
function openViewerSrc(src,el){vList=[{src,sec:t('app_kakao'),sub:t('photo')}];openViewer(0,el,true)}
async function openViewer(i,el,custom){if(!custom)vList=allPhotos;vIdx=i;const p=vList[i];const r=el?relRect(el):null;
 const v=document.createElement('div');v.className='viewer';v.innerHTML=`<div class="vbg"></div><img class="vi" src="${p.src}" alt=""><div class="vt"><button class="nb-back" onclick="closeViewer()">${G.chevL}</button><div class="ttl" id="vttl"></div><div class="nb-right" style="color:#fff">${t('edit')}</div></div><div class="vb">${G.share}${G.heart}${G.info}${G.trash}</div>`;OV.appendChild(v);setVTitle();setStatus(true);
 const img=v.querySelector('.vi');try{await img.decode()}catch(e){}const f=placeImg(img);
 if(r){img.animate([flipFrom(img,r,f),{transform:'none',clipPath:`inset(0px 0px round 0px)`}],{duration:420,easing:'cubic-bezier(.2,.9,.25,1)'})}
 v.querySelector('.vbg').animate([{opacity:0},{opacity:1}],{duration:300});[...v.querySelectorAll('.vt,.vb')].forEach(x=>x.animate([{opacity:0},{opacity:1}],{duration:400}));
 viewerGestures(v)}
function setVTitle(){const p=vList[vIdx];const T_=$('#vttl');if(T_)T_.innerHTML=`${esc(fmtLabel(p.sec))}<small>${esc(p.sub||t('photo'))}</small>`}
function closeViewer(){const v=OV.querySelector('.viewer');if(!v)return;const img=v.querySelector('.vi');const th=vList===allPhotos?document.querySelector(`[data-pi="${vIdx}"] img`):null;
 const f={x:parseFloat(img.style.left),y:parseFloat(img.style.top),w:parseFloat(img.style.width),h:parseFloat(img.style.height)};
 const cur=getComputedStyle(img).transform;
 if(th&&view==='photos'){th.scrollIntoView({block:'nearest'});const r=relRect(th);img.animate([{transform:cur==='none'?'none':cur},flipFrom(img,r,f)],{duration:380,easing:'cubic-bezier(.3,.8,.25,1)',fill:'forwards'})}
 else img.animate([{transform:cur==='none'?'none':cur,opacity:1},{transform:'scale(.85)',opacity:0}],{duration:300,fill:'forwards'});
 v.querySelector('.vbg').animate([{opacity:getComputedStyle(v.querySelector('.vbg')).opacity},{opacity:0}],{duration:360,fill:'forwards'});[...v.querySelectorAll('.vt,.vb')].forEach(x=>x.style.opacity=0);
 setTimeout(()=>{v.remove();setStatus(viewDark());updateIsland()},390)}
function viewerGestures(v){const img=v.querySelector('.vi'),bg=v.querySelector('.vbg');let x0=null,y0=0,dx=0,dy=0,mode=null;
 v.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;x0=e.clientX;y0=e.clientY;dx=dy=0;mode=null;v.setPointerCapture(e.pointerId)});
 v.addEventListener('pointermove',e=>{if(x0===null)return;dx=(e.clientX-x0)/SC;dy=(e.clientY-y0)/SC;if(!mode&&Math.hypot(dx,dy)>8)mode=Math.abs(dx)>Math.abs(dy)?'h':'v';
  if(mode==='h')img.style.transform=`translateX(${dx}px)`;if(mode==='v'){const k=Math.max(.6,1-Math.max(0,dy)/900);img.style.transform=`translate(${dx}px,${dy}px) scale(${k})`;bg.style.opacity=Math.max(0,1-Math.max(0,dy)/400)}});
 v.addEventListener('pointerup',async()=>{if(x0===null)return;x0=null;
  if(!mode){v.classList.toggle('bare');return}
  if(mode==='v'&&dy>110){closeViewer();return}
  if(mode==='h'&&Math.abs(dx)>70&&vList[vIdx+(dx<0?1:-1)]){const dir=dx<0?1:-1;img.animate([{transform:`translateX(${dx}px)`},{transform:`translateX(${-dir*110}%)`}],{duration:220,fill:'forwards'});
   setTimeout(async()=>{vIdx+=dir;img.getAnimations().forEach(a=>a.cancel());img.style.transform='';img.src=vList[vIdx].src;try{await img.decode()}catch(e){}placeImg(img);setVTitle();img.animate([{transform:`translateX(${dir*110}%)`},{transform:'none'}],{duration:280,easing:'cubic-bezier(.2,.9,.25,1)'})},210);return}
  img.animate([{transform:img.style.transform||'none'},{transform:'none'}],{duration:300,easing:'cubic-bezier(.2,1.2,.4,1)'});img.style.transform='';bg.style.opacity=1})}

/* --- Instagram --- */
/* v: 视频文件名（放在 media/ 下），留空则用 cover 封面图 */
const REELS=[
 {t:'Off My Face',d:fmtYMD(2023,6,2),v:'3,921',n:214,video:'',cover:'media/cover_01.jpg'},
 {t:'What 2 Do',d:fmtYMD(2024,8,19),v:'2,107',n:168,video:'',cover:'media/cover_01.jpg'},
 {t:'Boyfriend',d:fmtYMD(2025,10,30),v:'5,866',n:402,video:'',cover:'media/cover_02.jpg'}
];
/* ============================================================
   微博（原 Instagram 位置）
   ============================================================ */
/* 数字格式化：过万显示「x.x万」 */
function wbNum(n){n=+n||0;return n>=10000?(n/10000).toFixed(1).replace(/\.0$/,'')+'万':String(n)}
/* 正文里的 #话题# 变橙色链接 */
function wbText(s){
 const e=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 return e(s).replace(/#([^#\s][^#]{0,20})#/g,(m,t)=>`<a class="wb-topic" onclick="event.stopPropagation();vib(6)">#${t}#</a>`);
}
/* 单条微博卡片 */
function wbCard(p,i){
 const [name,vip,av,time,text,imgs,rf,cm,lk]=p;
 const imgsArr=imgs||[];
 let grid='';
 if(imgsArr.length===1)grid=`<div class="wb-media one">${wbImg(imgsArr[0])}</div>`;
 else if(imgsArr.length>1)grid=`<div class="wb-media grid g${Math.min(imgsArr.length,9)}">${imgsArr.slice(0,9).map(wbImg).join('')}</div>`;
 return `<div class="wb-card">
   <div class="wb-hd">
     <img class="wb-av" src="${av||WEIBO.avatar}" onerror="this.style.visibility='hidden'">
     <div class="wb-hi"><div class="wb-nm">${esc(name)}${vip?`<span class="wb-vip" title="${esc(vip)}">V</span>`:''}</div>
       <div class="wb-tm">${esc(time)} · 来自 iPhone</div></div>
     <button class="wb-follow" onclick="event.stopPropagation();this.classList.toggle('on');this.textContent=this.classList.contains('on')?'已关注':'+ 关注';vib(8)">+ 关注</button>
   </div>
   <div class="wb-tx">${wbText(text)}</div>
   ${grid}
   <div class="wb-bar">
     <span onclick="event.stopPropagation();vib(6)">${G.wbShare}<b>${wbNum(rf)}</b></span>
     <span onclick="event.stopPropagation();vib(6)">${G.wbComment}<b>${wbNum(cm)}</b></span>
     <span class="like" onclick="event.stopPropagation();this.classList.toggle('on');const b=this.querySelector('b');const on=this.classList.contains('on');b.textContent=(+b.textContent.replace('万','')||0)+(on?1:-1);vib(8)">${G.wbLike}<b>${wbNum(lk)}</b></span>
   </div>
 </div>`;
}
/* 判断是不是视频文件 */
function isVideoName(f){return /\.(mp4|mov|webm|m4v|ogv)$/i.test(String(f))}
/* 统一路径：带 media/ 或 photos/ 前缀的照用，否则默认去 photos/ 找 */
function wbSrc(f){f=String(f);return /^(media|photos)\//.test(f)?f:'photos/'+f}
/* 微博配图单元：图片走大图查看器，视频直接内联播放 */
function wbImg(f){
 const src=wbSrc(f);
 if(isVideoName(f))return `<button class="vid" onclick="event.stopPropagation();toggleWbVideo(this)">
   <video src="${src}" playsinline webkit-playsinline loop preload="metadata"></video>
   <span class="vplay">${G.playF||''}</span>
   <span class="vbadge">视频</span></button>`;
 return `<button onclick="event.stopPropagation();openViewerSrc('${src}',this.firstElementChild)"><img src="${src}" alt="" onerror="this.parentNode.style.background='#eee';this.style.display='none'"></button>`}
/* 点视频：播放/暂停，并同步播放按钮状态 */
function toggleWbVideo(btn){
 const v=btn.querySelector('video');if(!v)return;
 if(v.paused){document.querySelectorAll('.wb-media video').forEach(o=>{if(o!==v){o.pause();o.closest('button').classList.remove('playing')}});v.play().catch(()=>{});btn.classList.add('playing')}
 else{v.pause();btn.classList.remove('playing')}
 vib(6)}

/* 微博底部五栏 */
function wbTabbar(on){
 const ics=['wbHome','wbVideo','wbFind','wbMsg','wbMe'];
 return `<div class="wb-tab">${WEIBO_TABS.map((l,i)=>`<button class="${i===on?'on':''}" onclick="event.stopPropagation();${i===0?'wbHome()':i===4?'wbProfile()':'vib(8)'}">${G[ics[i]]||G.wbHome}<span>${esc(l)}</span></button>`).join('')}</div>`}

/* 首页（关注流） */
VIEWS.instagram=()=>({cls:'wb',html:`
 <div class="wb-top"><button class="wb-close" onclick="closeApp()">${G.chevLb}</button>
  <div class="wb-seg"><span class="on">关注</span><span onclick="event.stopPropagation();show('wbhot')">推荐</span></div>
  <span class="wb-tr">${G.wbSearch}</span></div>
 <div class="scroll wb-scroll">${WEIBO_POSTS.map(wbCard).join('')}<div class="wb-end">—— 没有更多了 ——</div></div>
 ${wbTabbar(0)}`});

/* 推荐（热搜） */
VIEWS.wbhot=()=>({cls:'wb',html:`
 <div class="wb-top"><button class="wb-close" onclick="back()">${G.chevLb}</button>
  <div class="wb-seg"><span onclick="event.stopPropagation();back()">关注</span><span class="on">推荐</span></div>
  <span class="wb-tr">${G.wbSearch}</span></div>
 <div class="scroll wb-scroll">
  <div class="wb-hot-hd">微博热搜</div>
  ${['今天的晚霞','秋天的第一杯奶茶','周一上班状态','这只猫火了','城市漫游计划','深夜食堂','周末去哪儿'].map((k,i)=>`
   <button class="wb-hot ${i<3?'top':''}" onclick="vib(6)"><span class="n">${i+1}</span><span class="k">${esc(k)}</span><span class="h">${wbNum(3000000-i*420000)}</span></button>`).join('')}
  <div class="wb-hot-hd">你可能感兴趣</div>
  ${WEIBO_POSTS.slice(0,3).map(wbCard).join('')}
 </div>${wbTabbar(2)}`});

/* 我（个人主页） */
VIEWS.wbprofile=()=>({cls:'wb wbp',html:`
 <div class="wb-top" style="background:transparent;box-shadow:none;position:absolute;left:0;right:0;top:0;z-index:20">
  <button class="wb-close" onclick="closeApp()" style="color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.55)">${G.chevLb}</button>
  <span class="wb-tr" style="color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.55)">${G.wbMore}</span></div>
 <div class="scroll wb-scroll" style="padding-top:0">
  <div class="wb-cvwrap"><img class="wb-cover" src="${WEIBO_COVER}" alt="" onerror="this.parentNode.style.background='#5b6b9a';this.style.display='none'"></div>
  <div class="wb-pr">
   <img class="wb-pav" src="${WEIBO.avatar}" alt="" onerror="this.style.visibility='hidden'">
   <div class="wb-pn">${esc(WEIBO.name)}${WEIBO.verified?`<span class="wb-vip">V</span>`:''}</div>
   <div class="wb-pd">${esc(WEIBO.verified||'')}</div>
   <div class="wb-pst"><span><b>${WEIBO.posts}</b> 微博</span><span><b>${WEIBO.following}</b> 关注</span><span><b>${WEIBO.fans}</b> 粉丝</span></div>
   <div class="wb-pbt"><button onclick="vib(8)">编辑资料</button><button onclick="vib(8)">${G.wbShare}</button></div>
  </div>
  <div class="wb-ptabs"><span class="on">微博 ${WEIBO.posts}</span><span>相册</span><span>赞</span></div>
  ${WEIBO_POSTS.map(wbCard).join('')}
  <div class="wb-end">—— 没有更多了 ——</div>
 </div>${wbTabbar(4)}`});
function wbHome(){if(view!=='instagram')show('instagram')}
function wbProfile(){push('wbprofile')}

/* 微博用到的图标 */
G.wbShare='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8V5l5 4.5L17 14v-3H9a4 4 0 0 0-4 4v3"/></svg>';
G.wbComment='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4Z"/></svg>';
G.wbLike='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z"/></svg>';
G.wbSearch='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
G.wbMore='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></svg>';
G.wbHome='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20h-5v-5H9v5H4Z"/></svg>';
G.wbVideo='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="3"/><path d="m10.5 9.5 4 2.5-4 2.5Z" fill="currentColor" stroke="none"/></svg>';
G.wbFind='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2.2 5-5 2.2 2.2-5Z" fill="currentColor" stroke="none"/></svg>';
G.wbMsg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3.5 6h17v12h-17Z"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>';
G.wbMe='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20.5c.6-3.7 3.5-5.9 7.2-5.9s6.6 2.2 7.2 5.9"/></svg>';
/* --- 微信「发现」页图标（24 网格，白色描边） --- */
const WXI=c=>'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+c+'</svg>';
G.wxMoments=WXI('<circle cx="12" cy="12" r="3.6"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18"/>');
G.wxScan=WXI('<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/><path d="M4 12h16"/>');
G.wxLook=WXI('<rect x="3.5" y="6" width="17" height="12" rx="2.4"/><path d="m10.5 9.5 4 2.5-4 2.5Z" fill="#fff" stroke="none"/>');
G.wxSearch2=WXI('<circle cx="11" cy="11" r="6.4"/><path d="m15.8 15.8 4 4"/>');
G.wxVideo=WXI('<rect x="3" y="5.5" width="18" height="13" rx="2.6"/><path d="M10 9.4 15 12l-5 2.6Z" fill="#fff" stroke="none"/>');
G.wxLive=WXI('<circle cx="12" cy="12" r="2.4" fill="#fff" stroke="none"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 15.8a5.4 5.4 0 0 0 0-7.6M5.6 5.6a9 9 0 0 0 0 12.8M18.4 18.4a9 9 0 0 0 0-12.8"/>');
G.wxShop=WXI('<path d="M5 8h14l-1 11H6Z"/><path d="M9 8V6.4a3 3 0 0 1 6 0V8"/>');
G.wxGame=WXI('<rect x="2.6" y="7" width="18.8" height="10" rx="4.6"/><path d="M7.5 10v4M5.5 12h4"/><circle cx="16" cy="11" r="1" fill="#fff" stroke="none"/><circle cx="18" cy="13.4" r="1" fill="#fff" stroke="none"/>');
/* --- 微信「我」页图标 --- */
G.wxPay=WXI('<rect x="3" y="6" width="18" height="12.5" rx="2.6"/><path d="M3 10.2h18"/><path d="M7 14.6h3.4"/>');
G.wxFav=WXI('<path d="m12 4 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8Z"/>');
G.wxAlbum=WXI('<rect x="3.5" y="5" width="17" height="14" rx="2.6"/><circle cx="9" cy="10" r="1.7"/><path d="m5 16.5 4.2-4 3.4 3.2 2.6-2.4 4.3 4.4"/>');
G.wxCards=WXI('<path d="M4 8.5h11.5v9.5H4Z"/><path d="M7.5 6.2h11.5v9.3"/><path d="M6 13h6"/>');
G.wxEmoji=WXI('<circle cx="12" cy="12" r="8.4"/><circle cx="9.2" cy="10.2" r="1" fill="#fff" stroke="none"/><circle cx="14.8" cy="10.2" r="1" fill="#fff" stroke="none"/><path d="M8.6 14.2a4.2 4.2 0 0 0 6.8 0"/>');
G.wxSettings2=WXI('<circle cx="12" cy="12" r="3.1"/><path d="M12 2.8v2.6M12 18.6v2.6M4.5 12H2M22 12h-2.5M6.3 6.3 4.5 4.5M19.5 19.5l-1.8-1.8M6.3 17.7l-1.8 1.8M19.5 4.5l-1.8 1.8"/>');

function reelInner(i){const r=REELS[i];
 const media=r.video?`<video src="${r.video}" autoplay loop playsinline></video>`:`<img class="rcover" src="${r.cover||'media/cover_01.jpg'}" alt="">`;
 return `<div class="vwrap">${media}
 <div class="ract"><div class="liked">${G.heart}<span>${r.n+1}</span></div><div>${G.comment}<span>${12+i*7}</span></div><div>${G.send}<span>${3+i}</span></div><div>${G.dotsH}</div></div>
 <div class="rinfo"><div class="u"><img src="${IMG.igAvatar}" alt="">${esc(typeof WEIBO!=='undefined'?WEIBO.name:'')}<span>${t('followingTag')}</span></div>${esc(r.t)} ${t('cover')}<br><small>${r.d} · ${t('likedBy','w',r.n)}</small><br><small>${t('origAudio')}</small></div></div>`}
VIEWS.reel=()=>({cls:'reel dark',dark:true,html:`<div id="rhost">${reelInner(videoIndex)}</div><div class="rtop"><button class="rback" onclick="back()" aria-label="${t('back')}">${G.chevLb}</button><span>${t('reels')}</span>${G.camera}</div>${tabbar([['home',''],['search',''],['plusSq',''],['reels',''],['person','']],3).replace(/<button class="(on)?">/g,'<button class="$1" onclick="back()">')}`,
 init:pg=>{playReel(pg);let y0=null,dy=0;pg.addEventListener('pointerdown',e=>{if(e.target.closest('button,.tabbar'))return;y0=e.clientY;dy=0});pg.addEventListener('pointermove',e=>{if(y0===null)return;dy=(e.clientY-y0)/SC;const w=pg.querySelector('.vwrap');if(w)w.style.transform=`translateY(${dy*.6}px)`});
  pg.addEventListener('pointerup',()=>{if(y0===null)return;y0=null;const w=pg.querySelector('.vwrap');const n=videoIndex+(dy<0?1:-1);
   if(Math.abs(dy)>80&&REELS[n]){w.animate([{transform:w.style.transform},{transform:`translateY(${dy<0?-100:100}%)`}],{duration:250,fill:'forwards'});setTimeout(()=>{videoIndex=n;$('#rhost').innerHTML=reelInner(n);$('#rhost .vwrap').animate([{transform:`translateY(${dy<0?100:-100}%)`},{transform:'none'}],{duration:330,easing:'cubic-bezier(.2,.9,.25,1)'});playReel(pg)},240)}
   else{if(w){w.style.transform='';if(Math.abs(dy)<6){const vd=w.querySelector('video');vd.paused?vd.play():vd.pause()}}}})}});
function playReel(pg){const v=pg.querySelector('video');if(!v)return;if(nowSong>=0)PLAYER.pause();v.muted=false;v.play().catch(()=>{v.muted=true;v.play().catch(()=>{})})}

/* --- 음악 --- */
const artStyle=i=>ART[i]?`background-image:url(${ART[i]})`:'';
VIEWS.music=()=>({html:navHTML({title:t('songs'),back:t('libraryMu'),backFn:'closeApp()',right:''})+`<div class="scroll" style="padding-bottom:180px"><h1 class="lt">${t('songs')}</h1>
 <div style="display:flex;gap:12px;margin:4px 16px 14px"><button onclick="playSong(0)" style="flex:1;background:#eeeef0;border-radius:10px;padding:12px;color:#fa2d48;font-weight:600;display:flex;justify-content:center;gap:6px;align-items:center">${G.playF.replace('<svg','<svg width="14" fill="#fa2d48"')}${t('play')}</button><button onclick="playSong(Math.floor(Math.random()*${songs.length}))" style="flex:1;background:#eeeef0;border-radius:10px;padding:12px;color:#fa2d48;font-weight:600">${t('shuffle')}</button></div>
 ${songs.map((s,i)=>`<button class="mrow" onclick="playSong(${i})"><span class="art" style="${artStyle(i)}">${ART[i]?'':G.musicNote}</span><span class="mt ${i===nowSong?'pl':''}">${esc(s[0])}<small>${ARTIST[i]}</small></span><span style="color:#8e8e93">${G.dotsH.replace('<svg','<svg width="20"')}</span></button>`).join('')}</div>
 ${miniHTML()}${tabbar([['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m10 8.5 5 3.5-5 3.5Z" fill="currentColor"/></svg>',t('listenNow')],['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',t('browse')],['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/></svg>',t('radio')],['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4v16M10 4v16M14.5 4.5l5 15"/></svg>',t('libraryMu')],['search',t('search')]],3).replace(/class="on"/,'class="on" style="color:#fa2d48"')}`});
function miniHTML(){if(nowSong<0)return '';return `<div class="mini" onclick="openNP()"><span class="art" style="${artStyle(nowSong)}">${ART[nowSong]?'':G.musicNote}</span><b>${esc(songs[nowSong][0])}</b><button onclick="event.stopPropagation();toggleSong()">${PLAYER.paused?G.playF:G.pauseF}</button><button onclick="event.stopPropagation();nextSong(1)">${G.fwdF.replace('<svg','<svg width="30"')}</button></div>`}
function playSong(i){nowSong=i;delete PLAYER.dataset.voice;PLAYER.src=songs[i][1];PLAYER.onended=()=>nextSong(1);PLAYER.play().catch(()=>{});if(view==='music'){const sc=APP.querySelector('.scroll').scrollTop;const pg=show('music');pg.querySelector('.scroll').scrollTop=sc}refreshNP()}
function toggleSong(){if(PLAYER.paused)PLAYER.play().catch(()=>{});else PLAYER.pause();setTimeout(()=>{if(view==='music'){const m=APP.querySelector('.mini');if(m)m.outerHTML=miniHTML()}refreshNP();updateIsland()},30)}
function nextSong(d){playSong((nowSong+d+songs.length)%songs.length)}
function openNP(){if(nowSong<0)return;const n=document.createElement('div');n.className='np';OV.appendChild(n);refreshNP();setStatus(true);n.animate([{transform:'translateY(100%)'},{transform:'none'}],{duration:480,easing:'cubic-bezier(.2,.9,.25,1)'});
 let y0=null,dy=0;n.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;y0=e.clientY;dy=0;n.setPointerCapture(e.pointerId)});n.addEventListener('pointermove',e=>{if(y0===null)return;dy=Math.max(0,(e.clientY-y0)/SC);n.style.transform=`translateY(${dy}px)`});n.addEventListener('pointerup',()=>{if(y0===null)return;y0=null;if(dy>120)closeNP();else{n.animate([{transform:n.style.transform},{transform:'none'}],{duration:280,easing:'cubic-bezier(.2,1.2,.4,1)'});n.style.transform=''}})}
function refreshNP(){const n=OV.querySelector('.np');if(!n||nowSong<0)return;const a=ART[nowSong]?`url(${ART[nowSong]})`:'linear-gradient(135deg,#ff9a9e,#fa2d48)';n.classList.toggle('paused',PLAYER.paused);
 n.innerHTML=`<div class="bgart" style="background-image:${a}"></div><button class="grab" onclick="closeNP()"></button><div class="bigart" style="background-image:${a}"></div><div class="ti">${esc(songs[nowSong][0])}<small>${ARTIST[nowSong]}</small></div><div class="bar"><i id="npbar"></i></div><div class="tt"><span id="npc">0:00</span><span id="npr">-0:00</span></div>
 <div class="ctl"><button onclick="nextSong(-1)">${G.bwdF.replace('<svg','<svg width="44"')}</button><button onclick="toggleSong()">${(PLAYER.paused?G.playF:G.pauseF).replace('<svg','<svg width="46"')}</button><button onclick="nextSong(1)">${G.fwdF.replace('<svg','<svg width="44"')}</button></div>`}
function closeNP(){const n=OV.querySelector('.np');if(!n)return;n.animate([{transform:n.style.transform||'none'},{transform:'translateY(100%)'}],{duration:340,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'}).onfinish=()=>{n.remove();setStatus(viewDark());updateIsland()}}
const fmtT=s=>Math.floor(s/60)+':'+pad(Math.floor(s%60));
PLAYER.addEventListener('timeupdate',()=>{const b=$('#npbar');if(b&&PLAYER.duration){b.style.width=(PLAYER.currentTime/PLAYER.duration*100)+'%';$('#npc').textContent=fmtT(PLAYER.currentTime);$('#npr').textContent='-'+fmtT(PLAYER.duration-PLAYER.currentTime)}});
PLAYER.addEventListener('play',updateIsland);PLAYER.addEventListener('pause',updateIsland);


/* --- 地图（长沙 · 马栏山七彩盒子一带，虚拟坐标） --- */
let mapSel=null,mapPos={x:-480,y:-640};
function mapSVG(){return `<svg width="900" height="1200" viewBox="0 0 900 1200" style="position:absolute;inset:0" font-family="-apple-system,Pretendard,sans-serif">
 <!-- 底色 -->
 <rect width="900" height="1200" fill="#f1efe9"/>

 <!-- 月湖（公园水体，西北大片） -->
 <path d="M0 120C90 84 196 96 264 150S392 268 384 342 300 430 210 442 66 470 0 448Z" fill="#a9d3f2"/>
 <path d="M0 120C90 84 196 96 264 150S392 268 384 342 300 430 210 442 66 470 0 448" fill="none" stroke="#8fc4e8" stroke-width="4"/>
 <!-- 浏阳河（南侧东西向水道） -->
 <path d="M0 1032C150 1000 268 1058 400 1104S660 1178 900 1152V1200H0Z" fill="#a9d3f2"/>
 <path d="M0 1032C150 1000 268 1058 400 1104S660 1178 900 1152" fill="none" stroke="#8fc4e8" stroke-width="4"/>

 <!-- 月湖公园绿地 -->
 <path d="M40 150C130 118 230 128 292 176S372 282 358 340 268 404 186 410 52 400 28 344Z" fill="#cfe8c4"/>
 <!-- 金鹰城 / 世界之窗 绿地 -->
 <rect x="660" y="176" width="240" height="216" rx="14" fill="#d6ebc8"/>
 <!-- 马栏山文创园绿地 -->
 <path d="M366 646h244v232H366Z" fill="#dcecd2"/>

 <!-- 建筑街区 -->
 <g fill="#e3ddd2">
  <rect x="120" y="480" width="150" height="96" rx="6"/>
  <rect x="120" y="596" width="104" height="82" rx="6"/>
  <rect x="244" y="596" width="86" height="62" rx="6"/>
  <rect x="120" y="700" width="150" height="70" rx="6"/>
  <rect x="120" y="792" width="96" height="86" rx="6"/>
 </g>
 <g fill="#e8e3da">
  <rect x="636" y="440" width="118" height="96" rx="6"/>
  <rect x="774" y="440" width="92" height="150" rx="6"/>
  <rect x="636" y="556" width="70" height="90" rx="6"/>
 </g>
 <!-- 七彩盒子本体（彩色块，位于三一大道与锦绣路西北角） -->
 <rect x="404" y="456" width="156" height="132" rx="16" fill="#f6ddd6"/>
 <g>
  <rect x="422" y="472" width="44" height="40" rx="6" fill="#ff6b6b"/>
  <rect x="474" y="472" width="44" height="40" rx="6" fill="#ffc94d"/>
  <rect x="526" y="472" width="20" height="40" rx="6" fill="#4dd0a7"/>
  <rect x="422" y="520" width="44" height="54" rx="6" fill="#4d9cff"/>
  <rect x="474" y="520" width="44" height="54" rx="6" fill="#b47bff"/>
  <rect x="526" y="520" width="20" height="54" rx="6" fill="#ff9f0a"/>
 </g>
 <!-- 湖南广电主楼 -->
 <rect x="648" y="196" width="216" height="150" rx="14" fill="#e0d6c8"/>
 <g fill="#d2c4b0">
  <rect x="668" y="216" width="82" height="110" rx="5"/>
  <rect x="766" y="216" width="78" height="110" rx="5"/>
 </g>

 <!-- 主干道（路面 + 中线） -->
 <g stroke="#d5cfc6" stroke-width="30" fill="none" stroke-linecap="round">
  <path d="M0 640H900"/>
  <path d="M380 600V1200"/>
  <path d="M0 940H380"/>
  <path d="M600 296H900"/>
  <path d="M600 660V940"/>
 </g>
 <g stroke="#fff" stroke-width="26" fill="none" stroke-linecap="round">
  <path d="M0 640H900"/>
  <path d="M380 600V1200"/>
  <path d="M0 940H380"/>
  <path d="M600 296H900"/>
  <path d="M600 660V940"/>
 </g>
 <path d="M0 640H900" stroke="#ffe08a" stroke-width="26"/>
 <g stroke="#f3d76b" stroke-width="3" stroke-dasharray="16 14" fill="none">
  <path d="M0 640H900"/>
 </g>

 <!-- 人行小径 -->
 <g stroke="#fff" stroke-width="4" fill="none" stroke-dasharray="2 9">
  <path d="M96 400H340M300 180V360"/>
 </g>

 <!-- 地名标签 -->
 <g fill="#8a8578" font-size="13" font-weight="600" text-anchor="middle">
  <text x="152" y="292" font-size="17" fill="#5b8fbf">${t('m_yuehu')}</text>
  <text x="776" y="256" font-size="16" fill="#6b5f4c">${t('m_world')}</text>
  <text x="486" y="440" font-size="16" fill="#c94f4f">${t('m_colorful')}</text>
  <text x="486" y="612" font-size="11" fill="#9a7d2c">${t('m_sanyi')}</text>
  <text x="328" y="502" transform="rotate(90 328 502)" font-size="11">${t('m_jinxiu')}</text>
  <text x="756" y="192" font-size="15" fill="#7d6b55">${t('m_mango')}</text>
  <text x="486" y="766" font-size="14" fill="#5f8f4e">${t('m_park2')}</text>
  <text x="280" y="1064" fill="#5b8fbf" font-size="12">${t('m_river')}</text>
  <text x="106" y="870" font-size="11">${t('m_commercial')}</text>
 </g>

 <!-- 轨道交通 5 号线（沿万家丽路，西侧南北向） -->
 <g stroke="#c8c8cc" stroke-width="10" fill="none" stroke-linecap="round"><path d="M94 1200V0"/></g>
 <g stroke="#ff7a1a" stroke-width="6" fill="none" stroke-dasharray="14 10" stroke-linecap="round"><path d="M94 1200V0"/></g>
 <g font-size="11" font-weight="700" text-anchor="middle">
  <circle cx="94" cy="640" r="9" fill="#fff" stroke="#ff7a1a" stroke-width="4"/>
  <text x="94" y="668" fill="#ff7a1a">${t('m_sta')}</text>
  <circle cx="94" cy="412" r="9" fill="#fff" stroke="#ff7a1a" stroke-width="4"/>
  <text x="94" y="440" fill="#ff7a1a">${t('m_sta2')}</text>
 </g>
</svg>`}
const MG={home:'<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4Z"/>',cup:'<path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2M11 3v2"/>',pin:'<circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/>',bag:'<path d="M5 8h14l-1 12H6Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',game:'<rect x="3" y="8" width="18" height="10" rx="5"/><path d="M8 11v4M6 13h4"/><circle cx="15.5" cy="12" r=".6"/><circle cx="17" cy="14.5" r=".6"/>',mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',bowl:'<path d="M3.5 11h17a8.5 8.5 0 0 1-17 0Z"/><path d="M9 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/>',bus:'<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 18v2.5M16 18v2.5"/><circle cx="8.5" cy="14.5" r=".7"/><circle cx="15.5" cy="14.5" r=".7"/>',film:'<rect x="3" y="4" width="18" height="16" rx="4"/><circle cx="9" cy="10" r="2"/><path d="M4 17l5-4 4 3 3-2 4 3"/>'};
const mg=k=>`<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">${MG[k]}</svg>`;
const placeById=id=>MAP_PLACES.find(p=>p.id===id)||MAP_PLACES.find(p=>p.name===id);
// 到某地的方式：收藏里取 walk（步行分钟），否则用 bus 的副标题
const stOf=p=>(p.id==='home'&&!p.walk)?t('currentLoc'):(p.walk?t('walkMin',p.walk):(p.bus||p.sub));
function mapSheet(){if(mapSel){const p=placeById(mapSel);return `<div class="grab"></div><div class="mdet"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h2>${esc(p.name)}</h2><div class="sb">${esc(p.sub)}</div></div><button onclick="selPlace(null)" style="width:30px;height:30px;border-radius:50%;background:#e3e3e8;color:#7c7c80;font-size:17px">✕</button></div>
  <div class="acts"><button class="pri">${G.send.replace('<svg','<svg style="color:#fff"')}${esc(stOf(p))}</button><button>${G.star}${p.fav?t('favorited'):t('favorite')}</button><button>${G.share}${t('share')}</button><button>${G.dotsH}${t('moreInfo')}</button></div>
  <div class="inf">${(p.info.length?p.info:[[t('info'),t('noInfo')]]).map(r=>`<div><small>${esc(r[0])}</small>${esc(r[1])}</div>`).join('')}</div></div>`}
 const favs=MAP_PLACES.filter(p=>p.fav);
 return `<div class="grab"></div><div class="srch" style="margin:0 0 14px;background:rgba(118,118,128,.14)">${G.search}${t('searchMaps')}</div>
 <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:600;color:var(--grey);margin-bottom:8px"><span>${t('favorites')}</span><span style="color:var(--blue);font-weight:500">${t('moreInfo')}</span></div>
 <div class="mfav">${favs.map(p=>`<button onclick="selPlace('${p.id}')"><span class="fc" style="background:${p.color}">${mg(p.glyph)}</span>${esc(p.name)}<small>${esc(stOf(p))}</small></button>`).join('')}<button><span class="fc" style="background:#e3e3e8"><svg viewBox="0 0 24 24" style="stroke:var(--blue)"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg></span>${t('add')}<small>&nbsp;</small></button></div>
 <div style="font-size:15px;font-weight:600;color:var(--grey);margin:16px 0 8px">${t('recentsMap')}</div><div class="group" style="margin:0">${MAP_RECENTS.map(r=>`<button class="row tap" style="--inset:58px;min-height:56px" onclick="selPlace('${(placeById(r[0])||{}).id||''}')"><span class="st-ic" style="background:${(placeById(r[0])||{}).color||'#8e8e93'};border-radius:50%">${mg((placeById(r[0])||{}).glyph||'pin').replace('<svg','<svg style="stroke:#fff;fill:none;stroke-width:2"')}</span><span style="flex:1"><div style="font-size:16px">${esc(r[0])}</div><div class="muted" style="font-size:13px">${esc(r[1])}</div></span></button>`).join('')}</div>`}
// 收藏点位显示名字，非收藏点位只留圆点（避免地图上文字拥挤）
function mapCanvas(){const pins=MAP_PLACES.map(p=>`<div class="mpin ${p.fav?'':'small'}" style="left:${p.x}px;top:${p.y}px" onclick="event.stopPropagation();selPlace('${p.id}')"><span class="pc" style="background:${p.color}">${mg(p.glyph)}</span>${p.fav?esc(p.name):''}</div>`).join('');
 const favsHit=MAP_PLACES.filter(p=>p.fav).map(p=>`<div onclick="selPlace('${p.id}')" style="position:absolute;left:${p.x-30}px;top:${p.y-30}px;width:60px;height:60px;z-index:5;-webkit-tap-highlight-color:transparent"></div>`).join('');
 const me=placeById('me')||placeById('home');return mapSVG()+`<div class="me-dot" style="left:${me.x-26}px;top:${me.y+30}px"></div>`+pins+favsHit}
function setMapPos(x,y,anim){const cv=$('#mapcv');if(!cv)return;const W=SCREEN.clientWidth,H=SCREEN.clientHeight;mapPos={x:Math.min(0,Math.max(W-900,x)),y:Math.min(0,Math.max(H-1200,y))};const t=`translate(${mapPos.x}px,${mapPos.y}px)`;if(anim)cv.animate([{transform:cv.style.transform||'none'},{transform:t}],{duration:450,easing:'cubic-bezier(.2,.9,.25,1)'});cv.style.transform=t}
function centerOn(p,anim){const W=SCREEN.clientWidth,H=SCREEN.clientHeight;setMapPos(W/2-p.x,H*.27-p.y,anim)}
function selPlace(id){mapSel=id;const s=$('#msheet');if(s){s.innerHTML=mapSheet();s.animate([{transform:'translateY(16px)',opacity:.6},{transform:'none',opacity:1}],{duration:260})}
 document.querySelectorAll('.mpin').forEach(el=>el.classList.remove('sel'));if(id){const p=placeById(id);const i=MAP_PLACES.indexOf(p);const el=document.querySelectorAll('.mpin')[i];if(el)el.classList.add('sel');centerOn(p,true);vib(8)}}
VIEWS.maps=()=>({cls:'mapv',html:`<div class="mapwrap" id="mapwrap"><div class="mapcv" id="mapcv">${mapCanvas()}</div></div>
 <div class="mbtns"><button>${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7l9-4 9 4-9 4Z"/><path d="m3 12 9 4 9-4M3 17l9 4 9-4"/></svg>'}</button><button onclick="centerOn(placeById('me')||placeById('home'),true)">${'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5 3.5 10.6l7.2 2.7 2.7 7.2Z"/></svg>'}</button></div>
 <div class="msheet" id="msheet">${mapSheet()}</div>`,
 init:pg=>{centerOn(placeById(mapSel)||placeById('me')||placeById('home'));const w=pg.querySelector('#mapwrap');let x0=null,y0=0,sx=0,sy=0,mv=false;
  w.addEventListener('pointerdown',e=>{x0=e.clientX;y0=e.clientY;sx=mapPos.x;sy=mapPos.y;mv=false});
  w.addEventListener('pointermove',e=>{if(x0===null)return;const dx=(e.clientX-x0)/SC,dy=(e.clientY-y0)/SC;if(Math.hypot(dx,dy)>4)mv=true;if(mv){w.style.cursor='grabbing';setMapPos(sx+dx,sy+dy)}});
  w.addEventListener('pointerup',()=>{x0=null;w.style.cursor=''})}});

/* --- 날씨 --- */
VIEWS.weather=()=>{const h=new Date().getHours();const hrs=[];for(let i=0;i<12;i++){const hh=(h+i)%24,night=hh>=19||hh<6;const tp=Math.round(15+5*Math.sin((hh-9)/24*2*Math.PI));hrs.push(`<div><span>${i?fmtHour(hh):t('now')}</span>${night?G.moon:(hh%5===0?G.pcloud:G.sun)}<span>${i?tp:18}°</span></div>`)}
 const days=[[G.sun,12,21],[G.pcloud,11,20],[G.cloud,10,18],[G.sun,9,19],[G.sun,10,20],[G.pcloud,11,19],[G.cloud,8,15],[G.sun,7,16],[G.sun,8,17],[G.pcloud,9,18]].map((d,i)=>[i?wdShort(2026,10,17+i):t('today'),...d]);
 return{cls:'wx',dark:true,html:`<div class="scroll"><div class="top"><div class="lc">${t('myLoc')}</div><div class="ct">${t('seoul')}</div><div class="tp">18°</div><div class="ds">${t('mostlySunny')}</div><div style="font-size:18px;font-weight:500">${t('hiLo')}</div></div>
 <div class="wcard"><div class="wh" style="border:0;padding-bottom:6px;opacity:1;font-size:14px;font-weight:500">${t('wxSummary')}</div><div style="border-top:.5px solid rgba(255,255,255,.25);padding-top:12px" class="hrs">${hrs.join('')}</div></div>
 <div class="wcard"><div class="wh">${G.calSm.replace('<svg','<svg width="14" height="14"')}${t('tenDay')}</div>${days.map(d=>`<div class="d10"><span>${d[0]}</span>${d[1]}<span class="lo">${d[2]}°</span><span class="rng"><i style="left:${(d[2]-7)/15*100}%;right:${(22-d[3])/15*100}%"></i></span><span>${d[3]}°</span></div>`).join('')}</div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 16px"><div class="wcard" style="margin:0"><div class="wh">${t('uv')}</div><b style="font-size:30px">3</b><div>${t('moderate')}</div></div><div class="wcard" style="margin:0"><div class="wh">${t('sunset')}</div><b style="font-size:26px">${fmtTime(17*60+56)}</b><div style="font-size:14px">${t('sunrise')}: ${fmtTime(6*60+39)}</div></div></div></div>
 <div class="tabbar" style="background:rgba(40,90,170,.5);box-shadow:none"><button style="color:#fff">🗺</button><button style="color:#fff;flex:2;flex-direction:row;justify-content:center;gap:6px"><i style="width:7px;height:7px;border-radius:50%;background:#fff;display:block"></i></button><button style="color:#fff">${G.list}</button></div>`}};

/* --- 설정 / 스크린 타임 --- */
const sIc=(c,i)=>`<span class="st-ic" style="background:${c}">${(G[i]||i).replace('<svg','<svg style="color:#fff" width="18" height="18"')}</span>`;
const sRow=(c,i,t,r='',fn)=>`<div class="row ${fn?'tap':''}" style="--inset:57px;cursor:${fn?'pointer':'default'}" ${fn?`onclick="${fn}"`:''}>${sIc(c,i)}<span style="flex:1">${t}</span>${r.startsWith('<button')?r:`<span class="muted" style="font-size:17px">${r}</span>${G.chevR}`}</div>`;
VIEWS.settings=()=>({cls:'grouped',html:navHTML({title:t('app_settings')})+`<div class="scroll"><h1 class="lt">${t('app_settings')}</h1><div class="srch">${G.search}${t('search')}</div>
 <div class="group" style="margin-bottom:22px"><div class="row" style="min-height:76px"><span style="width:58px;height:58px;border-radius:50%;background:linear-gradient(#a8aeb8,#7f858f);color:#fff;font-size:24px;font-weight:600;display:grid;place-items:center">${OWNER_INITIAL}</span><div style="flex:1"><b style="font-size:20px;font-weight:500">${esc(OWNER)}</b><div class="muted" style="font-size:13px">${t('acct')}</div></div>${G.chevR}</div></div>
 <div class="group" style="margin-bottom:22px">${sRow('#ff9500','<svg viewBox="0 0 24 24"><path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0v5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5Z" fill="#fff"/></svg>',t('airplane'),sw(false))}${sRow('#007aff','<svg viewBox="0 0 16 12"><path fill="#fff" d="M8 2.3c2.3 0 4.4.9 6 2.4l1.2-1.2A10.3 10.3 0 0 0 8 .6 10.3 10.3 0 0 0 .8 3.5L2 4.7a8.6 8.6 0 0 1 6-2.4Zm0 3.4c1.4 0 2.6.5 3.6 1.4l1.2-1.2A6.8 6.8 0 0 0 8 4a6.8 6.8 0 0 0-4.8 1.9l1.2 1.2c1-.9 2.2-1.4 3.6-1.4Zm0 3.4c-.6 0-1.2.2-1.6.6L8 11.3l1.6-1.6c-.4-.4-1-.6-1.6-.6Z"/></svg>','Wi-Fi','wb_home_5G')}${sRow('#007aff','<svg viewBox="0 0 24 24"><path d="m7 7 10 10-5 4V3l5 4L7 17" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>','Bluetooth',t('on'))}${sRow('#34c759','<svg viewBox="0 0 24 24"><path d="M12 4v16M7 9v11M17 7v13M2 13v7M22 11v9" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>',t('cellular'))}${sRow('#34c759','<svg viewBox="0 0 24 24"><rect x="3" y="7" width="16" height="10" rx="2.5" fill="none" stroke="#fff" stroke-width="2"/><rect x="5.5" y="9.5" width="8" height="5" rx="1" fill="#fff"/></svg>',t('battery'),'64%')}</div>
 <div class="group" style="margin-bottom:22px">${sRow('#8e8e93','gear',t('general'))}${sRow('#007aff','person',t('access'))}${sRow('#8e8e93','camera',t('camera'))}${sRow('#32ade6','photo',t('wallpaper'))}${sRow('#8e8e93','search',t('search'))}</div>
 <div class="group" style="margin-bottom:22px">${sRow('#ff3b30','bellF',t('notif'))}${sRow('#ff2d55','speaker',t('sound'))}${sRow('#5856d6','<svg viewBox="0 0 24 24"><path d="M15.5 3.5A8.5 8.5 0 1 0 20.5 15 7 7 0 0 1 15.5 3.5Z" fill="#fff"/></svg>',t('focus'))}${sRow('#5856d6','<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9h-9Z" fill="#fff"/><path d="M14 3.2V10h6.8A9 9 0 0 0 14 3.2Z" fill="#fff" opacity=".7"/></svg>',t('screenTime'),'',"push('screentime')")}</div>
 <div class="group" style="margin-bottom:22px">${sRow('#34c759','<svg viewBox="0 0 24 24"><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 16c1.5 1 3.5 1 5 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',t('faceid'))}${sRow('#007aff','<svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="#fff" stroke-width="2"/><rect x="5" y="11" width="14" height="10" rx="2" fill="#fff"/></svg>',t('privacy'))}</div></div>`});
VIEWS.screentime=()=>{const apps=[['instagram',t('hm',2,41),100],['kakao',t('hm',1,52),70],['music',t('mOnly',58),36],['photos',t('mOnly',31),19],['safari',t('mOnly',22),14]].map(a=>[a[0],t('app_'+a[0]),a[1],a[2]]);
 return{cls:'grouped',html:navHTML({title:t('screenTime'),back:t('app_settings')})+`<div class="scroll"><h1 class="lt">${t('screenTime')}</h1>
 <div class="gh" style="margin-top:8px">${t('wonbinsIphone')}</div><div class="group" style="padding:14px 16px"><div class="muted" style="font-size:13px">${t('dailyAvg')}</div><div style="font-size:28px;font-weight:600">${t('hm',6,48)}</div><div class="muted" style="font-size:13px">${t('upPct',32)}</div>
 <div class="bars">${[55,62,48,70,83,77,92].map(v=>`<i style="height:${v}%"></i>`).join('')}</div><div style="display:flex;justify-content:space-between;padding:4px 16px 0;font-size:11px;color:#8e8e93">${wdNarrow().map(d=>`<span>${d}</span>`).join('')}</div></div>
 <div class="gh">${t('mostUsed')}</div><div class="group">${apps.map(a=>`<div class="row" style="--inset:58px;min-height:54px"><span style="width:30px;height:30px;border-radius:7px;overflow:hidden;flex:none">${appIcon(a[0])}</span><div style="flex:1"><div style="font-size:16px">${a[1]}</div><div style="height:5px;border-radius:3px;background:#007aff;width:${a[3]}%;margin-top:5px;opacity:.85"></div></div><span class="muted" style="font-size:15px">${a[2]}</span></div>`).join('')}</div>
 <div class="gh">${t('pickups')}</div><div class="group"><div class="row"><span style="flex:1">${t('firstPickup')}</span><span class="muted">${fmtTime(7*60+2)}</span></div><div class="row"><span style="flex:1">${t('avgPickups')}</span><span class="muted">${t('pickN',143)}</span></div><div class="row"><span style="flex:1">${t('firstUsed')}</span><span class="muted">Instagram</span></div></div>
 <div class="gh">${t('notifSec')}</div><div class="group"><div class="row"><span style="flex:1">${t('app_kakao')}</span><span class="muted">${t('perDay',41)}</span></div></div><div style="height:30px"></div></div>`}};

/* ============================================================
   电话 (엔딩)
   ============================================================ */
function startRing(){ringOnce();clearInterval(ringIv);ringIv=setInterval(()=>{ringOnce();vib([400,250,400])},2600);vib([400,250,400])}
function stopRing(){clearInterval(ringIv);ringIv=null;clearTimeout(ringTo);try{navigator.vibrate&&navigator.vibrate(0)}catch(e){}}
function incomingCall(){callName=LIVE_PARTNER_CLI;callDir='in';callPrev=view;callState='ring';if(nowSong>=0||PLAYER.dataset.voice)PLAYER.pause();APP.querySelectorAll('video').forEach(v=>v.pause());OV.querySelectorAll('.banner').forEach(b=>b.remove());renderCall();startRing();ringTo=setTimeout(missCall,30000)}
function callTop(){const sh=callName===LIVE_PARTNER_CLI;return `<div class="cav">${sh?'<img src="'+IMG.partnerAvatar+'" alt="">':/^[0-9*-]+$/.test(callName)?`<span style="width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(#a5abb6,#7f858f)">${G.sil.replace('<svg','<svg width="64"')}</span>`:`<span style="width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(#a5abb6,#7f858f);font-size:42px;font-weight:500">${esc([...dn(callName)][0]||'?')}</span>`}</div><div class="cnm">${esc(dn(callName))}</div>`}
function renderCall(){let c=OV.querySelector('.call');if(!c){c=document.createElement('div');c.className='call';OV.appendChild(c);c.animate([{opacity:0,transform:'scale(1.05)'},{opacity:1,transform:'none'}],{duration:380,easing:'cubic-bezier(.2,.9,.25,1)'})}
 setStatus(true);const locked=['lock','pin'].includes(callPrev);c.classList.toggle('act',callState!=='ring');
 if(callState==='ring'){c.innerHTML=callTop()+`<div class="csub">${t('mobile')}</div>`+(locked?`<div class="ring-top"><div class="cb"><span class="cc" style="width:50px;height:50px">${G.bellF}</span>${t('remind')}</div><div class="cb"><span class="cc" style="width:50px;height:50px">${G.msgF}</span>${t('message2')}</div></div><div class="slider" id="slider"><div class="kn">${G.handset}</div><span>${t('slideAnswer')}</span></div>`:
  `<div class="ring-top"><div class="cb"><span class="cc" style="width:50px;height:50px">${G.bellF}</span>${t('remind')}</div><div class="cb"><span class="cc" style="width:50px;height:50px">${G.msgF}</span>${t('message2')}</div></div><div class="ring"><button class="cb red" onclick="declineCall()"><span class="cc"><span style="display:block;transform:rotate(135deg)">${G.handset}</span></span>${t('decline')}</button><button class="cb grn" onclick="answerCall()"><span class="cc">${G.handset}</span>${t('accept')}</button></div>`);
  if(locked)wireSlider()}
 else{const B=[['speaker',t('speaker')],['videoF','FaceTime'],['muteF',t('mute')],['plusF',t('addCall')],['end',t('endCall')],['keypadF',t('keypad')]];
  const dl=callState==='dialing';c.innerHTML=callTop()+`<div class="csub" id="ctime">${dl?t('calling'):'00:00'}</div>${dl?'':`<div class="cap" id="cap"><small>${t('liveCap')}</small>…</div>`}<div class="cgrid">${B.map(([i,l])=>i==='end'?`<button class="cb red" onclick="endCall()"><span class="cc"><span style="display:block;transform:rotate(135deg)">${G.handset}</span></span>${l}</button>`:`<button class="cb" onclick="${i==='videoF'||i==='plusF'?'':"this.classList.toggle('on');vib(8)"}"><span class="cc">${G[i]}</span>${l}</button>`).join('')}</div>`;
  if(!dl)c.querySelector('.cav').animate([{transform:'scale(1)'},{transform:'scale(.82)'}],{duration:400,fill:'forwards',easing:'cubic-bezier(.2,.9,.25,1)'})}}
function wireSlider(){const s=$('#slider'),k=s.querySelector('.kn'),lab=s.querySelector('span');let x0=null,dx=0;const max=s.clientWidth-k.clientWidth-12;
 k.addEventListener('pointerdown',e=>{x0=e.clientX;k.setPointerCapture(e.pointerId)});k.addEventListener('pointermove',e=>{if(x0===null)return;dx=Math.max(0,Math.min(max,(e.clientX-x0)/SC));k.style.transform=`translateX(${dx}px)`;lab.style.opacity=1-dx/max});
 k.addEventListener('pointerup',()=>{if(x0===null)return;x0=null;if(dx>max*.75){answerCall()}else{k.animate([{transform:`translateX(${dx}px)`},{transform:'none'}],{duration:300,easing:'cubic-bezier(.2,1.3,.4,1)'});k.style.transform='';lab.style.opacity=1}})}
function answerCall(){if(callDir==='in'){curScript=speech;isEnding=true}stopRing();stopRingback();vib(20);callState='active';callStart=Date.now();capIdx=-1;renderCall()}
function declineCall(){stopRing();callState='';declined++;extraCalls.unshift([LIVE_PARTNER_CLI,'今天 '+new Date().getHours()+':'+pad(new Date().getMinutes()),'부재중']);afterDecline();closeCallUI()}
function missCall(){if(callState!=='ring')return;stopRing();callState='';declined++;extraCalls.unshift([LIVE_PARTNER_CLI,'今天 '+new Date().getHours()+':'+pad(new Date().getMinutes()),'부재중']);afterDecline();closeCallUI();if(['lock','pin'].includes(view)){lockNotes.unshift({title:t('missedCall'),body:LIVE_PARTNER_CLI,app:'phone',time:t('now')});renderLock()}}
function endCall(){if(callState==='dialing'){clearCallTimers();stopRingback();callState='';extraCalls.unshift([callName,'今天 '+new Date().getHours()+':'+pad(new Date().getMinutes()),'발신']);closeCallUI();if(view==='phone')show('phone');return}
 if(callState!=='active')return;callState='ended';vib(15);const t=$('#ctime');if(t)t.textContent=t_('callEnded');const c=OV.querySelector('.call');c&&c.querySelectorAll('.cb').forEach(b=>b.style.opacity=.4);
 extraCalls.unshift([callName,'今天 '+new Date().getHours()+':'+pad(new Date().getMinutes()),callDir==='out'?'발신':'수신']);if(isEnding)phoneDone=true;isEnding=false;setTimeout(()=>{callState='';closeCallUI();if(view==='phone')show('phone')},1100)}
/* 소희 电话를 거절/놓쳤을 때: 카톡으로 다시 걸어달라고 하고, 90초 뒤 다시 걸어옴 */
function afterDecline(){nextCallAt=elapsed()+90;if(declineSent)return;declineSent=true;CALL_DECLINED.forEach((m,k)=>setTimeout(()=>incomingMsg(m),3000+k*2600))}
/* 플레이어가 거는 电话 */
let callDir='in',curScript=null,isEnding=false;
function clearCallTimers(){callTimers.forEach(clearTimeout);callTimers=[]}
function startRingback(){const r=()=>{tone(440,0,1,.05);tone(480,0,1,.05)};r();clearInterval(rbIv);rbIv=setInterval(r,3000)}
function stopRingback(){clearInterval(rbIv);rbIv=null}
function dial(name){if(callState)return;callName=name;callDir='out';callPrev=view;callState='dialing';if(nowSong>=0||PLAYER.dataset.voice)PLAYER.pause();renderCall();startRingback();vib(10);
 const ready=askedCall||elapsed()>=CALL_ASK_AT;const pick=(sc,ms,end)=>{callTimers.push(setTimeout(()=>{if(callState!=='dialing')return;curScript=sc;isEnding=!!end;answerCall()},ms))};
 if(name===LIVE_PARTNER_CLI&&!phoneDone&&ready)pick(speech,4200,true);
 else if(name===LIVE_PARTNER_CLI&&phoneDone)pick((typeof PHONE_AFTER!=='undefined'?PHONE_AFTER:speech),6000);
 else if(name===LIVE_PARTNER_CLI){callTimers.push(setTimeout(()=>{if(callState!=='dialing')return;rejectOut(t('callEnded'));if(!busySent){busySent=true;CALL_BUSY.forEach((m,k)=>setTimeout(()=>incomingMsg(m),2500+k*2600))}},3500))}
 else if(OTHER_CALLS[name])pick(OTHER_CALLS[name],/^0/.test(name)?1800:3000+Math.random()*3000);
 else{callTimers.push(setTimeout(()=>{if(callState==='dialing')rejectOut(t('noAnswer'))},9000))}}
function rejectOut(msg){stopRingback();clearCallTimers();const t=$('#ctime');if(t)t.textContent=msg;tone(480,0,.25,.05);tone(480,.35,.25,.05);tone(480,.7,.25,.05);extraCalls.unshift([callName,'今天 '+new Date().getHours()+':'+pad(new Date().getMinutes()),'발신']);callState='ended';
 const c=OV.querySelector('.call');c&&c.querySelectorAll('.cb').forEach(b=>b.style.opacity=.4);setTimeout(()=>{callState='';closeCallUI();if(view==='phone')show('phone')},1300)}
function closeCallUI(){const c=OV.querySelector('.call');if(!c)return;c.animate([{opacity:1},{opacity:0,transform:'scale(1.04)'}],{duration:320,fill:'forwards'}).onfinish=()=>{c.remove();setStatus(viewDark());updateIsland();if(view==='home')renderHome()}}

/* ============================================================
   主循环 / 启动
   ============================================================ */
let lastMin=-1;
function tick(){typeof updateCrumb==="function"&&updateCrumb();const now=new Date();$('#sbt').textContent=clock12();const lk=$('#lkt');if(lk)lk.textContent=clock12();
 if(now.getMinutes()!==lastMin){lastMin=now.getMinutes();if(view==='home'&&!HOME.getAnimations().length)renderHome()}
 const e=elapsed();
 if(AUTO_ON&&LIVE_PARTNER_CLI){
 if(e>=40&&incoming===0){incoming=1;incomingMsg(INCOMING[0])}
 if(e>=43.5&&incoming===1){incoming=2;incomingMsg(INCOMING[1])}
 if(e>=CALL_ASK_AT&&incoming>=2&&!askedCall&&!replyBusy&&!typing){askedCall=true;replyStage=liveReplies.length;lineIdx=0;pendingText='';setTimeout(()=>{liveReplies.push({mine:CALL_ASK_REPLY,them:[]});replyStage=liveReplies.length-1;lineIdx=0},CALL_ASK.length*2600+1700);nextCallAt=Math.max(nextCallAt,e+CALL_ASK.length*2.6+30);CALL_ASK.forEach((m,k)=>setTimeout(()=>incomingMsg(m),k*2600))}
 if(askedCall&&e>=Math.max(nextCallAt,CALL_AT)&&!phoneDone&&!callState)incomingCall();
 }
 if(callState==='active'){const sec=Math.floor((Date.now()-callStart)/1000);const tm=$('#ctime');if(tm)tm.textContent=pad(Math.floor(sec/60))+':'+pad(sec%60);
  const S=curScript||speech;const idx=Math.min(S.length-1,Math.floor(sec/3));if(idx!==capIdx){capIdx=idx;const c=$('#cap');if(c){c.animate([{opacity:.2,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:280});c.innerHTML=`<small>${esc(dn(S[idx][0]))}</small>${esc(S[idx][1])}`}}
  if(sec>S.length*3+2)endCall()}}
function fit(){const ph=$('#phone');const mob=innerWidth<=540;ph.classList.toggle('mob',mob);ph.classList.toggle('short',mob&&innerHeight<740);if(mob){ph.style.width=innerWidth+'px';ph.style.height=innerHeight+'px';ph.style.transform='';SC=1}else{ph.style.width='393px';ph.style.height='852px';SC=Math.min((innerHeight-40)/852,(innerWidth-40)/393,1.1);ph.style.transform=`scale(${SC})`}}
addEventListener('resize',fit);fit();renderLock();renderHome();setStatus(true);setInterval(tick,250);tick();
