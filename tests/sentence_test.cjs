// Exercise the actual Console parser, not a duplicated implementation.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../Console.html'), 'utf8');
const code = html.slice(html.indexOf('    function cleanCaption('), html.indexOf('    function wrapSentence('));
const shown = [];
let now = 0, timerId = 0;
const timers = new Map();
function tick(ms) {
 const target = now + ms;
 for (;;) {
  const next = [...timers].sort((a,b)=>a[1].at-b[1].at)[0];
  if (!next || next[1].at > target) break;
  now=next[1].at;timers.delete(next[0]);next[1].callback();
 }
 now=target;
}
const context = vm.createContext({ captionBuffer: '', currentTextInputMode: 'sentence',
 textDisplayEnabled: true, latestCaption: '', wordSliceTimer: null, wordSliceToken: 0,
 setTimeout: (callback,ms)=>{const id=++timerId;timers.set(id,{callback,at:now+ms});return id},
 clearTimeout: id=>timers.delete(id), setBigText: text => shown.push(text) });
vm.runInContext(code, context);
const frame = text => '\x1eVAX:' + text + '\x1f\r\n';
const native = '[:n0][:rate 135][:dv ap 110 pr 5]Welcome [_<0,1>]to the [:dv br 0]machine.';
const packet = frame(native);
for (let split = 0; split <= packet.length; split++) {
 shown.length = 0; context.captionBuffer = '';
 context.receiveCaptionChunk('Version 1.0\r\n$ '+packet.slice(0,split));
 context.receiveCaptionChunk(packet.slice(split));
 assert.deepStrictEqual(shown,['Welcome to the machine.']);
}
shown.length=0; context.captionBuffer='';
for(const char of packet) context.receiveCaptionChunk(char);
assert.deepStrictEqual(shown,['Welcome to the machine.']);
shown.length=0; context.captionBuffer='';
context.receiveCaptionChunk(frame('Old')+'\x1eVAX:Discard unfinished');
context.receiveCaptionChunk(frame('[:rate 75]Newest phrase.'));
assert.deepStrictEqual(shown,['Old','Newest phrase.']);
assert.strictEqual(context.captionBuffer,'');
shown.length=0;
context.receiveCaptionChunk(frame('[:dv ap 90]')); // no readable words
context.receiveCaptionChunk('Diagnostics 123\r\n');
context.receiveCaptionChunk(frame('Text\r\ninterleaved diagnostic'));
assert.deepStrictEqual(shown,[]);
context.receiveCaptionChunk(frame('<img src=x onerror=alert(1)>'));
assert.deepStrictEqual(shown,['<img src=x onerror=alert(1)>']); // renderer uses textContent
shown.length=0; context.currentTextInputMode='word';
assert.strictEqual(context.receiveCaptionChunk('hello '+frame(native)+'world '),'hello \r\nworld ');
assert.deepStrictEqual(shown,[]);
context.currentTextInputMode='sentence';context.textDisplayEnabled=false;
context.receiveCaptionChunk(frame('Hidden'));assert.deepStrictEqual(shown,[]);
context.receiveCaptionChunk('\x1eVAX:'+'x'.repeat(5000));
assert(context.captionBuffer.length<=4096);
context.textDisplayEnabled=true;context.receiveCaptionChunk(frame('Recovered'));
assert.deepStrictEqual(shown,['Recovered']);
shown.length=0; context.currentTextInputMode='slice';
context.receiveCaptionChunk(frame('[:ra 75][:rate 150]Welcome [_<0,1>]to the machine.'));
assert.deepStrictEqual(shown,['Welcome']);
tick(399);assert.deepStrictEqual(shown,['Welcome']);
tick(1);assert.deepStrictEqual(shown,['Welcome','to']);
tick(800);assert.deepStrictEqual(shown,['Welcome','to','the','machine.']);
assert.strictEqual(timers.size,0);tick(2000);assert.strictEqual(shown.length,4);
shown.length=0;
context.receiveCaptionChunk(frame('[:rate 75]Old sequence should stop.'));
tick(100);context.receiveCaptionChunk(frame('[:rate 600]New robot.'));
assert.deepStrictEqual(shown,['Old','New']);tick(1000);
assert.deepStrictEqual(shown,['Old','New','robot.']);assert.strictEqual(timers.size,0);
shown.length=0;context.receiveCaptionChunk(frame('Default pace test'));
tick(399);assert.deepStrictEqual(shown,['Default']);tick(1);assert.deepStrictEqual(shown,['Default','pace']);
context.stopWordSlicing();tick(1000);assert.strictEqual(shown.length,2);
shown.length=0;context.receiveCaptionChunk(frame('Stop when hidden'));
context.textDisplayEnabled=false;tick(1000);assert.deepStrictEqual(shown,['Stop']);
context.textDisplayEnabled=true;shown.length=0;context.receiveCaptionChunk(frame('Stop when mode changes'));
context.currentTextInputMode='word';tick(1000);assert.deepStrictEqual(shown,['Stop']);assert.strictEqual(timers.size,0);
console.log('PASS: actual word slicer: first word immediately, inherited/overridden/default rates, timed word order, last word held, retrigger cancellation, display/mode cancellation and no leftover timers.');
console.log('PASS: actual Console caption parser: every split, bytewise serial, command/pause cleaning, full sentences, replacement, diagnostics, bounded input, legacy Words filtering and recovery.');
