/*
 * Calculator interaction layer.
 * Render functions only reflect state; input handlers below are responsible
 * for editing, validation, clear behavior, and committing calculations.
 */
function renderPart(p,ri,pi){
  const selected=partEdit&&partEdit.rowIndex===ri&&partEdit.partIndex===pi;
  const ep=editedPart(ri,pi);
  if(ep.kind==='unit'){
    return `<button class="part ${selected?'selected':''}" data-row="${ri}" data-part="${pi}">${esc(trim(ep.value))}${esc(label[ep.unit])}</button>`;
  }
  const hh=selected?partEdit.hours:String(ep.hours);
  const mm=selected?partEdit.minutes:String(ep.minutes).padStart(2,'0');
  const hasSeconds=selected?partEdit.hasSeconds:(ep.seconds!==null&&ep.seconds!==undefined);
  const ss=selected?partEdit.seconds:(ep.seconds!==null&&ep.seconds!==undefined?String(ep.seconds).padStart(2,'0'):'');
  return `<button class="part ${selected?'selected':''}" data-row="${ri}" data-part="${pi}">
    <span data-field="hour">${esc(hh||'_')}</span><span class="colon">:</span>
    <span data-field="minute">${esc(mm||'__')}</span>
    ${hasSeconds?`<span class="colon">:</span><span data-field="second">${esc(ss||'__')}</span>`:''}
  </button>`;
}
function renderCurrentLine(){
  let value=currentParts.map(p=>`<span class="part">${esc(partText(p))}</span>`).join('');
  if(colonMode){
    const mm=colonMinutes.length===0?'__':colonMinutes.length===1?colonMinutes+'_':colonMinutes;
    value+=`<span class="part selected">${esc(colonHours||'0')}<span class="colon">:</span>
      <span class="${colonMinutes.length<2?'placeholder':''}">${esc(mm)}</span>
      ${colonStage==='second'?`<span class="colon">:</span><span class="${colonSeconds.length<2?'placeholder':''}">${esc(colonSeconds.length===0?'__':colonSeconds.length===1?colonSeconds+'_':colonSeconds)}</span>`:''}
    </span>`;
  }else if(numberBuffer)value+=`<span class="raw">${esc(numberBuffer)}</span>`;
  if(!value)value='<span class="placeholder">输入下一时间</span>';
  return `<div class="expr-line current-row">
    <button class="line-op ${rows.length?'':'empty'}">${rows.length?(currentOp==='-'?'−':'+'):''}</button>
    <div class="line-value">${value}<span class="cursor"></span></div>
    <button class="line-menu">·</button>
  </div>`;
}
function renderExpression(){
  const out=[];
  rows.forEach((row,ri)=>{
    const selected=selectedRow===ri;
    const op=row.op===null?'':(row.op==='-'?'−':'+');
    out.push(`<div class="expr-line ${selected?'selected':''}" data-line="${ri}">
      <button class="line-op ${ri===0?'empty':''}" data-line-op="${ri}">${ri===0?'':op}</button>
      <div class="line-value">${row.parts.map((p,pi)=>renderPart(p,ri,pi)).join('')}</div>
      <button class="line-menu ${selected?'active':''}" data-line-menu="${ri}">⋯</button>
    </div>`);
  });
  const showCurrent=!justEvaluated&&(!rows.length||currentParts.length||numberBuffer||colonMode||currentOp!==null);
  expressionEl.innerHTML=out.join('');
  // Keep committed rows scrollable while pinning the editable current line
  // below them. This gives the process area room to grow without allowing it
  // to consume the result area.
  exprScroll.classList.toggle('empty', rows.length===0);
  currentInputEl.hidden=!showCurrent;
  currentInputEl.classList.toggle('with-divider', showCurrent&&rows.length>0);
  currentInputEl.innerHTML=showCurrent?renderCurrentLine():'';
  requestAnimationFrame(()=>{exprScroll.scrollTop=exprScroll.scrollHeight});
}

