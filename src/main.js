import {createPrintUI} from './print-ui.js';
import {PRINT_STATION,PRINT_APPROACH} from './print-state.js';
import {createSolderUI} from './solder-ui.js';
import {SOLDER_STATION,SOLDER_APPROACH} from './solder-scene.js';
import './style.css';
import{PLAYER_START,STATION_APPROACH,STATION_REACH,SLOT_SIZES,UI_ACCENT}from'./world-config.js';
import * as THREE from 'three';
import{createWorld,STATION,SLOT_POS,PIN_POS,PIN_COLORS}from'./scene.js';
import{PARTS,createState,placePart,connectPins,setDistance,isWarning,movePlayer}from'./game-state.js';
const $=id=>document.getElementById(id);
const SAVE_KEY='moxd-lab-abstandsmelder-v1';
let solderUI,printUI;
let mode='intro',state=createState(),selectedPart=null,ready=false,world,environment;
let missionDone=false,soundOn=false,audioContext=null,modalOpen=false;
let yaw=0,pitch=0,player={...PLAYER_START},keys=new Set(),looking=false,lastPointer={x:0,y:0};
let lastTime=performance.now(),feedbackTimer=0,transitionTimer=0,wasLocked=false;
try{missionDone=JSON.parse(localStorage.getItem(SAVE_KEY)||'null')?.completed===true;}catch{}
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const icons={
 chip:'<rect x="8" y="3" width="27" height="24" rx="3" fill="#246767"/><rect x="15" y="9" width="13" height="12" rx="1" fill="#a8c2a5"/><path d="M4 8h4m-4 6h4m-4 6h4M35 8h5m-5 6h5m-5 6h5" stroke="#c8e087" stroke-width="2"/>',
 sensor:'<rect x="3" y="7" width="39" height="19" rx="3" fill="#236487"/><circle cx="14" cy="14" r="8" fill="#adc6c5"/><circle cx="32" cy="14" r="8" fill="#adc6c5"/><circle cx="14" cy="14" r="5" fill="#233830"/><circle cx="32" cy="14" r="5" fill="#233830"/>',
 led:'<rect x="10" y="19" width="25" height="9" rx="2" fill="#37664b"/><path d="M18 22V13a6 6 0 0 1 12 0v9z" fill="#c8b5ef"/><path d="M14 5l-3-3m25 3 3-3M24 3V0" stroke="#c8b5ef"/>',
 temperature:'<rect x="7" y="14" width="30" height="14" rx="2" fill="#285b69"/><rect x="15" y="2" width="15" height="21" rx="3" fill="#82c2de"/><path d="M19 6v13m4-13v13m4-13v13" stroke="#32627a" stroke-width="2"/>'};
