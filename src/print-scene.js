import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export const BED_Y=.142,PRINT_SCALE=.001;
export function createPrintScene(environment){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#272e34');scene.environment=environment;scene.environmentIntensity=.42;
 scene.add(new THREE.HemisphereLight('#fff0dd','#4c5360',.95));
 const light=new THREE.DirectionalLight('#ffefd8',1.8);light.position.set(-1,3,2);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:.1,far:8});light.shadow.normalBias=.001;light.shadow.radius=3;scene.add(light);
 const fill=new THREE.DirectionalLight('#c8cefa',.65);fill.position.set(2,1,-1);scene.add(fill);
 const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.01,15);
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 let promise,head,gantry,boards=[],boardMaterials=[],modelReady=false,holder=new THREE.Group(),layers=[],path=[],cumulative=[],length=0,previewLine;
 scene.add(holder);
 const filamentMat=new THREE.MeshStandardMaterial({color:'#c3a9ee',roughness:.64});
 const motionFilament=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#c3a9ee'}));scene.add(motionFilament);
 const target=new THREE.Mesh(new THREE.RingGeometry(.024,.027,48),new THREE.MeshBasicMaterial({color:'#c8b5ef',transparent:true,opacity:.7,side:THREE.DoubleSide}));target.rotation.x=-Math.PI/2;target.position.set(0,BED_Y+.028,0);scene.add(target);target.visible=false;
 function resize(){camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<850?50:40;camera.position.set(1.0,1.38,1.65);camera.lookAt(.10,.33,0);camera.updateProjectionMatrix();}resize();
 async function load(){return promise??=(async()=>{
  const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}models/print-bench.glb`);head=gltf.scene.getObjectByName('PrintHeadRig');gantry=gltf.scene.getObjectByName('PrintGantryRig');boards=[0,1,2].map(i=>gltf.scene.getObjectByName('PCB_'+i));
  if(!head||!gantry||boards.some(b=>!b))throw new Error('Druckermodell unvollständig.');
  // Isolate PCB materials: feedback must not tint the printer or other boards.
  boards.forEach((board,i)=>{boardMaterials[i]=[];board.traverse(o=>{if(!o.isMesh)return;const clone=material=>{const m=material.clone();boardMaterials[i].push({material:m,color:m.color.clone(),emissive:m.emissive?.clone(),intensity:m.emissiveIntensity});return m;};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);});});
  gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(gltf.scene);modelReady=true;
 })().catch(e=>{promise=null;throw e;});}
 function clearHolder(){holder.traverse(o=>{if(o.geometry)o.geometry.dispose();});holder.clear();layers=[];if(previewLine){scene.remove(previewLine);previewLine.geometry.dispose();previewLine.material.dispose();previewLine=null;}}
 function build(contour){
  clearHolder();path=contour.map(p=>new THREE.Vector3((p[0]-300)*PRINT_SCALE,0,(p[1]-240)*PRINT_SCALE));cumulative=[0];length=0;
  path.forEach((p,i)=>{length+=p.distanceTo(path[(i+1)%path.length]);cumulative.push(length);});
  const shape=new THREE.Shape(path.map(p=>new THREE.Vector2(p.x,-p.z)));
  const floorGeometry=new THREE.ExtrudeGeometry(shape,{depth:.004,bevelEnabled:false,steps:1});floorGeometry.rotateX(-Math.PI/2);
  const floor=new THREE.Mesh(floorGeometry,filamentMat);floor.position.y=BED_Y;floor.receiveShadow=true;holder.add(floor);layers.push(floor);
  const parts=[];
  path.forEach((p,i)=>{const q=path[(i+1)%path.length],d=p.distanceTo(q);if(d<1e-6)return;const g=new THREE.BoxGeometry(d,.002,.006);g.rotateY(-Math.atan2(q.z-p.z,q.x-p.x));g.translate((p.x+q.x)/2,0,(p.z+q.z)/2);parts.push(g);const corner=new THREE.CylinderGeometry(.003,.003,.002,8);corner.translate(p.x,0,p.z);parts.push(corner);});
  const wall=mergeGeometries(parts);parts.forEach(g=>g.dispose());
  for(let i=0;i<10;i++){const mesh=new THREE.Mesh(wall.clone(),filamentMat);mesh.position.y=BED_Y+.005+i*.002;mesh.castShadow=true;mesh.receiveShadow=true;holder.add(mesh);layers.push(mesh);}wall.dispose();
  previewLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([...path,path[0]]),new THREE.LineBasicMaterial({color:'#f6e9ff'}));scene.add(previewLine);
 }
 function along(t){if(!path.length)return new THREE.Vector3();const d=t*length;let i=0;while(i<cumulative.length-2&&cumulative[i+1]<d)i++;return path[i].clone().lerp(path[(i+1)%path.length],(d-cumulative[i])/(cumulative[i+1]-cumulative[i]||1));}
 function update(s,dt,boardPosition,feedback=null){
  if(!modelReady)return;
  boards.forEach((b,i)=>{b.visible=i===s.level;if(i===s.level){b.position.set(boardPosition.x,s.phase==='success'?BED_Y+.004:boardPosition.y,boardPosition.z);}});
  const tint=feedback?.kind==='tight'?'#ff253f':feedback?.kind==='loose'?'#ffb52e':null;
  const pulse=tint?Math.max(0,1-feedback.elapsed/1.5)*(.6+.4*Math.abs(Math.cos(feedback.elapsed*10))):0;
  boardMaterials.forEach((materials,i)=>materials.forEach(({material,color,emissive,intensity})=>{
   material.color.copy(color);if(emissive)material.emissive.copy(emissive);material.emissiveIntensity=intensity;
   if(tint&&i===s.level){material.color.lerp(new THREE.Color(tint),pulse);if(emissive){material.emissive.set(tint);material.emissiveIntensity=pulse*.7;}}
  }));
  holder.visible=s.phase!=='draw';target.visible=s.phase==='fit';target.material.color.set(tint??'#c8b5ef');target.scale.setScalar(tint?1+pulse*.5:1);
  if(s.phase==='printing'){
   const n=s.progress*layers.length,index=Math.min(layers.length-1,Math.floor(n)),fraction=n-index;
   layers.forEach((m,i)=>m.visible=i<=index);
   const p=along(fraction);p.y=BED_Y+.005+index*.002;head.position.copy(p);gantry.position.set(0,p.y,p.z);
   if(previewLine){previewLine.visible=true;previewLine.position.y=p.y;previewLine.geometry.setDrawRange(0,Math.max(2,Math.ceil(path.length*fraction)));}
  }else{
   layers.forEach(m=>m.visible=true);if(previewLine)previewLine.visible=false;
   head.position.lerp(new THREE.Vector3(-.19,.39,-.08),1-Math.exp(-dt*7));gantry.position.set(0,head.position.y,head.position.z);
  }
  const filamentPoints=[new THREE.Vector3(.09,.86,-.09),new THREE.Vector3(.18,.84,0),head.position.clone().add(new THREE.Vector3(0,.11,0))];
  const curve=new THREE.QuadraticBezierCurve3(...filamentPoints);motionFilament.geometry.dispose();motionFilament.geometry=new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
 }
 return{scene,camera,load,resize,build,clearHolder,update};
}
