// Exercise the actual Console parser, not a duplicated implementation.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../Console.html'), 'utf8');
const code = html.slice(html.indexOf('    function cleanCaption('), html.indexOf('    function wrapSentence('));
const shown = [];
const context = vm.createContext({ captionBuffer: '', currentTextInputMode: 'sentence', textDisplayEnabled: true, setBigText: text => shown.push(text) });
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
console.log('PASS: actual Console caption parser: every split, bytewise serial, command/pause cleaning, full sentences, replacement, diagnostics, bounded input, legacy Words filtering and recovery.');
