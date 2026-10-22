// Validate the actual embedded CC0 mesh and source morph targets, not an imitation.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const html=fs.readFileSync(path.join(__dirname,'../Console.html'),'utf8');
const modelText=html.match(/<script id="head3DModelData" type="application\/json">([\s\S]*?)<\/script>/)[1];
const data=JSON.parse(modelText);
const provenance=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/head3d/provenance.json'),'utf8'));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.strictEqual(hash(modelText),provenance.embeddedAssetSHA256);
assert.strictEqual(data.meta.name,'MakeHuman hm08 head');assert.strictEqual(data.meta.license,'CC0-1.0');
assert.strictEqual(data.meta.visemeAuthor,'Mika Suominen');assert.strictEqual(data.meta.revision,provenance.revision);
assert.strictEqual(data.vertices.length,4858);assert.strictEqual(data.faces.length,4786);assert.strictEqual(data.targets.length,22);
assert.strictEqual(data.materials.length,data.vertices.length);
for(const p of data.vertices)for(const x of p)assert(Number.isFinite(x));
for(const face of data.faces)for(const id of face)assert(Number.isInteger(id)&&id>=0&&id<data.vertices.length);
for(const target of data.targets)for(const [id,...delta] of target){assert(id>=0&&id<data.vertices.length);assert(delta.length===3&&delta.every(Number.isFinite));}
assert.deepStrictEqual([...new Set(data.materials)].sort(),[0,1,2,3]);
const code=html.slice(html.indexOf('    function prepareHumanHead('),html.indexOf('    function createWireframe('));
const context=vm.createContext({});vm.runInContext(code+';globalThis.prepare=prepareHumanHead;',context);
const mesh=context.prepare(data),weights=new Float32Array(22);weights[0]=1;mesh.blend(weights);
assert.strictEqual(mesh.positions.length,4858*3);assert.strictEqual(mesh.triangles.length%3,0);assert.strictEqual(mesh.edges.length%2,0);
assert.deepStrictEqual([...mesh.positions],[...mesh.base]);
const neutral=mesh.positions.slice();
const gap=()=>Math.abs(mesh.positions[data.landmarks.upperLip*3+1]-mesh.positions[data.landmarks.lowerLip*3+1]);
const neutralGap=gap(),shapes=new Set();
for(let i=0;i<22;i++) {
 weights.fill(0);weights[i]=1;mesh.blend(weights);
 for(const x of mesh.positions)assert(Number.isFinite(x));
 for(let k=0;k<mesh.normals.length;k+=3){const n=Math.hypot(mesh.normals[k],mesh.normals[k+1],mesh.normals[k+2]);assert(Math.abs(n-1)<.0001||n===0);}
 shapes.add(hash(Buffer.from(mesh.positions.buffer)));
}
assert(shapes.size>=20,'Mouth targets must produce distinct mesh positions');
weights.fill(0);weights[2]=1;mesh.blend(weights);const open=mesh.positions.slice();assert(gap()>neutralGap*2);
weights.fill(0);weights[0]=.5;weights[2]=.5;mesh.blend(weights);
for(let i=0;i<mesh.positions.length;i++)assert(Math.abs(mesh.positions[i]-(neutral[i]+open[i])*.5)<.000001);
// Source vertices are translated, not rebuilt into a procedural head.
assert.strictEqual(data.sourceVertexIDs.length,data.vertices.length);
assert(data.meta.meshURL.includes(data.meta.revision));assert(data.meta.meshSHA256.length===64&&data.meta.visemeSHA256.length===64);
assert(html.includes("wire.setViseme(item.viseme,"));assert(!html.includes('wire.setPose('));
assert(html.includes('id="head3DStyle"'));assert(html.includes('Solid (shaded)'));assert(html.includes('showHead3DSources()'));
assert(html.includes('canvas:not(#scopeCanvas):not(#barsCanvas):not(#mouthWireframe)'));
assert(html.includes('id="head3DSwitch"'));assert(html.includes('Enable 3D Head'));
assert(html.includes('id="head3DSize"'));assert(html.includes('--head-size'));
assert(html.includes('body.head-fullscreen'));assert(html.includes('document.documentElement.requestFullscreen()'));
assert(/id="head3DMenu" class="menu-item"(?!.*dev-only)/.test(html.match(/<div id="head3DMenu"[^>]*>/)[0]),'3D Head must stay in the main menu');
assert(!html.includes('submenu-item dev-only" onclick="showHelp()"'),'Help must stay visible without developer mode');
// Transparent clear keeps Scope/Hydra around the head; the mesh fill stays opaque so the face masks the waveform.
assert(html.includes("{alpha:true,premultipliedAlpha:true"));assert(html.includes('gl.clearColor(0,0,0,0)'));
assert(html.includes('gl_FragColor=vec4((solid<-.5 || pupil)?color:vec3(0.),1.)'),'Wireframe fill must mask Scope behind the face');
console.log('PASS: source CC0 mesh and 22 visemes, provenance checksum, material groups, finite geometry, smooth normals, distinct poses, true source interpolation, style selector, toggle switch, head fullscreen with Scope, transparent canvas and About sources.');
// Eyelids affect the eye region only and compose with every speech pose.
assert.strictEqual(data.blinks.length,2);
assert.strictEqual(data.meta.blinkSHA256,provenance.blinkSHA256);
for(const target of data.blinks) {
 assert(target.length>50);
 for(const [id,...delta] of target) {
  assert(data.vertices[id][1]>-.4,'Blink must not deform the jaw or lips');
  assert.strictEqual(data.materials[id],0,'Blink must move eyelids, not eyeballs');
  assert(delta.length===3&&delta.every(Number.isFinite));
 }
}
for(let pose=0;pose<22;pose++) {
 weights.fill(0);weights[pose]=1;mesh.blend(weights);const before=mesh.positions.slice();
 mesh.blend(weights,1);let changed=0;
 for(let i=0;i<before.length;i++)if(before[i]!==mesh.positions[i])changed++;
 assert(changed>100);
 for(const id of [data.landmarks.upperLip,data.landmarks.lowerLip])
  assert.deepStrictEqual([...mesh.positions.slice(id*3,id*3+3)],[...before.slice(id*3,id*3+3)]);
 assert([...mesh.normals].every(Number.isFinite));
 mesh.blend(weights,0);assert.deepStrictEqual([...mesh.positions],[...before]);
}
// Deterministic fake timers verify irregular spacing, no duplicate timers on
// repeated configure calls, reopening and cancellation when hidden/reduced.
vm.runInContext(';globalThis.makeBlink=createHeadBlink;',context);
let now=0,notifications=0,nextID=0;const timers=new Map(),delays=[],randoms=[0,1,.25];
const blink=context.makeBlink(()=>notifications++,()=>now,()=>randoms.shift()??.5,(fn,delay)=>{timers.set(++nextID,{fn,delay});delays.push(delay);return nextID;},id=>timers.delete(id));
function fire(){const [id,{fn,delay}]=[...timers][0];timers.delete(id);now+=delay;fn();}
assert.strictEqual(blink.sample(now),0);blink.setActive(true);blink.setActive(true);assert.strictEqual(timers.size,1);
assert.strictEqual(delays[0],3000);fire();assert.strictEqual(notifications,1);assert(blink.animating);
assert.strictEqual(blink.sample(now+70),1);assert.strictEqual(blink.sample(now+90),1);
assert(blink.sample(now+150)>0&&blink.sample(now+150)<1);now+=220;
assert.strictEqual(blink.sample(now),0);assert(!blink.animating);assert.strictEqual(timers.size,1);assert.strictEqual(delays[1],7000);
blink.setActive(false);assert.strictEqual(timers.size,0);assert.strictEqual(blink.sample(now),0);
blink.setActive(true);fire();assert(blink.animating);blink.setActive(false);assert(!blink.animating);assert.strictEqual(blink.sample(now),0);assert.strictEqual(timers.size,0);
console.log('PASS: CC0 eyelid targets, independent speech/blink blending, exact reopening, irregular blink timing and hidden/reduced-motion cancellation.');
