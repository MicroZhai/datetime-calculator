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
function render(){
  updateBadge();renderExpression();renderRowActions();
  const r=evaluateRows(true);
  if(r.ok){
    lastResultMs=r.value;
    resultEl.textContent=durationText(r.value);
    secondaryEl.textContent=hms(r.value);
  }else{
    resultEl.textContent='—';secondaryEl.textContent='无法精确表示';
  }
  document.querySelectorAll('.key.unit').forEach(b=>b.classList.toggle('disabled',colonMode));
}

function clearInput(){currentParts=[];numberBuffer='';colonMode=false;colonHours='';colonMinutes='';colonSeconds='';colonStage='minute'}
// Clear only the calculator expression. The date-anchor wrapper intentionally
// keeps the selected start date, because date context is separate from input.
function clearAll(show=true){
  rows=[];currentOp=null;selectedRow=null;partEdit=null;clearInput();
  resultUnit='d';resultRadix=60;lastResultMs=0n;justEvaluated=false;setError('');render();
}

function beginPartEdit(ri,pi,field=null){
  if(numberBuffer||colonMode||currentParts.length){return}
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
    if(p.buffer===''||p.buffer==='.'||p.buffer==='-.'){return false}
    const parsed=DurationPrecision.parseDecimalToMs(p.buffer,p.unit);
    if(!parsed.ok){setError(parsed.error);return false}
    rows[p.rowIndex].parts[p.partIndex]={kind:'unit',unit:p.unit,value:parsed.normalized};
  }else{
    if(!/^\d+$/.test(p.hours)){return false}
    if(p.hours.length>MAX_INPUT_DIGITS){return false}
    if(!/^\d{2}$/.test(p.minutes)||Number(p.minutes)>59){return false}
    if(p.hasSeconds&&(!/^\d{2}$/.test(p.seconds)||Number(p.seconds)>59)){return false}
    rows[p.rowIndex].parts[p.partIndex]={kind:'colon',hours:normalizeIntegerText(p.hours),minutes:String(Number(p.minutes)).padStart(2,'0'),seconds:p.hasSeconds?String(Number(p.seconds)).padStart(2,'0'):null};
  }
  partEdit=null;setError('');render();return true;
}

function rawDigitCount(value){return String(value).replace(/\D/g,'').length}
function appendToNumberBuffer(d){
  if(d==='.'){
    if(numberBuffer===''){return}
    if(numberBuffer.includes('.'))return;
    numberBuffer+='.';return;
  }
  if(rawDigitCount(numberBuffer)+rawDigitCount(d)>MAX_INPUT_DIGITS){return}
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
      if(d!=='.'&&rawDigitCount(partEdit.buffer)+rawDigitCount(d)>MAX_INPUT_DIGITS){return}
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
        if(v.length>=MAX_INPUT_DIGITS){break}
        v+=ch;
      }else{
        if(v.length>=2){break}
        if(v.length===0&&Number(ch)>5){break}
        v+=ch;
      }
    }
    if(f==='hour')partEdit.hours=v;else if(f==='minute')partEdit.minutes=v;else partEdit.seconds=v;
    render();return;
  }

  if(colonMode){
    if(d==='.')return;
    let v=colonStage==='minute'?colonMinutes:colonSeconds;
    for(const ch of d.split('')){
      if(v.length>=2){break}
      if(v.length===0&&Number(ch)>5){break}
      v+=ch;
    }
    if(colonStage==='minute')colonMinutes=v;else colonSeconds=v;
    render();return;
  }

  appendToNumberBuffer(d);render();
}

function commitUnit(unit){
  if(colonMode){return}
  if(partEdit){
    if(partEdit.kind!=='unit'){return}
    partEdit.unit=unit;commitPartEdit();return;
  }
  // 计算完毕且无待输入数字：按单位键切换结果格式
  if(justEvaluated&&!numberBuffer){
    switchResultFormat(unit);render();return;
  }
  if(!numberBuffer){return}
  if(numberBuffer.endsWith('.'))numberBuffer=numberBuffer.slice(0,-1);
  const parsed=DurationPrecision.parseDecimalToMs(numberBuffer,unit);
  if(!parsed.ok){setError(parsed.error);return}
  currentParts.push({kind:'unit',unit,value:parsed.normalized});
  numberBuffer='';setError('');render();
}

function pressColon(){
  setError('');
  if(partEdit){
    if(partEdit.kind==='unit'){return}
    if(partEdit.field==='hour'){partEdit.field='minute';partEdit.fresh=true;render();return}
    if(partEdit.field==='minute'){partEdit.hasSeconds=true;partEdit.field='second';partEdit.fresh=true;render();return}
    return;
  }
  if(!colonMode){
    if(!numberBuffer){return}
    if(numberBuffer.includes('.')){return}
    if(rawDigitCount(numberBuffer)>MAX_INPUT_DIGITS){return}
    colonHours=normalizeIntegerText(numberBuffer);numberBuffer='';
    colonMinutes='';colonSeconds='';colonStage='minute';colonMode=true;
    render();return;
  }
  if(colonStage==='minute'){
    if(colonMinutes.length!==2){return}
    colonStage='second';render();return;
  }
}
function finishColon(){
  if(!colonMode)return true;
  if(!colonComplete()){
    setError(colonStage==='minute'?'分钟必须两位':'秒必须两位');return false;
  }
  currentParts.push(colonPart());
  colonMode=false;colonHours='';colonMinutes='';colonSeconds='';colonStage='minute';setError('');
  return true;
}
function currentComplete(){
  if(numberBuffer){return false}
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
    if(!rows.length){return}
    currentOp=op;render();return;
  }

  if(!currentComplete())return;
  if(partsMs(currentParts)===null){return}
  rows.push({op:rows.length?currentOp:null,parts:clone(currentParts)});
  clearInput();currentOp=op;selectedRow=null;render();
}

function equals(){
  setError('');
  if(partEdit&&!commitPartEdit())return;

  if(numberBuffer){return}
  if(colonMode&&!finishColon())return;

  if(currentParts.length){
    if(partsMs(currentParts)===null){return}
    rows.push({op:rows.length?currentOp:null,parts:clone(currentParts)});
    clearInput();currentOp=null;
  }else if(rows.length&&currentOp!==null&&!justEvaluated){
    return;
  }

  if(!rows.length){return}
  const r=evaluateRows(false);
  if(!r.ok){setError(r.error);return}
  lastResultMs=r.value;justEvaluated=true;selectedRow=null;partEdit=null;currentOp=null;
  saveHistoryRecord(r.value);render();
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
  if(numberBuffer||colonMode||currentParts.length){return}
  if(partEdit&&!commitPartEdit())return;
  selectedRow=selectedRow===ri?null:ri;render();
}
function toggleSelectedOp(){
  if(selectedRow===null||selectedRow===0)return;
  rows[selectedRow].op=rows[selectedRow].op==='-'?'+':'-';render();
}
function deleteSelectedRow(){
  if(selectedRow===null)return;
  rows.splice(selectedRow,1);if(rows.length)rows[0].op=null;selectedRow=null;partEdit=null;render();
}
