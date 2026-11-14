import * as T from 'three';
import {D,PITCH,PORTS,isHot,wave} from './design.js';

const v2 = (x,y) => new T.Vector2(x,y);
const ccw = loop => T.ShapeUtils.area(loop) < 0 ? loop.slice().reverse() : loop;
export function circle(x, y, r, n=48) {
  return Array.from({length:n},(_,i)=>v2(x+r*Math.cos(2*Math.PI*i/n),y+r*Math.sin(2*Math.PI*i/n)));
}
function pathPoints(start, commands) {
  const path = new T.Path();
  path.moveTo(...start);
  for (const args of commands) {
    if (args.length === 2) path.lineTo(...args);
    else path.quadraticCurveTo(...args);
  }
  return path.getPoints(5);
}
function upperEdge(kind, hot, lower) {
  const b = D.fieldY;
  if (kind === 'plate') {
    const w=D.plateHalfWidth, h=D.plateHalfHeight;
    const notch = lower ? [[13,h],[13,368],[-13,368],[-13,h]] :
      [[7,h],[7,376],[17,376],[17,359],[-17,359],[-17,376],[-7,376],[-7,h]];
    return pathPoints([w,b],[[w,h-17],[w,h,w-17,h],...notch,[-w+17,h],[-w,h,-w,h-17],[-w,b]]);
  }
  const w=110;
  let points = pathPoints([w,b],[[w,269],[w,276,101,277],[48,281],
    [21,284,18,308],[16,339],[15,353,0,353],[-85,353],
    [-w,353,-w,331],[-w,b]]);
  if (!hot) points=points.map(p=>v2(-p.x,p.y)).reverse();
  return points;
}
function edge(kind,hot,lower) {
  const pts=upperEdge(kind,hot,lower);
  return lower ? pts.map(p=>v2(p.x,-p.y)).reverse() : pts;
}
export function gasketOutline(hot) {
  return [...edge('channel',hot,false),...edge('channel',hot,true)];
}
// Offsets the wet edge of the sealing land outwards. The inner face coincides with the fluid boundary.
export function offsetLoop(points, d) {
  const p=ccw(points);
  return p.map((cur,i) => {
    const prev=p[(i+p.length-1)%p.length], next=p[(i+1)%p.length];
    const a=cur.clone().sub(prev).normalize(), b=next.clone().sub(cur).normalize();
    const n1=v2(a.y,-a.x), n2=v2(b.y,-b.x);
    return cur.clone().add(n1.clone().add(n2).multiplyScalar(d/Math.max(.22,1+n1.dot(n2))));
  });
}
export function extrude(outer, holes, thickness, bevel=0) {
  const shape=new T.Shape(ccw(outer));
  for(const h of holes) shape.holes.push(new T.Path(ccw(h).slice().reverse()));
  const g=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:bevel>0,bevelThickness:bevel,
    bevelSize:bevel,bevelSegments:2,curveSegments:6,steps:1});
  g.translate(0,0,-thickness/2);
  return g;
}
export function roundRect(x0,y0,x1,y1,r=6) {
  return pathPoints([x0+r,y0],[[x1-r,y0],[x1,y0,x1,y0+r],[x1,y1-r],
    [x1,y1,x1-r,y1],[x0+r,y1],[x0,y1,x0,y1-r],[x0,y0+r],[x0,y0,x0+r,y0]]).slice(0,-1);
}
export function ring(ro,ri,length,n=48,extra=[]) {
  return extrude(circle(0,0,ro,n),[circle(0,0,ri,n),...extra],length);
}

