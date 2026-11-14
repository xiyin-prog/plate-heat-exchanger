// All dimensions are millimetres. +Z points towards the four front connections.
export const D = Object.freeze({
  count: 101, frameW: 320, frameH: 920, frameFront: 32, rearThickness: 30,
  plateHalfWidth: 126, plateHalfHeight: 392, thickness: 0.5, clearGap: 2,
  portX: 70, portY: 320, bore: 25, period: 24, slope: 0.75,
  fieldX: 104, fieldY: 264, sealHalfWidth: 2.7,
  columnDepth: 30, serviceClearance: 80, serviceTravel: 60
});
export const PITCH = D.thickness + D.clearGap;
export const AMP = D.clearGap / 2;
export const PACK_LENGTH = D.count * PITCH;
export const rearFace = -PACK_LENGTH;
export const GUIDE_LENGTH = PACK_LENGTH + D.rearThickness + D.serviceClearance;
export const POST_Z = -GUIDE_LENGTH - D.columnDepth / 2;
export const MODEL_ID = 'PHE–' + D.count;
export const ROOT_NAME = 'PHE' + D.count;
export const DETAIL_START = Math.floor((D.count - 1) / 4) * 2 - 2;
export const BOLT_TIP = rearFace - D.rearThickness - 28;
export const zPlate = i => -(i + 0.5) * PITCH;
export const zGap = i => (zPlate(i) + zPlate(i + 1)) / 2;
// Inspection-only spacing magnifies the distance between selected rigid components.
export function layerOffset(meta, e, view, first) {
  if (view!=='plate' && view!=='flow') return 0;
  if (!['plate','seal','channel'].includes(meta.role)) return 0;
  const offset = meta.role === 'plate' ? 0 : 0.5;
  const middle = view === 'plate' ? 0.5 : 1;
  const stride = view === 'plate' ? 930 : 300;
  return -((meta.index ?? first) + offset - first - middle) * stride * ramp(e, 0.15, 1);
}
export const isHot = i => i % 2 === 0;
export const seq = i => String(i + 1).padStart(2, '0');
export const PORTS = [
  {code:'S4', x:-D.portX, y:D.portY, circuit:'hot', inlet:true, name:'热侧入口'},
  {code:'S3', x:-D.portX, y:-D.portY, circuit:'hot', inlet:false, name:'热侧出口'},
  {code:'S2', x:D.portX, y:-D.portY, circuit:'cold', inlet:true, name:'冷侧入口'},
  {code:'S1', x:D.portX, y:D.portY, circuit:'cold', inlet:false, name:'冷侧出口'}
];
export const GROUPS = [
  ['fixed','固定压紧板'], ['moving','活动压紧板'], ['plates','波纹板片'],
  ['seals','密封垫片'], ['guides','上、下导杆'], ['ties','压紧紧固件'],
  ['stand','立柱与底座'], ['pipes','进出口接管'], ['fluid','流体域']
];
export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export function ramp(t, a, b) {
  const v = clamp((t - a) / (b - a));
  return v * v * (3 - 2 * v);
}
export function wave(i, x, y) {
  const ax = Math.abs(x), ay = Math.abs(y);
  const direction = isHot(i) ? 1 : -1;
  const k = 2 * Math.PI / D.period;
  const field = (1 - ramp(ax, 91, 102)) * (1 - ramp(ay, 213, 235));
  // Rotating a stamping by 180° maps (x,y) to (-x,-y).
  const chevron = Math.cos(k * (direction * y + D.slope * ax));
  const fan = ramp(ay, 217, 236) * (1 - ramp(ay, 252, 263)) * (1 - ramp(ax, 91, 102));
  const fanPhase = Math.hypot(x - direction * -D.portX, 1.2 * (ay - 327));
  return AMP * (field * chevron + 0.58 * fan * Math.cos(k * 1.28 * fanPhase));
}
export function walls(i, x, y) {
  return [zPlate(i + 1) + wave(i + 1, x, y) + D.thickness / 2,
          zPlate(i) + wave(i, x, y) - D.thickness / 2];
}
export const opening = (i,x,y) => {const [lo,hi]=walls(i,x,y); return hi-lo;};

