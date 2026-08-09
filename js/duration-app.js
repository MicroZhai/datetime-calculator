const undoBar=document.getElementById('undoBar');
const undoMessage=document.getElementById('undoMessage');
const undoButton=document.getElementById('undoButton');
let pendingUndo=null;
let undoTimer=null;
let historyFocusReturn=null;

function syncA11yState(){
  document.querySelectorAll('.format-option').forEach((button,index)=>{
    button.setAttribute('aria-checked',String(index===formatIndex));
  });
  document.querySelectorAll('.key.unit').forEach(button=>{
    button.disabled=colonMode;
    button.setAttribute('aria-disabled',String(colonMode));
  });
}

function syncHistoryA11y(){
  historyList.querySelectorAll('[data-history-index]').forEach(item=>{
    item.tabIndex=0;
    const time=item.querySelector('.history-time')?.textContent?.trim()||'历史记录';
    const result=item.querySelector('.history-result')?.textContent?.trim()||'';
    item.setAttribute('aria-label',`${time}${result?`，结果 ${result}`:''}，按回车恢复`);
  });
}

const baseRender=render;
render=function(){
  baseRender();
  syncA11yState();
};

const baseRenderHistory=renderHistory;
renderHistory=function(){
  baseRenderHistory();
  syncHistoryA11y();
};

function hideUndo(){
  pendingUndo=null;
  clearTimeout(undoTimer);
  undoTimer=null;
  undoBar.classList.remove('show');
}

function showUndo(message,restore){
  clearTimeout(undoTimer);
  pendingUndo=restore;
  undoMessage.textContent=message;
  undoBar.classList.add('show');
  undoTimer=setTimeout(hideUndo,6000);
}

function runUndo(){
  if(!pendingUndo)return;
  const restore=pendingUndo;
  hideUndo();
  restore();
}

function snapshotCalculator(){
  return {
    rows:clone(rows),
    currentOp,
    currentParts:clone(currentParts),
    numberBuffer,
    colonMode,
    colonHours,
    colonMinutes,
    colonSeconds,
    colonStage,
    formatIndex,
    lastResultMs,
    justEvaluated,
    selectedRow,
    partEdit:clone(partEdit),
    error:errorEl.textContent
  };
}

function restoreCalculator(snapshot){
  rows=clone(snapshot.rows);
  currentOp=snapshot.currentOp;
  currentParts=clone(snapshot.currentParts);
  numberBuffer=snapshot.numberBuffer;
  colonMode=snapshot.colonMode;
  colonHours=snapshot.colonHours;
  colonMinutes=snapshot.colonMinutes;
  colonSeconds=snapshot.colonSeconds;
  colonStage=snapshot.colonStage;
  formatIndex=snapshot.formatIndex;
  lastResultMs=snapshot.lastResultMs;
  justEvaluated=snapshot.justEvaluated;
  selectedRow=snapshot.selectedRow;
  partEdit=clone(snapshot.partEdit);
  setError(snapshot.error||'');
  render();
}

function hasCalculatorContent(){
  return rows.length>0||currentParts.length>0||numberBuffer!==''||colonMode||currentOp!==null||justEvaluated||selectedRow!==null||partEdit!==null;
}

function clearCalculatorWithUndo(){
  if(!hasCalculatorContent())return;
  const snapshot=snapshotCalculator();
  clearAll(false);
  showUndo('已清空计算内容',()=>restoreCalculator(snapshot));
}

function toggleSelectedOpQuiet(){
  if(selectedRow===null||selectedRow===0)return;
  rows[selectedRow].op=rows[selectedRow].op==='-'?'+':'-';
  render();
}

function deleteSelectedRowWithUndo(){
  if(selectedRow===null)return;
  const snapshot=snapshotCalculator();
  const deletedIndex=selectedRow;
  rows.splice(selectedRow,1);
  if(rows.length)rows[0].op=null;
  selectedRow=null;
  partEdit=null;
  render();
  showUndo('已删除这一行',()=>{
    restoreCalculator(snapshot);
    selectedRow=Math.min(deletedIndex,Math.max(0,rows.length-1));
    render();
  });
}

function deleteHistoryWithUndo(index){
  const record=historyRecords[index];
  if(!record)return;
  const snapshot=clone(record);
  historyRecords.splice(index,1);
  persistHistory();
  renderHistory();
  showUndo('已删除历史记录',()=>{
    historyRecords.splice(Math.min(index,historyRecords.length),0,snapshot);
    if(historyRecords.length>HISTORY_LIMIT)historyRecords.length=HISTORY_LIMIT;
    persistHistory();
    renderHistory();
  });
  requestAnimationFrame(()=>{
    const nextIndex=Math.min(index,historyRecords.length-1);
    const next=nextIndex>=0?historyList.querySelector(`[data-history-index="${nextIndex}"]`):null;
    (next||closeHistoryBtn).focus({preventScroll:true});
  });
}

function clearHistoryWithUndo(){
  if(!historyRecords.length)return;
  const snapshot=clone(historyRecords);
  historyRecords=[];
  persistHistory();
  renderHistory();
  showUndo('已清空历史记录',()=>{
    historyRecords=clone(snapshot).slice(0,HISTORY_LIMIT);
    persistHistory();
    renderHistory();
  });
  requestAnimationFrame(()=>closeHistoryBtn.focus({preventScroll:true}));
}