// A single triangulated planar domain feeds both skins. The grid of the field is identical for
// the two adjacent sheets and for the fluid between them. Port/distributor caps are planar.
function domain(kind,i,blind,window,overview) {
  const pts=[], tris=[], loops=[], lookup=new Map();
  const add = p => {
    const key=p.x.toFixed(5)+','+p.y.toFixed(5);
    if (!lookup.has(key)) {lookup.set(key,pts.length);pts.push(p);}
    return lookup.get(key);
  };
  const series=(a,b,step)=>Array.from({length:Math.round((b-a)/step)+1},(_,j)=>a+j*step);
  const xs=window ? series(-44,44,4) : series(-D.fieldX,D.fieldX,overview ? 8 : 4);
  const ys=window ? series(-30,30,3) : series(-D.fieldY,D.fieldY,overview ? 6 : 3);
  if (!window) {
    const w=kind==='plate' ? D.plateHalfWidth : 110;
    xs.unshift(-w);xs.push(w);
  }
  const rows=ys.map(y=>xs.map(x=>add(v2(x,y))));
  for(let k=1;k<ys.length;k++) for(let j=1;j<xs.length;j++) {
    const a=rows[k-1][j-1], b=rows[k-1][j], c=rows[k][j], d=rows[k][j-1];
    tris.push(a,b,c,a,c,d);
  }
  if (window) {
    loops.push([...rows[0],...rows.slice(1).map(row=>row.at(-1)),...rows.at(-1).slice(0,-1).reverse(),
      ...rows.slice(1,-1).reverse().map(row=>row[0])]);
    return {pts,tris,loops};
  }
  const sides=[];
  for(const lower of [false,true]) {
    const rim=edge(kind,isHot(i),lower);
    const holes=blind ? [] : PORTS.filter(p=>(p.y<0)===lower && (kind==='plate'||(p.circuit==='hot')===isHot(i)))
      .map(p=>circle(p.x,p.y,D.bore).reverse());
    const outer=ccw(rim), coords=[...outer,...holes.flat()], ids=coords.map(add);
    const face=T.ShapeUtils.triangulateShape(outer,holes);
    const row=rows[lower?0:rows.length-1];
    const left=row[0], right=row[row.length-1];
    // Earcut's long closing edge is split at every grid vertex so the solid is watertight.
    for (const f of face) {
      const t=f.map(j=>ids[j]);
      const k=t.findIndex((id,j)=>(id===left && t[(j+1)%3]===right)||(id===right && t[(j+1)%3]===left));
      if(k===-1) {tris.push(...t);continue;}
      const baseline=t[k]===left ? row : [...row].reverse();
      for(let j=1;j<baseline.length;j++) tris.push(baseline[j-1],baseline[j],t[(k+2)%3]);
    }
    sides.push(rim.map(add));
    for(const hole of holes) loops.push(hole.map(add));
  }
  // Join the curved caps to the two straight sides, retaining every boundary vertex.
  loops.push([...sides[0],...rows.slice(1,-1).reverse().map(row=>row[0]),
    ...sides[1],...rows.slice(1,-1).map(row=>row.at(-1))]);
  return {pts,tris,loops};
}
export function stampedSolid(kind,i,{blind=false,window=false,overview=false}={}) {
  const {pts,tris,loops}=domain(kind,i,blind,window,overview);
  const xyz=[],idx=[],n=pts.length, top=[],bottom=[];
  for(const p of pts) {
    const w=wave(i,p.x,p.y);
    if(kind==='plate') { top.push(w+D.thickness/2); bottom.push(w-D.thickness/2); }
    else { top.push(PITCH/2+w-D.thickness/2);bottom.push(-PITCH/2+wave(i+1,p.x,p.y)+D.thickness/2); }
  }
  for(const h of [top,bottom]) for(let j=0;j<n;j++) xyz.push(pts[j].x,pts[j].y,h[j]);
  for(let j=0;j<tris.length;j+=3) {
    const a=tris[j], b=tris[j+1], c=tris[j+2];
    idx.push(a,b,c,a+n,c+n,b+n);
  }
  // Duplicate perimeter normals only, preserving hard edges between the skins and cut faces.
  for(const loop of loops) {
    for(let j=0;j<loop.length;j++) {
      const a=loop[j],b=loop[(j+1)%loop.length], k=xyz.length/3;
      xyz.push(pts[a].x,pts[a].y,top[a],pts[a].x,pts[a].y,bottom[a],
        pts[b].x,pts[b].y,bottom[b],pts[b].x,pts[b].y,top[b]);
      idx.push(k,k+1,k+2,k,k+2,k+3);
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
  g.setIndex(idx);g.computeVertexNormals();g.computeBoundingBox();
  return g;
}
