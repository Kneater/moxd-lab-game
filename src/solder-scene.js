import * as THREE from 'three';
import {PAD_RADII} from './solder-state.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
export const SOLDER_STATION=new THREE.Vector3(1.0,.94,-.50);
export const SOLDER_APPROACH={x:1.08,z:-1.43};
export const SOLDER_PADS=[[-.34,.084,.17],[-.34,.084,-.08],[.10,.084,-.08],[.10,.084,.17]].map(p=>new THREE.Vector3(...p));
export function createSolderScene(environment){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#282e35');scene.environment=environment;scene.environmentIntensity=.4;
 scene.add(new THREE.HemisphereLight('#fff2e2','#46525e',.8));
 const light=new THREE.DirectionalLight('#ffe9cd',1.5);light.position.set(-2,4,2);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:.1,far:10});light.shadow.normalBias=.001;light.shadow.radius=3;scene.add(light);
 const fill=new THREE.DirectionalLight('#c2cdfa',.55);fill.position.set(2,2,-1);scene.add(fill);
 const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.02,20);
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 let promise,iron,wire,led,joints=[],loaded=false,rest;
 const solderWire=flexibleCable('#c5cbd0',.0035,.8),powerCord=flexibleCable('#181d24',.008,0);scene.add(solderWire.mesh,powerCord.mesh);
 const spoolAnchor=new THREE.Vector3(-.677,.115,.07),wireRest=new THREE.Vector3(-.56,.035,.28),wireEnd=wireRest.clone();
 const tipDot=new THREE.Mesh(new THREE.SphereGeometry(.0055,16,12),new THREE.MeshBasicMaterial({color:'#fff2db'}));scene.add(tipDot);
 const hotLight=new THREE.PointLight('#ffb267',0,.18);scene.add(hotLight);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.045,.002,8,64),new THREE.MeshBasicMaterial({color:'#c8b5ef'}));ring.rotation.x=-Math.PI/2;scene.add(ring);
 const glow=new THREE.PointLight('#8effaf',0,.5);glow.position.set(.19,.26,.035);scene.add(glow);
 function resize(){
  const narrow=innerWidth<900;
  camera.aspect=innerWidth/innerHeight;camera.fov=narrow?48:42;
  camera.position.set(narrow?-.12:-.30,1.98,narrow?1.55:1.55);
  camera.lookAt(narrow?-.12:-.26,0,narrow?.03:.04);camera.updateProjectionMatrix();
 }
 resize();
 async function load(){
  if(promise)return promise;
  promise=(async()=>{
   const result=await loader.loadAsync(`${import.meta.env.BASE_URL}models/solder-bench.glb`);
   result.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
   iron=result.scene.getObjectByName('IronRig');wire=result.scene.getObjectByName('FeedRig');led=result.scene.getObjectByName('CompletionLED');
   joints=Array.from({length:4},(_,i)=>result.scene.getObjectByName('Joint_'+i));
   if(!iron||!wire||!led||joints.some(j=>!j))throw new Error('Lötmodell unvollständig.');
   rest=iron.position.clone();iron.traverse(o=>{if(o.name.replaceAll('_',' ').startsWith('Iron cord'))o.visible=false;});joints.forEach((j,i)=>{j.material=j.material.clone();j.geometry=j.geometry.clone();const p=SOLDER_PADS[i];j.geometry.translate(-p.x,-p.y,-p.z);j.position.add(p);j.visible=false;});led.material=led.material.clone();wire.visible=false;scene.add(result.scene);loaded=true;
  })().catch(e=>{promise=null;throw e;});
  return promise;
 }
 function update(s,dt,input){
  if(!loaded)return;
  const active=SOLDER_PADS[s.selected],{tip,held,inTarget}=input;
  ring.position.copy(active).add(new THREE.Vector3(0,.005,0));ring.scale.setScalar(PAD_RADII[s.selected]/.045);ring.visible=!s.completed&&s.joints[s.selected]!=='good';ring.material.color.set(held&&!inTarget?'#ed9a75':'#c8b5ef');
  // The rendered tip and the contact test share the exact same world coordinate.
  const target=tip.clone();target.y=held?.089:.16;
  if(s.completed)iron.position.lerp(rest,1-Math.exp(-dt*10));else iron.position.copy(target);
  tipDot.visible=held;tipDot.position.copy(target);tipDot.material.color.set(inTarget?'#fff2db':'#ed9a75');
  wire.visible=false;
  const amount=s.phase==='feeding'?Math.min(1,s.feed*5):s.phase==='withdrawing'?Math.max(0,1-s.phaseTime/.55):0;
  const feedTarget=wireRest.clone().lerp(active.clone().add(new THREE.Vector3(-.013,.008,0)),amount);
  wireEnd.lerp(feedTarget,1-Math.exp(-dt*18));
  solderWire.update([spoolAnchor,new THREE.Vector3(-.55,.17,.12),new THREE.Vector3((spoolAnchor.x+wireEnd.x)*.5,.14,(spoolAnchor.z+wireEnd.z)*.5),wireEnd]);
  iron.updateWorldMatrix(true,false);
  const cordEnd=iron.localToWorld(new THREE.Vector3(0,.467,0));
  powerCord.update([new THREE.Vector3(-.46,.16,-.34),new THREE.Vector3(-.25,.09,-.55),new THREE.Vector3(.56,.16,-.38),cordEnd]);
  joints.forEach((j,i)=>{
   const q=s.joints[i],growing=i===s.selected&&s.feed>0&&q==='empty';
   j.visible=q!=='empty'||growing;j.material.color.set(q==='cold'?'#8a9196':q==='burnt'?'#423a31':'#c3c9cd');j.material.roughness=q==='cold'||q==='burnt'?.87:.22;
   j.scale.setScalar(growing?.12+.88*s.feed:1);
   j.material.emissive.set(growing?'#d97731':'#000000');j.material.emissiveIntensity=growing?.15:0;
  });
  hotLight.position.copy(active).add(new THREE.Vector3(0,.045,0));hotLight.intensity=held?s.heat*.035:0;
  led.material.emissive.set(s.completed?'#61ff8d':'#000000');led.material.emissiveIntensity=s.completed?2:0;glow.intensity=s.completed?.5:0;
 }
 return{scene,camera,load,update,resize};
}
// Reuse GPU buffers as the wire bends; the first ring stays at the spool anchor.
function flexibleCable(color,radius,metalness){
 const segments=48,sides=8,positions=new Float32Array((segments+1)*sides*3),normals=new Float32Array(positions.length),indices=[];
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=b+sides;indices.push(a,c,b,b,c,d);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:metalness?.27:.8,metalness}));mesh.castShadow=true;mesh.frustumCulled=false;
 const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]);
 const p=new THREE.Vector3(),t=new THREE.Vector3(),n=new THREE.Vector3(),b=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 function update(points){curve.points.forEach((v,i)=>v.copy(points[i]));for(let i=0;i<=segments;i++){
  curve.getPoint(i/segments,p);curve.getTangent(i/segments,t);n.crossVectors(t,Math.abs(t.y)>.98?new THREE.Vector3(1,0,0):up).normalize();b.crossVectors(t,n).normalize();
  for(let j=0;j<sides;j++){const angle=j/sides*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle),k=(i*sides+j)*3;for(let axis=0;axis<3;axis++){const normal=n.getComponent(axis)*c+b.getComponent(axis)*s;positions[k+axis]=p.getComponent(axis)+radius*normal;normals[k+axis]=normal;}}
 }geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;}
 return{mesh,update};
}
