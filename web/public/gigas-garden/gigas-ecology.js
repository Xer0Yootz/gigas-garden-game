/**
 * Gigas Garden micro-fauna — code-only 3D draft, not canon.
 * Three.js r160+; WebGL-compatible and WebGPU-portable geometry.
 * Call update(deltaSeconds, playerPosition) from the existing render loop.
 */
export function createGigasEcology({THREE,scene,seed=5150,quality='auto',
 bounds={minX:-14,maxX:14,minZ:3,maxZ:56},
 water={centerX:0,centerZ:42,radiusX:10,radiusZ:8,surfaceY:-.15},groundY=0}={}){
 if(!THREE||!scene)throw Error('THREE and scene required');
 let state=seed>>>0;
 const rand=()=>((state=(1664525*state+1013904223)>>>0)/4294967296);
 const range=(a,b)=>a+(b-a)*rand(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const low=quality==='lite'||(quality==='auto'&&typeof navigator!=='undefined'&&(navigator.hardwareConcurrency||8)<=4);
 const root=new THREE.Group();root.name='NV_LIVING_ECOLOGY_DRAFT';scene.add(root);
 const geometry=[],materials=[],agents=[];
 const geo=g=>(geometry.push(g),g),mat=(color,emissive=0,intensity=0,opt={})=>{
  const m=new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:intensity,roughness:.83,side:THREE.DoubleSide,...opt});
  materials.push(m);return m;
 };
 const dark=mat(0x170e22),fur=mat(0x392047),pink=mat(0xff3c9e,0xa71460,.4),
  cyan=mat(0x28cde5,0x148ca4,.6),indigo=mat(0x37318f,0x302c8a,.7),
  wing=mat(0x68517e,0x292049,.2,{transparent:true,opacity:.8,depthWrite:false}),
  glass=mat(0x8fe0ea,0x27789a,.45,{transparent:true,opacity:.7,depthWrite:false});
 const ball=geo(new THREE.SphereGeometry(1,8,6)),cone=geo(new THREE.ConeGeometry(1,1,5));
 function piece(p,g,m,scale,pos=[0,0,0]){
  const mesh=new THREE.Mesh(g,m);mesh.scale.set(...scale);mesh.position.set(...pos);p.add(mesh);return mesh;
 }
 const wet=(x,z)=>{
  const dx=(x-water.centerX)/water.radiusX,dz=(z-water.centerZ)/water.radiusZ;
  return dx*dx+dz*dz<1.15;
 };
 const counts={moth:12,bee:8,skimmer:12,skitter:10,velvet:5,fish:16,skybird:6,symbiont:5};
 for(const [type,n] of Object.entries(counts))for(let i=0;i<Math.max(1,Math.round(n*(low?.5:1)));i++){
  const group=new THREE.Group(),body=new THREE.Group();group.add(body);root.add(group);
  const flaps=[];let tail=null,legs=[];
  const add=(g,m,s,p)=>piece(body,g,m,s,p);
  if(type==='moth'||type==='bee'||type==='skimmer'){
   add(ball,type==='bee'?fur:indigo,[.14,.15,.32]);
   if(type==='bee')for(let k=0;k<3;k++)add(ball,k%2?cyan:pink,[.16,.11,.05],[0,0,k*.14-.14]);
   for(const side of [-1,1])for(const back of (type==='skimmer'?[-1,1]:[0])){
    const pivot=new THREE.Group();pivot.position.set(side*.1,.07,back*.13);body.add(pivot);
    piece(pivot,ball,type==='moth'?wing:glass,[type==='skimmer'?.27:.3,.025,.13],[side*.26,0,0]);
    flaps.push([pivot,side*(back||1)]);
   }
  }else if(type==='skitter'){
   add(ball,fur,[.24,.13,.32]);
   for(const side of [-1,1])for(let k=0;k<3;k++){
    const leg=add(cone,dark,[.045,.24,.045],[side*.24,-.11,(k-1)*.17]);leg.rotation.z=side*.8;legs.push(leg);
   }
  }else if(type==='velvet'){
   add(ball,fur,[.34,.3,.39]);add(ball,dark,[.2,.17,.2],[0,.09,-.27]);
   for(const side of [-1,1]){
    add(cone,fur,[.1,.2,.1],[side*.19,.32,-.2]);
    add(ball,cyan,[.05,.03,.03],[side*.13,.11,-.45]);
   }
   tail=new THREE.Group();tail.position.set(0,.1,.35);body.add(tail);
   piece(tail,ball,fur,[.14,.19,.35],[0,.21,.19]);
  }else if(type==='fish'){
   add(ball,indigo,[.18,.13,.35]);add(ball,cyan,[.07,.04,.055],[0,.065,-.23]);
   tail=new THREE.Group();tail.position.z=.35;body.add(tail);
   piece(tail,cone,glass,[.23,.24,.075],[0,0,.16]).rotation.x=Math.PI/2;
  }else if(type==='skybird'){
   add(ball,dark,[.16,.12,.45]);
   for(const side of [-1,1]){
    const pivot=new THREE.Group();pivot.position.x=side*.1;body.add(pivot);
    piece(pivot,cone,wing,[.48,.045,.23],[side*.34,0,0]).rotation.z=side*Math.PI/2;
    flaps.push([pivot,side]);
   }
  }else{
   add(ball,glass,[.27,.24,.25]);
   for(let k=0;k<5;k++){
    const a=k*Math.PI*2/5;add(ball,k%2?cyan:indigo,[.12,.1,.12],[Math.cos(a)*.23,Math.sin(a)*.22,0]);
   }
   add(ball,pink,[.055,.028,.025],[0,-.07,-.24]);
  }
  let x=range(bounds.minX,bounds.maxX),z=range(bounds.minZ,bounds.maxZ),y=range(1.3,5);
  if(type==='fish'){
   const a=range(0,Math.PI*2),r=Math.sqrt(rand())*.75;
   x=water.centerX+Math.cos(a)*water.radiusX*r;z=water.centerZ+Math.sin(a)*water.radiusZ*r;
   y=water.surfaceY-range(.6,3);
  }else if(type==='skybird')y=range(7,12);
  else if(type==='velvet'||type==='skitter')y=groundY+(type==='velvet'?.35:.17);
  if(type!=='fish'&&wet(x,z))z=bounds.minZ+range(0,18);
  const phase=range(0,Math.PI*2),speed={moth:.56,bee:.72,skimmer:1,skitter:.17,velvet:.24,fish:.6,skybird:1.15,symbiont:.38}[type];
  agents.push({type,group,body,flaps,tail,legs,base:[x,y,z],phase,speed,radius:type==='skybird'?6:type==='skimmer'?2.8:1.7});
 }
 const count=low?90:220,points=new Float32Array(count*3),origins=new Float32Array(count*3);
 for(let i=0;i<count;i++){
  origins[i*3]=range(bounds.minX,bounds.maxX);
  origins[i*3+1]=range(.4,7);
  origins[i*3+2]=range(bounds.minZ,bounds.maxZ);
 }
 points.set(origins);
 const pg=geo(new THREE.BufferGeometry());pg.setAttribute('position',new THREE.BufferAttribute(points,3));
 const pm=new THREE.PointsMaterial({color:0x87d8ed,size:.055,transparent:true,opacity:.65,depthWrite:false});
 materials.push(pm);root.add(new THREE.Points(pg,pm));
 let t=0,disposed=false;
 function update(dt,playerPosition){
  if(disposed)return;
  t+=clamp(Number(dt)||0,0,.05);
  for(const a of agents){
   const v=t*a.speed+a.phase;
   let x=a.base[0]+Math.cos(v)*a.radius,z=a.base[2]+Math.sin(v)*a.radius,y=a.base[1];
   if(a.type==='fish'){
    let dx=(x-water.centerX)/water.radiusX,dz=(z-water.centerZ)/water.radiusZ;
    if(dx*dx+dz*dz>.89){let k=Math.sqrt(.89/(dx*dx+dz*dz));x=water.centerX+(x-water.centerX)*k;z=water.centerZ+(z-water.centerZ)*k;}
    y=Math.min(water.surfaceY-.3,y+Math.sin(t*2+a.phase)*.14);
   }else if(a.type==='skitter'||a.type==='velvet'){
    if(wet(x,z)){x=a.base[0];z=a.base[2];}
    y+=Math.abs(Math.sin(t*7+a.phase))*.03;
    if(playerPosition){
     const dx=x-playerPosition.x,dz=z-playerPosition.z,d2=dx*dx+dz*dz;
     if(d2>0.01&&d2<4){x+=dx*.2;z+=dz*.2;}
    }
   }else y+=Math.sin(t*2.3+a.phase)*(a.type==='skybird'?.4:.2);
   a.group.position.set(clamp(x,bounds.minX,bounds.maxX),y,clamp(z,bounds.minZ,bounds.maxZ));
   a.group.rotation.y=Math.atan2(Math.sin(v),-Math.cos(v));
   for(const [pivot,side] of a.flaps)pivot.rotation.z=side*Math.sin(t*(a.type==='bee'?32:a.type==='skybird'?3:15)+a.phase)*(a.type==='skybird'?.2:.5);
   if(a.tail)a.tail.rotation.y=Math.sin(t*8+a.phase)*.3;
   a.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(t*12+a.phase+i)*.23);
   a.body.rotation.z=Math.sin(t*1.4+a.phase)*.04;
  }
  for(let i=0;i<count;i++){points[i*3]=origins[i*3]+Math.sin(t*.3+i*2)*.3;points[i*3+1]=origins[i*3+1]+Math.sin(t*.6+i)*.17;}
  pg.attributes.position.needsUpdate=true;
 }
 function dispose(){if(disposed)return;disposed=true;scene.remove(root);geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.clear();}
 return {root,update,setEnabled:flag=>{root.visible=!!flag;},dispose,counts};
}
