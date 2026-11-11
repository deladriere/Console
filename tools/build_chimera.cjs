// Regenerate the offline CHIMERA head poses and inline renderer.
// node tools/build_chimera.cjs --modules /path/to/node_modules [--wasm /path/to/chimera.wasm]
// Build dependencies: esbuild 0.27.0, three 0.186.1. No runtime downloads.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),file=path.join(root,'Console.html');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const modules=arg('--modules');if(!modules)throw Error('Pass --modules /path/to/node_modules containing three and esbuild');
const esbuild=require(path.resolve(modules,'esbuild'));
async function bake(wasm,html){
 const {instance}=await WebAssembly.instantiate(fs.readFileSync(wasm),{}),e=instance.exports;
 const enc=new TextEncoder(),dec=new TextDecoder();
 function call(fn,args={}){const b=enc.encode(JSON.stringify({fn,...args})),p=e.chimera_alloc(b.length);new Uint8Array(e.memory.buffer,p,b.length).set(b);const status=e.chimera_call(p,b.length);e.chimera_free(p,b.length);const v=JSON.parse(dec.decode(new Uint8Array(e.memory.buffer,e.chimera_result_ptr(),e.chimera_result_len())));if(status)throw Error(JSON.stringify(v));return v;}
 const cat=call('catalog'),body={female:0,child:0},m=call('model',{body,sampleRate:48000});
 const mouth=html.match(/<script id="consoleMouth">([\s\S]*?)<\/script>/)[1],ctx=vm.createContext({});
 vm.runInContext(mouth.slice(mouth.indexOf('const visemeTable'),mouth.indexOf('// Robomouth SC-01/SC-02'))+';globalThis.tables={sc01:votraxSC01Table,sc02:votraxSC02Table,sam:samTable,monk:monkTable};',ctx);
 const ipas=[...new Set(Object.values(ctx.tables).flat().flatMap(x=>x.ipa))].filter(x=>x!=='sil');
 const rest={...cat.neutral,jaw:0,lipAp:0,labiodental:0};
 const data={neutral:cat.neutral,body:m.body,keys:cat.articKeys,rest:{artic:rest,frame:call('frame',{model:m.model,artic:rest})},poses:{},sequences:{},wasmSHA256:hash(fs.readFileSync(wasm))};
 // Console's source tables include spelling variants, clusters and vowel variants
 // absent from CHIMERA's inventory. Use explicit nearest display equivalents.
 const aliases={'ɡ':['g'],'ju':['j','u'],'ɛə':['ɛ','ə'],'ɑː':['ɑ'],'lb':['l','b'],'əl':['ə','l'],'əm':['ə','m'],'ən':['ə','n'],'ʍ':['w'],'ʏ':['y'],'ɶ':['œ'],'ɵ':['ø']};
 data.approximations=aliases;
 for(const ipa of ipas){
   const plan=call('planUtterance',{segments:(aliases[ipa]||[ipa]).map(ipa=>({ipa,dur:.32})),options:{body,t0:0,intonation:'flat',openEnd:true}});
   const segments=plan.segments.filter(s=>s.kind!=='pause');
   data.sequences[ipa]=[];
   for(const s of segments){
     const id=s.ipa,t=(s.t0+s.t1)/2;
     if(!data.poses[id]){
       const artic={...cat.neutral};
       // Evaluate the upstream gestural score at the segment centre. Use a weighted
       // average of active articulator targets to make a static display preset.
       for(const key of cat.articKeys){let sum=0,weight=0;
         for(const g of plan.gestures){if(g.targets[key]===undefined)continue;let a=1;
           if(t<=g.t0-g.rampIn||t>=g.t1+g.rampOut)a=0;
           else if(t<g.t0)a=.5-.5*Math.cos(Math.PI*(t-g.t0+g.rampIn)/Math.max(1e-6,g.rampIn));
           else if(t>g.t1)a=.5+.5*Math.cos(Math.PI*(t-g.t1)/Math.max(1e-6,g.rampOut));
           const w=a*g.strength;sum+=w*g.targets[key];weight+=w;
         }
         if(weight>0)artic[key]=sum/weight;
       }
       data.poses[id]={artic,frame:call('frame',{model:m.model,artic})};
     }
     data.sequences[ipa].push(id);
   }
   if(!segments.length)data.sequences[ipa]=['sil'];
 }
 data.poses.sil=data.rest;data.sequences.sil=['sil'];
 // Round display geometry to 0.0001 cm; preserve upstream point indices and topology.
 return JSON.parse(JSON.stringify(data,(_,v)=>typeof v==='number'?Math.round(v*1e4)/1e4:v));
}
(async()=>{
 let html=fs.readFileSync(file,'utf8');
 const previous=html.match(/<script id="chimeraPoseData" type="application\/json">([\s\S]*?)<\/script>/);
 html=html.replace(/<script id="chimeraPoseData" type="application\/json">[\s\S]*?<\/script>\s*<script id="consoleChimera">[\s\S]*?<\/script>\s*/,'');
 const data=arg('--wasm')?await bake(arg('--wasm'),html):previous?JSON.parse(previous[1]):null;
 if(!data)throw Error('First build requires --wasm');
 const build=await esbuild.build({entryPoints:[path.join(root,'assets/chimera/console-chimera.ts')],bundle:true,write:false,format:'iife',target:'es2020',supported:{'template-literal':false},minify:true,legalComments:'inline',nodePaths:[path.resolve(modules)]});
 const notices=['LICENSE-CHIMERA.txt','LICENSE-THREE.txt'].map(p=>fs.readFileSync(path.join(root,'assets/chimera',p),'utf8')).join('\n\n');
 const bundle=('/*! CHIMERA and Three.js licence notices\n'+notices+'\n*/\n'+build.outputFiles[0].text).replace(/<\/script/gi,'<\\/script');
 const scripts=`<script id="chimeraPoseData" type="application/json">${JSON.stringify(data)}</script>\n<script id="consoleChimera">\n${bundle}</script>\n`;
 html=html.replace(/<script id="chimeraPoseData" type="application\/json">[\s\S]*?<\/script>\s*<script id="consoleChimera">[\s\S]*?<\/script>\s*/,'');
 html=html.replace('<script id="consoleMouth">',()=>scripts+'<script id="consoleMouth">');fs.writeFileSync(file,html);
 const metadata={project:'CHIMERA',author:'Jameson Hodge',license:'MIT',source:'https://github.com/jamesondh/chimera-vocal-synth',revision:'6259e880f5d0108b862e98cefd930aa8c5bc0dc5',sourceFiles:['anatomy3d.ts','beams3d.ts','expression.ts','geom.ts','profile.ts','vector.ts','../colors.ts'],adaptations:'Removed unused faceView/handle overlay from Anatomy3D. Console supplies baked anatomy frames and phoneme gestures; no audio engine or measured telemetry runs in Console.',geometryGeneratorURL:'https://chimera-vocal-synth.vercel.app/assets/chimera-BuGQbnb-.wasm',geometryGeneratorSHA256:data.wasmSHA256,geometryNote:'Geometry generated from the upstream deployed engine retrieved 2026-11-11; its binary revision is not advertised. Renderer source is separately pinned above.',threeVersion:'0.186.1',poseCount:Object.keys(data.poses).length,embeddedDataSHA256:hash(JSON.stringify(data)),embeddedRendererSHA256:hash(bundle)};
 fs.writeFileSync(path.join(root,'assets/chimera/provenance.json'),JSON.stringify(metadata,null,2)+'\n');
 console.log(`CHIMERA: ${metadata.poseCount} poses, ${Object.keys(data.sequences).length} IPA mappings, ${bundle.length} renderer bytes, ${JSON.stringify(data).length} data bytes`);
})();
