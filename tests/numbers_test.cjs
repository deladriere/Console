// Actual serial reader + numeric parser, exercised with recorded Robotrax output.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(process.argv[2]||path.join(root,'Console.html'),'utf8');
const trace=fs.readFileSync(path.join(__dirname,'fixtures/robotrax-digits.log'),'utf8');
const start=html.indexOf('    function createNumberInput('),end=html.indexOf('    async function readSerialLoop(');
const helper=start<0?'':html.slice(start,end);
const readerCode=html.slice(end,html.indexOf('    function cleanCaption(',end));
const lineStart=html.indexOf('    function processSerialLine(');
const lineCode=html.slice(lineStart,html.indexOf('    // Handle serial disconnect event',lineStart));
async function replay(chunks,mode='row10',enabled=true){
 const shown=[],mouth=[],bit=[];let index=0;
 const context=vm.createContext({serialConnected:true,textDisplayEnabled:enabled,currentTextInputMode:mode,currentLine:'',bytesReceived:0,
  console:{log(){},error(){}},setBigText:x=>shown.push(String(x)),stopWordSlicing(){},receiveCaptionChunk:x=>x,
  window:{ConsoleMouth:{receive:x=>mouth.push(x),reset(){}},ConsoleBit:{receive:x=>bit.push(x),reset(){}}},
  reader:{async read(){return index<chunks.length?{value:chunks[index++],done:false}:{done:true};}}});
 vm.runInContext(helper+readerCode+lineCode+(helper?'\nconst numberInput=createNumberInput(setBigText);':''),context);
 await context.readSerialLoop();assert.deepStrictEqual(mouth,chunks.filter(Boolean));assert.deepStrictEqual(bit,chunks.filter(Boolean));
 return shown;
}
(async()=>{
 for(const size of [1,2,7,64,257,trace.length]){
  const chunks=[];for(let i=0;i<trace.length;i+=size)chunks.push(trace.slice(i,i+size));
  assert.deepStrictEqual(await replay(chunks),['0','1','2','3','4','5','6','7','8','9'],`Recorded digits at chunk size ${size}`);
 }
 const seven=trace.match(/^PLAY bank=4 item=8 label="SEVEN"[^\n]*\n[\s\S]*?^RESULT[^\n]*\n/m)[0];
 for(let split=0;split<=seven.length;split++)assert.deepStrictEqual(await replay([seven.slice(0,split),seven.slice(split)]),['7']);
 for(const mode of ['row','row10','pulse','zoom'])assert.deepStrictEqual(await replay([seven],mode),['7']);
 assert.deepStrictEqual(await replay([seven],'row10',false),[]);
 const german=['NULL','EINS','ZWEI','DREI','VIER','FUENF','SECHS','SIEBEN','ACHT','NEUN'];
 const germanTrace=german.map((label,i)=>`PLAY bank=12 item=${i+1} label="${label}" mode=speech\r\nEH1\r\nOO1\r\nSTOP\r\nRESULT label="${label}" clipped=0\r\n`).join('');
 for(const mode of ['row','row10','pulse','zoom']) {
  const chunks=Array.from(germanTrace);
  assert.deepStrictEqual(await replay(chunks,mode),german.map((_,i)=>String(i)),`German labels in ${mode}`);
 }
 assert.deepStrictEqual(await replay(['FÜNF\nfu','enf\nfünf\n']),['5','5','5']);
 assert.deepStrictEqual(await replay(['Hello world\n'],'word'),['Hello','world']);
 const shown=[],context=vm.createContext({out:x=>shown.push(String(x))});vm.runInContext(helper+';globalThis.input=createNumberInput(out);',context);
 const input=context.input;
 input.receive('PLAY bank=4 item=8 label="SE');assert.deepStrictEqual(shown,[]);
 input.receive('VEN" mode=speech');assert.deepStrictEqual(shown,[]);input.receive('\n');assert.deepStrictEqual(shown,['7']);
 shown.length=0;input.receive('EH1\nPA0\nY1\nSTOP\nRESULT label="SEVEN" status=done clipped=0\nTalko 2 Robotrax v0.6\n');assert.deepStrictEqual(shown,[]);
 input.receive('0\r\n-12.5\n+3\nseven\nTWENTY\nNINETY\nHUNDRED\nTHOUSAND\n');assert.deepStrictEqual(shown,['0','-12.5','+3','7','20','90','100','1000']);
 shown.length=0;input.receive('7');input.reset();input.receive('\n');assert.deepStrictEqual(shown,[]);
 input.receive('x'.repeat(520)+'7\n\x007\n8\n');assert.deepStrictEqual(shown,['8']);
 shown.length=0;input.receive(seven+seven);assert.deepStrictEqual(shown,['7','7'],'Each repeated utterance must retrigger the same number');
 assert(!readerCode.includes('numMatches'),'Raw substring number extraction must stay removed');
 console.log('PASS: real ZERO–NINE serial capture, six chunk sizes, every SEVEN split, exact digits in all numeric modes, no diagnostic/phoneme resets, repeats, numeric words/decimals, bounded input and unchanged mouth/Bit routing.');
})();
