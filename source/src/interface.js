import {D,PORTS,GROUPS,SOURCES,MODEL_ID,PACK_LENGTH,seq} from './design.js';
import {VIEWS,timeline} from './views.js';

const icons={
  exchanger:'<path d="m3 8 8-5 10 5-8 5z M3 12l10 5 8-5 M3 16l10 5 8-5"/>',
  play:'<path d="m8 4 11 8-11 8z"/>',pause:'<path d="M7 5v14M16 5v14"/>',
  reset:'<path d="M4 10a8 8 0 1 1 1 7 M4 4v6h6"/>',
  panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
  eye:'<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.4"/>',
  hide:'<path d="m3 3 18 18M5 7.8C3.1 9.2 2 12 2 12s3.8 6 10 6c1.6 0 3-.4 4.2-1M9.1 6.4 12 6c6.2 0 10 6 10 6l-2.2 2.8"/>',
  focus:'<path d="M9 3H4v5M15 3h5v5M4 16v5h5M20 16v5h-5"/><circle cx="12" cy="12" r="3.4"/>',
  plus:'<path d="M5 12h14M12 5v14"/>',minus:'<path d="M5 12h14"/>',
  chevron:'<path d="m8 10 4 4 4-4"/>',close:'<path d="m5 5 14 14M19 5 5 19"/>',
  turn:'<path d="M3 11c2-4 15-6 18-1s-6 8-12 7M8 14l-1 4 5 1"/>',
  list:'<path d="M8 6h12M8 12h12M8 18h12 M3 6h1M3 12h1M3 18h1"/>',
  full:'<path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6"/>'
};
const ico=n=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[n]+'</svg>';
const $=(el,sel)=>el.querySelector(sel);
const btnIcon=(n,text,attrs='')=>'<button class="icon-btn" title="'+text+'" aria-label="'+text+'" '+attrs+'>'+ico(n)+'</button>';
const sw=(id,text,checked)=>'<label class="switch-line"><span>'+text+'</span><input type="checkbox" id="'+id+'" '+(checked?'checked':'')+'><i class="switch"></i></label>';
const range=(id,caption,value)=>'<div class="range-block"><label for="'+id+'">'+caption+'</label><output id="'+id+'-value">'+value+'%</output><input id="'+id+'" type="range" min="0" max="100" step="1" value="'+value+'"></div>';
const ord=['assembly','exploded','plate','flow','section'];
export function mount(canvas) {
  const app=document.querySelector('#app');
  app.insertAdjacentHTML('beforeend',`
    <header class="mast">
      <div class="identity"><span class="mark">${ico('exchanger')}</span><div><h1>可拆式板式换热器</h1><div class="eng">GASKETED PLATE HEAT EXCHANGER</div></div></div>
      <div class="mast-actions"><button class="tour" id="tour">${ico('play')}<span>自动导览</span></button>${btnIcon('info','模型资料','id="info"')}</div>
    </header>
    <main class="workbench">
      <section class="viewport" aria-label="可旋转的三维模型">
        <div class="scene-host"></div><div class="anchors" aria-hidden="true"></div>
        <div class="viewport-top"><span id="scene-id">${MODEL_ID}</span><span class="slash">/</span><b id="scene-tag">ASSEMBLY</b></div>
        <button class="drawer-toggle" id="drawer">${ico('panel')}<span>控制台</span></button>
        <div class="camera-tools">${btnIcon('plus','放大','id="zoom-in"')}${btnIcon('minus','缩小','id="zoom-out"')}${btnIcon('focus','复位视角','id="home"')}</div>
        <div class="film-read"><div id="film-kicker"></div><h2 id="film-title"></h2><p id="film-body"></p></div>
        <div class="scene-foot"><div class="scene-copy"><div class="kicker"><span></span> <b id="scene-kicker"></b></div><div class="scene-caption" id="scene-caption"></div></div>
          <div class="orbit-hint">${ico('turn')}<span>拖动旋转<br>滚轮缩放</span></div></div>
        <div class="auto-cursor" hidden><svg viewBox="0 0 20 26"><path d="M2 2l15 12-7 1-4 8z" fill="#224443" stroke="white" stroke-width="1.6"/></svg></div>
      </section>
      <aside class="inspector">
        <div class="drawer-head"><b>模型控制台</b>${btnIcon('close','收起控制台','id="close-drawer"')}</div>
        <div class="panel-tabs"><button id="tab-settings" aria-pressed="true">视图设置</button><button id="tab-parts" aria-pressed="false">零件树</button></div>
        <div class="panel-scroll">
          <div class="settings-page">
            <section class="chapter"><div class="chapter-head"><div><div class="kicker"><b id="chapter-en"></b></div><h2 id="chapter-title"></h2></div><div class="pattern" aria-hidden="true"></div></div><p id="chapter-body"></p></section>
            <section class="params"><div id="counts"></div><div id="context"></div></section>
            <section class="options"><h3>显示控制</h3>${range('spread','拆解进度',0)}${range('opacity','板片不透明度',100)}
              ${sw('labels','零件标注',true)}${sw('flow','显示冷热流体',false)}
              <div class="fluid-filters" id="fluid-filters"><button data-circuit="hot"><i class="dot hot"></i>热侧</button><button data-circuit="cold"><i class="dot cold"></i>冷侧</button></div>
            </section>
          </div>
          <div class="parts-page" hidden>
            <div class="tree-intro"><h2>零件树</h2><span id="part-total"></span></div>
            <input id="filter" type="search" placeholder="查找零件或编号" aria-label="查找零件或编号">
            <div class="part-actions"><button id="isolate" disabled>仅显示选中件</button><button id="restore">全部显示</button></div><div class="tree"></div>
          </div>
        </div>
        <div class="panel-end"><i></i><span id="mode-status">交互视图</span><button id="idle" aria-pressed="true" title="空闲 25 秒后继续导览">闲置导览</button></div>
      </aside>
    </main>
    <nav class="view-nav" aria-label="观察视图"><span class="nav-label">观察视图</span><div class="view-tabs">
      ${ord.map((v,i)=>'<button data-view="'+v+'"><small>'+String(i+1).padStart(2,'0')+'</small><span>'+VIEWS[v].title+'</span></button>').join('')}
    </div></nav>
    <dialog class="source-dialog"><form method="dialog"><h2>模型资料</h2><button class="icon-btn" aria-label="关闭">${ico('close')}</button></form>
      <p>单流程液–液逆流，固定端四接管。板包内有 ${D.count} 张板片，末片四角封闭。通道实体和板片使用同一套三角网格生成。</p>
      <p>框架比例和 2.0 mm 名义通道间隙参考 M6 系列。人字纹节距、分配区、密封截面及紧固件取演示尺寸。流向标记沿预设路径运动。</p>
      <h3>结构参考</h3>${SOURCES.map(([n,u])=>'<a target="_blank" rel="noreferrer" href="'+u+'">'+n+' ↗</a>').join('')}
      <h3>操作</h3><p>拖动旋转，滚轮或双指缩放，右键或双指拖动平移。单击模型可选件，双击可单独查看。数字键 1–5 切换视图，空格暂停流向标记。</p>
    </dialog>`);
  const host=$(app,'.scene-host'),anchorHost=$(app,'.anchors');
  host.append(canvas);
  return {app,host,anchorHost};
}
const contextHTML=(s)=>{
  const i=s.partIndex;
  if(s.view==='assembly')return '<div class="port-map">'+PORTS.map(p=>'<div><b class="port-code '+p.circuit+'">'+p.code+'</b><span>'+p.name+'</span></div>').join('')+'</div>'+
    '<div class="pack-dimensions"><div class="detail-line"><span>压紧板包厚度</span><strong>'+PACK_LENGTH+' mm</strong></div>'+
    '<div class="detail-line"><span>活动端至立柱</span><strong>'+D.serviceClearance+' mm</strong></div></div>';
  if(s.view==='exploded')return '<div class="detail-line"><span>压紧紧固件</span><strong>6 组</strong></div><div class="detail-line"><span>板片排列</span><strong>A / B 交替</strong></div>';
  if(s.view==='section')return '<div class="detail-line"><span>平面取样范围</span><strong>88 × 60 mm</strong></div><div class="detail-line"><span>板厚方向放大</span><strong>8×</strong></div>';
  const max=s.view==='plate'?D.count-1:D.count-2;
  return '<label class="choose-pair">观察板组<select id="pick-index">'+Array.from({length:max},(_,k)=>
    '<option value="'+k+'" '+(i===k?'selected':'')+'>P'+seq(k)+' – P'+seq(k+(s.view==='plate'?1:2))+'</option>').join('')+'</select></label>'+
    (s.view==='flow'?'<div class="flow-line"><span class="hot">S4 ↓ S3</span><span class="cold">S2 ↑ S1</span></div>':'<div class="detail-line"><span>翻转角度</span><strong>180°</strong></div>');
};
export function connectUI(app, stage, api) {
  const {get,change,mode,tour,setTab,panel}=api, tree=$(app,'.tree'), query=$(app,'#filter');
  let ctxKey='',viewKey='',treeKey='',tabKey='',treeBuilt=false,scrollSelection=null;
  const groups=new Map();
  function fillTree(){
    if(treeBuilt)return;treeBuilt=true;
    for(const [id,name] of GROUPS) {
      const list=stage.assembly.parts.filter(p=>p.group===id), details=document.createElement('details');details.dataset.group=id;
      details.innerHTML='<summary>'+ico('chevron')+'<b>'+name+'</b><small>'+list.length+'</small><button class="group-eye" title="显示或隐藏此组" aria-label="显示或隐藏'+name+'">'+ico('eye')+'</button></summary><div class="rows"></div>';
      const rows=details.querySelector('.rows');
      for(const p of list){
        const row=document.createElement('div');row.className='part-row';row.dataset.id=p.id;
        row.innerHTML='<button class="pick-part" title="'+p.id+'">'+p.label+'</button><button class="part-eye" aria-label="切换'+p.label+'可见性">'+ico('eye')+'</button>';rows.append(row);
      }
      groups.set(id,details);tree.append(details);
    }
  }
  // Event delegation retains expanded branches, focus and scroll position while state changes.
  tree.addEventListener('click',(e)=>{
    const p=e.target.closest('.part-row'),group=e.target.closest('details')?.dataset.group;
    if(e.target.closest('.group-eye')) {
      e.preventDefault();e.stopPropagation();const parts=stage.assembly.parts.filter(p=>p.group===group);
      const hide=parts.some(p=>!get().hidden.has(p.id));
      change(s=>{s.isolate=null;for(const p of parts){if(hide)s.hidden.add(p.id);else s.hidden.delete(p.id);}if(group==='fluid'&&!hide){s.flow=true;s.hot=true;s.cold=true;}s.revision++;});return;
    }
    if(!p)return;
    const id=p.dataset.id;
    if(e.target.closest('.part-eye'))change(s=>{
      s.isolate=null;
      if(s.hidden.has(id)){s.hidden.delete(id);const m=stage.assembly.byId.get(id).meta;if(m.circuit && (m.role==='header'||m.role==='channel')){s.flow=true;s[m.circuit]=true;}}
      else s.hidden.add(id);
      s.revision++;
    });
    else change(s=>{s.selected=id;});
  });
  query.addEventListener('input',()=>{
    fillTree();const term=query.value.toLowerCase().trim();
    for(const [id,d] of groups){
      let n=0;for(const r of d.querySelectorAll('.part-row')){
        const p=stage.assembly.byId.get(r.dataset.id), ok=!term||[p.id,p.label, GROUPS.find(g=>g[0]===id)[1]].some(x=>x.toLowerCase().includes(term));
        r.hidden=!ok;if(ok)n++;
      }
      d.hidden=!n;if(term&&n)d.open=true;
    }
  });
  const click=(id,fn)=>$(app,'#'+id).addEventListener('click',fn);
  for(const b of app.querySelectorAll('[data-view]'))b.onclick=()=>mode(b.dataset.view);
  click('tab-parts',()=>setTab('parts'));click('tab-settings',()=>setTab('settings'));
  click('drawer',()=>panel(!get().drawer));click('close-drawer',()=>panel(false));
  click('zoom-in',()=>{change(()=>{});stage.zoom(1.2);});click('zoom-out',()=>{change(()=>{});stage.zoom(1/1.2);});
  click('home',()=>{change(()=>{});stage.reset();});
  click('info',()=>{change(()=>{});$(app,'dialog').showModal();});
  click('tour',()=>tour(!get().tour));
  click('idle',()=>change(s=>{s.idle=!s.idle;}));
  click('isolate',()=>change(s=>{
    if(!s.selected)return;
    s.isolate=s.isolate===s.selected?null:s.selected;
    if(s.isolate)s.hidden.delete(s.isolate);
    s.revision++;
  }));
  click('restore',()=>change(s=>{
    Object.assign(s,VIEWS.assembly,{view:'assembly',selected:null,isolate:null,flow:true,hot:true,cold:true});
    s.hidden.clear();s.revision++;stage.reset();
  }));
  for(const id of ['spread','opacity'])$(app,'#'+id).oninput=e=>change(s=>{if(id==='spread'){s.e=+e.target.value/100;if(s.view==='assembly'&&s.e>0)s.view='exploded';}else s.alpha=+e.target.value/100;});
  for(const id of ['labels','flow'])$(app,'#'+id).onchange=e=>change(s=>{s[id]=e.target.checked;});
  for(const b of app.querySelectorAll('[data-circuit]'))b.onclick=()=>change(s=>{s[b.dataset.circuit]=!s[b.dataset.circuit];});
  $(app,'#context').addEventListener('change',e=>{if(e.target.id==='pick-index')change(s=>{s.partIndex=+e.target.value;s.isolate=null;s.selected=null;});});
  const partCount=stage.assembly.parts.length;
  $(app,'#part-total').textContent=partCount+' 件';
  const cached=new Map();
  const elements=['scene-kicker','scene-caption','scene-tag','chapter-en','chapter-title','chapter-body','film-kicker','film-title','film-body','context','counts','spread','spread-value','opacity','opacity-value','labels','flow','mode-status','idle','tour','fluid-filters','isolate','tab-settings','tab-parts'];
  for(const id of elements)cached.set(id,$(app,'#'+id));
  const el=id=>cached.get(id);
  const txt=(id,t)=>{if(el(id).textContent!==t)el(id).textContent=t;};
  function render(s,film) {
    const v=VIEWS[s.view];
    if(tabKey!==s.tab){tabKey=s.tab;$(app,'.settings-page').hidden=s.tab!=='settings';$(app,'.parts-page').hidden=s.tab!=='parts';
      el('tab-settings').setAttribute('aria-pressed',s.tab==='settings');el('tab-parts').setAttribute('aria-pressed',s.tab==='parts');}
    app.classList.toggle('drawer-open',s.drawer);
    if(viewKey!==s.view){
      viewKey=s.view;for(const b of app.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed',b.dataset.view===s.view);
      txt('chapter-en',v.tag);txt('chapter-title',v.title);txt('chapter-body',v.body);txt('scene-tag',v.tag);
      txt('film-kicker',MODEL_ID+'   /   '+v.tag);txt('film-title',v.title);
      txt('film-body',({
        assembly:'固定端四个接管连接热、冷回路。',exploded:'螺栓退出，活动端滑开，板片逐层分离。',
        plate:'场垫接通两孔，孔环隔开另一回路。',
        flow:'热侧 S4 ↓ S3，冷侧 S2 ↑ S1。',section:'厚度方向 ×8。交叉波峰处净隙为零。'
      })[s.view]);
    }
    const ck=[s.view,s.partIndex].join('/');
    if(ctxKey!==ck){
      ctxKey=ck;el('context').innerHTML=contextHTML(s);
      const values=s.view==='section'?[['0–4','mm','中心区净隙'],['0.5','mm','板材厚度']]:
        (s.view==='plate'?[['0.5','mm','板材厚度'],['24','mm','波纹纵向节距']]:
        (s.view==='flow'?[[String((D.count-1)/2)+' + '+String((D.count-1)/2),'','热道 + 冷道'],['2.0','mm','名义净隙']]:[[String(D.count),'张','换热板片'],[String(D.count-1),'条','板间流道']]));
      el('counts').innerHTML=values.map(([a,b,c])=>'<div><strong>'+a+'</strong><small>'+b+'</small><span>'+c+'</span></div>').join('');
    }
    const selection=s.selected&&stage.assembly.byId.get(s.selected);
    txt('scene-kicker',s.isolate?'零件隔离':(selection?'已选零件':v.title));
    let caption=v.legend;
    if(s.view==='flow')caption='P'+seq(s.partIndex)+' — P'+seq(s.partIndex+2)+(s.e<.005?' · 压紧位置':' · 分层显示');
    if(s.view==='plate') caption='P'+seq(s.partIndex)+' / P'+seq(s.partIndex+1)+' · 相邻板片与密封垫';
    if(s.view==='section')caption='88 × 60 mm 取样　·　厚度方向 ×8';
    txt('scene-caption',selection?selection.label+'　·　'+selection.id:caption);
    for(const [id,val] of [['spread',s.e],['opacity',s.alpha]]){
      const num=Math.round(val*100);el(id).value=num;el(id).style.setProperty('--v',num+'%');txt(id+'-value',num+'%');
    }
    el('spread').disabled=s.view==='section'&&!s.isolate;
    el('labels').checked=s.labels;el('flow').checked=s.flow;el('fluid-filters').hidden=!s.flow;
    for(const b of app.querySelectorAll('[data-circuit]'))b.setAttribute('aria-pressed',s[b.dataset.circuit]);
    const tourEl=el('tour');
    if(tourEl.dataset.on!==String(s.tour)){tourEl.dataset.on=String(s.tour);tourEl.innerHTML=ico(s.tour?'pause':'play')+'<span>'+(s.tour?'暂停导览':'自动导览')+'</span>';}
    el('idle').setAttribute('aria-pressed',s.idle);txt('mode-status',s.tour?'自动导览中':(s.isolate?'零件隔离中':'交互视图'));
    if(s.tab==='parts'){
      fillTree();
      const key=[s.selected,s.isolate,s.revision].join('/');
      if(treeKey!==key){
        treeKey=key;el('isolate').disabled=!s.selected;el('isolate').textContent=s.isolate?'退出隔离':'仅显示选中件';
        for(const [id,d] of groups){
          const parts=stage.assembly.parts.filter(p=>p.group===id);
          const visible=parts.some(p=>!s.hidden.has(p.id));d.querySelector('.group-eye').innerHTML=ico(visible?'eye':'hide');
          for(const r of d.querySelectorAll('.part-row')) {
            const hidden=s.hidden.has(r.dataset.id);r.classList.toggle('muted',hidden);r.classList.toggle('selected',s.selected===r.dataset.id);
            const eye=r.querySelector('.part-eye');eye.innerHTML=ico(hidden?'hide':'eye');eye.setAttribute('aria-pressed',!hidden);
            if(r.dataset.id===s.selected&&scrollSelection!==s.selected){d.open=true;scrollSelection=s.selected;}
          }
        }
      }
    }
    const cursor=$(app,'.auto-cursor');
    cursor.hidden=film||!s.tour||!s.showCursor;
    if(!cursor.hidden){cursor.style.left=(s.view==='exploded'?48:60)+'%';cursor.style.top=s.view==='plate'?'39%':'62%';}
  }
  return {render};
}
