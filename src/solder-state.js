export const PAD_RADII=[.030,.027,.024,.022];
export const ACTIVE_PHASES=['heating','feeding','withdrawing','release'];
export function createSolderState(){return{selected:0,joints:Array(4).fill('empty'),scores:Array(4).fill(0),phase:'ready',heat:0,feed:0,elapsed:0,phaseTime:0,outside:0,stable:0,total:0,attempts:0,completed:false,reason:''};}
export function selectJoint(s,index){
 if(ACTIVE_PHASES.includes(s.phase)||s.phase==='cooling'||s.completed||!Number.isInteger(index)||index<0||index>3||s.joints[index]==='good')return false;
 s.selected=index;s.heat=0;s.feed=0;s.phase='ready';s.reason='';return true;
}
export function beginContact(s){
 if(s.completed||!['ready','result'].includes(s.phase)||s.joints[s.selected]==='good')return false;
 Object.assign(s,{phase:'heating',heat:0,feed:0,elapsed:0,phaseTime:0,outside:0,stable:0,total:0,reason:''});s.joints[s.selected]='empty';s.attempts++;return true;
}
export function driftAt(index,time){
 const a=[.039,.046,.052,.058][index],ramp=Math.min(1,time/1.2);
 return{x:a*ramp*Math.sin(time*1.35),z:a*.65*ramp*Math.sin(time*1.05)};
}
function fail(s,reason){s.phase='result';s.reason=reason;s.joints[s.selected]=reason==='overheated'?'burnt':'cold';}
export function releaseContact(s){
 if(s.phase==='release'){s.phase='cooling';s.phaseTime=0;return true;}
 if(ACTIVE_PHASES.includes(s.phase))fail(s,'early');return false;
}
export function cancelContact(s){
 if(ACTIVE_PHASES.includes(s.phase)||s.phase==='cooling'){
  Object.assign(s,{phase:'ready',heat:0,feed:0,elapsed:0,phaseTime:0,outside:0,reason:'paused'});s.joints[s.selected]='empty';
 }
}
export function tickSolder(s,seconds,inTarget){
 if(!Number.isFinite(seconds)||seconds<=0)return;
 // Small fixed upper steps preserve phase transitions across slower frames.
 let left=Math.min(seconds,30);
 while(left>1e-8){const dt=Math.min(left,1/120);left-=dt;
  if(s.phase==='cooling'){
   s.phaseTime+=dt;s.heat=Math.max(0,s.heat-dt);
   if(s.phaseTime>=.7){s.joints[s.selected]='good';s.scores[s.selected]=Math.round(100*s.stable/Math.max(.001,s.total));s.completed=s.joints.every(j=>j==='good');s.phase='result';s.reason='good';}continue;
  }
  if(!ACTIVE_PHASES.includes(s.phase))continue;
  s.elapsed+=dt;s.phaseTime+=dt;
  if(s.phase==='release'){if(s.phaseTime>=2.2)fail(s,'overheated');continue;}
  s.total+=dt;if(inTarget){s.stable+=dt;s.outside=0;}else s.outside+=dt;
  if(s.outside>1.35){fail(s,'drift');continue;}
  if(s.phase==='heating'){
   s.heat=Math.max(0,Math.min(.72,s.heat+(inTarget?.28:-.22)*dt));
   if(s.heat>=.72){s.phase='feeding';s.phaseTime=0;}
  }else if(s.phase==='feeding'){
   if(inTarget)s.feed=Math.min(1,s.feed+dt/1.1);
   if(s.feed>=1){s.phase='withdrawing';s.phaseTime=0;}
  }else if(s.phase==='withdrawing'&&s.phaseTime>=.55){s.phase='release';s.phaseTime=0;}
 }
}
