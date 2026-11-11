// Console adapter for Jameson Hodge's MIT-licensed CHIMERA Anatomy3D renderer.
// Only display geometry runs here. No audio, speech planner, or acoustic telemetry.
import * as THREE from 'three';
import { Anatomy3D } from './src/ui/render/anatomy3d.ts';

const el=(id:string)=>document.getElementById(id)!;
let data:any=null, renderer:THREE.WebGLRenderer|null=null, head:Anatomy3D|null=null, model:any=null;
let active=false, lost=false, frameID:number|null=null, previous=0, transitionAt=0;
let from:any=null, goal:any=null, pose:any=null, sequence:string[]=[], sequenceAt=0;
let currentItem:any={code:'-',ipa:['sil']}, serialModel='sc02';
const options={yaw:35,pitch:8,size:100,smooth:true};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let canvas:HTMLCanvasElement;
const clone=(x:any)=>JSON.parse(JSON.stringify(x));
function blend(a:any,b:any,t:number):any {
 if(typeof b==='number')return typeof a==='number'?a+(b-a)*t:b;
 if(Array.isArray(b))return b.map((v,i)=>{
   // Inner/outer outlines have slightly different sample counts between poses.
   // Match their normalized point positions while preserving each target outline.
   if(Array.isArray(a)&&a.length!==b.length&&a.length>1&&b.length>1){const at=i*(a.length-1)/(b.length-1),j=Math.floor(at);return blend(blend(a[j],a[Math.min(j+1,a.length-1)],at-j),v,t);}
   return blend(a?.[i]??v,v,t);
 });
 if(b&&typeof b==='object')return Object.fromEntries(Object.entries(b).map(([k,v])=>[k,blend(a?.[k]??v,v,t)]));
 return b;
}
function init(){
 if(renderer)return;
 data??=JSON.parse(el('chimeraPoseData').textContent!);
 canvas=el('chimeraCanvas') as HTMLCanvasElement;
 renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,premultipliedAlpha:true});
 renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
 head=new Anatomy3D();head.centred=true;
 const body=data.body;
 model={bodyParams:body,tract:{scale:body.scale,P:(x:number,y:number)=>({x:(x>.5?.5+(x-.5)*.86:x)*body.scale,y:(y<7?7-(7-y)*body.pharynx:y)*body.scale})},frame:()=>data.rest.frame};
 pose=clone(data.rest);from=clone(pose);goal=data.rest;
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;stop();el('mouthSource').textContent='Chimera graphics paused — reload to restore';});
 canvas.addEventListener('webglcontextrestored',()=>{lost=false;schedule();});
 let drag:any=null;
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,yaw:options.yaw,pitch:options.pitch};canvas.setPointerCapture(e.pointerId);canvas.focus();});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;setView(Math.max(-90,Math.min(90,drag.yaw+(e.clientX-drag.x)*.3)),Math.max(-30,Math.min(30,drag.pitch+(e.clientY-drag.y)*.2)));});
 const finish=()=>{if(drag){drag=null;saveView();}};
 canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
 canvas.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
   e.preventDefault();e.stopPropagation();setView(Math.max(-90,Math.min(90,options.yaw+(e.key==='ArrowLeft'?-5:e.key==='ArrowRight'?5:0))),Math.max(-30,Math.min(30,options.pitch+(e.key==='ArrowUp'?-3:e.key==='ArrowDown'?3:0))));saveView();
 });
 el('chimeraStatus').textContent='Jaw, lips, tongue and soft palate follow phoneme labels. Demo has no audio.';
}
function setView(yaw:number,pitch:number){options.yaw=yaw;options.pitch=pitch;(el('chimeraYaw') as HTMLInputElement).value=String(Math.round(yaw));el('chimeraAngle').textContent=`${Math.round(yaw)}°`;schedule();}
function saveView(){try{localStorage.setItem('chimeraView',JSON.stringify(options));}catch{}}
function loadView(){try{const s=JSON.parse(localStorage.getItem('chimeraView')||'{}');if(Number.isFinite(s.yaw))options.yaw=Math.max(-90,Math.min(90,s.yaw));if(Number.isFinite(s.pitch))options.pitch=Math.max(-30,Math.min(30,s.pitch));if(Number.isFinite(s.size))options.size=Math.max(50,Math.min(160,s.size));if(typeof s.smooth==='boolean')options.smooth=s.smooth;}catch{}}
function stop(){if(frameID!==null)cancelAnimationFrame(frameID);frameID=null;previous=0;}
function schedule(){if(active&&!lost&&!document.hidden&&frameID===null)frameID=requestAnimationFrame(draw);}
function sample(now:number){
 if(!goal)return;
 const t=reduced.matches||!options.smooth?1:Math.min(1,(now-transitionAt)/90);
 pose=t===1?clone(goal):blend(from,goal,1-Math.pow(1-t,3));
}
function target(id:string,immediate=false){
 sample(performance.now());from=clone(pose);goal=data.poses[id]||data.rest;transitionAt=performance.now();
 if(immediate||id==='sil'){pose=clone(goal);from=clone(pose);transitionAt-=100;}
 canvas.dataset.pose=id;canvas.dataset.jaw=String(goal.artic.jaw);canvas.dataset.lipAperture=String(goal.artic.lipAp);
}
function draw(now:number){
 frameID=null;if(!active||lost||document.hidden||!renderer||!head)return;
 const dt=previous?Math.min(.05,(now-previous)/1000):1/60;previous=now;
 if(sequence.length>1&&now-sequenceAt>135){sequence.shift();sequenceAt=now;target(sequence[0]);}
 sample(now);
 const box=canvas.getBoundingClientRect(),w=Math.max(1,Math.round(box.width)),h=Math.max(1,Math.round(box.height));
 const size=renderer.getSize(new THREE.Vector2());if(size.x!==w||size.y!==h){renderer.setSize(w,h,false);head.resize(w,h);}
 const p=head.poses(model),distance=p.home.distanceTo(p.target),az=options.yaw*Math.PI/180,elevation=options.pitch*Math.PI/180;
 head.camera.position.copy(p.target).add(new THREE.Vector3(Math.sin(az)*Math.cos(elevation),Math.sin(elevation),Math.cos(az)*Math.cos(elevation)).multiplyScalar(distance));
 head.camera.lookAt(p.target);head.camera.updateMatrixWorld();
 if(!reduced.matches)head.face.update(null,dt);else{head.face.lid=0;head.face.nod=0;head.face.tilt=0;}
 head.update(model,pose.frame,pose.artic,null,{grid:false,pressure:false,particles:false,calipers:false},dt);
 renderer.render(head.scene,head.camera);
 canvas.dataset.draws=String(Number(canvas.dataset.draws||0)+1);canvas.dataset.yaw=options.yaw.toFixed(1);
 if(!reduced.matches||now-transitionAt<120||sequence.length>1)schedule();
}
function configure(value:{active:boolean,model:string}){
 serialModel=value.model;const was=active;active=value.active;
 if(!active){stop();sequence=[];return;}
 try{init();if(!was){head!.resetMotion();setPhoneme(currentItem,true);}schedule();}
 catch(error){active=false;el('chimeraStatus').textContent='Chimera needs a browser with working WebGL. '+String(error);el('mouthSource').textContent=el('chimeraStatus').textContent;console.error('Chimera:',error);}
}
function setPhoneme(item:any,immediate=false){
 currentItem=item;if(!active||!renderer||!data)return;
 const ipa=item.ipa.find((x:string)=>data.sequences[x]?.length)||'sil';
 const next=data.sequences[ipa]||['sil'];
 canvas.dataset.phoneme=item.code;canvas.dataset.ipa=ipa;canvas.dataset.model=serialModel;
 canvas.setAttribute('aria-label',`Chimera anatomical head — ${item.code}: ${item.description||ipa}`);
 sequence=next.slice();sequenceAt=performance.now();target(sequence[0],immediate);schedule();
}
loadView();
(el('chimeraYaw') as HTMLInputElement).value=String(Math.round(options.yaw));el('chimeraAngle').textContent=`${Math.round(options.yaw)}°`;
(el('chimeraSize') as HTMLInputElement).value=String(options.size);el('chimeraSizeValue').textContent=`${options.size}%`;
el('chimeraCanvas').style.setProperty('--head-size',String(options.size/100));
el('chimeraSmooth').setAttribute('aria-pressed',String(options.smooth));el('chimeraSmooth').classList.toggle('selected',options.smooth);
el('chimeraYaw').addEventListener('input',e=>{setView(Number((e.target as HTMLInputElement).value),options.pitch);saveView();});
el('chimeraSize').addEventListener('input',e=>{options.size=Number((e.target as HTMLInputElement).value);el('chimeraSizeValue').textContent=`${options.size}%`;el('chimeraCanvas').style.setProperty('--head-size',String(options.size/100));saveView();schedule();});
el('chimeraSmooth').addEventListener('click',()=>{options.smooth=!options.smooth;el('chimeraSmooth').setAttribute('aria-pressed',String(options.smooth));el('chimeraSmooth').classList.toggle('selected',options.smooth);saveView();schedule();});
el('chimeraReset').addEventListener('click',()=>{setView(35,8);options.size=100;(el('chimeraSize') as HTMLInputElement).value='100';el('chimeraSizeValue').textContent='100%';el('chimeraCanvas').style.setProperty('--head-size','1');saveView();schedule();});
new ResizeObserver(()=>schedule()).observe(el('chimeraCanvas'));
reduced.addEventListener('change',()=>schedule());
window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else schedule();});
(window as any).ConsoleChimera=Object.freeze({configure,setPhoneme,pause:stop});
