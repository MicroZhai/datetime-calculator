(() => {
  const FACTOR_MS = Object.freeze({
    d: 86400000n,
    h: 3600000n,
    m: 60000n,
    s: 1000n
  });
  const MAX_INPUT_DIGITS = 100;

  function toBigIntMs(value) {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
      return BigInt(value);
    }
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
      try { return BigInt(value.trim()); } catch (_) { return null; }
    }
    return null;
  }

  function normalizeDecimalString(value) {
    let raw = String(value ?? '').trim();
    if (!raw) return null;
    if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return null;
    let sign = '';
    if (raw.startsWith('-')) { sign = '-'; raw = raw.slice(1); }
    let [whole, fraction = ''] = raw.split('.');
    whole = whole.replace(/^0+(?=\d)/, '') || '0';
    fraction = fraction.replace(/0+$/, '');
    if (whole === '0' && !fraction) sign = '';
    return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
  }

  function digitCount(value) {
    const normalized = normalizeDecimalString(value);
    if (!normalized) return 0;
    return normalized.replace('-', '').replace('.', '').length;
  }

  function parseDecimalToMs(value, unit) {
    const factor = FACTOR_MS[unit];
    if (!factor) return { ok: false, error: '未知时间单位' };
    const normalized = normalizeDecimalString(value);
    if (!normalized) return { ok: false, error: '数字格式不正确' };
    if (digitCount(normalized) > MAX_INPUT_DIGITS) {
      return { ok: false, error: `数字最多支持 ${MAX_INPUT_DIGITS} 位` };
    }

    const negative = normalized.startsWith('-');
    const unsigned = negative ? normalized.slice(1) : normalized;
    const [whole, fraction = ''] = unsigned.split('.');
    const scale = 10n ** BigInt(fraction.length);
    const digits = BigInt(`${whole}${fraction}` || '0');
    const numerator = digits * factor;
    if (numerator % scale !== 0n) {
      return { ok: false, error: '当前数值无法精确到 1 毫秒' };
    }
    const result = numerator / scale;
    return { ok: true, value: negative ? -result : result, normalized };
  }

  function formatMillisecondsAsSeconds(ms) {
    const x = toBigIntMs(ms);
    if (x === null) return '0';
    const whole = x / 1000n;
    const rem = x % 1000n;
    if (rem === 0n) return whole.toString();
    return `${whole}.${rem.toString().padStart(3, '0').replace(/0+$/, '')}`;
  }

  function durationText(totalMs) {
    let value = toBigIntMs(totalMs);
    if (value === null) return '—';
    if (value === 0n) return '0分';
    const sign = value < 0n ? '-' : '';
    if (value < 0n) value = -value;

    const d = value / FACTOR_MS.d; value %= FACTOR_MS.d;
    const h = value / FACTOR_MS.h; value %= FACTOR_MS.h;
    const m = value / FACTOR_MS.m; value %= FACTOR_MS.m;
    const sMs = value;
    const out = [];
    if (d) out.push(`${d}天`);
    if (h) out.push(`${h}小时`);
    if (m) out.push(`${m}分`);
    if (sMs || !out.length) out.push(`${formatMillisecondsAsSeconds(sMs)}秒`);
    return sign + out.join('');
  }

  function hms(totalMs) {
    let value = toBigIntMs(totalMs);
    if (value === null) return '—';
    const sign = value < 0n ? '-' : '';
    if (value < 0n) value = -value;
    const h = value / FACTOR_MS.h; value %= FACTOR_MS.h;
    const m = value / FACTOR_MS.m; value %= FACTOR_MS.m;
    const s = value / 1000n;
    const ms = value % 1000n;
    return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}${ms ? `.${ms.toString().padStart(3, '0')}` : ''}`;
  }

  function roundedRatioText(totalMs, divisor, decimals = 6) {
    let value = toBigIntMs(totalMs);
    const den = typeof divisor === 'bigint' ? divisor : BigInt(divisor);
    if (value === null || den <= 0n) return '—';
    const negative = value < 0n;
    if (negative) value = -value;
    const whole = value / den;
    let remainder = value % den;
    if (!remainder || decimals <= 0) return `${negative ? '-' : ''}${whole}`;

    const scale = 10n ** BigInt(decimals);
    let fraction = (remainder * scale * 10n) / den;
    const roundDigit = fraction % 10n;
    fraction /= 10n;
    if (roundDigit >= 5n) fraction += 1n;

    let adjustedWhole = whole;
    if (fraction >= scale) {
      adjustedWhole += 1n;
      fraction -= scale;
    }
    const fracText = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${negative ? '-' : ''}${adjustedWhole}${fracText ? `.${fracText}` : ''}`;
  }

  function millisecondsToParts(totalMs) {
    let value = toBigIntMs(totalMs);
    if (value === null) return [];
    if (value === 0n) return [{ kind: 'unit', unit: 'm', value: '0' }];
    const negative = value < 0n;
    if (negative) value = -value;
    const raw = [];
    const d = value / FACTOR_MS.d; value %= FACTOR_MS.d;
    const h = value / FACTOR_MS.h; value %= FACTOR_MS.h;
    const m = value / FACTOR_MS.m; value %= FACTOR_MS.m;
    if (d) raw.push({ kind: 'unit', unit: 'd', value: d.toString() });
    if (h) raw.push({ kind: 'unit', unit: 'h', value: h.toString() });
    if (m) raw.push({ kind: 'unit', unit: 'm', value: m.toString() });
    if (value) raw.push({ kind: 'unit', unit: 's', value: formatMillisecondsAsSeconds(value) });
    if (!raw.length) raw.push({ kind: 'unit', unit: 'm', value: '0' });
    if (negative) raw[0].value = `-${raw[0].value}`;
    return raw;
  }

  function normalizeStoredPart(part) {
    if (!part || typeof part !== 'object') return null;
    if (part.kind === 'unit' && FACTOR_MS[part.unit]) {
      const normalized = normalizeDecimalString(part.value);
      return normalized === null ? null : { kind: 'unit', unit: part.unit, value: normalized };
    }
    if (part.kind === 'colon') {
      const hours = String(part.hours ?? '0').replace(/^0+(?=\d)/, '') || '0';
      const minutes = String(part.minutes ?? '0').padStart(2, '0').slice(-2);
      const seconds = part.seconds === null || part.seconds === undefined ? null : String(part.seconds).padStart(2, '0').slice(-2);
      return { kind: 'colon', hours, minutes, seconds };
    }
    return null;
  }

  function normalizeStoredRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row, index) => ({
      op: index === 0 ? null : (row?.op === '-' ? '-' : '+'),
      parts: Array.isArray(row?.parts) ? row.parts.map(normalizeStoredPart).filter(Boolean) : []
    })).filter(row => row.parts.length);
  }

  globalThis.DurationPrecision = Object.freeze({
    FACTOR_MS,
    MAX_INPUT_DIGITS,
    toBigIntMs,
    normalizeDecimalString,
    digitCount,
    parseDecimalToMs,
    durationText,
    hms,
    roundedRatioText,
    millisecondsToParts,
    normalizeStoredRows
  });
})();
const expressionEl=document.getElementById('expression');
const exprScroll=document.getElementById('exprScroll');
const badge=document.getElementById('badge');
const resultEl=document.getElementById('result');
const secondaryEl=document.getElementById('secondary');
const normalizedEl=document.getElementById('normalized');
const errorEl=document.getElementById('errorLine');
const rowActions=document.getElementById('rowActions');
const rowActionLabel=document.getElementById('rowActionLabel');
const toggleOpBtn=document.getElementById('toggleOpBtn');
const toast=document.getElementById('toast');
const historyMask=document.getElementById('historyMask');
const historyList=document.getElementById('historyList');
const HISTORY_KEY='time-calculator-v12-history';
const HISTORY_LIMIT=50;
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