function updateBadge(){
  if(partEdit){badge.textContent=partEdit.kind==='unit'?`编辑片段 · ${partEdit.buffer}${label[partEdit.unit]}`:'编辑冒号片段';badge.className='badge edit';return}
  if(selectedRow!==null){badge.textContent=`已选择第 ${selectedRow+1} 行`;badge.className='badge edit';return}
  if(colonMode){badge.textContent=colonStage==='minute'?'冒号输入 · 分钟 00～59':'冒号输入 · 秒 00～59';badge.className='badge colon';return}
  if(numberBuffer){badge.textContent=`已输入 ${numberBuffer}，请选择单位`;badge.className='badge wait';return}
  if(rows.length&&currentOp!==null){badge.textContent=`${currentOp==='-'?'减':'加'} · 等待下一时间`;badge.className='badge';return}
  badge.textContent='输入数字后选择单位';badge.className='badge';
}
function renderRowActions(){
  if(selectedRow===null){rowActions.classList.remove('show','without-toggle');return}
  rowActions.classList.add('show');
  // Keep the grid aware that the base row intentionally has no +/- control.
  rowActions.classList.toggle('without-toggle', selectedRow===0);
  rowActionLabel.textContent=selectedRow===0?'第 1 行（基准行）':`第 ${selectedRow+1} 行`;
  toggleOpBtn.style.display=selectedRow===0?'none':'inline-flex';
}
function renderNormalized(){
  const raw=currentRawText(),cp=currentValueParts();
  if(raw&&cp.length){
    const ms=partsMs(cp);
    if(ms===null){normalizedEl.innerHTML='<strong>当前输入无法精确到 1 毫秒</strong>';return}
    const norm=durationText(ms);
    normalizedEl.innerHTML=norm!==raw?`当前输入规范化：<strong>${esc(norm)}</strong>`:'';
  }else normalizedEl.innerHTML='';
}
function render(){
  updateBadge();renderExpression();renderRowActions();renderNormalized();
  const r=evaluateRows(true);
  if(r.ok){
    lastResultMs=r.value;
    resultEl.textContent=formatResult(r.value);
    secondaryEl.textContent=hms(r.value);
    if(errorEl.textContent==='当前时长无法精确到 1 毫秒')setError('');
  }else{
    resultEl.textContent='—';secondaryEl.textContent='无法精确表示';setError(r.error);
  }
  document.querySelectorAll('.key.unit').forEach(b=>b.classList.toggle('disabled',colonMode));
}

function clearInput(){currentParts=[];numberBuffer='';colonMode=false;colonHours='';colonMinutes='';colonSeconds='';colonStage='minute'}
// Clear only the calculator expression. The date-anchor wrapper intentionally
// keeps the selected start date, because date context is separate from input.
function clearAll(show=true){
  rows=[];currentOp=null;selectedRow=null;partEdit=null;clearInput();
  formatIndex=0;lastResultMs=0n;justEvaluated=false;setError('');render();
  if(show)notify('已清空');
}

function beginPartEdit(ri,pi,field=null){
  if(numberBuffer||colonMode||currentParts.length){notify('先完成当前正在输入的内容');return}
  selectedRow=ri;
  const p=rows[ri].parts[pi];
  if(p.kind==='unit'){
    partEdit={rowIndex:ri,partIndex:pi,kind:'unit',unit:p.unit,buffer:trim(p.value),fresh:true};
  }else{
    partEdit={rowIndex:ri,partIndex:pi,kind:'colon',hours:String(p.hours),minutes:String(p.minutes).padStart(2,'0'),
      seconds:p.seconds!==null&&p.seconds!==undefined?String(p.seconds).padStart(2,'0'):'',
      hasSeconds:p.seconds!==null&&p.seconds!==undefined,field:field||'minute',fresh:true};
  }
  setError('');render();
}
function commitPartEdit(){
  if(!partEdit)return true;
  const p=partEdit;
  if(p.kind==='unit'){
    if(p.buffer===''||p.buffer==='.'||p.buffer==='-.'){notify('请输入有效数字');return false}
    const parsed=DurationPrecision.parseDecimalToMs(p.buffer,p.unit);
    if(!parsed.ok){notify(parsed.error);setError(parsed.error);return false}
    rows[p.rowIndex].parts[p.partIndex]={kind:'unit',unit:p.unit,value:parsed.normalized};
  }else{
    if(!/^\d+$/.test(p.hours)){notify('小时需要是整数');return false}
    if(p.hours.length>MAX_INPUT_DIGITS){notify(`小时最多支持 ${MAX_INPUT_DIGITS} 位`);return false}
    if(!/^\d{2}$/.test(p.minutes)||Number(p.minutes)>59){notify('分钟必须是 00～59');return false}
    if(p.hasSeconds&&(!/^\d{2}$/.test(p.seconds)||Number(p.seconds)>59)){notify('秒必须是 00～59');return false}
    rows[p.rowIndex].parts[p.partIndex]={kind:'colon',hours:normalizeIntegerText(p.hours),minutes:String(Number(p.minutes)).padStart(2,'0'),seconds:p.hasSeconds?String(Number(p.seconds)).padStart(2,'0'):null};
  }
  partEdit=null;setError('');render();return true;
}

