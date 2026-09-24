import{test}from'node:test';
import sourceMetrics from './fixtures/lab-source-metrics.json' with {type:'json'};
import assert from'node:assert/strict';
import{NodeIO}from'@gltf-transform/core';
import{ALL_EXTENSIONS}from'@gltf-transform/extensions';
import{listTextureInfoByMaterial}from'@gltf-transform/functions';
import{MeshoptDecoder}from'meshoptimizer';
import{canStand}from'../src/game-state.js';
import{STATION_POSITION,STATION_APPROACH,STATION_REACH}from'../src/world-config.js';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const lab=await io.read(new URL('../public/models/lab.glb',import.meta.url).pathname);

test('compressed color textures retain their UV sets, including scope and case labels',()=>{
 let textured=0;
 for(const mesh of lab.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
  const material=primitive.getMaterial();if(!material)continue;
  for(const info of listTextureInfoByMaterial(material)){
   textured++;
   assert.ok(info.getTexCoord()>=0,material.getName());
   const uv=primitive.getAttribute(`TEXCOORD_${info.getTexCoord()}`);
   assert.ok(uv,`${material.getName()} lost its texture coordinates during compression`);
   assert.equal(uv.getCount(),primitive.getAttribute('POSITION').getCount());
   const data=Array.from(uv.getArray());
   assert.ok(new Set(data.filter((_,i)=>i%2===0)).size>1,`${material.getName()} collapsed U`);
   assert.ok(new Set(data.filter((_,i)=>i%2===1)).size>1,`${material.getName()} collapsed V`);
  }
 }
 assert.ok(textured>=2);
 for(const label of ['scope','caseart']){
  const mesh=lab.getRoot().listMeshes().find(m=>m.listPrimitives().some(p=>p.getMaterial()?.getName().includes(label)));
  assert.ok(mesh,`${label} absent`);assert.equal(mesh.listPrimitives().length,1,'Label must remain separate from room-scale quantization');
 }
 assert.equal(lab.getRoot().listMaterials().some(m=>m.getName().includes('poster')),false);
});

test('the green IoT kit is reachable from a collision-free aisle position; old solder corner is out of range',()=>{
 assert.ok(canStand(STATION_APPROACH.x,STATION_APPROACH.z));
 assert.ok(Math.hypot(STATION_APPROACH.x-STATION_POSITION.x,STATION_APPROACH.z-STATION_POSITION.z)<STATION_REACH);
 assert.ok(Math.hypot(1.08-STATION_POSITION.x,-1.43-STATION_POSITION.z)>STATION_REACH);
});

test('room export retains submillimetre positions and original triangle topology',async()=>{
 const triangles=doc=>doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0);
 assert.equal(triangles(lab),sourceMetrics.triangles);
 for(const mesh of lab.getRoot().listMeshes())for(const p of mesh.listPrimitives())assert.ok(p.getAttribute('POSITION').getArray() instanceof Float32Array);
});

test('solder asset contains all four joints and animated tool roots',async()=>{
 const asset=await io.read(new URL('../public/models/solder-bench.glb',import.meta.url).pathname);
 const nodes=asset.getRoot().listNodes();
 for(const name of ['IronRig','FeedRig','CompletionLED',...Array.from({length:4},(_,i)=>'Joint_'+i)])assert.ok(nodes.some(n=>n.getName()===name),name);
});

test('printer asset keeps movable nozzle and three distinct PCB models',async()=>{
 const asset=await io.read(new URL('../public/models/print-bench.glb',import.meta.url).pathname),nodes=asset.getRoot().listNodes();
 for(const name of ['PrintHeadRig','PrintGantryRig','PCB_0','PCB_1','PCB_2'])assert.ok(nodes.some(n=>n.getName()===name),name);
});
