// Test Console's actual SC-01 parser against the Talko firmware and captured USB serial stream.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const firmware=path.resolve(process.argv[2]||path.join(__dirname,'../../../../Talko 2/Software/Talko_Robotrax'));
const consoleRoot=path.resolve(process.argv[3]||path.join(__dirname,'..'));
const html=fs.readFileSync(path.join(consoleRoot,'Console.html'),'utf8');
const mouth=html.match(/<script id="consoleMouth">([\s\S]*?)<\/script>/)[1];
const tableCode=mouth.slice(mouth.indexOf('const visemeTable'),mouth.indexOf('// Robomouth SC-01/SC-02'));
const receiveCode=mouth.slice(mouth.indexOf('    function receive('),mouth.indexOf("    el('mouthEnabled').addEventListener"));
const shown=[];
const context=vm.createContext({active:true,settings:{model:'sc01'},buffer:'',dropping:false,
  stopDemo(){},show(code){shown.push(code);}});
vm.runInContext(tableCode+`
 const tables={sc01:votraxSC01Table,sc02:votraxSC02Table};
 const maps=Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,new Map(v.map(x=>[x.code,x]))]));
 globalThis.sc01Codes=[...maps.sc01.keys()];
`+receiveCode,context);
const core=fs.readFileSync(path.join(firmware,'src/votrax.cpp'),'utf8');
const names=[...core.match(/PhonemeNames\[65\] = \{([\s\S]*?)nullptr/)[1].matchAll(/"(\w+)"/g)].map(x=>x[1]);
assert.strictEqual(names.length,64);
assert.deepStrictEqual([...context.sc01Codes].sort(),names.slice().sort());
const trace=fs.readFileSync(path.join(firmware,'validation/serial-bench.log'),'utf8');
const known=new Set(names);
const expected=trace.split(/\r?\n/).filter(line=>known.has(line));
assert(expected.length>1000,'A real hardware capture with phoneme labels is required');
for(const size of [1,2,7,64,257]) {
 shown.length=0;context.buffer='';context.dropping=false;
 for(let i=0;i<trace.length;i+=size)context.receive(trace.slice(i,i+size));
 assert.deepStrictEqual(shown,expected,'actual serial capture at chunk size '+size);
}
assert(expected.includes('PA0')&&expected.includes('PA1')&&expected.includes('STOP'));
assert(expected.some((x,i)=>x==='L'&&expected[i+1]==='L'),'Repeated L events must survive');
assert.strictEqual(expected.at(-1),'STOP','The final mouth pose must be closed');
console.log(`PASS: all 64 Talko SC-01 labels match Console; ${expected.length} captured events parse unchanged at five chunk sizes; diagnostics ignored, repeated phones and silence retained.`);
