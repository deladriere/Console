// Test Console's actual migrated tables and stream parser without browser dependencies.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const path = require('path'), crypto = require('crypto');
const html = fs.readFileSync(path.join(__dirname, '../Console.html'), 'utf8');
const mouth = html.match(/<script id="consoleMouth">([\s\S]*?)<\/script>/)[1];
const assets = JSON.parse(html.match(/<script id="mouthBitmapAssets" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
const expectedTables = {
  "sc01": {
    "count": 64,
    "sha256": "5ab38f45a22307f692f10fac8bfd55362a05c09b3c0c83dcf95e9fe296353530"
  },
  "sc02": {
    "count": 65,
    "sha256": "8c92d885d9ecfd5e35d94978b06f2bd06dfa2f31cc60efab028909ec488c07d7"
  }
};
const expectedAssets = {
  "viseme-id-0.png": "656a0a7fa2ae4d06c2c999ed28f5db1dd1eada04d38eb02d45ed17c37cb06a31",
  "viseme-id-1.png": "d63840ff302edc6ab62227472e9c44effa7d76ce52368ed086e0ab71ec158fcc",
  "viseme-id-10.png": "8670fcbc6db0663dd531fc509f97a21a97a858313565987ad12303e88ad33ed5",
  "viseme-id-11.png": "8e5883891559ff01d17b1886c768c30aa80836e0696834fecad329e761dffa18",
  "viseme-id-12.png": "86754cb9beb34555ffb07c5faf43b6eadf015b3cea1a1af9f5a64acceaedda72",
  "viseme-id-13.png": "526c98f477a06ab86089d135865ca8459a096c2a32ce8297c301d2da17638ea8",
  "viseme-id-14.png": "972c7abe7531587395d59b14bb42e8b15ff2566593f9e2d2b0251c8bd54cc5b1",
  "viseme-id-15.png": "37ed0068d28db207a417e15834f63d501f02ad44566594f9784f191f5524bcba",
  "viseme-id-16.png": "4ba4a01c0e1a49880f24b87210e34baf4a0178eb3bbaf88f2363cf662227c4d7",
  "viseme-id-17.png": "5dea51c51c152bd15074d252efc13f3cc2b88a132431b9710ac687a296552251",
  "viseme-id-18.png": "ef1294bf954944b678b464382eede814fbc51b5e48ba8a1cfde524265775a325",
  "viseme-id-19.png": "c119c0938f5605de67cd34622710c612587b23ad10714b5f79408cf2ca56827a",
  "viseme-id-2.png": "6fbb56002fefe84c64d98f3517daf31de935269dc20248f6e1cdca59948fb89f",
  "viseme-id-20.png": "5fccae193e80ae36c25b0343d31ebea1403abff4f3118e4ea05404c6d0a8e576",
  "viseme-id-21.png": "bc6887b93bc6840c8eb5a0cc1f736bc545d243dd9657e847c6931837ca10e354",
  "viseme-id-3.png": "6621053bd75d2b4a9d916b7fd8cd0ef398997d07851a6323fcae901861e6533b",
  "viseme-id-4.png": "13e55f9f3a5412fbd05823b8ff2edb4ca5804916d5f9b20fd5cfd91c5e591843",
  "viseme-id-5.png": "1556c60b3bc3a42e788b0378c7ab148cb7e0c4c8c00b7e54b072a1ffab1559d6",
  "viseme-id-6.png": "4b1f452197de9bc49bd1f3bb4d1f4a7bab65fb3edabf6169f9c74c4daec5fce8",
  "viseme-id-7.png": "3944cc9f0951f8f844140a5d76b31420ad2d47bfc66a0a180f0446d2cf3d7127",
  "viseme-id-8.png": "6239f57347ef6228f563423f817345d403ff2841f7b9fdbf3fb5b81baa4b195a",
  "viseme-id-9.png": "b1fa1c12e335d9c324a3ea6d964812d53612670a64e4e6d793dff95a81aa16c8",
  "face1.jpeg": "590e160c8c064d565c90bc805776ff7f84cc627cf94cf90f06e5050040318b47",
  "face.jpeg": "5d6acf15a66012dc670141f5dc496ee138f6cebb29a2e7ea3fdbd9f15ff43fe4",
  "face.png": "6ee4fcb40fcde4c4e21fd24ff3852e54670f9e79e59fb3006f720e9e2c888564",
  "face2.png": "3403ea67e3117b8bcdbb47e0be99c27c50369f59a36231ce77b69cf2fb314c89"
};
const shown = [];
let stopped = 0;
const context = vm.createContext({ active: true, settings: { model: 'sc02' }, buffer: '', dropping: false,
    stopDemo: () => { stopped++; }, show: (code, source) => shown.push({ code, source }) });
const tableCode = mouth.slice(mouth.indexOf('const visemeTable'), mouth.indexOf('// Robomouth SC-01/SC-02'));
const receiveCode = mouth.slice(mouth.indexOf('    function receive('), mouth.indexOf("    el('mouthEnabled').addEventListener"));
vm.runInContext(tableCode + `
    const tables = { sc01: votraxSC01Table, sc02: votraxSC02Table };
    const maps = Object.fromEntries(Object.entries(tables).map(([key, entries]) => [key, new Map(entries.map(item => [item.code, item]))]));
    globalThis.actualTables = tables;
` + receiveCode, context);
for (const [key, expected] of Object.entries(expectedTables)) {
    assert.strictEqual(context.actualTables[key].length, expected.count);
    assert.strictEqual(digest(JSON.stringify(context.actualTables[key])), expected.sha256, key + ' mapping changed from Robomouth');
}
assert.deepStrictEqual(Object.keys(assets).sort(), Object.keys(expectedAssets).sort());
for (const [name, hash] of Object.entries(expectedAssets)) {
    assert.strictEqual(digest(Buffer.from(assets[name].split(',')[1], 'base64')), hash, name + ' bytes changed');
}
const codes = () => shown.map(item => item.code);
function clear() { shown.length = 0; context.buffer = ''; context.dropping = false; }
const packet = 'M\r\n:UH\nSCH\rPA\n';
for (let split = 0; split <= packet.length; split++) {
    clear(); context.receive(packet.slice(0, split)); context.receive(packet.slice(split));
    assert.deepStrictEqual(codes(), ['M', ':UH', 'SCH', 'PA']);
}
clear(); for (const char of packet) context.receive(char);
assert.deepStrictEqual(codes(), ['M', ':UH', 'SCH', 'PA']);
clear(); context.receive('s'); assert.strictEqual(shown.length, 0);
context.receive('ch\r\n'); assert.deepStrictEqual(codes(), ['SCH']);
clear(); context.receive('diagnostic M\nM unknown\n123\n<img src=x>\n\x1eVAX:M\x1f\n');
assert.deepStrictEqual(codes(), []);
context.receive('x'.repeat(150)+'\nM\n'); assert.deepStrictEqual(codes(), ['M']);
clear(); context.receive('x'.repeat(150)); context.receive('M\nU\n');
assert.deepStrictEqual(codes(), ['U']); // overlong-line suffix cannot become a phoneme
assert(context.buffer.length <= 128);
clear(); context.receive('SC'); context.active = false; context.receive('H\n');
context.active = true; context.receive('H\n'); assert.deepStrictEqual(codes(), []);
context.receive('SCH\n'); assert.deepStrictEqual(codes(), ['SCH']);
clear(); context.settings.model = 'sc01'; context.receive('SCH\nSH\nPA0\nSTOP\n');
assert.deepStrictEqual(codes(), ['SH', 'PA0', 'STOP']);
assert.strictEqual(stopped > 0, true);
assert(html.includes('window.ConsoleMouth.receive(chunk);\n                    if (!textDisplayEnabled) continue;'));
assert(html.includes('window.ConsoleMouth.sync();'));
console.log('PASS: original SC-01 (64) / SC-02 (65) mappings and all 26 bitmap assets preserved byte-for-byte.');
console.log('PASS: split and bytewise streams, CR/LF, case normalization, unknown/control/oversized input, model selection and disabled input.');