// Barycentric interpolation of the very triangles used by both sheet and fluid meshes.
export function meshWave(i, x, y) {
  if (Math.abs(x) >= D.fieldX || Math.abs(y) >= D.fieldY) return 0;
  const x0 = Math.floor((x + D.fieldX) / 4) * 4 - D.fieldX;
  const y0 = Math.floor((y + D.fieldY) / 3) * 3 - D.fieldY;
  const u = (x - x0) / 4, v = (y - y0) / 3;
  const a = wave(i,x0,y0), c = wave(i,x0+4,y0+3);
  return u >= v ? a*(1-u) + wave(i,x0+4,y0)*(u-v) + c*v
                : a*(1-v) + c*u + wave(i,x0,y0+3)*(v-u);
}
// Lane endpoints reach the two open corner holes. Coordinates in the node's local frame.
export function lanePoint(i, lane, t) {
  const sign = isHot(i) ? -1 : 1;
  const y = (isHot(i) ? 1 : -1) * D.portY * (1 - 2 * t);
  const fieldX = [-62, -29, 2, 33, 64][lane];
  const fan = ramp(Math.abs(y), 178, D.portY);
  const meander = 2.4 * Math.sin(y * Math.PI / 61 + lane * 0.81) * (1 - fan);
  const x = fieldX * (1 - fan) + sign * D.portX * fan + meander;
  const z = (meshWave(i,x,y) + meshWave(i+1,x,y)) / 2;
  return [x,y,z];
}
// An opened machine uses only the available service stroke. The subsequent CAD
// explosion translates rigid parts in free space, after the support has moved.
function sheetSpread(index) {
  const widerGaps = clamp(index - DETAIL_START, 0, 4);
  return 24 + 4 * index + 32 * widerGaps;
}
export const PACK_SPREAD = sheetSpread(D.count - 1);
export function explosion(meta, t) {
  const {role, index = 0, sign = 1} = meta;
  const fan = ramp(t, .54, 1);
  const service = D.serviceTravel * ramp(t, .30, .48);
  const rearTravel = service + PACK_SPREAD * fan;
  const supportTravel = PACK_SPREAD * ramp(t, .48, .92);
  let x = 0, z = 0;
  switch (role) {
    case 'plate':
      z = -sheetSpread(index) * fan;
      break;
    case 'seal':
    case 'channel': {
      const fraction = role === 'seal' ? .34 : .66;
      const step = sheetSpread(index + 1) - sheetSpread(index);
      z = -(sheetSpread(index) + fraction * step) * fan;
      break;
    }
    case 'startSeal': z = -sheetSpread(0) * .45 * fan; break;
    case 'rear': z = -rearTravel; break;
    case 'post': z = -supportTravel; break;
    case 'backFoot': z = -supportTravel - 58 * ramp(t, .91, 1); break;
    case 'frontFoot': z = 70 * ramp(t, .84, 1); break;
    case 'rail': z = -36 * ramp(t, .82, 1); break;
    case 'bolt': {
      // Withdraw the actual full-length bolt before moving it outside the frame.
      const withdrawal = D.frameFront + 32 - BOLT_TIP;
      z = withdrawal * ramp(t, .09, .29) - (withdrawal - 18) * ramp(t, .43, .78);
      x = sign * 106 * ramp(t, .29, .42);
      break;
    }
    case 'nut':
      z = -44 * ramp(t, 0, .09) - rearTravel;
      x = sign * 51 * ramp(t, .09, .22);
      break;
    case 'backWasher':
      z = -32 * ramp(t, 0, .09) - rearTravel;
      x = sign * 85 * ramp(t, .09, .22);
      break;
    case 'frontWasher':
      z = 39 * ramp(t, .43, .61);
      x = sign * 51 * ramp(t, .43, .61);
      break;
    case 'pipe': z = 70 * ramp(t, .48, .72); break;
  }
  return [x, 0, z];
}
export const SOURCES = [
  ['M6 系列外形尺寸与通道规格','https://www.alfalaval.com/globalassets/documents/microsites/heating-and-cooling-hub/pd-leaflets---gasketed/m6.pdf'],
  ['A/B 板片方向与 0.5 mm 板厚','https://shop.alfalaval.com/en-us/gasketed-plates--1386555/channel-plate--1627033-'],
  ['单流程逆流及四孔分配','https://www.youtube.com/watch?v=uEInVVcc6Sc']
];
