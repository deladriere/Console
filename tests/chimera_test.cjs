// Check actual offline anatomy assets, source notices and all Console IPA mappings.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'Console.html'),'utf8');
const content=id=>html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`))[1];
const text=content('chimeraPoseData'),data=JSON.parse(text),meta=JSON.parse(fs.readFileSync(path.join(root,'assets/chimera/provenance.json'),'utf8'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.equal(sha(text),meta.embeddedDataSHA256);assert.equal(sha(content('consoleChimera').replace(/^\n/,'')),meta.embeddedRendererSHA256);
assert.equal(meta.license,'MIT');assert.equal(meta.author,'Jameson Hodge');assert(meta.geometryGeneratorSHA256.length===64);
for(const name of ['LICENSE-CHIMERA.txt','LICENSE-THREE.txt'])assert(content('consoleChimera').includes(fs.readFileSync(path.join(root,'assets/chimera',name),'utf8').trim()));
const mouth=content('consoleMouth'),ctx=vm.createContext({});
vm.runInContext(mouth.slice(mouth.indexOf('const visemeTable'),mouth.indexOf('// Robomouth SC-01/SC-02'))+';globalThis.tables={sc01:votraxSC01Table,sc02:votraxSC02Table,sam:samTable,monk:monkTable};',ctx);
let labels=0;for(const entries of Object.values(ctx.tables))for(const item of entries){labels++;assert(item.ipa.some(ipa=>data.sequences[ipa]?.length),`No Chimera pose for ${item.code}: ${item.ipa}`);}
const finite=x=>{if(typeof x==='number')assert(Number.isFinite(x));else if(x&&typeof x==='object')Object.values(x).forEach(finite);};
finite(data);assert.equal(Object.keys(data.poses).length,meta.poseCount);assert(meta.poseCount>30);
for(const seq of Object.values(data.sequences))for(const id of seq)assert(data.poses[id]);
for(const p of Object.values(data.poses)){
 assert.equal(p.frame.tongue.length,53);assert.equal(p.frame.upperLip.length,12);assert.equal(p.frame.lowerLip.length,12);
 assert(p.frame.grid.length>30);assert.deepStrictEqual(Object.keys(p.artic).sort(),data.keys.slice().sort());
}
// Internal articulation must distinguish sounds which share a 2D viseme.
assert.equal(data.poses.m.artic.lipAp,data.poses.p.artic.lipAp);
assert(data.poses.m.artic.velum>data.poses.p.artic.velum);
assert(data.poses.n.artic.velum>data.poses.t.artic.velum);
assert(data.poses['ɑ'].artic.jaw>data.poses.u.artic.jaw*3);
assert(data.poses.u.artic.lipProt>data.poses.i.artic.lipProt);
assert.deepStrictEqual(data.sequences['ɡ'],['g']);assert.deepStrictEqual(data.sequences.ju,['j','u']);
assert.deepStrictEqual(data.sequences['əl'],['ə','l']);assert(data.sequences['aʊ'].length===2);
assert.equal(data.poses.sil.artic.jaw,0);assert.equal(data.poses.sil.artic.lipAp,0);
const scripts=[...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)];
for(const script of scripts)if(!/type="(?:application\/json|module|importmap)"/.test(script[0].split('>')[0])&&!/\bsrc=/.test(script[0].split('>')[0]))new vm.Script(script[1]);
assert.equal((html.match(/<script id="consoleMouth">/g)||[]).length,1);
assert(/id="chimeraMenu" class="menu-item"/.test(html));
for(const selector of html.matchAll(/canvas:not\(#scopeCanvas\)[^'"{]+/g))assert(selector[0].includes(':not(#chimeraCanvas)'),'Hydra selector includes Chimera');
console.log(`PASS: ${labels} labels across four models; ${meta.poseCount} finite anatomical poses, compound sounds, internal articulator differences, silence, licence notices, asset hashes, syntax and Hydra isolation.`);
