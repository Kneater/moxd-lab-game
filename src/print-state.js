import LEVELS from './print-levels.json' with {type:'json'};
export {LEVELS};
export const PRINT_SECONDS=7;
export const PRINT_STATION={x:3.28,y:1.15,z:-.43},PRINT_APPROACH={x:3.28,z:-1.43};
export function createPrintState(){return{level:0,phase:'draw',points:[],contour:null,closed:false,progress:0,passed:[false,false,false],attempts:0,completed:false,feedback:''};}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function area(poly){return poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;}
export function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
export function boundaryDistance(p,poly){return Math.min(...poly.map((a,i)=>segmentDistance(p,a,poly[(i+1)%poly.length])));}
export function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function cross(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function intersects(a,b,c,d){
 const on=(p,u,v)=>segmentDistance(p,u,v)<.001;
 return(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)||on(a,c,d)||on(b,c,d)||on(c,a,b)||on(d,a,b);
}
export function validateContour(raw){
 const points=[];
 for(const p of raw){if(!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n))||p[0]<20||p[0]>580||p[1]<20||p[1]>460)return{ok:false,message:'Bitte innerhalb der Zeichenfläche bleiben.'};if(!points.length||distance(p,points.at(-1))>1)points.push([...p]);}
 if(points.length>1&&distance(points[0],points.at(-1))<2)points.pop();
 if(points.length<3||Math.abs(area(points))<1200)return{ok:false,message:'Zeichne eine geschlossene Fläche um die ganze Platine.'};
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
  if(j===i+1||(i===0&&j===points.length-1))continue;
  if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return{ok:false,message:'Die Kontur kreuzt sich. Kürze das Ende oder zeichne neu.'};
 }
 // Resampling smooths tiny hand tremors, without replacing the player's geometry.
 const sampled=[];
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],steps=Math.max(1,Math.ceil(distance(a,b)/5));for(let j=0;j<steps;j++)sampled.push([a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps]);}
 const smooth=sampled.map((p,i)=>{const a=sampled[(i+sampled.length-1)%sampled.length],b=sampled[(i+1)%sampled.length];return[(a[0]+6*p[0]+b[0])/8,(a[1]+6*p[1]+b[1])/8];});
 return{ok:true,contour:area(smooth)>0?smooth:smooth.reverse()};
}
export function addDrawPoint(s,p){if(s.phase!=='draw'||s.closed||s.points.length>=1600||p.some(v=>!Number.isFinite(v)))return false;const q=[Math.max(20,Math.min(580,p[0])),Math.max(20,Math.min(460,p[1]))];if(s.points.length&&distance(q,s.points.at(-1))<2)return false;
 if(s.points.length>=3&&Math.abs(area(s.points))>=1200&&distance(q,s.points[0])<12){s.closed=true;return true;}s.points.push(q);return true;}
export function startPrint(s){
 if(s.phase!=='draw')return false;
 if(!s.closed){s.feedback='Schließe die Kontur am Startpunkt oder mit „Kontur schließen“.';return false;}
 const result=validateContour(s.points);if(!result.ok){s.feedback=result.message;return false;}
 s.contour=result.contour;s.progress=0;s.phase='printing';s.attempts++;s.feedback='';return true;
}
export function tickPrint(s,dt){if(s.phase==='printing'&&Number.isFinite(dt)&&dt>0){s.progress=Math.min(1,s.progress+dt/PRINT_SECONDS);if(s.progress>=1)s.phase='fit';}}
export function assessFit(contour,level){
 const board=LEVELS[level],samples=[];
 for(let i=0;i<board.outline.length;i++){const a=board.outline[i],b=board.outline[(i+1)%board.outline.length],steps=Math.ceil(distance(a,b)/3);for(let j=0;j<steps;j++)samples.push([a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps]);}
 const tight=samples.find(p=>!inside(p,contour)||boundaryDistance(p,contour)<6);
 if(tight)return{ok:false,kind:'tight',point:tight,message:'Zu eng: Die Platine stößt an den Rand. Zeichne an der roten Markierung etwas weiter außen.'};
 const loose=contour.find(p=>boundaryDistance(p,board.outline)>board.maxGap);
 if(loose)return{ok:false,kind:'loose',point:loose,message:'Zu viel Spiel: Der Halter ist hier zu weit. Zeichne näher am lila Hilfsrand.'};
 return{ok:true,message:'Passt! Deine Platine sitzt im selbst gezeichneten Halter.'};
}
export function tryFit(s,x,z){
 if(s.phase!=='fit'||!Number.isFinite(x)||!Number.isFinite(z)||Math.hypot(x,z)>.085)return{ok:false,kind:'position',message:'Ziehe die Platine mittig über deinen gedruckten Halter.'};
 const result=assessFit(s.contour,s.level);s.feedback=result.message;
 if(result.ok){s.passed[s.level]=true;s.phase='success';s.completed=s.passed.every(Boolean);}return result;
}
export function chooseLevel(s,level){if(!Number.isInteger(level)||level<0||level>=LEVELS.length||s.phase==='printing')return false;s.level=level;s.phase='draw';s.points=[];s.contour=null;s.closed=false;s.progress=0;s.feedback='';return true;}
