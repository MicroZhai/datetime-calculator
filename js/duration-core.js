/*
 * Shared Web runtime state and pure-ish calculation helpers.
 * Exact values stay as BigInt milliseconds internally; formatting belongs to
 * the UI layer and must never change the stored result.
 */
const expressionEl=document.getElementById('expression');
const exprScroll=document.getElementById('exprScroll');
const currentInputEl=document.getElementById('currentInput');
const badge=document.getElementById('badge');
const resultEl=document.getElementById('result');
const secondaryEl=document.getElementById('secondary');
const rowActions=document.getElementById('rowActions');
const rowActionLabel=document.getElementById('rowActionLabel');
const toggleOpBtn=document.getElementById('toggleOpBtn');
const historyMask=document.getElementById('historyMask');
const historyList=document.getElementById('historyList');
const HISTORY_KEY='time-calculator-v12-history';
const HISTORY_LIMIT=HistoryStore.DEFAULT_LIMIT;
const factorMs=DurationPrecision.FACTOR_MS;
const label={d:'天',h:'小时',m:'分',s:'秒'};
const shortLabel={d:'天',h:'时',m:'分',s:'秒'};
const MAX_INPUT_DIGITS=DurationPrecision.MAX_INPUT_DIGITS;

let rows=[];
let currentOp=null;
let currentParts=[];
let numberBuffer='';

let colonMode=false;
let colonHours='';
let colonMinutes='';
let colonSeconds='';
let colonStage='minute';

let resultUnit='d';
let resultRadix=60;
let lastResultMs=0n;
let justEvaluated=false;
let selectedRow=null;
let partEdit=null;
let historyContextProvider=()=>({});
let historyRecords=loadHistory();