function announce(message,error=false){const el=$('feedback');el.textContent=message;el.classList.toggle('error',error);el.classList.add('visible');clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>el.classList.remove('visible'),error?6000:4200);}
function tone(success=true){if(!soundOn)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const osc=audioContext.createOscillator(),g=audioContext.createGain();osc.type='sine';osc.frequency.setValueAtTime(success?540:210,audioContext.currentTime);osc.frequency.exponentialRampToValueAtTime(success?820:140,audioContext.currentTime+.13);g.gain.setValueAtTime(.07,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.24);osc.connect(g).connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+.25);}catch{}}
function setMode(next){if(mode==='print'&&next!=='print')printUI?.exit();$('print-workshop').hidden=next!=='print';$('print-marker').hidden=next!=='walk';if(mode==='solder'&&next!=='solder')solderUI?.exit();mode=next;$('solder-workshop').hidden=next!=='solder';$('solder-marker').hidden=next!=='walk';document.body.classList.toggle('playing',next==='walk'||next==='pause');document.body.classList.toggle('workshop',next==='station'||next==='success'||next==='solder'||next==='print');$('welcome').hidden=next!=='intro';$('intro-index').hidden=next!=='intro';$('walk-hud').hidden=!(next==='walk'||next==='pause');$('crosshair').hidden=next!=='walk';$('pause').hidden=next!=='pause';$('workshop').hidden=!(next==='station'||next==='success');$('success').hidden=next!=='success';$('station-marker').hidden=next!=='walk';$('mode-label').textContent=next==='print'?'MISSION 03 / 3D-DRUCK':next==='solder'?'MISSION 02 / LÖTEN':next==='station'||next==='success'?'MISSION 01 / ABSTANDSMELDER':'INTERAKTIVES LABOR';if(next!=='walk'){keys.clear();looking=false;}}
function solderCompleted(){try{return solderUI?.getState().completed||JSON.parse(localStorage.getItem('moxd-lab-solder-v1')||'null')?.completed===true;}catch{return false;}}
function printCompleted(){try{return printUI?.getState().completed||JSON.parse(localStorage.getItem('moxd-lab-print-v1')||'null')?.completed===true;}catch{return false;}}
function updateBadge(){const done=Number(missionDone)+Number(solderCompleted())+Number(printCompleted());$('walk-objective').textContent=`${done} / 3 Stationen abgeschlossen`;$('mission-complete-mark').textContent=done===3?'✓':'';if(done===3)$('mission-complete-mark').style.color=UI_ACCENT;}
function lockMouse(){try{const result=$('world').requestPointerLock?.();result?.catch(()=>{});}catch{}}
function exitMouse(){if(document.pointerLockElement)document.exitPointerLock();}
function faceStation(){yaw=Math.atan2(player.x-STATION.x,player.z-STATION.z);pitch=Math.atan2(STATION.y-1.65,stationDistance());}
function startWalk(){if(!ready)return;if(mode==='intro'){player={...PLAYER_START};faceStation();}setMode('walk');updateBadge();lockMouse();$('world').focus({preventScroll:true});}
function pauseWalk(){if(mode!=='walk')return;setMode('pause');exitMouse();$('resume').focus({preventScroll:true});}
function stationDistance(){return Math.hypot(player.x-STATION.x,player.z-STATION.z);}
function stationInReach(){if(!world)return false;const forward=new THREE.Vector3();world.camera.getWorldDirection(forward);const to=STATION.clone().sub(world.camera.position).normalize();return stationDistance()<STATION_REACH&&forward.dot(to)>.30;}
function enterStation(){if(!ready||mode==='station'||mode==='success')return;setMode('station');world.workshop.loadKit();exitMouse();$('transition').classList.add('active');clearTimeout(transitionTimer);transitionTimer=setTimeout(()=>{$('transition').classList.remove('active');$('leave-station').focus({preventScroll:true});},reduceMotion?0:350);renderState();}
function returnLab(){const origin=mode;setMode('walk');modalOpen=false;exitMouse();player={...(origin==='print'?PRINT_APPROACH:origin==='solder'?SOLDER_APPROACH:STATION_APPROACH)};if(origin==='solder'||origin==='print'){const target=origin==='print'?PRINT_STATION:SOLDER_STATION;yaw=Math.atan2(player.x-target.x,player.z-target.z);pitch=-.5;}else faceStation();keys.clear();updateBadge();lockMouse();$('world').focus({preventScroll:true});}
function enterPrint(){if(!ready)return;setMode('print');exitMouse();printUI.enter();$('world').focus({preventScroll:true});}
function printInReach(){if(!world)return false;const forward=new THREE.Vector3();world.camera.getWorldDirection(forward);return Math.hypot(player.x-PRINT_STATION.x,player.z-PRINT_STATION.z)<1.65&&forward.dot(new THREE.Vector3(PRINT_STATION.x,PRINT_STATION.y,PRINT_STATION.z).sub(world.camera.position).normalize())>.5;}
function enterSolder(){if(!ready)return;setMode('solder');exitMouse();solderUI.enter();$('world').focus({preventScroll:true});}
function solderInReach(){if(!world)return false;const forward=new THREE.Vector3();world.camera.getWorldDirection(forward);return Math.hypot(player.x-SOLDER_STATION.x,player.z-SOLDER_STATION.z)<1.8&&forward.dot(SOLDER_STATION.clone().sub(world.camera.position).normalize())>.3;}
function restart(){state=createState();selectedPart=null;setMode('station');renderState();announce('Neue Runde. Wähle zuerst die drei passenden Bauteile.');}
function partAction(partId,slotId){if(mode!=='station'||state.step!==0)return;const result=placePart(state,partId,slotId);tone(result.ok);announce(result.message,!result.ok);if(result.ok)selectedPart=null;renderState();}
function pinAction(id){if(mode!=='station'||state.step!==1)return;if(state.pending===id){state.pending=null;renderPins();return;}if(!state.pending){state.pending=id;renderPins();return;}const result=connectPins(state,state.pending,id);state.pending=null;tone(result.ok);announce(result.message,!result.ok);renderState();}
function makeUI(){
 for(const part of PARTS){const button=document.createElement('button');button.className='part-card';button.dataset.part=part.id;button.draggable=true;button.setAttribute('aria-label',`${part.title}: ${part.detail}`);button.setAttribute('aria-pressed','false');button.innerHTML=`<svg viewBox="0 0 45 31" aria-hidden="true">${icons[part.icon]}</svg><strong>${part.title}</strong><small>${part.detail}</small>`;
  button.onclick=()=>{if(state.step!==0)return;selectedPart=part.id;renderCards();renderSlots();announce(`${part.title} ausgewählt. Wähle jetzt den passenden Steckplatz.`);};
  button.addEventListener('dragstart',e=>{selectedPart=part.id;e.dataTransfer.setData('text/plain',part.id);e.dataTransfer.effectAllowed='move';renderCards();renderSlots();});
  $('part-cards').append(button);
 }
 const slotNames={controller:'Controller',sensor:'Sensor',led:'LED-Ausgang'};
 for(const[id,pos]of Object.entries(SLOT_POS)){const button=document.createElement('button');button.className='slot-label';button.dataset.slot=id;button.setAttribute('aria-label',`${slotNames[id]}-Steckplatz`);button.innerHTML=`<span class="slot-index">＋</span>${slotNames[id]}`;button.onclick=()=>{if(selectedPart)partAction(selectedPart,id);else announce('Wähle zuerst ein Bauteil aus der Box.');};
  button.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';button.classList.add('drag-over');});button.addEventListener('dragleave',()=>button.classList.remove('drag-over'));button.addEventListener('drop',e=>{e.preventDefault();button.classList.remove('drag-over');partAction(e.dataTransfer.getData('text/plain')||selectedPart,id);});$('slot-labels').append(button);
  const zone=document.createElementNS('http://www.w3.org/2000/svg','polygon');zone.dataset.dropSlot=id;
  zone.onclick=button.onclick;
  zone.addEventListener('dragenter',e=>{e.preventDefault();zone.classList.add('drag-over');});
  zone.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';zone.classList.add('drag-over');});
  zone.addEventListener('dragleave',()=>zone.classList.remove('drag-over'));
  zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('drag-over');partAction(e.dataTransfer.getData('text/plain')||selectedPart,id);});
  $('slot-drop-zones').append(zone);
 }
 const pinNames={'5v':'5V',ground:'GND',d2:'D2',vcc:'VCC',gnd:'GND',sig:'SIG'};
 for(const id of Object.keys(PIN_POS)){const button=document.createElement('button');button.className='pin-button';button.dataset.pin=id;button.textContent=pinNames[id];button.style.setProperty('--pin-color',PIN_COLORS[id]);button.setAttribute('aria-label',`${['5v','ground','d2'].includes(id)?'Controller':'Sensor'} ${pinNames[id]}`);button.onclick=()=>pinAction(id);$('pin-labels').append(button);}
}
function renderCards(){for(const el of document.querySelectorAll('[data-part]')){el.classList.toggle('selected',el.dataset.part===selectedPart);el.setAttribute('aria-pressed',String(el.dataset.part===selectedPart));el.classList.toggle('used',Object.values(state.placed).includes(el.dataset.part));el.disabled=Object.values(state.placed).includes(el.dataset.part);}}
function renderSlots(){for(const el of document.querySelectorAll('[data-slot]')){const filled=Boolean(state.placed[el.dataset.slot]);el.hidden=state.step!==0||filled;el.classList.toggle('available',Boolean(selectedPart));}for(const zone of document.querySelectorAll('[data-drop-slot]')){zone.style.display=state.step!==0||state.placed[zone.dataset.dropSlot]?'none':'';}}
function renderPins(){for(const el of document.querySelectorAll('[data-pin]')){const connected=state.wires.some(w=>w.includes(el.dataset.pin));el.hidden=state.step!==1;el.classList.toggle('connected',connected);el.classList.toggle('selected',state.pending===el.dataset.pin);el.setAttribute('aria-pressed',String(state.pending===el.dataset.pin));el.disabled=connected;}}
function renderState(){if(!world)return;renderCards();renderSlots();renderPins();world.workshop.update(state);
 for(const el of document.querySelectorAll('[data-step]')){el.classList.toggle('active',Number(el.dataset.step)===state.step);el.classList.toggle('done',Number(el.dataset.step)<state.step);el.setAttribute('aria-current',Number(el.dataset.step)===state.step?'step':'false');}
 $('inventory').hidden=state.step!==0;$('wiring-help').hidden=state.step!==1;$('test-panel').hidden=state.step!==2;
 $('task-kicker').textContent=`SCHRITT 0${state.step+1} / 03`;
 const content=[['Was braucht dein<br>Abstandsmelder?','Wähle ein Bauteil und dann seinen Steckplatz. Du kannst es auch direkt hinziehen.','Ein Sensor erfasst seine Umgebung. Der Controller verarbeitet das Signal. Die LED macht es sichtbar.'],['Gib dem Sensor<br>eine Verbindung.','Wähle einen Pin am Sensor und dann den passenden Pin am Controller.','VCC → 5V liefert Strom. GND → GND verbindet die Masse. SIG → D2 überträgt das Signal. Die LED sitzt bereits im vorbereiteten Ausgang.'],['Wie nah ist<br>zu nah?','Bewege das Testobjekt. Unter 30 cm muss die LED rot leuchten, ab 30 cm grün.','Dies ist eine vereinfachte Lernschaltung. Im echten Aufbau hängen Anschlüsse und Spannungen vom verwendeten Modul ab.']][state.step];
 $('task-title').innerHTML=content[0];$('task-description').textContent=content[1];$('learning-note').textContent=content[2];
 const checks=state.step===0?[['Controller',state.placed.controller],['Abstandssensor',state.placed.sensor],['LED-Modul',state.placed.led]]:state.step===1?[['VCC → 5V',state.wires.some(w=>w.includes('vcc'))],['GND → GND',state.wires.some(w=>w.includes('gnd'))],['SIG → D2',state.wires.some(w=>w.includes('sig'))]]:[['Warnung unter 30 cm',state.nearTested],['Freier Abstand ab 30 cm',state.farTested]];
 $('task-checks').innerHTML=checks.map(([label,done])=>`<div class="check-item ${done?'done':''}">${label}</div>`).join('');renderDistance();
}
function renderDistance(){const warning=isWarning(state.distance);$('distance').value=state.distance;$('distance-value').textContent=state.distance;$('sensor-status').textContent=warning?'● Zu nah · Warnung':'● Abstand frei';$('sensor-status').classList.toggle('warning',warning);$('finish').hidden=!state.completed;$('test-progress').textContent=state.completed?'Beide Fälle bestanden. Dein Abstandsmelder funktioniert.':state.nearTested?'Warnung funktioniert. Teste jetzt mindestens 30 cm.':state.farTested?'Freier Abstand erkannt. Teste jetzt weniger als 30 cm.':'Prüfe beide Fälle: näher als 30 cm und mindestens 30 cm.';}
function completeMission(){if(!state.completed)return;missionDone=true;try{localStorage.setItem(SAVE_KEY,JSON.stringify({completed:true,version:1,completedAt:new Date().toISOString()}));}catch{}tone();setMode('success');$('return-lab').focus({preventScroll:true});updateBadge();}
$('print-direct').onclick=enterPrint;$('pause-print').onclick=enterPrint;$('walk-to-print').onclick=enterPrint;$('print-marker').onclick=()=>{if(printInReach())enterPrint();};
$('solder-direct').onclick=enterSolder;$('pause-solder').onclick=enterSolder;$('walk-to-solder').onclick=enterSolder;$('solder-marker').onclick=()=>{if(solderInReach())enterSolder();};
$('start').onclick=startWalk;$('direct-start').onclick=enterStation;$('walk-to-station').onclick=enterStation;$('pause-station').onclick=enterStation;$('resume').onclick=startWalk;
$('pause-home').onclick=()=>{setMode('intro');exitMouse();};$('home').onclick=e=>{e.preventDefault();setMode('intro');exitMouse();};
$('leave-station').onclick=returnLab;$('return-lab').onclick=returnLab;$('restart').onclick=restart;$('play-again').onclick=restart;$('finish').onclick=completeMission;
$('station-marker').onclick=()=>{if(stationDistance()<STATION_REACH)enterStation();else{setMode('pause');$('pause-title').textContent='Die Station wartet auf dich.';}};
$('undo-wire').onclick=()=>{if(state.step!==1)return;state.wires.pop();state.pending=null;renderState();announce('Die letzte Leitung wurde gelöst.');};
$('distance').oninput=e=>{const previous=state.completed;setDistance(state,e.target.value);world.workshop.distance(state.distance);renderDistance();$('task-checks').innerHTML=`<div class="check-item ${state.nearTested?'done':''}">Warnung unter 30 cm</div><div class="check-item ${state.farTested?'done':''}">Freier Abstand ab 30 cm</div>`;if(!previous&&state.completed)tone();};
$('sound').onclick=()=>{soundOn=!soundOn;$('sound').setAttribute('aria-pressed',String(soundOn));$('sound').setAttribute('aria-label',soundOn?'Spielklänge ausschalten':'Spielklänge einschalten');$('sound').innerHTML=`♪ <span>Ton ${soundOn?'an':'aus'}</span>`;if(soundOn)tone();};
$('help').onclick=()=>{modalOpen=true;solderUI?.cancel();printUI?.cancel();if(mode==='walk')pauseWalk();$('help-modal').hidden=false;exitMouse();$('close-help').focus();};$('close-help').onclick=()=>{modalOpen=false;$('help-modal').hidden=true;};$('reload').onclick=()=>location.reload();
window.addEventListener('keydown',e=>{if(modalOpen){if(e.code==='Escape'){$('help-modal').hidden=true;modalOpen=false;}return;}
 if(e.code==='Escape'){if(mode==='walk')pauseWalk();else if(mode==='station'||mode==='solder'||mode==='print')returnLab();return;}
 if(mode==='walk'){if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='KeyE'){if(printInReach())enterPrint();else if(solderInReach())enterSolder();else if(stationInReach())enterStation();}}
});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(mode==='walk')pauseWalk();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='walk')pauseWalk();});
document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===$('world');if(wasLocked&&!locked&&mode==='walk')pauseWalk();wasLocked=locked;});
document.addEventListener('mousemove',e=>{if(mode!=='walk'||modalOpen)return;if(document.pointerLockElement===$('world')){yaw-=e.movementX*.002;pitch-=e.movementY*.002;}else if(looking){yaw-=(e.clientX-lastPointer.x)*.003;pitch-=(e.clientY-lastPointer.y)*.003;lastPointer={x:e.clientX,y:e.clientY};}pitch=Math.max(-1.25,Math.min(1.25,pitch));});
$('world').addEventListener('pointerdown',e=>{if(mode!=='walk'||document.pointerLockElement)return;looking=true;lastPointer={x:e.clientX,y:e.clientY};$('world').setPointerCapture(e.pointerId);});$('world').addEventListener('pointerup',()=>looking=false);$('world').addEventListener('pointercancel',()=>looking=false);
window.addEventListener('resize',()=>world?.resize());
function project(position,camera,el){const p=position.clone().project(camera);el.style.left=`${(p.x*.5+.5)*innerWidth}px`;el.style.top=`${(-p.y*.5+.5)*innerHeight}px`;return p.z<1&&p.z>-1&&Math.abs(p.x)<1.1&&Math.abs(p.y)<1.1;}
function projectDropZones(){
 for(const zone of document.querySelectorAll('[data-drop-slot]')){
  const id=zone.dataset.dropSlot,center=SLOT_POS[id],[w,d]=SLOT_SIZES[id];
  const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>{
   const p=new THREE.Vector3(center.x+x*w/2,-.008,center.z+z*d/2).project(world.workshop.camera);
   return `${(p.x*.5+.5)*innerWidth},${(-p.y*.5+.5)*innerHeight}`;
  });zone.setAttribute('points',points.join(' '));
 }
}
function animate(now){requestAnimationFrame(animate);if(!world)return;const dt=Math.min((now-lastTime)/1000,.045);lastTime=now;
 if(mode==='walk'){
  let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);let side=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);const length=Math.hypot(forward,side)||1;forward/=length;side/=length;
  const speed=1.9*dt;player=movePlayer(player,(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed,(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed);
  world.camera.position.set(player.x,1.65,player.z);world.camera.rotation.set(pitch,yaw,0,'YXZ');
  const visible=project(STATION.clone().add(new THREE.Vector3(0,.22,0)),world.camera,$('station-marker'));$('station-marker').hidden=!visible;
  $('marker-distance').textContent=missionDone?'✓ Abgeschlossen':`${stationDistance().toFixed(1).replace('.',',')} m · ${stationDistance()<STATION_REACH?'E drücken':'Folge dem Symbol'}`;
  const solderVisible=project(SOLDER_STATION.clone().add(new THREE.Vector3(0,.25,0)),world.camera,$('solder-marker'));$('solder-marker').hidden=!solderVisible;
  $('solder-marker-distance').textContent=`${Math.hypot(player.x-SOLDER_STATION.x,player.z-SOLDER_STATION.z).toFixed(1).replace('.',',')} m · ${solderInReach()?'E drücken':solderCompleted()?'✓ Abgeschlossen':'Lötecke'}`;
  const printVisible=project(new THREE.Vector3(PRINT_STATION.x,PRINT_STATION.y+.22,PRINT_STATION.z),world.camera,$('print-marker'));$('print-marker').hidden=!printVisible;
  $('print-marker-distance').textContent=`${Math.hypot(player.x-PRINT_STATION.x,player.z-PRINT_STATION.z).toFixed(1).replace('.',',')} m · ${printInReach()?'E drücken':printCompleted()?'✓ Abgeschlossen':'3D-Drucker'}`;
  $('interaction-prompt').hidden=!(stationInReach()||solderInReach()||printInReach());$('interaction-prompt').querySelector('strong').textContent=printInReach()?'Dein Platinenhalter':solderInReach()?'Die perfekte Lötstelle':'Abstandsmelder bauen';$('interaction-prompt').querySelector('small').textContent=printInReach()?'Zeichnen · Drucken · Einpassen':solderInReach()?'Vier Kontakte · eine leuchtende LED':'Grüne Sensorbox · Raspberry';
 }
 if(mode==='intro'){world.camera.position.set(PLAYER_START.x,1.65,PLAYER_START.z);world.camera.lookAt(STATION);}
 if(mode==='print'){
  if(!modalOpen)printUI.tick(dt);world.renderer.render(world.printing.scene,world.printing.camera);
 }else if(mode==='solder'){
  if(!modalOpen)solderUI.tick(dt);world.renderer.render(world.solder.scene,world.solder.camera);
 }else if(mode==='station'||mode==='success'){
  projectDropZones();
  for(const el of document.querySelectorAll('[data-slot]'))project(SLOT_POS[el.dataset.slot],world.workshop.camera,el);
  for(const el of document.querySelectorAll('[data-pin]'))project(PIN_POS[el.dataset.pin],world.workshop.camera,el);
  if(!reduceMotion)world.workshop.signalRings.forEach((r,i)=>r.material.opacity=.20+.20*Math.sin(now*.003-i));
  world.renderer.render(world.workshop.scene,world.workshop.camera);
 }else{
  world.stationRing.material.opacity=reduceMotion?.7:.52+Math.sin(now*.002)*.22;world.stationOrb.rotation.y=now*.0008;
  world.renderer.render(world.scene,world.camera);
 }
}
async function init(){try{
 world=createWorld($('world'));printUI=createPrintUI(world.printing,{leave:returnLab,tone});solderUI=createSolderUI(world.solder,{leave:returnLab,tone});faceStation();makeUI();renderState();updateBadge();requestAnimationFrame(animate);
 environment=await world.load(progress=>{$('loading-bar').style.width=`${Math.round(progress*100)}%`;$('load-status').textContent=`Lab-Szene laden · ${Math.round(progress*100)} %`;});
 if(import.meta.env.DEV&&new URLSearchParams(location.search).get('review')==='bench'){
  player={x:1.08,z:-1.43};yaw=Math.PI;pitch=-.35;setMode('walk');
 }
 ready=true;$('print-direct').disabled=false;$('solder-direct').disabled=false;$('start').disabled=false;$('direct-start').disabled=false;$('start-label').textContent='Lab betreten';$('load-status').textContent='Bereit · Maus & Tastatur';$('loading-bar').style.width='100%';
 // Read-only diagnostics make errors and performance observable during development.
 window.moxdDiagnostics=()=>({mode,printing:printUI?.getState(),solder:solderUI?.getState(),step:state.step,placed:{...state.placed},wires:state.wires.map(w=>[...w]),distance:state.distance,completed:state.completed,player:{...player},ready,drawCalls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles});
 }catch(error){console.error(error);$('error-message').textContent='Die 3D-Szene konnte nicht geöffnet werden. Verwende einen aktuellen Browser mit WebGL und starte das Spiel über den lokalen Server. '+error.message;$('error-panel').hidden=false;}}
init();
