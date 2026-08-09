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

  document.querySelectorAll('[data-digit]').forEach(b=>b.onclick=()=>inputDigit(b.dataset.digit));
  document.querySelectorAll('[data-unit]').forEach(b=>b.onclick=()=>commitUnit(b.dataset.unit));
  document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>inputOperator(b.dataset.op));
  document.querySelector('[data-action="colon"]').onclick=pressColon;
  document.querySelector('[data-action="clear"]').onclick=()=>clearAll();
  document.querySelector('[data-action="back"]').onclick=backspace;
  document.querySelector('[data-action="equals"]').onclick=equals;

  document.querySelectorAll('.format-option').forEach((b,i)=>b.onclick=()=>{formatIndex=i;render()});
  toggleOpBtn.onclick=toggleSelectedOp;
  document.getElementById('deleteRowBtn').onclick=deleteSelectedRow;
  document.getElementById('doneRowBtn').onclick=()=>{if(partEdit)commitPartEdit();selectedRow=null;render()};
  document.getElementById('historyBtn').onclick=openHistory;

  document.getElementById('closeHistoryBtn').onclick=closeHistory;
  document.getElementById('clearHistoryBtn').onclick=clearHistory;
  historyMask.addEventListener('click',(e)=>{
    if(e.target===historyMask)closeHistory();
  });
  historyList.addEventListener('click',(e)=>{
    const del=e.target.closest('[data-history-delete]');
    if(del){
      e.stopPropagation();
      deleteHistory(Number(del.dataset.historyDelete));
      return;
    }
    const item=e.target.closest('[data-history-index]');
    if(item)restoreHistory(Number(item.dataset.historyIndex));
  });

  render();

  // PWA 快捷入口：?action=history 直接打开历史。
  const startupAction=new URLSearchParams(location.search).get('action');
  if(startupAction==='history')openHistory();

  // 注册 Service Worker，保持原 GitHub Pages 地址可安装、可离线使用。
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    });
  }
