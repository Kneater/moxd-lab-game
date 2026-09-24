import * as THREE from 'three';
import {createSolderState,selectJoint,beginContact,tickSolder,releaseContact,cancelContact,driftAt,PAD_RADII,ACTIVE_PHASES} from './solder-state.js';
import {SOLDER_PADS} from './solder-scene.js';
const $=id=>document.getElementById(id),SAVE_KEY='moxd-lab-solder-v1';
export function createSolderUI(view,{leave,tone}){
 let state=createSolderState(),ready=false,active=false,saved=false,held=false,latched=false,pointerId=null,lastPhase='',inTarget=true;
 const surface=$('solder-surface'),aim=SOLDER_PADS[0].clone(),tip=aim.clone(),offset=new THREE.Vector3(),ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.084),arrows=new Set();
 const buttons=Array.from({length:4},(_,i)=>{
  const b=document.createElement('button');b.className='solder-pad';b.textContent=i+1;b.setAttribute('aria-label',`Lötpunkt ${i+1} auswählen`);
  b.onclick=()=>{if(ready&&selectJoint(state,i)){aim.copy(SOLDER_PADS[i]);offset.set(0,0,0);render();surface.focus({preventScroll:true});}};$('solder-pads').append(b);return b;
 });
 function usable(){return active&&ready&&$('help-modal').hidden&&!document.hidden;}
 function hit(e){
  const r=$('world').getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),view.camera);
  const p=ray.ray.intersectPlane(plane,new THREE.Vector3());if(p){p.x=THREE.MathUtils.clamp(p.x,-1,1);p.z=THREE.MathUtils.clamp(p.z,-.6,.65);}return p;
 }
 function begin(){if(!usable()||Math.hypot(aim.x-SOLDER_PADS[state.selected].x,aim.z-SOLDER_PADS[state.selected].z)>.065||!beginContact(state))return false;held=true;lastPhase='';render();return true;}
 function release(){held=false;latched=false;pointerId=null;releaseContact(state);render();}
 function cancel(){held=false;latched=false;pointerId=null;arrows.clear();offset.set(0,0,0);cancelContact(state);if(active)render();}
 surface.addEventListener('pointermove',e=>{if(!usable())return;const p=hit(e);if(p)aim.copy(p).add(offset);});
 surface.addEventListener('pointerdown',e=>{
  if(!usable()||e.button!==0)return;e.preventDefault();surface.focus({preventScroll:true});
  const p=hit(e);if(!p)return;
  if(latched){aim.copy(p);return;}
  if(held||state.phase==='cooling')return;
  const distances=SOLDER_PADS.map((pad,i)=>state.joints[i]==='good'?Infinity:pad.distanceTo(p));const i=distances.indexOf(Math.min(...distances));
  if(distances[i]>.065){$('solder-instruction').textContent='Setze die Spitze auf einen der vier goldenen Kontakte.';return;}
  if(!selectJoint(state,i))return;
  offset.copy(SOLDER_PADS[i]).sub(p);aim.copy(SOLDER_PADS[i]);
  if(begin()){pointerId=e.pointerId;surface.setPointerCapture(e.pointerId);}
 });
 surface.addEventListener('pointerup',e=>{if(e.pointerId===pointerId&&!latched){release();if(surface.hasPointerCapture(e.pointerId))surface.releasePointerCapture(e.pointerId);offset.set(0,0,0);}});
 surface.addEventListener('pointercancel',cancel);surface.addEventListener('lostpointercapture',()=>{if(held&&!latched)cancel();});
 window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 window.addEventListener('keydown',e=>{
  if(!usable()||e.target.matches('input,a')||(!surface.contains(e.target)&&e.target!==$('world')&&e.target!==document.body))return;
  if(e.code==='Space'){e.preventDefault();if(e.repeat)return;if(held)release();else{offset.set(0,0,0);if(begin())latched=true;}}
  if(e.code.startsWith('Arrow')){e.preventDefault();arrows.add(e.code);}
 });window.addEventListener('keyup',e=>arrows.delete(e.code));
 function render(){
  const quality=state.joints[state.selected],count=state.joints.filter(j=>j==='good').length;
  const messages={ready:'Führe die Spitze zum goldenen Kontakt. Linke Maustaste halten und die Drift im Zielkreis ausgleichen.',heating:inTarget?'Ruhig halten. Der Kontakt erwärmt sich.':'Zurück in den Zielkreis! Ohne Kontakt kühlt die Stelle ab.',feeding:'Lötzinn fließt automatisch zu. Halte die Spitze weiter im Kreis.',withdrawing:'Das Lötzinn wird zurückgezogen. Noch kurz ruhig halten.',release:'Jetzt loslassen und den Lötkolben abheben!',cooling:'Die Lötstelle kühlt aus …',result:quality==='good'?'Sauber verbunden! Weiter zum nächsten Kontakt.':state.reason==='overheated'?'Zu lange gehalten. Setze erneut an und hebe nach der Zinnzufuhr ab.':state.reason==='drift'?'Kontakt verloren. Erneut ansetzen und die Drift ausgleichen.':'Zu früh abgehoben. Halte bis zum Signal „Loslassen“.'};
  $('solder-progress').textContent=`${count} / 4 Kontakte verbunden`;
  $('solder-instruction').textContent=!ready?'Die Werkbank wird geladen …':state.completed?'Alle vier Kontakte leiten. Deine LED leuchtet!':messages[state.phase];
  $('solder-finish').hidden=!state.completed;
  $('solder-summary').textContent=state.completed?`Ruhige Hand: ${Math.round(state.scores.reduce((a,b)=>a+b,0)/4)} % · ${state.attempts} Versuche`:`Kontakt ${state.selected+1} · ${state.attempts} ${state.attempts===1?'Versuch':'Versuche'}`;
  $('solder-tip').textContent=state.completed?'Mission abgeschlossen · Auf diesem Gerät gespeichert.':'Alternative: Kontakt wählen · Leertaste hält / löst · Pfeiltasten korrigieren';
  buttons.forEach((b,i)=>{b.disabled=!ready||held||state.phase==='cooling'||state.joints[i]==='good'||state.completed;b.classList.toggle('selected',i===state.selected);b.classList.toggle('done',state.joints[i]==='good');b.setAttribute('aria-pressed',String(i===state.selected));b.textContent=state.joints[i]==='good'?'✓':i+1;});
  surface.classList.toggle('holding',held);surface.setAttribute('aria-label',held?'Lötkolben halten: Maus oder Pfeiltasten zum Ausgleichen, Leertaste zum Abheben':'Lötkolben führen: Kontakt anklicken und gedrückt halten');
  if(state.completed&&!saved){saved=true;try{localStorage.setItem(SAVE_KEY,JSON.stringify({completed:true,version:2,attempts:state.attempts,precision:state.scores,completedAt:new Date().toISOString()}));}catch{}tone(true);}
 }
 $('solder-reset').onclick=()=>{cancel();state=createSolderState();saved=false;aim.copy(SOLDER_PADS[0]);render();};$('solder-leave').onclick=leave;$('solder-finish').onclick=leave;
 async function load(){ready=false;$('solder-retry').hidden=true;render();try{await view.load();ready=true;render();}catch(e){console.error(e);$('solder-instruction').textContent='Die Werkbank konnte nicht geladen werden. Bitte erneut versuchen.';$('solder-retry').hidden=false;}}
 $('solder-retry').onclick=load;
 function tick(dt){
  if(!ready)return;
  const p=state.phase,oldTarget=inTarget;
  const dx=(arrows.has('ArrowRight')?1:0)-(arrows.has('ArrowLeft')?1:0),dy=(arrows.has('ArrowDown')?1:0)-(arrows.has('ArrowUp')?1:0);
  // Screen-aligned keyboard movement uses the same camera projection as the mouse.
  if(dx||dy){const screen=aim.clone().project(view.camera),r=$('world').getBoundingClientRect();const result=hit({clientX:(screen.x*.5+.5)*r.width+r.left+dx*90*dt,clientY:(-screen.y*.5+.5)*r.height+r.top+dy*90*dt});if(result)aim.copy(result);}
  const drift=held?driftAt(state.selected,state.elapsed):{x:0,z:0};tip.copy(aim);tip.x+=drift.x;tip.z+=drift.z;
  const pad=SOLDER_PADS[state.selected];inTarget=Math.hypot(tip.x-pad.x,tip.z-pad.z)<=PAD_RADII[state.selected];
  tickSolder(state,dt,inTarget);
  if(p!==state.phase||oldTarget!==inTarget){if(state.phase==='result'){held=false;latched=false;pointerId=null;tone(state.joints[state.selected]==='good');}render();}
  view.update(state,dt,{tip,held,inTarget});
  for(const [id,point]of [['solder-aim-dot',aim],['solder-tip-dot',tip]]){const projected=point.clone().project(view.camera),el=$(id);el.hidden=!held;el.style.left=`${(projected.x*.5+.5)*innerWidth}px`;el.style.top=`${(-projected.y*.5+.5)*innerHeight}px`;}
  $('solder-tip-dot').classList.toggle('off-target',held&&!inTarget);
  $('heat-needle').style.left=`${state.heat*100}%`;$('heat-meter').setAttribute('aria-valuenow',Math.round(state.heat*100));
  const labels={ready:'SPITZE ANSETZEN',heating:inTarget?'RUHIG HALTEN':'DRIFT AUSGLEICHEN',feeding:'ZINN FLIESST',withdrawing:'ZINN ZIEHT SICH ZURÜCK',release:'JETZT LOSLASSEN',cooling:'KÜHLT AUS',result:state.completed?'GESCHAFFT':state.joints[state.selected]==='good'?'VERBUNDEN':'ERNEUT VERSUCHEN'};
  const label=labels[state.phase];if(lastPhase!==label){$('heat-status').textContent=label;$('heat-meter').setAttribute('aria-valuetext',label);lastPhase=label;}
  $('solder-control').dataset.phase=state.phase;
  $('steadiness').textContent=held?(inTarget?'● Im Zielkreis':'↔ Gegensteuern'):state.completed?'✓ LED leuchtet':'○ Bereit';$('steadiness').classList.toggle('off-target',held&&!inTarget);
  $('feed-fill').style.width=`${state.feed*100}%`;
  buttons.forEach((button,i)=>{const p=SOLDER_PADS[i].clone().project(view.camera);button.style.left=`${(p.x*.5+.5)*innerWidth}px`;button.style.top=`${(-p.y*.5+.5)*innerHeight}px`;});
 }
 return{enter(){active=true;load();},exit(){cancel();active=false;},cancel,tick,getState:()=>({...state,joints:[...state.joints],scores:[...state.scores],ready,held,inTarget})};
}
