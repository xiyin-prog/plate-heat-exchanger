import * as T from 'three';
import {D,AMP,PORTS,zPlate,zGap,rearFace,isHot,seq,explosion,ROOT_NAME,MODEL_ID,GUIDE_LENGTH,POST_Z,BOLT_TIP} from './design.js';
import {circle,extrude,roundRect,ring,stampedSolid,gasketOutline,offsetLoop} from './mesh.js';

function finish(name,color,metalness,roughness,extra={}) {
  const m=new T.MeshStandardMaterial({color,metalness,roughness,...extra});
  m.name=name;return m;
}
export function materials() {
  return {
    frame:finish('Frame · enamel',0x28575c,.30,.46),
    frameSide:finish('Frame · graphite teal',0x294749,.27,.53),
    steel:finish('Stainless steel · hardware',0xadb8b8,.78,.37),
    dark:finish('Oxidised steel',0x48595e,.63,.45),
    zinc:finish('Zinc-plated fasteners',0x969f9c,.72,.40),
    sheet:finish('316 stainless · stamped',0x9dadb2,.75,.38),
    rubber:finish('NBR · gasket',0x263235,.04,.82),
    hot:finish('Hot · channel volume',0xde3b2a,.12,.47),
    cold:finish('Cold · channel volume',0x1672c2,.14,.47),
    hotBand:finish('Hot · connection marking',0xe96749,.32,.40),
    coldBand:finish('Cold · connection marking',0x3385bb,.32,.40)
  };
}
function cylinderZ(r,length,n=40) {
  return new T.CylinderGeometry(r,r,length,n).rotateX(Math.PI/2);
}
function partMesh(parent,g,m,x=0,y=0,z=0) {
  const mesh=new T.Mesh(g,m); mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function flangeHoles() {
  return [45,135,225,315].map(a=>circle(39*Math.cos(a*Math.PI/180),39*Math.sin(a*Math.PI/180),4.5,14));
}
function sealGeometry(hot) {
  const inner=gasketOutline(hot),outer=offsetLoop(inner,2*D.sealHalfWidth);
  return extrude(outer,[inner],D.clearGap);
}
export function makeAssembly() {
  const root=new T.Group();root.name=ROOT_NAME;
  const mat=materials(),parts=[],byId=new Map(),groups=new Map();
  const geom=new Map(), shared=(key,create)=>{if(!geom.has(key)) geom.set(key,create());return geom.get(key);};
  function component(id,group,label,meta,x=0,y=0,z=0) {
    if(!groups.has(group)){const g=new T.Group();g.name='Group_'+group;groups.set(group,g);root.add(g);}
    const g=new T.Group();g.name=id;g.userData={id,group,label,...meta};
    g.position.set(x,y,z);groups.get(group).add(g);
    const part={id,group,label,meta:g.userData,object:g,home:g.position.clone()};
    parts.push(part);byId.set(id,part);return g;
  }
  const boltSites=[];
  for(const y of [-282,0,282]) for(const sign of [-1,1]) boltSites.push({x:sign*143,y,sign});
  const boltHoles=boltSites.map(p=>circle(p.x,p.y,8.8,20));
  // The moving plate clears both the wide carrying flange and its narrow vertical web.
  const upperSlot=[[-17.4,359],[17.4,359],[17.4,377.6],[6.2,377.6],
    [6.2,394.4],[-6.2,394.4],[-6.2,377.6],[-17.4,377.6]].map(([x,y])=>new T.Vector2(x,y));
  const lowerSlot=roundRect(-12.5,-391,12.5,-369,1.5);
  const fixed=component('Fixed_frame','fixed','固定压紧板',{role:'fixed'},0,0,D.frameFront/2);
  partMesh(fixed,extrude(roundRect(-160,-449,160,460,19),[
    ...PORTS.map(p=>circle(p.x,p.y,D.bore)),...boltHoles],D.frameFront-2,1),mat.frame);
  // Raised identification plate on the dry front face, UV-free lettering for offline GLB.
  partMesh(fixed,extrude(roundRect(-61,-22,61,22,3),[],2.2),mat.frameSide,0,61,17);
  const glyphs={
    P:['11110','10001','10001','11110','10000','10000','10000'],
    H:['10001','10001','10001','11111','10001','10001','10001'],
    E:['11111','10000','10000','11110','10000','10000','11111'],
    '–':['00000','00000','00000','11111','00000','00000','00000'],
    '1':['00100','01100','00100','00100','00100','00100','01110'],
    '0':['01110','10001','10011','10101','11001','10001','01110']
  };
  const ink=[];
  for(const [col,ch] of [...MODEL_ID].entries())for(const [row,line] of glyphs[ch].entries()) {
    for(let k=0;k<line.length;k++)if(line[k]==='1') {
      const x=(col*6+k-(MODEL_ID.length*6-2)/2)*2.48,y=(3-row)*2.48+62,z=18.14,r=1.15;
      ink.push(x-r,y-r,z,x+r,y-r,z,x+r,y+r,z,x-r,y-r,z,x+r,y+r,z,x-r,y+r,z);
    }
  }
  const lettering=new T.BufferGeometry();
  lettering.setAttribute('position',new T.Float32BufferAttribute(ink,3));lettering.computeVertexNormals();
  partMesh(fixed,lettering,mat.steel);
  for(const x of [-54,54])for(const y of [47,75])partMesh(fixed,shared('rivets',()=>cylinderZ(1.55,1.6,12)),mat.zinc,x,y,18.2);
  const rear=component('Moving_frame','moving','活动压紧板',{role:'rear'},0,0,rearFace-D.rearThickness/2);
  partMesh(rear,extrude(roundRect(-160,-415,160,416,19),[...boltHoles,upperSlot,lowerSlot],D.rearThickness-2,1),mat.frame);
  // Rear face stiffeners remain attached to the pressure plate.
  for(const x of [-55,55]) partMesh(rear,extrude(roundRect(x-5,-335,x+5,344,4),[],7),mat.frameSide,0,0,-18.5);
  const flange=ring(49,D.bore,10,56,flangeHoles()), pipe=ring(30,D.bore,49);
  const collar=ring(37,D.bore,9),marking=ring(30.6,29.9,6);
  for(const p of PORTS) {
    const g=component('Nozzle_'+p.code,'pipes',p.code+' '+p.name,{role:'pipe',port:p.code,circuit:p.circuit,inlet:p.inlet},p.x,p.y,D.frameFront);
    partMesh(g,collar,mat.steel,0,0,4.5);partMesh(g,pipe,mat.steel,0,0,33.5);
    partMesh(g,flange,mat.steel,0,0,63);
    partMesh(g,marking,mat[p.circuit+'Band'],0,0,46);
    partMesh(g,shared('lip',()=>ring(33,25.1,1.4)),mat[p.circuit+'Band'],0,0,68.65);
  }
  const portSeal=ring(33,D.bore,D.clearGap), frontRing=ring(33,D.bore,AMP);
  const firstSeal=component('Gasket_start','seals','首片端口密封垫',{role:'startSeal'},0,0,-AMP/2);
  for(const p of PORTS) partMesh(firstSeal,frontRing,mat.rubber,p.x,p.y,0);
  for(let i=0;i<D.count;i++) {
    const blind=i===D.count-1, side=isHot(i)?'A':'B', suffix=seq(i);
    const plate=component('Plate_'+suffix,'plates','板片 '+suffix+' · '+side+(blind?'（盲端）':''),
      {role:'plate',index:i,orientation:side,blind},0,0,zPlate(i));
    partMesh(plate,shared('plate'+side+blind,()=>stampedSolid('plate',i,{blind})),mat.sheet);
    if(blind) continue;
    const hot=isHot(i), circuit=hot?'hot':'cold';
    const gasket=component('Gasket_'+suffix,'seals','垫片 '+suffix+' · '+(hot?'热侧':'冷侧'),
      {role:'seal',index:i,circuit},0,0,zGap(i));
    partMesh(gasket,shared('gasket'+side,()=>sealGeometry(hot)),mat.rubber);
    for(const p of PORTS.filter(p=>p.circuit!==circuit)) partMesh(gasket,portSeal,mat.rubber,p.x,p.y);
    const fluid=component('Channel_'+suffix+'_'+circuit,'fluid',(hot?'热':'冷')+'流道 '+suffix,
      {role:'channel',index:i,circuit,between:['Plate_'+suffix,'Plate_'+seq(i+1)]},0,0,zGap(i));
    partMesh(fluid,shared('fluid'+side,()=>stampedSolid('channel',i)),mat[circuit]);
  }
  // The beam clears the stamped top keyway. Narrow shoulders of the keyway rest on the beam.
  const railLength=GUIDE_LENGTH;
  const upper=component('Rail_upper','guides','上承重导杆',{role:'rail'},0,0,-railLength/2);
  partMesh(upper,new T.BoxGeometry(29,14,railLength),mat.steel,0,369,0);
  partMesh(upper,new T.BoxGeometry(8,16,railLength),mat.steel,0,384,0);
  const lower=component('Rail_lower','guides','下定位导杆',{role:'rail'},0,-380,-railLength/2);
  partMesh(lower,new T.BoxGeometry(21,17,railLength),mat.steel);
  const post=component('Rear_column','stand','后支撑立柱',{role:'post'},0,0,POST_Z);
  partMesh(post,new T.BoxGeometry(48,846,D.columnDepth),mat.frameSide,0,-26);
  // Baseplates are machined through for four independent anchor positions per base.
  function foot(id,label,z,w,depth,role) {
    const f=component(id,'stand',label,{role},0,-454.5,z);
    const holes=[];
    for(const sign of [-1,1]) for(const sz of [-1,1]) holes.push(circle(sign*(w/2-18),sz*(depth/2-12),4.7,20));
    const g=extrude(roundRect(-w/2,-depth/2,w/2,depth/2,9),holes,11);
    g.rotateX(-Math.PI/2);partMesh(f,g,mat.frameSide);
  }
  foot('Foot_front','固定端底座',14,329,76,'frontFoot');
  foot('Foot_rear','支柱底座',POST_Z,152,85,'backFoot');
  const boltEnd=BOLT_TIP, boltStart=D.frameFront+3.4;
  const shank=cylinderZ(7,boltStart-boltEnd,24), head=cylinderZ(13,10,6);
  const nut=extrude(circle(0,0,13,6),[circle(0,0,7.35,24)],11), washer=ring(14,8,3.4,32);
  const tooth=ring(7.55,6.92,.85,24);
  for(let i=0;i<boltSites.length;i++) {
    const {x,y,sign}=boltSites[i], s=seq(i), meta={index:i,sign};
    const b=component('Tie_'+s,'ties','压紧螺栓 '+s,{role:'bolt',...meta},x,y,0);
    partMesh(b,shank,mat.zinc,0,0,(boltStart+boltEnd)/2);partMesh(b,head,mat.zinc,0,0,boltStart+5);
    for(let j=0;j<9;j++) partMesh(b,tooth,mat.dark,0,0,boltEnd+1.3+1.65*j);
    const n=component('Nut_'+s,'ties','压紧螺母 '+s,{role:'nut',...meta},x,y,rearFace-D.rearThickness-3.4-5.5);
    partMesh(n,nut,mat.zinc);
    const fw=component('Washer_F'+s,'ties','前垫圈 '+s,{role:'frontWasher',...meta},x,y,D.frameFront+1.7);
    const bw=component('Washer_R'+s,'ties','后垫圈 '+s,{role:'backWasher',...meta},x,y,rearFace-D.rearThickness-1.7);
    partMesh(fw,washer,mat.dark);partMesh(bw,washer,mat.dark);
  }
  // Header bores run from the front nozzles to the first solid surface of the last (blind) plate.
  const boreFront=D.frameFront+69.35, boreEnd=zPlate(D.count-1)+D.thickness/2;
  const boreMesh=extrude(circle(0,0,D.bore),[],boreFront-boreEnd);
  for(const p of PORTS) {
    const g=component('Header_'+p.code,'fluid',p.code+' '+(p.inlet?'分配':'汇集')+'总管',
      {role:'header',port:p.code,circuit:p.circuit,inlet:p.inlet},p.x,p.y,(boreEnd+boreFront)/2);
    partMesh(g,boreMesh,mat[p.circuit]);
  }
  function pose(t) {
    for(const part of parts) {
      const [x,y,z]=explosion(part.meta,t);
      part.object.position.set(part.home.x+x,part.home.y+y,part.home.z+z);
    }
  }
  return {root,parts,byId,groups,mat,pose};
}