let formatIndex=0;
let lastResultMs=0n;
let justEvaluated=false;
let selectedRow=null;
let partEdit=null;
let historyRecords=loadHistory();

function normalizeHistoryRecord(record){
  if(!record||typeof record!=='object')return null;
  const normalizedRows=DurationPrecision.normalizeStoredRows(record.rows);
  if(!normalizedRows.length)return null;
  const parsedMs=DurationPrecision.toBigIntMs(record.resultMs);
  const resultMs=parsedMs===null?'0':parsedMs.toString();
  return {
    ...record,
    rows:normalizedRows,
    resultMs,
    signature:record.signature||rowsSignature(normalizedRows)
  };
}

function loadHistory(){
  try{
    const raw=localStorage.getItem(HISTORY_KEY);
    const parsed=raw?JSON.parse(raw):[];
    if(!Array.isArray(parsed))return [];
    return parsed.map(normalizeHistoryRecord).filter(Boolean).slice(0,HISTORY_LIMIT);
  }catch(_){return []}
}
function persistHistory(){
  try{localStorage.setItem(HISTORY_KEY,JSON.stringify(historyRecords))}
  catch(_){notify('历史记录保存失败')}
}
function rowsSignature(rs){
  return JSON.stringify(rs.map((r,index)=>({
    op:index===0?null:(r.op==='-'?'-':'+'),
    parts:r.parts.map(p=>p.kind==='unit'
      ?{kind:'unit',unit:p.unit,value:DurationPrecision.normalizeDecimalString(p.value)||'0'}
      :{kind:'colon',hours:String(p.hours),minutes:String(p.minutes),seconds:p.seconds===null?null:String(p.seconds)}
    )
  })));
}
function saveHistoryRecord(resultMs){
  if(!rows.length)return;
  const snapshot=clone(rows);
  const sig=rowsSignature(snapshot);
  historyRecords=historyRecords.filter(r=>r.signature!==sig);
  historyRecords.unshift({
    id:`h_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    createdAt:Date.now(),
    signature:sig,
    rows:snapshot,
    resultMs:DurationPrecision.toBigIntMs(resultMs)?.toString()||'0'
  });
  if(historyRecords.length>HISTORY_LIMIT)historyRecords.length=HISTORY_LIMIT;
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
  const record=historyRecords[index];
  if(!record)return;
  rows=DurationPrecision.normalizeStoredRows(clone(record.rows));
  currentOp=null;selectedRow=null;partEdit=null;clearInput();justEvaluated=false;setError('');
  const stored=DurationPrecision.toBigIntMs(record.resultMs);lastResultMs=stored??0n;
  closeHistory();render();notify('已恢复，可继续编辑');
}
function deleteHistory(index){historyRecords.splice(index,1);persistHistory();renderHistory()}
function clearHistory(){if(!historyRecords.length)return;historyRecords=[];persistHistory();renderHistory();notify('历史记录已清空')}

function notify(msg){
  toast.textContent=msg;toast.classList.add('show');
  clearTimeout(notify.t);notify.t=setTimeout(()=>toast.classList.remove('show'),1450);
}
function setError(msg=''){errorEl.textContent=msg}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]))}
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
  if(p.kind==='unit')return valueToMs(p.value,p.unit);
  try{
    const h=BigInt(String(p.hours||'0'));
    const m=BigInt(String(p.minutes||'0'));
    const s=BigInt(p.seconds!==null&&p.seconds!==undefined?String(p.seconds):'0');
    return h*factorMs.h+m*factorMs.m+s*factorMs.s;
  }catch(_){return null}
}
function partText(p){
  if(p.kind==='unit')return `${trim(p.value)}${label[p.unit]}`;
  const mm=String(p.minutes).padStart(2,'0');
  if(p.seconds!==null&&p.seconds!==undefined)return `${p.hours}:${mm}:${String(p.seconds).padStart(2,'0')}`;
  return `${p.hours}:${mm}`;
}
function partsMs(parts){
  let total=0n;
  for(const p of parts){
    const ms=partMs(p);
    if(ms===null)return null;
    total+=ms;
  }
  return total;
}
function partsText(parts){return parts.map(partText).join('')}
function durationText(totalMs){return DurationPrecision.durationText(totalMs)}
function hms(totalMs){return DurationPrecision.hms(totalMs)}
function formatResult(totalMs){
  if(formatIndex===0)return durationText(totalMs);
  if(formatIndex===1)return `${DurationPrecision.roundedRatioText(totalMs,factorMs.h,6)}小时`;
  return `${DurationPrecision.roundedRatioText(totalMs,factorMs.m,6)}分`;
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
  if(!rs.length)return {ok:true,value:0n};
  const first=partsMs(rs[0].parts);
  if(first===null)return {ok:false,error:'当前时长无法精确到 1 毫秒'};
  let total=first;
  for(let i=1;i<rs.length;i++){
    const v=partsMs(rs[i].parts);
    if(v===null)return {ok:false,error:'当前时长无法精确到 1 毫秒'};
    total=rs[i].op==='-'?total-v:total+v;
  }
  return {ok:true,value:total};
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
