// Reduced topology must retain source animation, open boundaries and components.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'../Console.html'),'utf8');
const json=id=>JSON.parse(html.match(new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)</script>`))[1]);
const data=json('head3DModelData'),levels=json('head3DDetailData').levels;
const context=vm.createContext({});
vm.runInContext(html.slice(html.indexOf('    function prepareHumanHead('),html.indexOf('    function createWireframe('))+';globalThis.prepare=prepareHumanHead;globalThis.detail=prepareHeadDetail;',context);
function topology(faces){
 const edges=new Map(),neighbors=new Map(),vertices=new Set();
 for(const face of faces){
  assert(face.length>=3&&face.length<=4);assert.equal(new Set(face).size,face.length);
  for(let i=0;i<face.length;i++){
   const a=face[i],b=face[(i+1)%face.length];assert(Number.isInteger(a)&&a>=0&&a<data.vertices.length);
   const key=[a,b].sort((x,y)=>x-y).join(':');edges.set(key,(edges.get(key)||0)+1);
   vertices.add(a);if(!neighbors.has(a))neighbors.set(a,new Set());neighbors.get(a).add(b);
   if(!neighbors.has(b))neighbors.set(b,new Set());neighbors.get(b).add(a);
  }
 }
 assert([...edges.values()].every(n=>n===1||n===2),'Non-manifold edge');
 const visited=new Set();let components=0;
 for(const v of vertices)if(!visited.has(v)){
  components++;const pending=[v];while(pending.length){const n=pending.pop();if(visited.has(n))continue;visited.add(n);pending.push(...neighbors.get(n));}
 }
 return {vertices,edges,boundary:[...edges].filter(([_,n])=>n===1).map(([key])=>key).sort(),euler:vertices.size-edges.size+faces.length,components};
}
const original=topology(data.faces),mesh=context.prepare(data),weights=new Float32Array(22);
assert.deepEqual(levels.map(l=>l.detail),[75,50,25,10]);
assert.deepEqual(levels.map(l=>l.faces.length),[3500,2400,1500,1249]);
let previous=data.faces.length;
for(const level of levels){
 const top=topology(level.faces);assert(level.faces.length<previous);previous=level.faces.length;
 assert.deepEqual(top.boundary,original.boundary,'Original open boundaries must be preserved exactly');
 assert.equal(top.euler,original.euler);assert.equal(top.components,original.components);
 for(const id of Object.values(data.landmarks))assert(top.vertices.has(id),'Lost lip landmark');
 const detail=context.detail(data,level.faces);
 assert.equal(detail.vertexCount,top.vertices.size);assert.equal(detail.edges.length/2,top.edges.size);
 for(let pose=0;pose<22;pose++)for(const blink of [0,.5,1]){
  weights.fill(0);weights[pose]=1;mesh.blend(weights,blink);detail.update(mesh.positions);
  assert([...detail.positions].every(Number.isFinite));assert([...detail.normals].every(Number.isFinite));
  for(let i=0;i<detail.normals.length;i+=3)assert(Math.abs(Math.hypot(...detail.normals.slice(i,i+3))-1)<1e-5,'Invalid flat normal');
  // Facet vertices must be exact samples of the original animated source.
  let n=0;
  for(const face of level.faces)for(let i=1;i<face.length-1;i++)for(const id of [face[0],face[i],face[i+1]]){
   assert.equal(detail.materials[n],data.materials[id]);
   for(let k=0;k<3;k++)assert.equal(detail.positions[n*3+k],mesh.positions[id*3+k]);
   n++;
  }
 }
}
assert(html.includes('id="head3DDetail"'));assert(html.includes('style:settings.wireStyle, detail:settings.wireDetail'));
console.log('PASS: four decreasing mesh levels; exact boundaries, components and Euler characteristic; original lip landmarks; source-exact deformation and valid flat normals for all 22 speech shapes at three blink weights.');
