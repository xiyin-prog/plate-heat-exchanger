import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {warmUp} from 'teardown-kit/warm.js';
import {D,PITCH,GUIDE_LENGTH,POST_Z,DETAIL_START,clamp,zPlate,zGap,seq,isHot,lanePoint,layerOffset,meshWave as assemblyWave} from './design.js';
import {stampedSolid} from './mesh.js';
import {makeAssembly} from './model.js';
import {preset} from './views.js';

const vec=(a)=>new T.Vector3(...a);
const UP=new T.Vector3(0,1,0);
const scaleVec=new T.Vector3(1,1,1), mx=new T.Matrix4(), quat=new T.Quaternion();
function contactShadow() {
  const c=document.createElement('canvas');c.width=256;c.height=128;
  const g=c.getContext('2d');g.scale(2,1);
  const grad=g.createRadialGradient(64,64,0,64,64,64);
  grad.addColorStop(0,'rgba(56,68,61,0.34)');grad.addColorStop(.35,'rgba(56,68,61,0.20)');grad.addColorStop(1,'rgba(56,68,61,0)');
  g.fillStyle=grad;g.fillRect(0,0,128,128);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  return new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
}
export function createStage(canvas,host,anchorHost,assembly=makeAssembly()) {
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<720?1.4:1.65));
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.96;
  renderer.setClearColor(0xffffff,0);
  const scene=new T.Scene(),cam=new T.OrthographicCamera(-700,700,550,-550,1,12000);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(), env=pmrem.fromScene(room,.04);
  scene.environment=env.texture;scene.environmentIntensity=.57;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xf5f8f8,0xa1a099,.86));
  function sun(color,intensity,pos) {const l=new T.DirectionalLight(color,intensity);l.position.set(...pos);scene.add(l);}
  sun(0xfff1df,1.65,[-750,1130,840]);sun(0xd6eafa,1.05,[520,560,-660]);sun(0xffffff,.38,[-900,280,-580]);
  scene.add(assembly.root);
  const shadows=new T.Group(), shadowMat=contactShadow(), groundMesh=new T.PlaneGeometry(1,1);
  for (const [x,z,w,h] of [[0,14,425,185],[0,POST_Z,246,155],[0,POST_Z/2,408,GUIDE_LENGTH+130]]) {
    const m=new T.Mesh(groundMesh,shadowMat);m.rotation.x=-Math.PI/2;m.scale.set(w,h,1);
    m.position.set(x,-461,z);shadows.add(m);
  }
  scene.add(shadows);
  const sample=new T.Group(), detailParts=[],detailById=new Map(), stretch=8;
  scene.add(sample);
  for(let i=DETAIL_START;i<=DETAIL_START+2;i++) {
    for(const kind of (i<DETAIL_START+2?['plate','channel']:['plate'])) {
      const id=kind==='plate'?'Plate_'+seq(i):'Channel_'+seq(i)+'_'+(isHot(i)?'hot':'cold');
      const m=new T.Mesh(stampedSolid(kind,i,{window:true}),assembly.mat[kind==='plate'?'sheet':isHot(i)?'hot':'cold']);
      m.position.z=((kind==='plate'?zPlate(i):zGap(i))-zPlate(DETAIL_START+1))*stretch;m.scale.z=stretch;
      m.userData.sourceId=id;sample.add(m);detailParts.push(m);detailById.set(id,m);
    }
  }
  const controls=new OrbitControls(cam,canvas);
  controls.enableDamping=false;controls.zoomSpeed=.9;controls.panSpeed=.88;
  controls.minZoom=.33;controls.maxZoom=9;controls.rotateSpeed=.8;controls.update();
  const sheet=assembly.mat.sheet, clear=sheet.clone();
  clear.transparent=true;clear.opacity=.2;clear.depthWrite=false;clear.side=T.FrontSide;
  clear.color.set(0x8fa7ad);
  clear.metalness=.29;clear.roughness=.48;
  const highlight=new Map();
  function selectedMat(mat) {
    if(!highlight.has(mat)) {const m=mat.clone();m.emissive.setRGB(.11,.076,.008);m.emissiveIntensity=.85;m.color.lerp(new T.Color(0xe6ad54),.33);highlight.set(mat,m);}
    return highlight.get(mat);
  }
  const flowG=new T.Group();scene.add(flowG);
  const cone=new T.BufferGeometry();
  cone.setAttribute('position',new T.Float32BufferAttribute([0,9,0, -4.5,2,0, -1.5,2,0, -1.5,-7,0, 1.5,-7,0, 1.5,2,0, 4.5,2,0],3));
  cone.setIndex([0,1,2,0,2,5,0,5,6,2,3,4,2,4,5]);
  const dotMats=[0xffd5a7,0xd2f5ff].map(c=>new T.MeshBasicMaterial({color:c,side:T.DoubleSide}));
  const arrows=dotMats.map((m)=>{const inst=new T.InstancedMesh(cone,m,D.count*15);inst.frustumCulled=false;inst.instanceMatrix.setUsage(T.DynamicDrawUsage);flowG.add(inst);return inst;});
  let cfg=null,modeKey='',styleKey='',lastE='',w=1,h=1,baseHeight=1100,baseWidth=1100;
  // At whole-machine scale each 2.5 mm pitch often projects to one pixel.
  // Use a coarser sampling of the same physical surfaces for that view alone.
  const detailMeshes=new Map(), overviewMeshes=new Map();
  for(const p of assembly.parts) {
    if(!['plate','channel'].includes(p.meta.role)) continue;
    const mesh=p.object.children[0], key=mesh.geometry;
    if(!overviewMeshes.has(key)) overviewMeshes.set(key,stampedSolid(p.meta.role==='plate'?'plate':'channel',
      p.meta.index,{blind:!!p.meta.blind,overview:true}));
    detailMeshes.set(mesh,key);
  }
  const origMat=new Map();for(const p of assembly.parts) p.object.traverse(m=>{if(m.isMesh)origMat.set(m,m.material);});
  function fitSize() {
    const hh=Math.max(baseHeight,baseWidth/(w/h)), hw=hh*w/h;
    cam.left=-hw/2;cam.right=hw/2;cam.top=hh/2;cam.bottom=-hh/2;cam.updateProjectionMatrix();
  }
  function resize() {
    const r=host.getBoundingClientRect(); w=Math.max(1,r.width);h=Math.max(1,r.height);
    renderer.setSize(w,h,false);fitSize();
  }
  function moveCamera(view,e,index,drift=0) {
    const p=preset(view,e,index);
    baseHeight=p.height;baseWidth=p.width;fitSize();
    cam.zoom=1;controls.target.copy(vec(p.target));cam.position.copy(controls.target).addScaledVector(vec(p.direction).applyAxisAngle(UP,drift).normalize(),2300);
    cam.up.copy(UP);cam.updateProjectionMatrix();controls.update();
  }
  function focus(part) {
    const box=new T.Box3().setFromObject(part.object,true), center=box.getCenter(new T.Vector3());
    const size=box.getSize(new T.Vector3());
    const dir=cam.position.clone().sub(controls.target).normalize();
    const dist=Math.max(size.x,size.y,size.z,22);
    baseHeight=dist*1.24;baseWidth=dist*1.4;fitSize();cam.zoom=1;cam.updateProjectionMatrix();
    controls.target.copy(center);cam.position.copy(center).addScaledVector(dir,2300);controls.update();
  }
  function visible(p,s) {
    if(s.hidden.has(p.id)) return false;
    if(s.isolate) return p.id===s.isolate;
    const a=p.meta,i=a.index, picked=s.partIndex;
    if(a.role==='channel'||a.role==='header') {
      if(!s.flow || !s[a.circuit])return false;
      if(a.role==='header')return s.e<.005 && (s.view==='flow'||s.view==='assembly'||s.view==='exploded');
    }
    if(s.view==='plate') return (a.role==='plate'&&(i===picked||i===picked+1)) || (a.role==='seal'&&i===picked) || (a.role==='channel'&&i===picked);
    if(s.view==='flow') {
      return (a.role==='plate'&&i>=picked&&i<=picked+2)||(a.role==='channel'&&i>=picked&&i<picked+2)
        ||(a.role==='header'&&s.e<.005);
    }
    return s.view!=='section';
  }
  function renderStyle(s) {
    const newKey=[s.view,s.alpha,s.flow,s.hot,s.cold,s.e<.005,s.partIndex,s.selected,s.isolate,s.revision].join('/');
    if(styleKey===newKey) return;
    styleKey=newKey;
    const det=s.view==='section'&&!s.isolate;
    const overview=!s.isolate&&(s.view==='assembly'||s.view==='exploded');
    for(const [mesh,detail] of detailMeshes)mesh.geometry=overview?overviewMeshes.get(detail):detail;
    assembly.root.visible=!det;sample.visible=det;shadows.visible=!s.isolate&&(s.view==='assembly'||s.view==='exploded');
    clear.opacity=s.alpha;
    const plateVisible = s.alpha > .0001;
    for(const p of assembly.parts) {
      p.object.visible=visible(p,s) && (p.id===s.isolate || p.meta.role!=='plate' || plateVisible);
      for(const m of p.object.children) {
        let mat=(p.meta.role==='plate'&&p.id!==s.isolate&&s.alpha<.995)?clear:origMat.get(m);
        if(p.id===s.selected)mat=selectedMat(mat);
        if(mat.transparent)mat.opacity=s.alpha;
        m.material=mat;
      }
    }
    for(const m of detailParts) {
      const p=assembly.byId.get(m.userData.sourceId);
      m.visible=!s.hidden.has(p.id)&&(p.meta.role==='plate'?plateVisible:(s.flow && s[p.meta.circuit]));
      let mat=p.meta.role==='plate'?(s.alpha<.995?clear:sheet):assembly.mat[p.meta.circuit];
      m.material=p.id===s.selected?selectedMat(mat):mat;
    }
    flowG.visible=s.flow&&!det;
  }
  function tracers(t,s) {
    if(!flowG.visible)return;
    const counts=[0,0];
    for(const part of assembly.parts) {
      if(part.meta.role!=='channel'||!part.object.visible)continue;
      const i=part.meta.index, which=isHot(i)?0:1;
      for(let lane=0;lane<5;lane++) {
        for(let j=0;j<3;j++) {
          const u=(t*.14 + .072*lane + j/3 + .014*i)%1;
          const u1=clamp(u,.0002,.9979), p=vec(lanePoint(i,lane,u1)),p2=vec(lanePoint(i,lane,u1+.002));
          const dir=p2.sub(p);dir.z=0;dir.normalize();
          // A display arrow sits on the visible skin of its own fluid solid.
          const zSurface=PITCH/2-D.thickness/2;
          p.z=zSurface+2.3+assemblyWave(i,p.x,p.y);
          p.add(part.object.position);quat.setFromUnitVectors(UP,dir);mx.compose(p,quat,scaleVec);
          arrows[which].setMatrixAt(counts[which]++,mx);
        }
      }
    }
    for(let k=0;k<2;k++){arrows[k].count=counts[k];arrows[k].instanceMatrix.needsUpdate=true;}
  }
  // Local texture-free callouts project the actual component coordinates through the camera.
  const ns='http://www.w3.org/2000/svg';
  const lineLayer=document.createElementNS(ns,'svg');
  lineLayer.classList.add('leaders');anchorHost.append(lineLayer);
  const callouts=Array.from({length:4},()=>{
    const line=document.createElementNS(ns,'path'), dot=document.createElementNS(ns,'circle');
    dot.setAttribute('r','2.7');lineLayer.append(line,dot);
    const tag=document.createElement('div');tag.className='part-label';anchorHost.append(tag);
    return {line,dot,tag};
  });
  const tagsFor=(s)=>{
    const i=s.partIndex, a='Plate_'+seq(i), b='Plate_'+seq(i+1);
    if(s.isolate) return [];
    switch(s.view) {
      case 'assembly':
        return [{id:'Plate_'+seq(DETAIL_START),p:[-D.plateHalfWidth,122,0],side:-1,offset:-18,text:D.count+' 张换热板片'},
          {id:'Nozzle_S4',p:[0,0,69],side:1,offset:18,text:'S4　热侧入口',c:'hot'},
          {id:'Nozzle_S2',p:[0,0,69],side:1,offset:18,text:'S2　冷侧入口',c:'cold'}];
      case 'exploded':
        return [{id:'Fixed_frame',p:[100,190,16],side:1,offset:-22,text:'固定压紧板'},
          {id:'Moving_frame',p:[-150,80,15],side:-1,offset:-22,text:'活动压紧板'}];
      case 'plate':
        return [{id:a,p:[80,-115,1],side:1,offset:9,text:'P'+seq(i)+'　'+(isHot(i)?'A':'B')+' 向板'},
          {id:'Gasket_'+seq(i),p:[isHot(i)?-110:110,302,0],side:-1,offset:-28,text:'板间密封垫'},
          {id:b,p:[-77,125,1],side:-1,offset:-18,text:'P'+seq(i+1)+'　'+(isHot(i+1)?'A':'B')+' 向板'}];
      case 'flow':
        return [0,1].map((k)=>{const hot=isHot(i+k);return {id:'Channel_'+seq(i+k)+'_'+(hot?'hot':'cold'),p:[k===0?85:-85,hot?70:-64,1],side:k===0?1:-1,offset:hot?-22:20,text:hot?'热流道　↓':'冷流道　↑',c:hot?'hot':'cold'};});
      case 'section': {const n=DETAIL_START;return [
        {id:'Channel_'+seq(n)+'_hot',p:[-44,18,(assemblyWave(n,-44,18)+assemblyWave(n+1,-44,18))/2],side:-1,offset:-22,text:'热流道',c:'hot'},
        {id:'Plate_'+seq(n+1),p:[32,30,assemblyWave(n+1,32,30)],side:1,offset:-17,text:'中间隔板'},
        {id:'Channel_'+seq(n+1)+'_cold',p:[-44,-12,(assemblyWave(n+1,-44,-12)+assemblyWave(n+2,-44,-12))/2],side:-1,offset:23,text:'冷流道',c:'cold'}];}
      default:return [];
    }
  };
  const proj=(p)=>{const n=p.project(cam);return [(n.x+1)*w/2,(1-n.y)*h/2];};
  function labels(s) {
    const items=s.labels?tagsFor(s):[], compact=w<510;
    for(let k=0;k<callouts.length;k++){
      const {tag,line,dot}=callouts[k], item=items[k];
      const object=item?(s.view==='section'?detailById.get(item.id):assembly.byId.get(item.id)?.object):null;
      const show=object?.visible && !!item && !(compact && k>1);
      tag.hidden=!show;line.style.display=dot.style.display=show?'':'none';if(!show)continue;
      const [x,y]=proj(object.localToWorld(vec(item.p)));
      const side=item.side, len=compact?22:51, dy=compact?item.offset*.6:item.offset;
      if(tag.textContent!==item.text){tag.textContent=item.text;}
      tag.dataset.c=item.c||'';
      const tw=tag.offsetWidth || 80;
      const lx=clamp(side<0?x-len-tw:x+len,8,w-tw-8), ly=clamp(y+dy,36,h-39);
      const ex=side<0?lx+tw:lx;
      tag.style.transform='translate('+Math.round(lx)+'px,'+Math.round(ly-11)+'px)';
      line.setAttribute('d','M '+x+' '+y+' L '+(ex-side*12)+' '+ly+' L '+ex+' '+ly);
      dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('class',item.c||'');
    }
  }
  function render(t,s,resetCamera=false) {
    const previousE=cfg?.e??s.e;
    cfg=s;
    const poseKey=[s.e,s.view,s.partIndex,s.isolate].join('/');
    if(poseKey!==lastE){
      const localView=s.view==='plate'||s.view==='flow';
      assembly.pose(localView?0:s.e);
      if(!s.isolate && localView)for(const part of assembly.parts) {
        part.object.position.z+=layerOffset(part.meta,s.e,s.view,s.partIndex);
      }
      const footFront=assembly.byId.get('Foot_front').object.position.z;
      const footRear=assembly.byId.get('Foot_rear').object.position.z;
      shadows.children[0].position.z=footFront;shadows.children[1].position.z=footRear;
      shadows.children[2].position.z=(footFront+footRear)/2;
      shadows.children[2].scale.y=footFront-footRear+130;
      lastE=poseKey;
    }
    const fullFrame=s.view==='assembly'||s.view==='exploded';
    const newMode=(fullFrame?'frame':s.view)+'/'+s.partIndex+'/'+(s.isolate||'');
    if(resetCamera||modeKey!==newMode) {
      modeKey=newMode;moveCamera(s.view,s.e,s.partIndex,s.cameraDrift||0);
      if(s.isolate)focus(assembly.byId.get(s.isolate));
    } else if(s.cameraFollows && s.view!=='section' && !s.isolate) {
      moveCamera(s.view,s.e,s.partIndex,s.cameraDrift||0);
    } else if(previousE!==s.e && fullFrame && !s.isolate) {
      // Keep orbit, pan and zoom under the user's control while fitting a changing span.
      const before=preset(s.view,previousE,s.partIndex), after=preset(s.view,s.e,s.partIndex);
      const dz=after.target[2]-before.target[2];
      cam.position.z+=dz;controls.target.z+=dz;
      baseHeight=after.height;baseWidth=after.width;fitSize();
    }
    renderStyle(s);tracers(t,s);controls.update();renderer.render(scene,cam);labels(s);
  }
  function pick(clientX,clientY){
    if(!cfg)return null;
    const r=canvas.getBoundingClientRect(),ray=new T.Raycaster();
    ray.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2),cam);
    const candidates=sample.visible ? detailParts.filter(m=>m.visible) :
      assembly.parts.filter(p=>p.object.visible).flatMap(p=>p.object.children);
    const hit=ray.intersectObjects(candidates,false)[0]?.object;
    return hit?.userData.sourceId||hit?.parent.userData.id||null;
  }
  function zoom(f){cam.zoom=clamp(cam.zoom*f,controls.minZoom,controls.maxZoom);cam.updateProjectionMatrix();}
  function info() {
    const gl=renderer.getContext(), ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'WebGL 2',triangles:renderer.info.render.triangles,
      calls:renderer.info.render.calls,visible:assembly.parts.filter(p=>p.object.visible&&assembly.root.visible).map(p=>p.id),
      detail:detailParts.filter(p=>p.visible&&sample.visible).map(p=>p.userData.sourceId),zoom:cam.zoom};
  }
  resize();return {assembly,render,resize,focus,pick,zoom,info,controls,reset:()=>{modeKey='';},warm:()=>warmUp(renderer,cam,[{scene,target:null}])};
}