function rawDigitCount(value){return String(value).replace(/\D/g,'').length}
function appendToNumberBuffer(d){
  if(d==='.'){
    if(numberBuffer===''){notify('小数请从 0. 开始输入');return}
    if(numberBuffer.includes('.'))return;
    numberBuffer+='.';return;
  }
  if(rawDigitCount(numberBuffer)+rawDigitCount(d)>MAX_INPUT_DIGITS){notify(`数字最多支持 ${MAX_INPUT_DIGITS} 位`);return}
  if(numberBuffer==='0'&&d!=='00')numberBuffer=d;
  else if(numberBuffer==='0'&&d==='00')return;
  else numberBuffer+=d;
}

function inputDigit(d){
  if(justEvaluated){clearAll(false);justEvaluated=false}
  setError('');

  if(partEdit){
    if(partEdit.kind==='unit'){
      if(d==='.'&&partEdit.buffer.includes('.'))return;
      if(d!=='.'&&rawDigitCount(partEdit.buffer)+rawDigitCount(d)>MAX_INPUT_DIGITS){notify(`数字最多支持 ${MAX_INPUT_DIGITS} 位`);return}
      if(partEdit.fresh){partEdit.buffer=d==='.'?'0.':d;partEdit.fresh=false}
      else partEdit.buffer+=d;
      render();return;
    }
    if(d==='.')return;
    const f=partEdit.field;
    let v=f==='hour'?partEdit.hours:f==='minute'?partEdit.minutes:partEdit.seconds;
    if(partEdit.fresh){v='';partEdit.fresh=false}
    for(const ch of d.split('')){
      if(f==='hour'){
        if(v.length>=MAX_INPUT_DIGITS){notify(`小时最多支持 ${MAX_INPUT_DIGITS} 位`);break}
        v+=ch;
      }else{
        if(v.length>=2){notify(f==='minute'?'分钟已两位':'秒已两位');break}
        if(v.length===0&&Number(ch)>5){notify(`${f==='minute'?'分钟':'秒'}范围是 00～59`);break}
        v+=ch;
      }
    }
    if(f==='hour')partEdit.hours=v;else if(f==='minute')partEdit.minutes=v;else partEdit.seconds=v;
    render();return;
  }

  if(colonMode){
    if(d==='.')return;
    let v=colonStage==='minute'?colonMinutes:colonSeconds;
    const word=colonStage==='minute'?'分钟':'秒';
    for(const ch of d.split('')){
      if(v.length>=2){notify(`${word}已经输入完成`);break}
      if(v.length===0&&Number(ch)>5){notify(`${word}范围是 00～59`);setError(`${word}十位只能是 0～5`);break}
      v+=ch;
    }
    if(colonStage==='minute')colonMinutes=v;else colonSeconds=v;
    render();return;
  }

  appendToNumberBuffer(d);render();
}

function commitUnit(unit){
  if(colonMode){notify('先完成当前冒号输入');return}
  if(partEdit){
    if(partEdit.kind!=='unit'){notify('先完成当前冒号片段编辑');return}
    partEdit.unit=unit;commitPartEdit();return;
  }
  if(!numberBuffer){notify(`先输入数字，再点“${shortLabel[unit]}”`);return}
  if(numberBuffer.endsWith('.'))numberBuffer=numberBuffer.slice(0,-1);
  const parsed=DurationPrecision.parseDecimalToMs(numberBuffer,unit);
  if(!parsed.ok){notify(parsed.error);setError(parsed.error);return}
  currentParts.push({kind:'unit',unit,value:parsed.normalized});
  numberBuffer='';setError('');render();
}

function pressColon(){
  setError('');
  if(partEdit){
    if(partEdit.kind==='unit'){notify('当前正在编辑单位片段');return}
    if(partEdit.field==='hour'){partEdit.field='minute';partEdit.fresh=true;render();return}
    if(partEdit.field==='minute'){partEdit.hasSeconds=true;partEdit.field='second';partEdit.fresh=true;render();return}
    notify('当前已在编辑秒');return;
  }
  if(!colonMode){
    if(!numberBuffer){notify('先输入小时，例如 47 : 12');return}
    if(numberBuffer.includes('.')){notify('冒号小时位不使用小数');return}
    if(rawDigitCount(numberBuffer)>MAX_INPUT_DIGITS){notify(`小时最多支持 ${MAX_INPUT_DIGITS} 位`);return}
    colonHours=normalizeIntegerText(numberBuffer);numberBuffer='';
    colonMinutes='';colonSeconds='';colonStage='minute';colonMode=true;
    setError('请输入两位分钟：00～59');render();return;
  }
  if(colonStage==='minute'){
    if(colonMinutes.length!==2){notify('请先完成两位分钟');return}
    colonStage='second';setError('请输入两位秒：00～59');render();return;
  }
  notify('最多支持 时:分:秒');
}
function finishColon(){
  if(!colonMode)return true;
  if(!colonComplete()){
    notify('请完成冒号格式');setError(colonStage==='minute'?'分钟必须两位':'秒必须两位');return false;
  }
  currentParts.push(colonPart());
  colonMode=false;colonHours='';colonMinutes='';colonSeconds='';colonStage='minute';setError('');
  return true;
}
function currentComplete(){
  if(numberBuffer){notify('这个数字还没有单位');setError('请选择 天 / 时 / 分 / 秒，或使用冒号');return false}
  if(colonMode&&!finishColon())return false;
  return currentParts.length>0;
}

