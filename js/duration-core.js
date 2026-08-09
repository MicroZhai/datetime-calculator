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
  let historyRecords=loadHistory();


  // V11: 内部一律使用整数毫秒。
  const factorMs={d:86400000,h:3600000,m:60000,s:1000};
  const label={d:'天',h:'小时',m:'分',s:'秒'};
  const shortLabel={d:'天',h:'时',m:'分',s:'秒'};
  const MAX_SAFE_MS=Number.MAX_SAFE_INTEGER;

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
  let lastResultMs=0;
  let justEvaluated=false;
  let selectedRow=null;
  let partEdit=null;


  function loadHistory(){
    try{
      const raw=localStorage.getItem(HISTORY_KEY);
      const parsed=raw?JSON.parse(raw):[];
      return Array.isArray(parsed)?parsed:[];
    }catch(_){return []}
  }
  function persistHistory(){
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(historyRecords))}
    catch(_){notify('历史记录保存失败')}
  }
  function rowsSignature(rs){
    return JSON.stringify(rs.map(r=>({
      op:r.op,
      parts:r.parts.map(p=>p.kind==='unit'
        ?{kind:'unit',unit:p.unit,value:Number(p.value)}
        :{kind:'colon',hours:String(p.hours),minutes:String(p.minutes),seconds:p.seconds===null?null:String(p.seconds)}
      )
    })));
  }
  function saveHistoryRecord(resultMs){
    if(!rows.length)return;
    const snapshot=clone(rows);
    const sig=rowsSignature(snapshot);

    // 同一个完整表达式连续按 =，只更新到最前面，不重复制造垃圾记录。
    historyRecords=historyRecords.filter(r=>r.signature!==sig);
    historyRecords.unshift({
      id:`h_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      createdAt:Date.now(),
      signature:sig,
      rows:snapshot,
      resultMs
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
  function openHistory(){
    renderHistory();
    historyMask.classList.add('show');
  }
  function closeHistory(){
    historyMask.classList.remove('show');
  }
  function restoreHistory(index){
    const record=historyRecords[index];
    if(!record)return;
    rows=clone(record.rows);
    currentOp=null;
    selectedRow=null;
    partEdit=null;
    clearInput();
    justEvaluated=false;
    setError('');
    closeHistory();
    render();
    notify('已恢复，可继续编辑');
  }
  function deleteHistory(index){
    historyRecords.splice(index,1);
    persistHistory();
    renderHistory();
  }
  function clearHistory(){
    if(!historyRecords.length)return;
    historyRecords=[];
    persistHistory();
    renderHistory();
    notify('历史记录已清空');
  }

  function notify(msg){
    toast.textContent=msg;toast.classList.add('show');
    clearTimeout(notify.t);notify.t=setTimeout(()=>toast.classList.remove('show'),1450);
  }
  function setError(msg=''){errorEl.textContent=msg}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function trim(n,d=6){return String(Number(Number(n).toFixed(d)))}
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function isSafeMs(v){return Number.isSafeInteger(v) && Math.abs(v)<=MAX_SAFE_MS}
  function valueToMs(value,unit){
    const ms=Math.round(Number(value)*factorMs[unit]);
    return isSafeMs(ms)?ms:null;
  }

  function partMs(p){
    if(p.kind==='unit')return valueToMs(p.value,p.unit);
    const h=Number(p.hours),m=Number(p.minutes),s=(p.seconds!==null&&p.seconds!==undefined)?Number(p.seconds):0;
    const ms=h*factorMs.h+m*factorMs.m+s*factorMs.s;
    return isSafeMs(ms)?ms:null;
  }
  function partText(p){
    if(p.kind==='unit')return `${trim(p.value)}${label[p.unit]}`;
    const mm=String(p.minutes).padStart(2,'0');
    if(p.seconds!==null&&p.seconds!==undefined)return `${p.hours}:${mm}:${String(p.seconds).padStart(2,'0')}`;
    return `${p.hours}:${mm}`;
  }
  function partsMs(parts){
    let total=0;
    for(const p of parts){
      const ms=partMs(p);
      if(ms===null)return null;
      total+=ms;
      if(!isSafeMs(total))return null;
    }
    return total;
  }
  function partsText(parts){return parts.map(partText).join('')}

  function durationText(totalMs){
    if(totalMs===0)return '0分';
    const sign=totalMs<0?'-':'';
    let x=Math.abs(totalMs);
    const d=Math.floor(x/factorMs.d);x%=factorMs.d;
    const h=Math.floor(x/factorMs.h);x%=factorMs.h;
    const m=Math.floor(x/factorMs.m);x%=factorMs.m;
    const wholeSec=Math.floor(x/1000),remMs=x%1000;
    const out=[];
    if(d)out.push(`${d}天`);
    if(h)out.push(`${h}小时`);
    if(m)out.push(`${m}分`);
    if(wholeSec||remMs||!out.length){
      const sec=remMs?trim(wholeSec+remMs/1000,3):String(wholeSec);
      out.push(`${sec}秒`);
    }
    return sign+out.join('');
  }
  function hms(totalMs){
    const sign=totalMs<0?'-':'';
    let x=Math.abs(totalMs);
    const h=Math.floor(x/factorMs.h);x%=factorMs.h;
    const m=Math.floor(x/factorMs.m);x%=factorMs.m;
    const s=Math.floor(x/1000),ms=x%1000;
    return `${sign}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}${ms?'.'+String(ms).padStart(3,'0'):''}`;
  }
  function formatResult(totalMs){
    if(formatIndex===0)return durationText(totalMs);
    if(formatIndex===1)return `${trim(totalMs/factorMs.h,6)}小时`;
    return `${trim(totalMs/factorMs.m,6)}分`;
  }
  function msToNormalizedParts(totalMs){
    if(totalMs===0)return [{kind:'unit',unit:'m',value:0}];
    const sign=totalMs<0?-1:1;
    let x=Math.abs(totalMs);
    const d=Math.floor(x/factorMs.d);x%=factorMs.d;
    const h=Math.floor(x/factorMs.h);x%=factorMs.h;
    const m=Math.floor(x/factorMs.m);x%=factorMs.m;
    const s=x/1000;
    const raw=[];
    if(d)raw.push({kind:'unit',unit:'d',value:d});
    if(h)raw.push({kind:'unit',unit:'h',value:h});
    if(m)raw.push({kind:'unit',unit:'m',value:m});
    if(s)raw.push({kind:'unit',unit:'s',value:s});
    if(!raw.length)raw.push({kind:'unit',unit:'m',value:0});
    raw[0].value*=sign;
    return raw;
  }

  function editedPart(rowIndex,partIndex){
    const original=rows[rowIndex].parts[partIndex];
    if(!partEdit || partEdit.rowIndex!==rowIndex || partEdit.partIndex!==partIndex)return original;
    if(partEdit.kind==='unit')return {kind:'unit',unit:partEdit.unit,value:Number(partEdit.buffer||0)};
    return {kind:'colon',hours:partEdit.hours||'0',minutes:partEdit.minutes||'0',
      seconds:partEdit.hasSeconds?(partEdit.seconds||'0'):null};
  }
  function effectiveRows(){
    return rows.map((row,ri)=>({op:row.op,parts:row.parts.map((_,pi)=>editedPart(ri,pi))}));
  }
  function evaluateRows(includeCurrent=true){
    const rs=effectiveRows().map(clone);
    if(includeCurrent){
      const cp=currentValueParts();
      if(cp.length)rs.push({op:rs.length?currentOp:null,parts:cp});
    }
    if(!rs.length)return {ok:true,value:0};
    const first=partsMs(rs[0].parts);
    if(first===null)return {ok:false,error:'时间数值过大'};
    let total=first;
    for(let i=1;i<rs.length;i++){
      const v=partsMs(rs[i].parts);
      if(v===null)return {ok:false,error:'时间数值过大'};
      total=rs[i].op==='-'?total-v:total+v;
      if(!isSafeMs(total))return {ok:false,error:'计算结果超出安全范围'};
    }
    return {ok:true,value:total};
  }

  function colonComplete(){
    if(!colonMode||colonHours==='')return false;
    if(colonMinutes.length!==2)return false;
    if(colonStage==='second'&&colonSeconds.length!==2)return false;
    return true;
  }
  function colonPart(){
    return {kind:'colon',hours:String(Number(colonHours)),
      minutes:String(Number(colonMinutes)).padStart(2,'0'),
      seconds:colonStage==='second'?String(Number(colonSeconds)).padStart(2,'0'):null};
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