function loadHistory(){
  try{return HistoryStore.parse(localStorage.getItem(HISTORY_KEY),HISTORY_LIMIT)}
  catch(_){return []}
}
function persistHistory(){
  try{localStorage.setItem(HISTORY_KEY,HistoryStore.serialize(historyRecords,HISTORY_LIMIT))}
  catch(_){}
}
function rowsSignature(rs){return HistoryStore.rowsSignature(rs)}
function saveHistoryRecord(resultMs){
  if(!rows.length)return;
  const snapshot=clone(rows);
  const context=historyContextProvider?.()||{};
  const record=HistoryStore.createRecord({
    id:`h_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    createdAt:Date.now(),
    rows:snapshot,
    resultMs,
    anchorDateTime:context.anchorDateTime||null
  });
  if(!record)return;
  historyRecords=HistoryStore.upsert(historyRecords,record,HISTORY_LIMIT);
  persistHistory();
}
function formatHistoryTime(ts){
  const d=new Date(ts);
  const now=new Date();
  const sameDay=d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();
  const hm=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return sameDay?`今天 ${hm}`:`${d.getMonth()+1}/${d.getDate()} ${hm}`;
}
function renderHistory(){
  if(!historyRecords.length){
    historyList.innerHTML='<div class="history-empty">还没有历史记录<br>完成一次计算并按 = 后会自动保存完整表达式</div>';
    return;
  }
  historyList.innerHTML=historyRecords.map((record,index)=>{
    const rowHtml=record.rows.map((row,ri)=>`
      <div class="history-row">
        <span class="history-row-op">${ri===0?'':row.op==='-'?'−':'+'}</span>
        <span class="history-row-value">${esc(partsText(row.parts))}</span>
      </div>`).join('');

    return `<article class="history-item" data-history-index="${index}">
      <div class="history-top">
        <span class="history-time">${esc(formatHistoryTime(record.createdAt))}</span>
        <span class="history-restore">点击恢复</span>
      </div>
      <div class="history-calc">
        <div class="history-expr">${rowHtml}</div>
        <div class="history-rule"></div>
        <div class="history-result-line">
          <span class="history-equal">=</span>
          <span class="history-result">${esc(durationText(record.resultMs))}</span>
        </div>
      </div>
      <div class="history-actions">
        <button class="history-delete" data-history-delete="${index}">删除</button>
      </div>
    </article>`;
  }).join('');
}
function openHistory(){renderHistory();historyMask.classList.add('show')}
function closeHistory(){historyMask.classList.remove('show')}
function restoreHistory(index){
  const record=HistoryStore.normalizeRecord(historyRecords[index]);
  if(!record)return;
  rows=clone(record.rows);
  currentOp=null;selectedRow=null;partEdit=null;clearInput();justEvaluated=false;setError('');
  const stored=DurationPrecision.toBigIntMs(record.resultMs);lastResultMs=stored??0n;
  closeHistory();render();
}
function deleteHistory(index){
  const change=HistoryStore.removeAt(historyRecords,index,HISTORY_LIMIT);
  historyRecords=change.records;persistHistory();renderHistory();
}
function clearHistory(){if(!historyRecords.length)return;historyRecords=[];persistHistory();renderHistory()}

function setError(){}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function trim(value){return DurationPrecision.normalizeDecimalString(value)??String(value)}
function clone(v){return JSON.parse(JSON.stringify(v))}
function valueToMs(value,unit){
  const parsed=DurationPrecision.parseDecimalToMs(value,unit);
  return parsed.ok?parsed.value:null;
}
function valuePrecisionError(value,unit){
  const parsed=DurationPrecision.parseDecimalToMs(value,unit);
  return parsed.ok?'':parsed.error;
}

function partMs(p){
  const parsed=DurationPrecision.partToMs(p);
  return parsed.ok?parsed.value:null;
}
function partText(p){
  if(p.kind==='unit')return `${trim(p.value)}${label[p.unit]}`;
  const mm=String(p.minutes).padStart(2,'0');
  if(p.seconds!==null&&p.seconds!==undefined)return `${p.hours}:${mm}:${String(p.seconds).padStart(2,'0')}`;
  return `${p.hours}:${mm}`;
}
function partsMs(parts){
  const parsed=DurationPrecision.partsToMs(parts);
  return parsed.ok?parsed.value:null;
}
function partsText(parts){return parts.map(partText).join('')}
function durationText(totalMs){return DurationPrecision.durationText(totalMs)}
function hms(totalMs){return DurationPrecision.hms(totalMs)}
// 60进制·秒：总秒数
function secondsText(totalMs){
  let v=DurationPrecision.toBigIntMs(totalMs);
  if(v===null)return '-';
  const sign=v<0n?'-':'';
  if(v<0n)v=-v;
  const s=v/1000n;
  const ms=v%1000n;
  return `${sign}${s}${ms?`.${ms.toString().padStart(3,'0')}`:''}秒`;
}
const UNIT_LABEL={d:'天',h:'小时',m:'分',s:'秒'};
// 把时长按所选单位向下 60 进制展开（省略零值）：
// 60进制小字按单位展示，10进制大分母分数的括号内也用它作为细分。
function subdivideByUnit(totalMs,unit){
  let v=DurationPrecision.toBigIntMs(totalMs);
  if(v===null)return '';
  const sign=v<0n?'-':'';
  if(v<0n)v=-v;
  const cfg={
    d:[['d','天'],['h','小时'],['m','分'],['s','秒']],
    h:[['h','小时'],['m','分'],['s','秒']],
    m:[['m','分'],['s','秒']]
  }[unit];
  if(!cfg)return '';
  const out=[];
  cfg.forEach(([key,text])=>{
    const f=factorMs[key];
    const q=v/f;v%=f;
    if(q!==0n)out.push(`${q}${text}`);
  });
  if(v>0n)out.push(`${v}毫秒`);
  if(!out.length)out.push('0'+cfg[cfg.length-1][1]);
  return sign+out.join(' ');
}
// 底部小字：随 resultUnit/resultRadix 显示所选单位的换算。
// 60进制按所选单位向下展开（带单位文本）；10进制为小数。
function secondaryText(totalMs){
  if(resultRadix===60){
    if(resultUnit==='d')return hms(totalMs);
    if(resultUnit==='h')return subdivideByUnit(totalMs,'h');
    if(resultUnit==='m')return subdivideByUnit(totalMs,'m');
    return secondsText(totalMs);
  }
  const divisor=factorMs[resultUnit];
  const unitLabel=UNIT_LABEL[resultUnit];
  return `${DurationPrecision.roundedRatioText(totalMs,divisor,6)}${unitLabel}`;
}
// justEvaluated 后按单位键切换结果格式。
// 同一单位再按一次切换 60/10 进制；秒单位不切换进制。
function switchResultFormat(unit){
  if(unit===resultUnit){
    if(unit!=='s')resultRadix=resultRadix===60?10:60;
  }else{
    resultUnit=unit;
    resultRadix=60;
  }
}
function msToNormalizedParts(totalMs){return DurationPrecision.millisecondsToParts(totalMs)}

function editedPart(rowIndex,partIndex){
  const original=rows[rowIndex].parts[partIndex];
  if(!partEdit||partEdit.rowIndex!==rowIndex||partEdit.partIndex!==partIndex)return original;
  if(partEdit.kind==='unit')return {kind:'unit',unit:partEdit.unit,value:DurationPrecision.normalizeDecimalString(partEdit.buffer||'0')||'0'};
  return {kind:'colon',hours:partEdit.hours||'0',minutes:partEdit.minutes||'0',seconds:partEdit.hasSeconds?(partEdit.seconds||'0'):null};
}
function effectiveRows(){return rows.map((row,ri)=>({op:row.op,parts:row.parts.map((_,pi)=>editedPart(ri,pi))}))}
function evaluateRows(includeCurrent=true){
  const rs=effectiveRows().map(clone);
  if(includeCurrent){
    const cp=currentValueParts();
    if(cp.length)rs.push({op:rs.length?currentOp:null,parts:cp});
  }
  return DurationPrecision.evaluateRows(rs);
}

function colonComplete(){
  if(!colonMode||colonHours==='')return false;
  if(colonMinutes.length!==2)return false;
  if(colonStage==='second'&&colonSeconds.length!==2)return false;
  return true;
}
function normalizeIntegerText(value){return String(value||'0').replace(/^0+(?=\d)/,'')||'0'}
function colonPart(){
  return {kind:'colon',hours:normalizeIntegerText(colonHours),minutes:String(Number(colonMinutes)).padStart(2,'0'),seconds:colonStage==='second'?String(Number(colonSeconds)).padStart(2,'0'):null};
}
function currentValueParts(){
  const p=clone(currentParts);
  if(colonMode&&colonComplete())p.push(colonPart());
  return numberBuffer?[]:p;
}
function currentRawText(){
  let txt=partsText(currentParts);
  if(colonMode&&colonComplete())txt+=partText(colonPart());
  return txt;
}
