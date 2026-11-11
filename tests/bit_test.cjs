const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../Console.html'),'utf8');
const script=html.match(/<script id="consoleBit">([\s\S]*?)<\/script>/)[1];
const pure=script.slice(script.indexOf('    function createBitMeshes'),script.indexOf('    // Browser adapter.'));
const context=vm.createContext({});vm.runInContext(pure+';globalThis.mesh=createBitMeshes();globalThis.makeInput=createBitInput;',context);
for(const [key,count] of Object.entries({neutralA:20,neutralB:12,yes:8,no:60})) {
 const faces=context.mesh[key];assert.strictEqual(faces.length,count);
 for(const face of faces) {
  assert(face.length>=3);assert(face.every(p=>p.length===3&&p.every(Number.isFinite)));
  const [a,b,c]=face,u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const centre=a.map((_,i)=>face.reduce((t,p)=>t+p[i],0)/face.length);
  assert(n.reduce((t,v,i)=>t+v*centre[i],0)>0,'outward nondegenerate faces');
 }
}
let out=[];const input=context.makeInput((w,live)=>out.push([w,live]),()=>out.push(['STOP']));
const packet='PLAY bank=10 item=1 label="YES" mode=speech\r\nY1\nEH3\nEH1\nS\nSTOP\nPLAY bank=10 item=2 label="NO" mode=speech\nN\nOO1\nO1\nU1\nSTOP\n';
const expected=[['YES',true],['STOP'],['NO',true],['STOP']];
for(let split=0;split<=packet.length;split++) {
 input.reset();out=[];input.receive(packet.slice(0,split));input.receive(packet.slice(split));assert.deepStrictEqual(out,expected);
}
input.reset();out=[];for(const c of packet)input.receive(c);assert.deepStrictEqual(out,expected);
input.reset();out=[];input.receive('YES\nno!\nNOISE\nY1\nNOT YES\n<YES>\n');assert.deepStrictEqual(out,[['YES',true],['NO',true]]);
input.reset();out=[];input.receive('\x1eVAX:Y');input.receive('ES\x1f\n\x1eSAM:NO\x1f\n');assert.deepStrictEqual(out,[['YES',false]]);
input.reset();out=[];input.receive('x'.repeat(600)+'YES\nNO\n');assert.deepStrictEqual(out,[['NO',true]]);
input.reset();out=[];input.receive('PLAY bank=9 item=1 label="VOICE" mode=speech\nRESULT label="YES" status=done\n');assert.deepStrictEqual(out,[['STOP'],['STOP']]);
input.reset();out=[];input.receive('PLAY bank=10 item=1 label="YES" mode=repeat\nY1\nSTOP\nY1\nSTOP\nY1\nRESULT label="YES" status=cut\nY1\n');assert.deepStrictEqual(out,[['YES',true],['STOP'],['YES',true],['STOP'],['YES',true],['STOP']]);
const wordPacket='YES\r\nPLAY bank=10 item=1 label="YES" mode=repeat stream=words\r\nSTOP\r\nYES\r\nSTOP\r\nNO\r\nPLAY bank=10 item=2 label="NO" mode=speech stream=words\r\nSTOP\r\n';
const wordExpected=[['YES',true],['STOP'],['YES',true],['STOP'],['NO',true],['STOP']];
for(let split=0;split<=wordPacket.length;split++) {
 input.reset();out=[];input.receive(wordPacket.slice(0,split));input.receive(wordPacket.slice(split));assert.deepStrictEqual(out,wordExpected);
}
input.reset();out=[];for(const c of wordPacket)input.receive(c);assert.deepStrictEqual(out,wordExpected);
input.reset();out=[];input.receive('\x1eBIT:YES\x1f\nSTOP\n\x1eBIT:NO\x1f\nSTOP\n');assert.deepStrictEqual(out,[['YES',true],['STOP'],['NO',true],['STOP']]);
assert(html.includes('window.ConsoleBit.receive(rawChunk);'));
assert(html.includes('window.ConsoleBit.handleSpace() || window.ConsoleMouth.handleSpace()'));
console.log('PASS: independent 3D Bit meshes, outward faces; YES/NO Talko metadata, plain words and VAX captions; split/byte streams, silence, input bounds and diagnostics; shared serial/fullscreen wiring.');
const captureRoot=path.resolve(process.argv[2]||path.join(__dirname,'../../../../Talko 2/Software/Talko_Robotrax'));
if(fs.existsSync(path.join(captureRoot,'validation/yes-no-repeat.log'))) {
 const full=fs.readFileSync(path.join(captureRoot,'validation/serial-bench.log'),'utf8');
 const repeated=fs.readFileSync(path.join(captureRoot,'validation/yes-no-repeat.log'),'utf8');
 const repeatStats=JSON.parse(fs.readFileSync(path.join(captureRoot,'validation/yes-no-repeat.json'),'utf8'));
 const wordStream=/\bstream=words\b/.test(full);
 const expectedWords=wordStream?full.split(/\r?\n/).filter(s=>/^(YES|NO)$/.test(s)):full.split(/\r?\n/).map(s=>s.match(/^PLAY\b.*\blabel="(YES|NO)"/)).filter(Boolean).map(m=>m[1]);
 assert(expectedWords.length>=6);
 for(const size of [1,7,64,257]) {
  input.reset();out=[];for(let i=0;i<full.length;i+=size)input.receive(full.slice(i,i+size));
  assert.deepStrictEqual(out.filter(x=>x[0]!=='STOP').map(x=>x[0]),expectedWords);
  input.reset();out=[];for(let i=0;i<repeated.length;i+=size)input.receive(repeated.slice(i,i+size));
  for(const row of repeatStats)assert.strictEqual(out.filter(x=>x[0]===row.label).length,row.repeated_word_starts??row.repeated_phone_starts);
  assert.strictEqual(out.at(-1)[0],'STOP');
 }
 console.log('PASS: actual Talko YES/NO word and repeat captures, four chunk sizes, every repeated answer and final cut retained.');
}
