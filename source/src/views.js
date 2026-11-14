import timeline from './timeline.json';
import {D,POST_Z,DETAIL_START,ramp,zPlate,explosion} from './design.js';

export const VIEWS = {
  assembly:{title:'整机装配',section:'装配',tag:'ASSEMBLY',legend:'板片压紧在固定端与活动端之间',body:`六组螺栓把 ${D.count} 张板片压紧在两块端板之间。活动端到后立柱留有 ${D.serviceClearance} mm，可沿导杆退开检查板片。`,e:0,alpha:1,flow:false},
  exploded:{title:'轴向拆解',section:'拆解',tag:'EXPLODED',legend:'退出螺栓 · 松开板包 · 逐层展列',body:`先退出螺栓，活动端在导杆上后退 ${D.serviceTravel} mm。继续拖动，后支架退开，板片在爆炸图中逐层分离。`,e:1,alpha:1,flow:false},
  plate:{title:'板片与密封',section:'板片',tag:'STAMPING',legend:'A / B 相邻板片旋转 180° 安装',body:'人字纹在相邻层反向交叉。场垫圈住本侧两个角孔，独立孔环隔开另一回路的总管。',e:.88,alpha:1,flow:false},
  flow:{title:'相邻逆流',section:'流道',tag:'COUNTERFLOW',legend:'三张相邻板片之间的两个独立流道',body:'热流体从 S4 向下流往 S3，冷流体从 S2 向上流往 S1。切换分层与压紧可追踪对应的板间空间。',e:.90,alpha:.19,flow:true},
  section:{title:'波纹接触截面',section:'剖面',tag:'CONTACT SECTION',legend:'压紧板组中心取样 · 深度单独放大',body:'红、蓝实体的两面取自对应板壁。相邻波峰相接处的净隙为零，流体从接触点两侧通过。',e:0,alpha:1,flow:true}
};
export {timeline};
export function tourAt(t) {
  const {beats}=timeline, cyc=((t%timeline.duration)+timeline.duration)%timeline.duration;
  let view='assembly';
  for(const b of beats) if(cyc>=b.at) view=b.view;
  const s={...VIEWS[view],view,detail:false,hot:true,cold:true,partIndex:DETAIL_START,labels:true};
  if(view==='exploded') s.e=ramp(cyc,beats[1].at,beats[1].at+3.9);
  if(view==='plate') s.e=.94+.06*ramp(cyc,beats[2].at,beats[2].at+2.5);
  const beatIndex=beats.findIndex(b=>b.view===view);
  const from=beats[beatIndex].at, until=beats[beatIndex+1]?.at??timeline.duration;
  s.cameraDrift=.11*(ramp(cyc,from,until)-.5);
  return s;
}
export function preset(view,e=.0,index=4) {
  switch(view) {
    case 'exploded':
    case 'assembly': {
      const columnZ = POST_Z + explosion({role:'backFoot'},e)[2] - 42.5;
      const frontZ = Math.max(D.frameFront + 69.35 + explosion({role:'pipe'},e)[2],
        D.frameFront + 13.4 + explosion({role:'bolt'},e)[2]);
      const targetZ = (frontZ + columnZ) / 2;
      return {target:[0,-5,targetZ],direction:[-1.21,.44-.16*e,.86-.5*e],
        height:1070 + 70*e,width:Math.max(580,(frontZ-columnZ)*(.815+.16*e)+D.frameW*(.58-.28*e)+120)};
    }
    case 'plate': return {target:[0,0,zPlate(index+.5)],direction:[-.77,.16,1.18],height:960,width:900};
    case 'flow': return {target:[0,0,zPlate(index+1)],direction:[-1.02,.24,1.02],height:923,width:785};
    case 'section': return {target:[0,0,0],direction:[-1.16,.85,1.09],height:135,width:151};
    default: return preset('assembly');
  }
}