function openHistoryAccessible(){
  historyFocusReturn=document.activeElement instanceof HTMLElement?document.activeElement:null;
  openHistory();
  requestAnimationFrame(()=>closeHistoryBtn.focus({preventScroll:true}));
}

function closeHistoryAccessible(){
  closeHistory();
  const target=historyFocusReturn;
  historyFocusReturn=null;
  requestAnimationFrame(()=>target?.focus?.({preventScroll:true}));
}

function focusableHistoryElements(){
  return [...historyMask.querySelectorAll('button:not(:disabled),[tabindex="0"]')]
    .filter(el=>el.getClientRects().length>0);
}

expressionEl.addEventListener('click',(e)=>{
  const opBtn=e.target.closest('[data-line-op]');
  if(opBtn){
    const ri=Number(opBtn.dataset.lineOp);
    if(ri>0){rows[ri].op=rows[ri].op==='-'?'+':'-';selectedRow=ri;render()}
    return;
  }
  const part=e.target.closest('.part[data-row]');
  if(part){
    const ri=Number(part.dataset.row),pi=Number(part.dataset.part);
    const field=e.target.closest('[data-field]')?.dataset.field||null;
    beginPartEdit(ri,pi,field);return;
  }
  const menu=e.target.closest('[data-line-menu]');
  if(menu){selectRow(Number(menu.dataset.lineMenu));return}
  const line=e.target.closest('[data-line]');
  if(line)selectRow(Number(line.dataset.line));
});

document.querySelectorAll('[data-digit]').forEach(button=>button.onclick=()=>inputDigit(button.dataset.digit));
document.querySelectorAll('[data-unit]').forEach(button=>button.onclick=()=>commitUnit(button.dataset.unit));
document.querySelectorAll('[data-op]').forEach(button=>button.onclick=()=>inputOperator(button.dataset.op));
document.querySelector('[data-action="colon"]').onclick=pressColon;
document.querySelector('[data-action="clear"]').onclick=clearCalculatorWithUndo;
document.querySelector('[data-action="back"]').onclick=backspace;
document.querySelector('[data-action="equals"]').onclick=equals;

document.querySelectorAll('.format-option').forEach((button,index)=>button.onclick=()=>{formatIndex=index;render()});
toggleOpBtn.onclick=toggleSelectedOpQuiet;
document.getElementById('deleteRowBtn').onclick=deleteSelectedRowWithUndo;
document.getElementById('doneRowBtn').onclick=()=>{if(partEdit)commitPartEdit();selectedRow=null;render()};
document.getElementById('historyBtn').onclick=openHistoryAccessible;

document.getElementById('closeHistoryBtn').onclick=closeHistoryAccessible;
document.getElementById('clearHistoryBtn').onclick=clearHistoryWithUndo;
undoButton.onclick=runUndo;

historyMask.addEventListener('click',(e)=>{
  if(e.target===historyMask)closeHistoryAccessible();
});

historyMask.addEventListener('keydown',(e)=>{
  if(e.key==='Escape'){
    e.preventDefault();
    closeHistoryAccessible();
    return;
  }
  if(e.key!=='Tab')return;
  const focusable=focusableHistoryElements();
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
});

historyList.addEventListener('click',(e)=>{
  const del=e.target.closest('[data-history-delete]');
  if(del){
    e.stopPropagation();
    deleteHistoryWithUndo(Number(del.dataset.historyDelete));
    return;
  }
  const item=e.target.closest('[data-history-index]');
  if(item){
    restoreHistory(Number(item.dataset.historyIndex));
    const target=historyFocusReturn;
    historyFocusReturn=null;
    requestAnimationFrame(()=>target?.focus?.({preventScroll:true}));
  }
});

historyList.addEventListener('keydown',(e)=>{
  if(e.target.closest('[data-history-delete]'))return;
  const item=e.target.closest('[data-history-index]');
  if(!item||!(e.key==='Enter'||e.key===' '))return;
  e.preventDefault();
  restoreHistory(Number(item.dataset.historyIndex));
  const target=historyFocusReturn;
  historyFocusReturn=null;
  requestAnimationFrame(()=>target?.focus?.({preventScroll:true}));
});

document.addEventListener('keydown',(e)=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&pendingUndo){
    e.preventDefault();
    runUndo();
    return;
  }

  if(historyMask.classList.contains('show'))return;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const target=e.target;
  if(target instanceof HTMLElement&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)))return;

  const key=e.key;
  let handled=true;
  if(/^\d$/.test(key))inputDigit(key);
  else if(key==='.')inputDigit('.');
  else if(key===':')pressColon();
  else if(key==='+')inputOperator('+');
  else if(key==='-')inputOperator('-');
  else if(key==='='||key==='Enter')equals();
  else if(key==='Backspace')backspace();
  else if(key.toLowerCase()==='d')commitUnit('d');
  else if(key.toLowerCase()==='h')commitUnit('h');
  else if(key.toLowerCase()==='m')commitUnit('m');
  else if(key.toLowerCase()==='s')commitUnit('s');
  else if(key==='Escape'&&(selectedRow!==null||partEdit!==null)){
    selectedRow=null;
    partEdit=null;
    setError('');
    render();
  }else handled=false;

  if(handled)e.preventDefault();
});

render();

// PWA 快捷入口：?action=history 直接打开历史。
const startupAction=new URLSearchParams(location.search).get('action');
if(startupAction==='history')openHistoryAccessible();

// 注册 Service Worker，保持原 GitHub Pages 地址可安装、可离线使用。
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}