function inputOperator(op){
  setError('');
  if(partEdit&&!commitPartEdit())return;

  if(justEvaluated){
    rows=[{op:null,parts:msToNormalizedParts(lastResultMs)}];
    clearInput();currentOp=op;selectedRow=null;partEdit=null;justEvaluated=false;render();return;
  }

  if(!currentParts.length&&!numberBuffer&&!colonMode){
    if(!rows.length){notify('先输入一个时间');return}
    currentOp=op;render();return;
  }

  if(!currentComplete())return;
  if(partsMs(currentParts)===null){notify('当前时长无法精确到 1 毫秒');return}
  rows.push({op:rows.length?currentOp:null,parts:clone(currentParts)});
  clearInput();currentOp=op;selectedRow=null;render();
}

function equals(){
  setError('');
  if(partEdit&&!commitPartEdit())return;

  if(numberBuffer){notify('请先选择单位');setError('裸数字不能直接结算');return}
  if(colonMode&&!finishColon())return;

  if(currentParts.length){
    if(partsMs(currentParts)===null){notify('当前时长无法精确到 1 毫秒');return}
    rows.push({op:rows.length?currentOp:null,parts:clone(currentParts)});
    clearInput();currentOp=null;
  }else if(rows.length&&currentOp!==null&&!justEvaluated){
    notify('请先输入下一时间');setError('当前运算符后还缺少一个时间值');return;
  }

  if(!rows.length){notify('还没有可计算的时间');return}
  const r=evaluateRows(false);
  if(!r.ok){setError(r.error);notify(r.error);return}
  lastResultMs=r.value;justEvaluated=true;selectedRow=null;partEdit=null;currentOp=null;
  saveHistoryRecord(r.value);render();normalizedEl.innerHTML='';
}

function backspace(){
  setError('');
  if(justEvaluated){clearAll(false);return}

  if(partEdit){
    if(partEdit.kind==='unit'){
      if(partEdit.fresh){partEdit.fresh=false;partEdit.buffer=''}
      else partEdit.buffer=partEdit.buffer.slice(0,-1);
    }else{
      const f=partEdit.field;
      if(f==='hour')partEdit.hours=partEdit.hours.slice(0,-1);
      else if(f==='minute')partEdit.minutes=partEdit.minutes.slice(0,-1);
      else partEdit.seconds=partEdit.seconds.slice(0,-1);
      partEdit.fresh=false;
    }
    render();return;
  }

  if(colonMode){
    if(colonStage==='second'){
      if(colonSeconds)colonSeconds=colonSeconds.slice(0,-1);
      else colonStage='minute';
    }else if(colonMinutes)colonMinutes=colonMinutes.slice(0,-1);
    else{numberBuffer=colonHours;colonHours='';colonMode=false}
  }else if(numberBuffer){
    numberBuffer=numberBuffer.slice(0,-1);
  }else if(currentParts.length){
    const last=currentParts.pop();
    if(last.kind==='unit')numberBuffer=trim(last.value);
    else numberBuffer=String(last.hours);
  }else if(rows.length&&currentOp!==null){
    currentOp=null;
  }else if(rows.length){
    const last=rows.pop();currentOp=last.op;currentParts=clone(last.parts);if(!rows.length)currentOp=null;
  }
  render();
}

function selectRow(ri){
  if(numberBuffer||colonMode||currentParts.length){notify('先完成当前正在输入的内容');return}
  if(partEdit&&!commitPartEdit())return;
  selectedRow=selectedRow===ri?null:ri;render();
}
function toggleSelectedOp(){
  if(selectedRow===null||selectedRow===0)return;
  rows[selectedRow].op=rows[selectedRow].op==='-'?'+':'-';render();notify(`已改为 ${rows[selectedRow].op==='-'?'减':'加'}`);
}
function deleteSelectedRow(){
  if(selectedRow===null)return;
  rows.splice(selectedRow,1);if(rows.length)rows[0].op=null;selectedRow=null;partEdit=null;render();notify('已删除这一行');
}
