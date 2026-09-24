import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPrintState,addDrawPoint,validateContour,startPrint,tickPrint,assessFit,tryFit,chooseLevel,PRINT_SECONDS,PRINT_APPROACH,PRINT_STATION} from '../src/print-state.js';
import {canStand} from '../src/game-state.js';
const outlines=[[[186,151],[414,151],[414,329],[186,329]],[[201,146],[379,146],[379,191],[416,191],[416,274],[379,274],[379,334],[201,334]],[[191,136],[314,136],[314,216],[409,216],[409,339],[191,339]]];
test('three player-drawn contours become distinct printable holders and all pass assembly',()=>{
 const s=createPrintState();
 for(let i=0;i<3;i++){chooseLevel(s,i);outlines[i].forEach(p=>addDrawPoint(s,p));s.closed=true;assert.ok(startPrint(s));assert.notDeepEqual(s.contour,outlines[i]);assert.ok(s.contour.length>outlines[i].length);assert.equal(s.phase,'printing');assert.equal(chooseLevel(s,2),false);tickPrint(s,PRINT_SECONDS);assert.equal(s.phase,'fit');assert.equal(tryFit(s,.4,0).kind,'position');assert.equal(s.passed[i],false);assert.ok(tryFit(s,0,0).ok);assert.equal(s.completed,i===2);}
 assert.equal(s.attempts,3);assert.deepEqual(s.passed,[true,true,true]);
});
test('tight, loose and concave-contour errors are classified from actual player geometry',()=>{
 const tight=validateContour([[199,164],[401,164],[401,316],[199,316]]).contour;
 assert.equal(assessFit(tight,0).kind,'tight');
 const loose=validateContour([[145,110],[455,110],[455,370],[145,370]]).contour;
 assert.equal(assessFit(loose,0).kind,'loose');
 assert.equal(assessFit(validateContour([[191,136],[409,136],[409,339],[191,339]]).contour,2).kind,'loose');
});
test('self-crossings, degenerate lines, non-finite input and invalid bounds never print',()=>{
 for(const p of [[[100,100],[420,380],[100,380],[420,100]],[[100,100],[200,100],[300,100]],[[NaN,4],[400,50],[300,300]],[[10,100],[400,100],[400,350],[100,350]]])assert.equal(validateContour(p).ok,false);
 const s=createPrintState();s.points=outlines[0];assert.equal(startPrint(s),false);assert.equal(s.phase,'draw');assert.equal(s.attempts,0);
});
test('tiny movements near the start do not prematurely close a freehand outline',()=>{
 const s=createPrintState();for(const p of [[100,100],[104,100],[108,100],[108,104],[105,106]])addDrawPoint(s,p);assert.equal(s.closed,false);
});
test('reverse winding and hand-drawn intermediate points preserve the intended fit',()=>{
 assert.ok(assessFit(validateContour([...outlines[0]].reverse()).contour,0).ok);
 const wobbly=[[186,151],[240,149],[305,152],[360,150],[414,151],[415,235],[414,329],[302,330],[186,329],[185,235]];
 assert.ok(assessFit(validateContour(wobbly).contour,0).ok);
});
test('time progress is guarded and printing cannot pass a board without a fit',()=>{
 const s=createPrintState();s.points=outlines[0];s.closed=true;startPrint(s);tickPrint(s,NaN);assert.equal(s.progress,0);tickPrint(s,PRINT_SECONDS/2);assert.equal(s.progress,.5);assert.equal(tryFit(s,0,0).ok,false);tickPrint(s,20);assert.equal(s.phase,'fit');assert.equal(s.completed,false);
 for(const i of [-1,3,NaN])assert.equal(chooseLevel(s,i),false);
});
test('printer station is anchored beside the existing solder bench with a clear approach',()=>{
 assert.ok(canStand(PRINT_APPROACH.x,PRINT_APPROACH.z));assert.ok(Math.hypot(PRINT_APPROACH.x-PRINT_STATION.x,PRINT_APPROACH.z-PRINT_STATION.z)<1.65);
 for(let z=-5.4;z<=-1.43;z+=.05)assert.ok(canStand(3.28,z));
});
