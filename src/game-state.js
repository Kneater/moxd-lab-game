export const PARTS = [
 {id:'controller',slot:'controller',title:'Controller',detail:'Verarbeitet das Sensorsignal',icon:'chip'},
 {id:'ultrasonic',slot:'sensor',title:'Ultraschallsensor',detail:'Misst den Abstand zu Objekten',icon:'sensor'},
 {id:'led',slot:'led',title:'LED-Modul',detail:'Zeigt die Abstandswarnung',icon:'led'},
 {id:'temperature',slot:null,title:'Temperatursensor',detail:'Misst Wärme, keinen Abstand',icon:'temperature'},
];
export const CONNECTIONS = [['vcc','5v'],['gnd','ground'],['sig','d2']];
export const THRESHOLD=30;
export function createState(){return {step:0,placed:{},wires:[],pending:null,distance:70,nearTested:false,farTested:false,completed:false};}
export function placePart(state,partId,slotId){
 const part=PARTS.find(p=>p.id===partId);
 if(!part||part.slot!==slotId)return {ok:false,message:partId==='temperature'?'Dieser Sensor misst Temperatur. Für Entfernungen brauchst du den Ultraschallsensor.':'Dieses Bauteil gehört auf einen anderen Steckplatz.'};
 state.placed[slotId]=partId;
 if(['controller','sensor','led'].every(k=>state.placed[k]))state.step=1;
 return {ok:true,message:state.step===1?'Alles eingesetzt. Verbinde jetzt 5V, GND und das Signal.':`${part.title} sitzt. Wähle das nächste Bauteil.`};
}
export function connectPins(state,a,b){
 if(state.step!==1)return {ok:false,message:'Setze zuerst alle drei Bauteile ein.'};
 const match=CONNECTIONS.find(pair=>pair.includes(a)&&pair.includes(b)&&a!==b);
 if(!match)return {ok:false,message:'Diese Verbindung passt nicht. VCC braucht 5V, GND gehört an GND und SIG an D2.'};
 if(state.wires.some(pair=>pair.includes(a)||pair.includes(b)))return {ok:false,message:'Diese Leitung ist bereits verbunden.'};
 state.wires.push([...match]);state.pending=null;
 if(state.wires.length===3)state.step=2;
 return {ok:true,message:state.step===2?'Die Schaltung ist bereit. Teste einen Abstand unter und über 30 cm.':'Verbindung sitzt. Weiter mit der nächsten Leitung.'};
}
export function setDistance(state,distance){
 const n=Number(distance);if(!Number.isFinite(n))return;
 state.distance=Math.min(100,Math.max(5,n));
 if(state.step===2){
  if(state.distance<THRESHOLD)state.nearTested=true;else state.farTested=true;
  if(state.nearTested&&state.farTested)state.completed=true;
 }
}
export function isWarning(distance){return distance<THRESHOLD;}
// X and Z coordinates in the exported Y-up scene. Colliders include chair backs,
// while the central aisle (x 2.85–4.05) remains clear for the player capsule.
export const COLLIDERS=[
 {x0:.47,x1:2.84,z0:-7.16,z1:-1.97},
 {x0:4.06,x1:6.42,z0:-7.16,z1:-1.97},
 {x0:0,x1:7.6,z0:-.90,z1:.1},
 {x0:0,x1:7.6,z0:-10.9,z1:-9.83},
 {x0:.84,x1:2.96,z0:-8.5,z1:-7.80},
 {x0:4.20,x1:6.83,z0:-8.63,z1:-7.88},
];
export function canStand(x,z,r=.17){
 if(x<.30||x>7.30||z>-.99||z< -9.6)return false;
 return !COLLIDERS.some(c=>x>c.x0-r&&x<c.x1+r&&z>c.z0-r&&z<c.z1+r);
}
export function movePlayer(position,dx,dz){
 // Small substeps prevent tunnelling even when a frame is delayed.
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));let{x,z}=position;
 for(let i=0;i<steps;i++){
  if(canStand(x+dx/steps,z))x+=dx/steps;
  if(canStand(x,z+dz/steps))z+=dz/steps;
 }
 return{x,z};
}
