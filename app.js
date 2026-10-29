const $ = id => document.getElementById(id);
const ACTIVE_KEY = 'planilla-tma-active-v2';
const PREFS_KEY = 'planilla-tma-prefs-v2';
const TYPE_LABELS = {'8x3':'8 × 3','3x1-EAL':'3 × 1'};
const prefs = {executiveLead:10,assistantLead:5,sound:true,vibration:true,...read(PREFS_KEY,{})};
let data;
let selectedType = '8x3';
let draft = null;
let active = read(ACTIVE_KEY,null);
let blocks = [];
let alarms = [];
let alarmTimer = null;
let beepTimer = null;
let audioContext = null;

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function savePrefs(){localStorage.setItem(PREFS_KEY,JSON.stringify(prefs))}
function saveActive(){if(active)localStorage.setItem(ACTIVE_KEY,JSON.stringify(active));else localStorage.removeItem(ACTIVE_KEY)}
function nextShiftBase(now=new Date()){
  const minutes=now.getHours()*60+now.getMinutes();
  if(minutes<870)return new Date(now.getFullYear(),now.getMonth(),now.getDate(),7,30).getTime();
  if(minutes<1350)return new Date(now.getFullYear(),now.getMonth(),now.getDate(),15,0).getTime();
  return new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,7,30).getTime();
}
function toMinutes(hhmm){const [h,m]=hhmm.split(':').map(Number);return h*60+m}
function fmt(time){return new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit'}).format(new Date(time))}
function role(code){return code==='Libre'?'Libre':code[0]==='E'?'Ejecutivo':'Ayudante'}
function slot(code){return code==='Libre'?null:code.slice(-1)}
function templateSlots(type,number){return [...new Set(data.templates[type][number].map(b=>slot(b.code)).filter(Boolean))].sort()}
function makeBlocks(plan){return data.templates[plan.type][plan.number].map(entry=>({start:plan.baseMs+(toMinutes(entry.start)-900)*60000,end:plan.baseMs+(toMinutes(entry.end)-900)*60000,role:role(entry.code),sector:slot(entry.code)?plan.sectors[slot(entry.code)]:''}))}
function makeAlarms(items){const result=[];let previous=null;for(const item of items){let text='';let lead=0;if(item.role==='Ejecutivo'){text=`Ejecutivo ${item.sector}`;lead=Number(prefs.executiveLead)}else if(item.role==='Ayudante'&&previous?.role!=='Ejecutivo'){text=`Ayudante ${item.sector}`;lead=Number(prefs.assistantLead)}else if(item.role==='Libre'&&previous?.role==='Ayudante'){text=`Quitar tarjeta sector ${previous.sector}`;lead=Number(prefs.assistantLead)}if(text)result.push({id:`${item.start}-${text}`,at:item.start-lead*60000,start:item.start,text});previous=item}return result}
function showScreen(name){for(const id of ['homeScreen','sectorsScreen','planScreen'])$(id).classList.toggle('hidden',id!==name);$('backButton').classList.toggle('hidden',name==='homeScreen')}
function renderHome(){showScreen('homeScreen');$('templateTabs').replaceChildren();for(const type of Object.keys(TYPE_LABELS)){const tab=document.createElement('button');tab.className=`template-tab ${type===selectedType?'active':''}`;tab.type='button';tab.role='tab';tab.setAttribute('aria-selected',String(type===selectedType));tab.textContent=TYPE_LABELS[type];tab.addEventListener('click',()=>{selectedType=type;renderHome()});$('templateTabs').append(tab)}$('templateTitle').textContent=TYPE_LABELS[selectedType];$('templateHint').textContent='Elige el número de la hoja de firmas';$('numberButtons').replaceChildren();for(const number of Object.keys(data.templates[selectedType])){const button=document.createElement('button');button.type='button';button.textContent=number;button.setAttribute('aria-label',`Planilla número ${number}`);button.addEventListener('click',()=>beginSelection(selectedType,number));$('numberButtons').append(button)}}
function beginSelection(type,number){draft={type,number,baseMs:nextShiftBase(),slots:templateSlots(type,number),chosen:[]};renderSectors()}
function renderSectors(){showScreen('sectorsScreen');const remaining=draft.slots.length-draft.chosen.length;$('sectorTitle').textContent=draft.slots.length===1?'Escoge tu sector':`Escoge ${remaining===draft.slots.length?'tu primer sector':remaining===1?'el último sector':'el siguiente sector'}`;$('sectorHint').textContent=`Planilla ${draft.number} · ${TYPE_LABELS[draft.type]} · ${draft.chosen.length+1} de ${draft.slots.length}`;$('chosenSectors').replaceChildren();draft.slots.forEach((item,index)=>{const chip=document.createElement('span');chip.textContent=draft.chosen[index]||`S${item}`;if(!draft.chosen[index])chip.className='pending';$('chosenSectors').append(chip)});$('sectorButtons').replaceChildren();for(const sector of data.sectors){const button=document.createElement('button');button.type='button';button.textContent=sector;button.disabled=draft.chosen.includes(sector);button.addEventListener('click',()=>chooseSector(sector));$('sectorButtons').append(button)}}
function chooseSector(sector){draft.chosen.push(sector);if(draft.chosen.length<draft.slots.length){renderSectors();return}const sectors={};draft.slots.forEach((item,index)=>{sectors[item]=draft.chosen[index]});active={type:draft.type,number:draft.number,baseMs:draft.baseMs,sectors,fired:[]};draft=null;saveActive();renderPlan();unlockAudio();if('Notification'in window&&Notification.permission==='default')Notification.requestPermission().catch(()=>{})}
function renderPlan(){blocks=makeBlocks(active);alarms=makeAlarms(blocks);showScreen('planScreen');$('planType').textContent=TYPE_LABELS[active.type];$('planNumber').textContent=`N.º ${active.number}`;const chart=$('scheduleChart');chart.querySelectorAll('.chart-rows,.chart-end').forEach(el=>el.remove());const rows=document.createElement('div');rows.className='chart-rows';rows.style.height='calc(100% - 28px)';const total=blocks.at(-1).end-blocks[0].start;for(const block of blocks){const row=document.createElement('div');row.className='chart-row';row.style.height=`${(block.end-block.start)/total*100}%`;const time=document.createElement('span');time.className='chart-time';time.textContent=fmt(block.start);const roleBox=document.createElement('span');roleBox.className=`chart-block ${block.role==='Ejecutivo'?'executive':block.role==='Ayudante'?'assistant':'free'}`;roleBox.textContent=block.role==='Libre'?'Libre':`${block.role} ${block.sector}`;row.append(time,roleBox);rows.append(row)}const end=document.createElement('div');end.className='chart-end';end.textContent=fmt(blocks.at(-1).end);chart.append(rows,end);$('planImage').src=`./images/${active.type}.png`;updateTimeLine();saveActive()}
function updateTimeLine(){if(!active||!blocks.length)return;const now=Date.now();const start=blocks[0].start;const end=blocks.at(-1).end;const fraction=(now-start)/(end-start);const visible=fraction>=0&&fraction<=1;$('nowLine').classList.toggle('hidden',!visible);$('imageNowLine').classList.toggle('hidden',!visible);if(visible){$('nowLine').style.top=`calc((100% - 28px) * ${fraction})`;$('imageNowLine').style.left=`${(1-fraction)*100}%`}const upcoming=blocks.find(b=>b.start>now);const current=blocks.find(b=>b.start<=now&&b.end>now);$('planStatus').textContent=current?`Ahora: ${current.role}${current.sector?' '+current.sector:''} · Hasta las ${fmt(current.end)}`:upcoming?`Próximo tramo a las ${fmt(upcoming.start)}`:'Turno terminado'}
function cancelPlan(){closeAlarm();active=null;draft=null;blocks=[];alarms=[];saveActive();renderHome()}
function back(){if($('imageDialog').open){$('imageDialog').close();return}if($('settingsDialog').open){$('settingsDialog').close();return}if(!$('sectorsScreen').classList.contains('hidden')){draft=null;renderHome()}else if(!$('planScreen').classList.contains('hidden'))cancelPlan()}
function updatePreferences(){prefs.executiveLead=Number($('executiveLead').value);prefs.assistantLead=Number($('assistantLead').value);prefs.sound=$('soundAlarm').checked;prefs.vibration=$('vibrationAlarm').checked;savePrefs();if(active)alarms=makeAlarms(blocks)}
function unlockAudio(){if(!prefs.sound)return;try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume()}catch{}}
function beep(){if(!prefs.sound||!audioContext)return;try{const oscillator=audioContext.createOscillator();const gain=audioContext.createGain();oscillator.type='sine';oscillator.frequency.value=880;gain.gain.value=.08;oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+.25)}catch{}}
async function notify(alarm){if(!('Notification'in window)||Notification.permission!=='granted')return;try{if('serviceWorker'in navigator){const registration=await navigator.serviceWorker.ready;await registration.showNotification('Planilla',{body:alarm.text,icon:'./icon.svg',tag:alarm.id})}else new Notification('Planilla',{body:alarm.text})}catch{}}
function openAlarm(alarm){if($('alarmDialog').open)return;if($('settingsDialog').open)$('settingsDialog').close();if($('imageDialog').open)$('imageDialog').close();$('alarmText').textContent=alarm.text;$('alarmCountdown').textContent=`${fmt(alarm.start)} · ${Math.ceil((alarm.start-Date.now())/60000)} min para el relevo`;$('alarmDialog').showModal();beep();beepTimer=setInterval(beep,1200);if(prefs.vibration&&navigator.vibrate)navigator.vibrate([350,150,350]);notify(alarm);alarmTimer=setTimeout(closeAlarm,20000)}
function closeAlarm(){clearTimeout(alarmTimer);clearInterval(beepTimer);alarmTimer=null;beepTimer=null;if(navigator.vibrate)navigator.vibrate(0);if($('alarmDialog').open)$('alarmDialog').close()}
function checkAlarms(){if(!active)return;const now=Date.now();if(now>=blocks.at(-1).end){cancelPlan();return}updateTimeLine();if($('alarmDialog').open)return;for(const alarm of alarms){if(active.fired.includes(alarm.id)||now<alarm.at||now-alarm.at>60000)continue;active.fired.push(alarm.id);saveActive();openAlarm(alarm);break}}
async function init(){
  data=window.PLANILLA_DATA;
  if(!data)throw Error('No se pudieron cargar las planillas');
  $('executiveLead').value=String(prefs.executiveLead);
  $('assistantLead').value=String(prefs.assistantLead);
  $('soundAlarm').checked=!!prefs.sound;
  $('vibrationAlarm').checked=!!prefs.vibration;
  for(const id of ['executiveLead','assistantLead','soundAlarm','vibrationAlarm'])
    $(id).addEventListener('change',updatePreferences);
  $('backButton').addEventListener('click',back);
  $('cancelButton').addEventListener('click',cancelPlan);
  $('settingsButton').addEventListener('click',()=>{$('settingsDialog').showModal();unlockAudio()});
  $('scheduleChart').addEventListener('click',()=>$('imageDialog').showModal());
  $('scheduleChart').addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();$('imageDialog').showModal()}
  });
  $('closeImage').addEventListener('click',()=>$('imageDialog').close());
  $('imageDialog').querySelector('.image-frame').addEventListener('click',()=>$('imageDialog').close());
  $('dismissAlarm').addEventListener('click',closeAlarm);
  $('alarmDialog').addEventListener('cancel',event=>{event.preventDefault();closeAlarm()});
  document.addEventListener('pointerdown',unlockAudio,{once:true});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('alarmDialog').open)back()});
  if(active&&data.templates[active.type]?.[active.number]&&Object.values(active.sectors||{}).every(sector=>data.sectors.includes(sector))&&makeBlocks(active).at(-1).end>Date.now())renderPlan();
  else{active=null;saveActive();renderHome()}
  if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  setInterval(checkAlarms,1000);
  checkAlarms();
}
init().catch(error=>{console.error(error);$('homeScreen').innerHTML='<p class="intro">No se pudieron cargar las planillas. Recarga la página.</p>'});
