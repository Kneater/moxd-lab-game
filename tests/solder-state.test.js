import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSolderState,selectJoint,beginContact,tickSolder,releaseContact,cancelContact,driftAt,PAD_RADII} from '../src/solder-state.js';
import {canStand} from '../src/game-state.js';
function reachRelease(s){tickSolder(s,2.6,true);assert.equal(s.phase,'feeding');tickSolder(s,1.12,true);assert.equal(s.phase,'withdrawing');tickSolder(s,.56,true);assert.equal(s.phase,'release');}
test('four stable contacts, automatic feed/retraction and release/cooling complete the LED',()=>{
 const s=createSolderState();
 for(let i=0;i<4;i++){
  assert.ok(selectJoint(s,i));assert.ok(beginContact(s));reachRelease(s);assert.equal(s.completed,false);assert.equal(s.joints[i],'empty');
  assert.ok(releaseContact(s));assert.equal(s.phase,'cooling');tickSolder(s,.71,true);assert.equal(s.joints[i],'good');assert.equal(s.completed,i===3);assert.equal(s.scores[i],100);
 }
 assert.equal(s.attempts,4);assert.equal(beginContact(s),false);assert.equal(selectJoint(s,0),false);
});
test('drifting pauses feeding and cools heat; brief slips recover but sustained loss fails',()=>{
 const s=createSolderState();beginContact(s);tickSolder(s,1,true);const heat=s.heat;tickSolder(s,.4,false);assert.ok(s.heat<heat);tickSolder(s,2.1,true);assert.equal(s.phase,'feeding');
 const feed=s.feed;tickSolder(s,.4,false);assert.equal(s.feed,feed);tickSolder(s,.3,true);assert.ok(s.feed>feed);tickSolder(s,1.4,false);assert.equal(s.phase,'result');assert.equal(s.reason,'drift');assert.equal(s.joints[0],'cold');
 assert.ok(beginContact(s));reachRelease(s);releaseContact(s);tickSolder(s,1,true);assert.equal(s.joints[0],'good');
});
test('early release and ignoring the lift signal fail; next attempt starts clean',()=>{
 const s=createSolderState();beginContact(s);tickSolder(s,.3,true);releaseContact(s);assert.equal(s.reason,'early');assert.equal(s.joints[0],'cold');
 beginContact(s);reachRelease(s);tickSolder(s,2.3,true);assert.equal(s.reason,'overheated');assert.equal(s.joints[0],'burnt');
 beginContact(s);assert.equal(s.feed,0);assert.equal(s.heat,0);assert.equal(s.elapsed,0);assert.equal(s.attempts,3);
});
test('stationary mouse cannot finish: predictable drift exceeds each target radius',()=>{
 for(let i=0;i<4;i++){
  const s=createSolderState();selectJoint(s,i);beginContact(s);
  for(let j=0;j<1200&&s.phase!=='result';j++){const d=driftAt(i,s.elapsed);tickSolder(s,1/120,Math.hypot(d.x,d.z)<=PAD_RADII[i]);}
  assert.equal(s.reason,'drift');assert.equal(s.completed,false);
 }
});
test('time integration is consistent across frame rates and guards invalid input',()=>{
 const a=createSolderState(),b=createSolderState();beginContact(a);beginContact(b);tickSolder(a,3,true);for(let i=0;i<180;i++)tickSolder(b,1/60,true);
 assert.equal(a.phase,b.phase);assert.ok(Math.abs(a.feed-b.feed)<.001);assert.equal(beginContact(a),false);assert.equal(selectJoint(a,2),false);tickSolder(a,NaN,true);assert.ok(Number.isFinite(a.heat));
});
test('pause cancels unfinished contact while preserving good joints; no background progress',()=>{
 const s=createSolderState();beginContact(s);reachRelease(s);releaseContact(s);tickSolder(s,1,true);selectJoint(s,1);beginContact(s);tickSolder(s,3,true);cancelContact(s);tickSolder(s,20,true);
 assert.equal(s.phase,'ready');assert.equal(s.heat,0);assert.equal(s.feed,0);assert.equal(s.joints[0],'good');assert.equal(s.joints[1],'empty');
 for(const i of [-1,4,1.5,NaN])assert.equal(selectJoint(s,i),false);
});
test('solder bench has a free approach connected to the central aisle',()=>{
 for(let x=1.08;x<=3.8;x+=.05)assert.ok(canStand(x,-1.43));for(let z=-5.4;z<=-1.43;z+=.05)assert.ok(canStand(3.8,z));
});
