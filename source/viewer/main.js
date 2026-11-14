import {MODEL_ID,DETAIL_START} from '../src/design.js';
import {runSim} from 'teardown-kit/runtime.js';
import {VIEWS,tourAt,timeline} from '../src/views.js';
import {mount,connectUI} from '../src/interface.js';
import {createStage} from '../src/stage.js';

const film=new URLSearchParams(location.search).has('film')||!!window.__CAPTURE||new URLSearchParams(location.search).has('capture');
if(film)document.body.classList.add('film');
const ready=runSim({duration:timeline.duration,fps:timeline.fps,theme:'light',accent:'#285e53',hud:{enabled:false,title:'可拆式板式换热器',subtitle:MODEL_ID},director:{enabled:false}},
async ({canvas,capture})=>{
  const {app,host,anchorHost}=mount(canvas);
  const stage=createStage(canvas,host,anchorHost);
  let state={...VIEWS.assembly,view:'assembly',e:0,alpha:1,flow:false,hot:true,cold:true,labels:true,
    hidden:new Set(),revision:0,selected:null,isolate:null,partIndex:DETAIL_START,tab:'settings',drawer:false,
    tour:false,idle:false,showCursor:false,cameraFollows:false};
  let actual=state, tourStart=performance.now(),lastInput=tourStart,flowPaused=false,flowOffset=0,clockOrigin=tourStart;
  const flowTime=()=>flowOffset+(flowPaused?0:(performance.now()-clockOrigin)/1000);
  function manual() {
    if(film)return;
    if(state.tour) Object.assign(state,{view:actual.view,e:actual.e,alpha:actual.alpha,flow:actual.flow,partIndex:actual.partIndex});
    state.tour=false;state.showCursor=false;lastInput=performance.now();
  }
  function change(fn){manual();fn(state);}
  function mode(view){change(s=>{Object.assign(s,VIEWS[view],{view,selected:null,isolate:null,hot:true,cold:true,partIndex:DETAIL_START});s.hidden.clear();s.revision++;stage.reset();});}
  function tour(on){
    if(!on){manual();state.idle=false;return;}
    state.tour=true;state.drawer=false;state.tab='settings';state.hidden.clear();state.revision++;state.selected=state.isolate=null;
    tourStart=performance.now();stage.reset();
  }
  const setTab=tab=>change(s=>{s.tab=tab;});
  const panel=on=>change(s=>{s.drawer=on;});
  const ui=connectUI(app,stage,{get:()=>state,change,mode,tour,setTab,panel});
  for(const ev of ['pointerdown','wheel','keydown'])document.addEventListener(ev,e=>{
    if(e.target.closest?.('#tour,#idle')) {lastInput=performance.now();return;}
    manual();
  },{capture:true,passive:true});
  const point={x:0,y:0};canvas.addEventListener('pointerdown',e=>{point.x=e.clientX;point.y=e.clientY;});
  canvas.addEventListener('pointerup',e=>{
    if(e.button!==0||Math.hypot(e.clientX-point.x,e.clientY-point.y)>4)return;
    const id=stage.pick(e.clientX,e.clientY);
    if(id)change(s=>{s.selected=id;});
  });
  canvas.addEventListener('dblclick',e=>{
    const id=stage.pick(e.clientX,e.clientY);
    if(id)change(s=>{s.isolate=s.isolate===id?null:id;s.selected=id;s.hidden.delete(id);s.revision++;});
  });
  // Intercept viewer shortcuts before the kit's time-seeking keys.
  window.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]')||e.target.matches('input,select,textarea,button,summary'))return;
    const number=Number(e.key);
    if(number>=1&&number<=5){mode(Object.keys(VIEWS)[number-1]);}
    else if(e.code==='Space'){manual();flowOffset=flowTime();clockOrigin=performance.now();flowPaused=!flowPaused;}
    else if(e.key==='Escape'){change(s=>{s.isolate=null;s.drawer=false;s.selected=null;stage.reset();});}
    else return;
    e.stopImmediatePropagation();e.preventDefault();
  },true);
  function render(t) {
    const now=performance.now();
    if(!film&&!state.tour&&state.idle&&!state.drawer&&!document.querySelector('dialog[open]')&&
      !state.isolate&&state.tab==='settings'&&now-lastInput>=25000)tour(true);
    const seconds=film?t:((now-tourStart)/1000)%timeline.duration;
    if(film||state.tour){
      actual={...state,...tourAt(seconds),tour:true,showCursor:!film&&timeline.beats.some(b=>seconds>b.at+.02&&seconds<b.at+.95),cameraFollows:true};
    }else actual={...state,cameraFollows:false};
    stage.render(film||state.tour?seconds:flowTime(),actual);ui.render(actual,film);return {};
  }
  window.PHE={state:()=>({view:actual.view,e:actual.e,alpha:actual.alpha,selected:actual.selected,
    isolate:actual.isolate,hidden:[...actual.hidden],parts:stage.assembly.parts.length,tour:actual.tour,hot:actual.hot,cold:actual.cold,flow:actual.flow,partIndex:actual.partIndex}),
    geometry:()=>stage.info()};
  return {render,resize:stage.resize,warm:stage.warm};
});
ready.catch(e=>{console.error(e);const box=document.createElement('div');box.style.cssText='position:fixed;z-index:30;inset:32% 14% auto;background:#f7f7f2;color:#203836;padding:28px;border:1px solid #bcc7ba;font:16px/1.7 system-ui';box.textContent='三维视图需要启用 WebGL 2。请使用支持硬件加速的浏览器打开此文件，或在建模软件中导入随附的 GLB。';document.body.append(box);});
