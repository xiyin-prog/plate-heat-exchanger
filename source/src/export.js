import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {makeAssembly} from './model.js';
import {D,PORTS,PITCH,seq,isHot,lanePoint,zGap,explosion,ramp,ROOT_NAME,PACK_LENGTH,GUIDE_LENGTH} from './design.js';

export async function createAssets() {
  const {root,parts}=makeAssembly();
  root.scale.setScalar(.001);
  root.userData={sourceUnits:'millimetres',sceneUnits:'metres',plateCount:D.count,
    channelCount:D.count-1,packLength_mm:PACK_LENGTH,guideLength_mm:GUIDE_LENGTH,rearClearance_mm:D.serviceClearance,nominalClearance_mm:D.clearGap,axis:'Connections face +Z; up is +Y.',
    orientation:'Adjacent A/B stampings are rotated 180 degrees in their plane.',
    contact:'Zero-clearance contacts. Plate and fluid boundaries share the active-field triangulation.'};
  const scene=new T.Scene();scene.name='Gasketed_heat_exchanger';scene.add(root);
  const times=Array.from({length:181},(_,i)=>i/15);
  const tracks=[];
  for(const p of parts) {
    if(p.meta.role==='header') {
      // A header only spans the aligned, compressed stack. Retract it into the nozzle as the pack opens.
      const geometry=p.object.children[0].geometry;
      geometry.computeBoundingBox();
      const halfLength=geometry.boundingBox.max.z;
      const scales=[],positions=[];
      for(const t of times) {
        const u=t<=6?t/6:(12-t)/6;
        const scale=1-.9999*ramp(u,0,.12);
        scales.push(1,1,scale);
        positions.push(p.home.x,p.home.y,p.home.z+halfLength*(1-scale)+explosion({role:'pipe'},u)[2]);
      }
      tracks.push(new T.VectorKeyframeTrack(p.id+'.scale',times,scales));
      tracks.push(new T.VectorKeyframeTrack(p.id+'.position',times,positions));
      continue;
    }
    if(p.meta.role==='fixed')continue;
    const pos=[];
    for(const t of times) {
      const u=t<=6?t/6:(12-t)/6;
      const [x,y,z]=explosion(p.meta,u);pos.push(p.home.x+x,p.home.y+y,p.home.z+z);
    }
    tracks.push(new T.VectorKeyframeTrack(p.id+'.position',times,pos));
  }
  const notes=new T.Group();notes.name='Flow_markers';root.add(notes);
  notes.userData={purpose:'Optional one-cycle centreline tracers. Diagram symbols are larger than the physical gap.'};
  const tracerGeom=new T.SphereGeometry(2.35,10,8),
    markerMat=new T.MeshStandardMaterial({color:0xfbf6d3,roughness:.58,metalness:0});markerMat.name='Flow markers · ivory';
  const flowTracks=[], routes=[];
  for(let i=0;i<D.count-1;i++) {
    const circuit=isHot(i)?'hot':'cold',codeA=isHot(i)?'S4':'S2',codeB=isHot(i)?'S3':'S1';
    const channelId='Channel_'+seq(i)+'_'+circuit;
    for(let lane=0;lane<5;lane++) {
      const points=Array.from({length:241},(_,j)=>lanePoint(i,lane,j/240));
      routes.push({channel:channelId,lane:lane+1,inlet:codeA,outlet:codeB,
        points:points.map(p=>p.map(v=>Math.round(v*1e5)/1e5))});
    }
    const marker=new T.Mesh(tracerGeom,markerMat);
    marker.name='Tracer_'+seq(i);marker.userData={channel:channelId,schematic:true};
    marker.position.fromArray(lanePoint(i,2,0));marker.position.z+=zGap(i);
    marker.scale.setScalar(.0001);notes.add(marker);
    const ft=Array.from({length:241},(_,j)=>j/30), vals=[];
    for(let j=0;j<ft.length;j++) {
      const [x,y,z]=lanePoint(i,2,j/(ft.length-1));vals.push(x,y,z+zGap(i));
    }
    flowTracks.push(new T.VectorKeyframeTrack(marker.name+'.position',ft,vals));
    const sc=[.0001,1,1,.0001].flatMap(s=>[s,s,s]);
    flowTracks.push(new T.VectorKeyframeTrack(marker.name+'.scale',[0,.14,7.86,8],sc));
  }
  const clips=[new T.AnimationClip('01_Explode_and_reassemble',12,tracks),
    new T.AnimationClip('02_Counterflow_in_assembled_pack',8,flowTracks)];
  root.traverse(node=>{
    if(node.isMesh)node.geometry.deleteAttribute('uv');
  });
  scene.updateMatrixWorld(true);
  const binary=await new GLTFExporter().parseAsync(scene,{binary:true,trs:true,onlyVisible:false,animations:clips});
  return {binary:new Uint8Array(binary),paths:{schema:1,units:'mm',coordinateSpace:`local to named Channel node, before the ${ROOT_NAME} root scale of 0.001`,nodeOrigins:'zGap in the assembly data',
    parameters:{platePitch:PITCH,nominalClearance:D.clearGap,plateThickness:D.thickness},ports:PORTS,routes}};
}
