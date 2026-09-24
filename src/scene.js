import {createPrintScene} from './print-scene.js';
import {PRINT_STATION} from './print-state.js';
import {createSolderScene,SOLDER_STATION} from './solder-scene.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import{STATION_POSITION,UI_ACCENT,SLOT_SIZES,KIT_ORIGIN,KIT_ROTATION}from'./world-config.js';
export const STATION=new THREE.Vector3(STATION_POSITION.x,STATION_POSITION.y,STATION_POSITION.z);
export const SLOT_POS={controller:new THREE.Vector3(-.62,.12,0),sensor:new THREE.Vector3(.58,.12,0),led:new THREE.Vector3(-.38,.14,-.66)};
export const PIN_POS={ '5v':new THREE.Vector3(-.16,.14,-.23),ground:new THREE.Vector3(-.16,.14,0),d2:new THREE.Vector3(-.16,.14,.23),vcc:new THREE.Vector3(.31,.14,-.23),gnd:new THREE.Vector3(.31,.14,0),sig:new THREE.Vector3(.31,.14,.23)};
export const PIN_COLORS={vcc:'#ee785a','5v':'#ee785a',gnd:'#b9c7bd',ground:'#b9c7bd',sig:'#efcf67',d2:'#efcf67'};
const mat=(color,roughness=.5,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
export function createWorld(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.88;renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#b3c7ce');
 const pmrem=new THREE.PMREMGenerator(renderer);const env=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environment=env;scene.environmentIntensity=.32;
 scene.add(new THREE.HemisphereLight('#f0e8de','#4b4941',.65));
 const sun=new THREE.DirectionalLight('#ffecd5',1.35);sun.position.set(7.3,2.75,-4);sun.target.position.set(2.6,.5,-4.2);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-8,right:8,top:10,bottom:-10,near:.1,far:25});sun.shadow.bias=-.00015;sun.shadow.normalBias=.006;sun.shadow.radius=3;scene.add(sun,sun.target);
 for(const z of [-1.5,-5,-8.5]){const l=new THREE.PointLight('#ffead2',7,7,2);l.position.set(3.8,2.85,z);scene.add(l);}
 const camera=new THREE.PerspectiveCamera(67,innerWidth/innerHeight,.06,70);camera.rotation.order='YXZ';
 const stationRing=new THREE.Mesh(new THREE.RingGeometry(.185,.196,64),new THREE.MeshBasicMaterial({color:UI_ACCENT,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));stationRing.rotation.x=-Math.PI/2;stationRing.position.set(STATION.x,STATION.y+.006,STATION.z);scene.add(stationRing);
 const stationOrb=new THREE.Mesh(new THREE.OctahedronGeometry(.055),new THREE.MeshBasicMaterial({color:UI_ACCENT}));stationOrb.position.copy(STATION).add(new THREE.Vector3(0,.15,0));scene.add(stationOrb);
 const halo=new THREE.PointLight(UI_ACCENT,.16,1.2);halo.position.copy(STATION);scene.add(halo);
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 async function load(onProgress){
  const result=await loader.loadAsync(`${import.meta.env.BASE_URL}models/lab.glb`,e=>onProgress(e.total?e.loaded/e.total:Math.min(.9,e.loaded/36000000)));
  const treated=new Set();
  result.scene.traverse(o=>{
   if(!o.isMesh)return;
   const scope=o.name.includes('Oscilloscope_live_waveform')||o.name.includes('Oscilloscope live waveform');
   const label=o.name.includes('Case_label_panel')||o.name.includes('Case label panel');
   o.castShadow=!scope&&!label;o.receiveShadow=!scope;
   for(const m of(Array.isArray(o.material)?o.material:[o.material])){
    if(treated.has(m))continue;treated.add(m);
    // GLTFLoader handles sRGB color maps. State the same explicitly for custom maps;
    // normal/roughness/metalness data stays linear (NoColorSpace).
    if(m.map){m.map.colorSpace=THREE.SRGBColorSpace;m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
    if(m.emissiveMap)m.emissiveMap.colorSpace=THREE.SRGBColorSpace;
    const name=m.name.replace(/^LAB /,'').replace(/\.\d+$/,'');
    const matte={table:.8,wood:.82,edge:.78,black:.74,chair:.8,white:.76,cream:.78,blue:.72,navy:.76,cabinet:.78,red:.66,pink:.85,yellow:.74,paper:.92,chip:.72,rubber:.92};
    if(name in matte){m.roughness=matte[name];m.metalness=0;}
    if(m.transmission>.1){m.transmission=0;m.transparent=true;m.opacity=name==='green'?.82:.23;m.depthWrite=false;m.roughness=.3;}
    if(name==='lamp')m.emissiveIntensity=.7;
    m.envMapIntensity=.35;
    if(name==='scope'){
     m.roughness=1;m.metalness=0;m.color.set('#ffffff');
     m.emissive.set('#ffffff');m.emissiveMap=m.map;m.emissiveIntensity=.48;
     m.polygonOffset=true;m.polygonOffsetFactor=-2;m.polygonOffsetUnits=-2;
    }
    if(name==='caseart'){m.roughness=.92;m.metalness=0;m.polygonOffset=true;m.polygonOffsetFactor=-1;m.polygonOffsetUnits=-1;}
   }
  });scene.add(result.scene);onProgress(1);return result.scene;
 }
 const workshop=createWorkshop(env);
 const solder=createSolderScene(env);
 const printing=createPrintScene(env);
 const printOrb=stationOrb.clone();printOrb.position.set(PRINT_STATION.x,PRINT_STATION.y+.15,PRINT_STATION.z);scene.add(printOrb);
 const solderOrb=stationOrb.clone();solderOrb.position.copy(SOLDER_STATION).add(new THREE.Vector3(0,.15,0));scene.add(solderOrb);
 let kitPromise;
 workshop.loadKit=()=>kitPromise??=(async()=>{
  try{
   const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}models/sensor-kit.glb`);
   gltf.scene.position.set(-KIT_ORIGIN.x,-KIT_ORIGIN.y,-KIT_ORIGIN.z);
   const orientation=new THREE.Group();orientation.rotation.y=-KIT_ROTATION;orientation.add(gltf.scene);
   const group=new THREE.Group();group.position.set(.92,.005,-.78);group.add(orientation);
   gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(m.transmission>.1){m.transmission=0;m.transparent=true;m.opacity=m.name.includes('green')?.86:.25;m.depthWrite=false;}}}});
   workshop.scene.add(group);
  }catch(error){console.warn('Optionales Sensorbox-Modell konnte nicht geladen werden.',error);}
 })();
 function resize(){printing.resize();solder.resize();renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();workshop.camera.aspect=camera.aspect;workshop.camera.fov=innerWidth<760?59:45;workshop.camera.updateProjectionMatrix();}
 resize();
 return{renderer,scene,camera,load,workshop,solder,printing,resize,stationRing,stationOrb,halo};
}
function createWorkshop(environment){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#27392f');scene.environment=environment;scene.environmentIntensity=.45;
 scene.add(new THREE.HemisphereLight('#e6f8ea','#333f32',.95));
 const key=new THREE.DirectionalLight('#fff2db',2.0);key.position.set(-2.5,5,3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:12});key.shadow.normalBias=.004;key.shadow.radius=2.5;scene.add(key);
 const fill=new THREE.DirectionalLight('#b0dbe9',.6);fill.position.set(3,2,-3);scene.add(fill);
 const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.03,30);camera.position.set(-.32,2.95,2.05);camera.lookAt(-.32,0,-.04);
 const geometries=[];const add=(o,parent=scene)=>{parent.add(o);if(o.geometry)geometries.push(o.geometry);return o};
 function box(w,h,d,color,x=0,y=0,z=0,r=.025,parent=scene){const o=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,r),typeof color==='string'?mat(color):color);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return add(o,parent);}
 function cyl(r,h,color,x,y,z,parent=scene){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,32),typeof color==='string'?mat(color,.32,.6):color);o.position.set(x,y,z);o.castShadow=true;return add(o,parent);}
 const tabletop=box(9,.12,6,'#706a59',0,-.13,0,.035);
 const grid=document.createElement('canvas');grid.width=1024;grid.height=768;const c=grid.getContext('2d');c.fillStyle='#224c53';c.fillRect(0,0,1024,768);
 for(let x=0;x<=1024;x+=20){c.strokeStyle=x%100===0?'#89aa9677':'#719a8850';c.lineWidth=x%100===0?1.2:.6;c.beginPath();c.moveTo(x,0);c.lineTo(x,768);c.stroke();}
 for(let y=0;y<=768;y+=20){c.strokeStyle=y%100===0?'#89aa9677':'#719a8850';c.lineWidth=y%100===0?1.2:.6;c.beginPath();c.moveTo(0,y);c.lineTo(1024,y);c.stroke();}
 c.fillStyle='#bbceba';c.font='17px monospace';c.fillText('MOXD LAB   /   PROTOTYPING MAT',35,730);c.font='12px monospace';for(let i=1;i<24;i++)c.fillText(String(i*10),i*40,25);
 const gridTex=new THREE.CanvasTexture(grid);gridTex.colorSpace=THREE.SRGBColorSpace;gridTex.anisotropy=4;
 const cutmat=box(3.15,.022,2.05,mat('#fff'),.1,-.044,-.03,.018);cutmat.material.map=gridTex;
 // Mat top UV from a plane prevents side UV projection from distorting the millimetre grid.
 const top=new THREE.Mesh(new THREE.PlaneGeometry(3.15,2.05),new THREE.MeshStandardMaterial({map:gridTex,roughness:.86}));top.rotation.x=-Math.PI/2;top.position.set(.1,-.031,-.03);top.receiveShadow=true;add(top);
 const parts={};const ghosts={};
 for(const[id,pos]of Object.entries(SLOT_POS)){
  const dims=SLOT_SIZES[id];
  const ghost=box(dims[0],.008,dims[1],new THREE.MeshBasicMaterial({color:UI_ACCENT,transparent:true,opacity:.13}),pos.x,-.012,pos.z,.035);ghosts[id]=ghost;
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(dims[0],.006,dims[1])),new THREE.LineBasicMaterial({color:UI_ACCENT,transparent:true,opacity:.70}));edges.position.copy(ghost.position);add(edges);ghost.userData.edges=edges;
 }
 function pcb(parent,w,d,color='#14545f'){
  box(w,.018,d,mat(color,.32,.22),0,.015,0,.012,parent);
  for(const x of [-w/2+.028,w/2-.028])for(const z of [-d/2+.028,d/2-.028]){cyl(.012,.006,'#c2a755',x,.029,z,parent);cyl(.006,.007,'#173530',x,.031,z,parent);}
  const gold=mat('#cfb971',.38,.7);
  for(let i=0;i<9;i++){const z=-d*.37+i*d*.082;box(w*.40,.001,.002,gold,-w*.10,.025,z,0,parent);box(.002,.001,d*.12,gold,-w*.29+i*.019,.025,z,0,parent);}
  return parent;
 }
 const controller=new THREE.Group();controller.position.set(-.62,.005,0);add(controller);pcb(controller,.70,.78);
 box(.24,.035,.27,'#1b2323',-.07,.046,-.025,.01,controller);
 for(let i=0;i<10;i++)for(const x of [-.207,.067])box(.035,.014,.008,'#c4c8ba',x,.04,-.145+i*.026,.001,controller);
 box(.15,.055,.13,'#bfc6ba',-.09,.06,.35,.005,controller);box(.115,.025,.006,'#252f2d',-.09,.071,.417,.001,controller);
 for(const x of [-.29,.29]){box(.042,.052,.59,'#202728',x,.054,0,.004,controller);for(let i=0;i<12;i++)box(.016,.005,.018,'#ad9360',x,.083,-.258+i*.046,.001,controller);}
 for(let i=0;i<5;i++){box(.057,.017,.025,'#bbaa7f',.04+i*.034,.041,.24,.002,controller);}
 // Small screen updates with the measured distance in step three.
 const displayCanvas=document.createElement('canvas');displayCanvas.width=256;displayCanvas.height=128;
 const displayTex=new THREE.CanvasTexture(displayCanvas);displayTex.colorSpace=THREE.SRGBColorSpace;
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(.25,.125),new THREE.MeshBasicMaterial({map:displayTex}));screen.rotation.x=-Math.PI/2;screen.position.set(-.62,.072,-.25);add(screen);
 const sensor=new THREE.Group();sensor.position.set(.61,.005,0);add(sensor);pcb(sensor,.52,.61,'#185b83');
 for(const z of [-.155,.155]){const barrel=cyl(.085,.15,'#b8c3c1',.10,.115,z,sensor);barrel.rotation.z=-Math.PI/2;const dark=cyl(.066,.005,'#23332f',.178,.115,z,sensor);dark.rotation.z=-Math.PI/2;for(let i=-3;i<=3;i++){box(.004,.006,.095,'#7d9a8c',.183,.115+i*.013,z,0,sensor);}}
 box(.075,.043,.086,'#252e2e',-.08,.048,0,.005,sensor);
 const led=new THREE.Group();led.position.set(-.38,.01,-.66);add(led);pcb(led,.36,.23,'#29493c');
 const ledMaterial=new THREE.MeshStandardMaterial({color:'#6f7d63',emissive:'#000000',roughness:.22,metalness:.15});
 const bulb=new THREE.Mesh(new THREE.SphereGeometry(.062,24,16),ledMaterial);bulb.scale.y=1.1;bulb.position.set(0,.09,0);led.add(bulb);cyl(.06,.045,'#afb59c',0,.052,0,led);
 const ledLight=new THREE.PointLight('#ff653a',0,.8);ledLight.position.set(-.38,.23,-.66);add(ledLight);
 parts.controller=controller;parts.sensor=sensor;parts.led=led;Object.values(parts).forEach(p=>p.visible=false);screen.visible=false;
 const terminalGroup=new THREE.Group();add(terminalGroup);terminalGroup.visible=false;
 for(const[id,p]of Object.entries(PIN_POS)){cyl(.025,.026,'#c1a85f',p.x,p.y-.04,p.z,terminalGroup);cyl(.014,.006,'#172823',p.x,p.y-.024,p.z,terminalGroup);}
 const wires=new THREE.Group();add(wires);
 function cable(a,b,color){const start=PIN_POS[a],end=PIN_POS[b];const curve=new THREE.CatmullRomCurve3([start,new THREE.Vector3((start.x+end.x)/2,.27,start.z-.025),end]);const wire=new THREE.Mesh(new THREE.TubeGeometry(curve,32,.012,8,false),mat(color,.42));wire.castShadow=true;wires.add(wire);}
 const testGroup=new THREE.Group();add(testGroup);testGroup.visible=false;
 const target=box(.15,.25,.36,'#d4b380',1.28,.10,0,.012,testGroup);box(.156,.01,.368,'#a78153',1.28,.232,0,.004,testGroup);
 const targetCap=testGroup.children[1];
 const rangeLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:UI_ACCENT,dashSize:.025,gapSize:.015}));rangeLine.position.y=.135;add(rangeLine);rangeLine.visible=false;
 const signalRings=[];for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.09+i*.055,.002,5,32,Math.PI),new THREE.MeshBasicMaterial({color:UI_ACCENT,transparent:true,opacity:.4}));ring.rotation.set(Math.PI/2,0,-Math.PI/2);ring.position.set(.83+i*.13,.03,0);add(ring);ring.visible=false;signalRings.push(ring);}
 // Small familiar lab details frame the working surface without obscuring controls.
 box(.24,.065,.12,'#efeae0',-1.18,.02,-.90,.012);for(let i=0;i<4;i++)box(.02,.003,.06,'#d78762',-1.25+i*.045,.057,-.90,.001);
 const pen=box(.022,.023,.50,'#dab941',1.30,.005,.52,.007);pen.rotation.y=.33;
 let latest={step:0,distance:70,placed:{},wires:[]};
 function update(state){latest=state;for(const id of Object.keys(parts)){parts[id].visible=Boolean(state.placed[id]);ghosts[id].visible=!parts[id].visible;ghosts[id].userData.edges.visible=!parts[id].visible;}
  screen.visible=parts.controller.visible;terminalGroup.visible=state.step>=1;
  while(wires.children.length){const o=wires.children[0];wires.remove(o);o.geometry.dispose();o.material.dispose();}
  for(const[a,b]of state.wires)cable(a,b,a==='gnd'?'#263732':PIN_COLORS[a]);
  testGroup.visible=state.step===2;rangeLine.visible=state.step===2;signalRings.forEach(r=>r.visible=state.step===2);
  distance(state.distance,state.step===2);
 }
 function distance(d,active=true){
  const warning=active&&d<30;ledMaterial.color.set(active?(warning?'#ed301b':'#70cb22'):'#6f7d63');ledMaterial.emissive.set(active?(warning?'#ff3914':'#89e328'):'#000');ledMaterial.emissiveIntensity=active?.45:0;ledLight.color.set(warning?'#ff633a':'#a4ef54');ledLight.intensity=active?.4:0;
  const x=.92+(d-5)/95*.62;target.position.x=x;targetCap.position.x=x;
  rangeLine.geometry.dispose();rangeLine.geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.80,0,.27),new THREE.Vector3(x,0,.27)]);rangeLine.computeLineDistances();
  const ctx=displayCanvas.getContext('2d');ctx.fillStyle='#112a25';ctx.fillRect(0,0,256,128);ctx.fillStyle='#c5f674';ctx.font='15px monospace';ctx.fillText('MOXD / DISTANCE',14,24);ctx.font='bold 48px monospace';ctx.fillText(active?`${d} cm`:'READY',14,80);ctx.font='13px monospace';ctx.fillStyle=warning?'#ff9a77':'#aabfac';ctx.fillText(active?(warning?'ALARM < 30 cm':'ABSTAND FREI'):'CONTROLLER',14,112);displayTex.needsUpdate=true;
 }
 update(latest);
 return{scene,camera,update,distance,parts,ghosts,signalRings,screen};
}
