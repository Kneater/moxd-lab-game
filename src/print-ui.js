import * as THREE from 'three';
import {LEVELS,createPrintState,addDrawPoint,startPrint,tickPrint,tryFit,chooseLevel} from './print-state.js';
import {BED_Y} from './print-scene.js';
const $=id=>document.getElementById(id),SAVE_KEY='moxd-lab-print-v1',NS='http://www.w3.org/2000/svg';
export function createPrintUI(view,{leave,tone}){
 let s=createPrintState(),active=false,ready=false,drawing=false,dragging=false,paused=false,keyboardGrab=false,saved=false,issue=null,fitFeedback=null;
 const boardPosition=new THREE.Vector3(.56,.07,-.16),ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-(BED_Y+.065)),dragOffset=new THREE.Vector3();
 const svg=$('print-sketch'),surface=$('print-surface');
 function usable(){return active&&ready&&!document.hidden&&$('help-modal').hidden;}
 const levelButtons=LEVELS.map((level,i)=>{const b=document.createElement('button');b.className='print-level';b.textContent=level.label;b.onclick=()=>{if(chooseLevel(s,i)){cancel();paused=false;issue=null;view.clearHolder();boardPosition.set(.56,.07,-.16);render();}};$('print-levels').append(b);return b;});
 function sketchPoint(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return[q.x,q.y];}
 function drawUI(){
  const board=LEVELS[s.level],d=board.outline.map((p,i)=>`${i?'L':'M'}${p.join(' ')}`).join(' ')+' Z';
  $('print-board-shape').setAttribute('d',d);$('print-board-shape').setAttribute('fill',board.color);$('print-guide').setAttribute('d',d);
  const path=s.points.map((p,i)=>`${i?'L':'M'}${p.join(' ')}`).join(' ')+(s.closed?' Z':'');$('print-player-line').setAttribute('d',path);
  const dot=$('print-start-dot');dot.hidden=!s.points.length;dot.style.display=s.points.length?'':'none';if(s.points.length){dot.setAttribute('cx',s.points[0][0]);dot.setAttribute('cy',s.points[0][1]);}
  $('print-sketch-name').textContent=board.name;
  $('print-issue').style.display=issue?'':'none';if(issue){$('print-issue').setAttribute('cx',issue[0]);$('print-issue').setAttribute('cy',issue[1]);}
  const components=$('print-components');components.replaceChildren();
  const chip=document.createElementNS(NS,'rect');chip.setAttribute('x',s.level===2?232:275);chip.setAttribute('y',225);chip.setAttribute('width',42);chip.setAttribute('height',36);chip.setAttribute('rx',3);chip.setAttribute('fill','#192a30');components.append(chip);
  for(let j=0;j<7;j++){const pin=document.createElementNS(NS,'rect');pin.setAttribute('x',s.level===0?212:225);pin.setAttribute('y',175+j*17);pin.setAttribute('width',9);pin.setAttribute('height',8);pin.setAttribute('fill','#dabd7b');components.append(pin);}
 }
 function render(){
  const returning=!!fitFeedback;
  $('print-control').dataset.feedback=fitFeedback?.kind??'';
  const printing=s.phase==='printing',fit=s.phase==='fit',success=s.phase==='success';
  $('print-drawing').hidden=s.phase!=='draw';$('print-surface').hidden=!fit; $('print-grab').hidden=!fit||returning;
  $('print-pause').hidden=!printing;$('print-pause').textContent=paused?'Druck fortsetzen ▶':'Druck pausieren Ⅱ';
  $('print-revise').hidden=!(fit||success);$('print-revise').disabled=returning;$('print-next').hidden=!success||s.completed;$('print-finish').hidden=!s.completed;
  $('print-go').disabled=!ready||!s.closed;$('print-close').disabled=!ready||s.closed||s.points.length<3;
  $('print-trim').disabled=!ready||!s.points.length;$('print-clear').disabled=!ready||!s.points.length;
  $('print-status').textContent=!ready?'MODELL LADEN':printing?(paused?'DRUCK PAUSIERT':'DRUCKT DEINE KONTUR'):fit?(fitFeedback?.kind==='tight'?'ZU ENG':fitFeedback?.kind==='loose'?'ZU VIEL SPIEL':'PASSPROBE'):success?'PASST':'KONTUR ZEICHNEN';
  $('print-instruction').textContent=!ready?'Die Druckstation wird geladen …':s.feedback||(printing?'Der Druckkopf folgt deiner geglätteten Kontur. Druck im Zeitraffer.':fit?'Greife die Platine rechts und ziehe sie mittig in deinen gedruckten Halter.':success?'Dein Halter passt. Probiere die nächste Platinenform!':'Zeichne außen um die Platine. Der lila Hilfsrand lässt Platz für Wand und Spiel.');
  $('print-progress').textContent=`${s.passed.filter(Boolean).length} / 3 Halter passen`;
  $('print-level-name').textContent=LEVELS[s.level].name;
  $('print-summary').textContent=s.completed?'Alle drei Formen gemeistert!':`Entwurf ${s.level+1} · ${s.attempts} Druckversuche`;
  $('print-progress-track').hidden=!printing;
  levelButtons.forEach((b,i)=>{b.disabled=printing||!ready||returning;b.classList.toggle('active',s.level===i);b.setAttribute('aria-pressed',String(s.level===i));b.textContent=LEVELS[i].label+(s.passed[i]?' ✓':'');});
  if(s.phase==='draw')drawUI();
  if(s.completed&&!saved){saved=true;try{localStorage.setItem(SAVE_KEY,JSON.stringify({completed:true,attempts:s.attempts,completedAt:new Date().toISOString()}));}catch{}tone(true);}
 }
 svg.addEventListener('pointerdown',e=>{if(!usable()||s.phase!=='draw'||s.closed||e.button!==0)return;e.preventDefault();drawing=true;svg.setPointerCapture(e.pointerId);s.feedback='';addDrawPoint(s,sketchPoint(e));drawUI();});
 svg.addEventListener('pointermove',e=>{if(!drawing||!usable())return;const samples=e.getCoalescedEvents?.();for(const event of samples?.length?samples:[e])addDrawPoint(s,sketchPoint(event));drawUI();});
 svg.addEventListener('pointerup',()=>{drawing=false;render();});svg.addEventListener('pointercancel',()=>{drawing=false;render();});
 $('print-close').onclick=()=>{s.closed=true;s.feedback='';render();};
 $('print-trim').onclick=()=>{s.closed=false;s.points.splice(Math.max(0,s.points.length-(s.points.length>24?8:1)));s.feedback='';render();};
 $('print-clear').onclick=()=>{s.points=[];s.closed=false;s.feedback='';issue=null;render();};
 $('print-go').onclick=()=>{if(!ready)return;if(startPrint(s)){view.build(s.contour);paused=false;boardPosition.set(.56,.07,-.16);}render();};
 $('print-revise').onclick=()=>{s.phase='draw';s.feedback='Passe deinen Entwurf an. „Ende kürzen“ öffnet die Kontur wieder.';s.closed=false;render();};
 $('print-pause').onclick=()=>{paused=!paused;render();};
 $('print-next').onclick=()=>{const next=s.passed.findIndex(v=>!v);if(next>=0){chooseLevel(s,next);issue=null;boardPosition.set(.56,.07,-.16);view.clearHolder();render();}};
 $('print-reset').onclick=()=>{cancel();s=createPrintState();saved=false;paused=false;issue=null;view.clearHolder();boardPosition.set(.56,.07,-.16);render();};$('print-leave').onclick=leave;$('print-finish').onclick=leave;
 function worldPoint(e,height=BED_Y+.065){plane.constant=-height;const r=$('world').getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),view.camera);return ray.ray.intersectPlane(plane,new THREE.Vector3());}
 function release(){
  if(!dragging&&!keyboardGrab)return;dragging=false;keyboardGrab=false;
  const result=tryFit(s,boardPosition.x,boardPosition.z);s.feedback=result.message;
  if(result.ok){boardPosition.set(0,BED_Y+.004,0);issue=null;tone(true);}else{issue=result.point??issue;tone(false);fitFeedback={kind:result.kind,elapsed:0,from:boardPosition.clone()};}render();
 }
 surface.addEventListener('pointerdown',e=>{if(!usable()||fitFeedback||s.phase!=='fit'||e.button!==0)return;const p=worldPoint(e,boardPosition.y+.005);if(!p)return;
  if(keyboardGrab){boardPosition.copy(worldPoint(e));release();return;}
  if(Math.hypot(p.x-boardPosition.x,p.z-boardPosition.z)>.16)return;
  e.preventDefault();dragging=true;keyboardGrab=false;boardPosition.y=BED_Y+.065;dragOffset.copy(boardPosition).sub(p);dragOffset.y=0;surface.setPointerCapture(e.pointerId);
 });
 surface.addEventListener('pointermove',e=>{if((!dragging&&!keyboardGrab)||!usable())return;const p=worldPoint(e);if(p){boardPosition.copy(p);if(dragging)boardPosition.add(dragOffset);boardPosition.x=THREE.MathUtils.clamp(boardPosition.x,-.35,.8);boardPosition.z=THREE.MathUtils.clamp(boardPosition.z,-.35,.4);}});
 surface.addEventListener('pointerup',release);surface.addEventListener('pointercancel',()=>{dragging=false;boardPosition.set(.56,.07,-.16);});
 $('print-grab').onclick=()=>{if(fitFeedback)return;keyboardGrab=true;boardPosition.y=BED_Y+.065;surface.focus();s.feedback='Platine gegriffen: Maus bewegen und im Halter klicken. Alternativ Pfeiltasten und Enter.';render();};
 window.addEventListener('keydown',e=>{if(!usable()||!keyboardGrab||s.phase!=='fit')return;const step=.025;if(e.code==='ArrowLeft')boardPosition.x-=step;else if(e.code==='ArrowRight')boardPosition.x+=step;else if(e.code==='ArrowUp')boardPosition.z-=step;else if(e.code==='ArrowDown')boardPosition.z+=step;else if(e.code==='Enter'){release();}else return;e.preventDefault();});
 function cancel(){fitFeedback=null;drawing=false;dragging=false;keyboardGrab=false;if(s.phase==='printing')paused=true;if(s.phase==='fit')boardPosition.set(.56,.07,-.16);if(active)render();}
 window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 async function load(){ready=false;$('print-retry').hidden=true;render();try{await view.load();ready=true;render();}catch(error){console.error(error);$('print-instruction').textContent='Der Drucker konnte nicht geladen werden. Bitte erneut versuchen.';$('print-retry').hidden=false;}}
 $('print-retry').onclick=load;
 function tick(dt){if(!ready)return;const phase=s.phase;if(!paused&&usable())tickPrint(s,dt);if(phase!==s.phase){boardPosition.set(.56,.07,-.16);render();}
  if(fitFeedback&&usable()){
   const f=fitFeedback;f.elapsed+=dt;
   const t=THREE.MathUtils.clamp((f.elapsed-.75)/.75,0,1),ease=t*t*(3-2*t);
   boardPosition.copy(f.from).lerp(new THREE.Vector3(.56,.07,-.16),ease);
   if(f.kind==='loose'&&f.elapsed<.75)boardPosition.x+=Math.sin(f.elapsed*28)*.012*Math.sin(Math.PI*f.elapsed/.75);
   if(f.elapsed>=1.5){fitFeedback=null;boardPosition.set(.56,.07,-.16);render();}
  }
  view.update(s,dt,boardPosition,fitFeedback);$('print-progress-fill').style.width=`${s.progress*100}%`;$('print-percent').textContent=`${Math.floor(s.progress*100)} %`;
  const grab=boardPosition.clone().add(new THREE.Vector3(0,.04,0)).project(view.camera);$('print-grab').style.left=`${(grab.x*.5+.5)*innerWidth}px`;$('print-grab').style.top=`${(-grab.y*.5+.5)*innerHeight}px`;
 }
 return{enter(){active=true;load();},exit(){cancel();active=false;},cancel,tick,getState:()=>({...s,points:s.points.map(p=>[...p]),passed:[...s.passed],ready,paused})};
}
