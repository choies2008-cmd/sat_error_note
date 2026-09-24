/* 사문 오답 분석 - vanilla JS / localStorage / no AI yet */
const TOPICS = [
  {id:1, group:'I. 사회·문화 현상의 탐구', name:'사회·문화 현상의 이해'},
  {id:2, group:'I. 사회·문화 현상의 탐구', name:'사회·문화 현상의 연구 방법'},
  {id:3, group:'I. 사회·문화 현상의 탐구', name:'자료 수집 방법'},
  {id:4, group:'I. 사회·문화 현상의 탐구', name:'사회·문화 현상의 탐구 태도와 연구 윤리'},
  {id:5, group:'II. 개인과 사회 구조', name:'사회적 존재로서의 인간'},
  {id:6, group:'II. 개인과 사회 구조', name:'사회 집단과 사회 조직'},
  {id:7, group:'II. 개인과 사회 구조', name:'사회 구조와 일탈 행동'},
  {id:8, group:'III. 문화와 일상생활', name:'문화의 이해'},
  {id:9, group:'III. 문화와 일상생활', name:'현대 사회의 문화 양상'},
  {id:10, group:'III. 문화와 일상생활', name:'문화 변동의 양상과 대응'},
  {id:11, group:'IV. 사회 계층과 불평등', name:'사회 불평등 현상의 이해'},
  {id:12, group:'IV. 사회 계층과 불평등', name:'사회 이동과 사회 계층 구조'},
  {id:13, group:'IV. 사회 계층과 불평등', name:'다양한 사회 불평등 현상'},
  {id:14, group:'IV. 사회 계층과 불평등', name:'사회 복지와 복지 제도'},
  {id:15, group:'V. 현대의 사회 변동', name:'사회 변동과 사회 운동'},
  {id:16, group:'V. 현대의 사회 변동', name:'현대 사회의 변화와 전 지구적 수준의 문제'}
];
const REASONS = [
  ['concept_unknown','개념을 몰랐음'], ['concept_confusion','개념을 혼동함'], ['choice_misinterpretation','선지를 잘못 해석함'],
  ['condition_missed','문제의 조건을 놓침'], ['question_misread','문제를 잘못 읽음'], ['passage_element_failed','제시문 요소 파악 실패'],
  ['passage_summary_failed','제시문 요지 파악 실패'], ['data_interpretation_failed','자료 해석을 잘못함'], ['calculation_error','계산·수치 처리 실수'],
  ['table_puzzle_stuck','도표 또는 퍼즐형 문제 막힘'], ['time_shortage','시간 부족'], ['guessing','찍음/근거 없이 선택함'],
  ['momentary_mistake','집중력·순간 판단 실수'], ['exam_anxiety','시험 긴장'], ['other','기타']
];
const STATUS = {wrong:'🔴 틀림', unsure:'🟡 맞았지만 헷갈림', guess:'🔵 찍음'};
const KEY = 'samuErrorNote.v1';
const GEMINI_MODELS = [
  {id:'gemini-3.5-flash-lite', name:'Gemini 3.5 Flash-Lite', note:'기본 · 빠르고 비용 효율적'},
  {id:'gemini-3.1-flash-lite', name:'Gemini 3.1 Flash-Lite', note:'안정형 Flash-Lite'},
  {id:'gemini-3.8-flash', name:'Gemini 3.8 Flash', note:'고성능 Flash'},
  {id:'gemini-3.7-flash', name:'Gemini 3.7 Flash', note:'이전 세대 고성능 Flash'},
  {id:'gemini-3.6-flash', name:'Gemini 3.6 Flash', note:'속도·멀티모달 균형'},
  {id:'gemini-3.5-flash', name:'Gemini 3.5 Flash', note:'범용 고성능 Flash'}
];
const DEFAULT = { exams:[], records:[], settings:{theme:'system', afterSave:'next', geminiApiKey:'', geminiModel:'gemini-3.5-flash-lite'} };
let db = loadDB();
let currentTab = 'records';
let analysisSub = 'ai';
let recordFilter = {status:'all', topic:'all', q:''};
let editingRecordId = null;
let selectedAnalysisTopic = 1;
let chartTooltip = null;

function uid(prefix='id') { return prefix + Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function loadDB(){ try { const x=JSON.parse(localStorage.getItem(KEY)); return x && x.exams && x.records ? {...DEFAULT,...x,settings:{...DEFAULT.settings,...x.settings,geminiModel:GEMINI_MODELS.some(m=>m.id===x.settings?.geminiModel)?x.settings.geminiModel:DEFAULT.settings.geminiModel}} : structuredClone(DEFAULT); } catch { return structuredClone(DEFAULT); } }
function saveDB(){ localStorage.setItem(KEY, JSON.stringify(db)); }
function esc(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function topic(id){ return TOPICS.find(t=>t.id===Number(id)); }
function reason(id){ return REASONS.find(r=>r[0]===id)?.[1] || id; }
function fmtDate(s){ if(!s) return ''; const d=new Date(s+'T00:00:00'); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`; }
function fmtDateTime(iso){ const d=new Date(iso); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function sortedExams(){ return [...db.exams].sort((a,b)=> b.date.localeCompare(a.date) || a.name.localeCompare(b.name)); }
function sortedRecords(){ return [...db.records].sort((a,b)=> b.created_at.localeCompare(a.created_at)); }
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),1800); }
function render(){ document.body.classList.toggle('dark', db.settings.theme==='dark' || (db.settings.theme==='system' && matchMedia('(prefers-color-scheme: dark)').matches)); document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===currentTab)); const main=document.getElementById('mainContent'); if(currentTab==='records') renderRecords(main); if(currentTab==='analysis') renderAnalysis(main); if(currentTab==='settings') renderSettings(main); }

function renderRecords(main){
  const records=sortedRecords();
  const filtered=records.filter(r=> (recordFilter.status==='all'||r.status===recordFilter.status) && (recordFilter.topic==='all'||Number(r.topic_id)===Number(recordFilter.topic)) && (!recordFilter.q || `${r.question_number} ${topic(r.topic_id)?.name||''} ${r.reasons.map(reason).join(' ')}`.toLowerCase().includes(recordFilter.q.toLowerCase())) );
  let html=`<div class="hero-card"><h2>오답을 쌓고, 패턴을 확인하세요.</h2><p>틀린 문제뿐 아니라 맞았지만 헷갈렸거나 찍은 문제도 기록할 수 있습니다. 기록된 세 상태는 분석에서 함께 누적됩니다.</p><button class="primary-btn full" style="margin-top:14px" onclick="openRecordForm()">＋ 새 오답 기록</button></div>`;
  html+=`<div class="section-title"><h2>최근 기록</h2><span class="muted">총 ${filtered.length}개</span></div>`;
  html+=`<input class="search-box" id="recordSearch" placeholder="문제 번호·단원·이유 검색" value="${esc(recordFilter.q)}" oninput="recordFilter.q=this.value; render()" />`;
  html+=`<div class="filter-row" style="margin-top:8px">${[['all','전체'],['wrong','🔴 틀림'],['unsure','🟡 헷갈림'],['guess','🔵 찍음']].map(([v,n])=>`<button class="chip ${recordFilter.status===v?'active':''}" onclick="recordFilter.status='${v}';render()">${n}</button>`).join('')}</div>`;
  html+=`<select class="select" onchange="recordFilter.topic=this.value;render()"><option value="all">전체 단원</option>${TOPICS.map(t=>`<option value="${t.id}" ${String(recordFilter.topic)===String(t.id)?'selected':''}>${String(t.id).padStart(2,'0')}. ${esc(t.name)}</option>`).join('')}</select>`;
  if(!filtered.length) html+=`<div class="empty"><div class="emoji">📝</div><div>아직 조건에 맞는 기록이 없습니다.</div></div>`;
  else {
    const groups={}; filtered.forEach(r=>(groups[r.exam_id]??=[]).push(r));
    sortedExams().filter(e=>groups[e.id]).forEach(e=>{ html+=`<section class="exam-group"><div class="exam-head"><span class="exam-name">${esc(e.name)}</span><span class="exam-date">${fmtDate(e.date)}</span></div>`; groups[e.id].forEach(r=>{ const rs=r.reasons.map(reason); html+=`<button class="record-card" onclick="openRecordDetail('${r.id}')"><span class="qnum">${esc(r.question_number)}번</span><span class="record-main"><span class="record-topic">${esc(topic(r.topic_id)?.name||'삭제된 단원')}</span><span class="record-reason">${esc(rs.join(' · '))}</span></span><span class="status-dot">${STATUS[r.status].slice(0,2)}</span></button>`; }); html+='</section>'; });
  }
  main.innerHTML=html;
}

function renderAnalysis(main){
  let html=`<div class="analysis-switch"><button class="${analysisSub==='ai'?'active':''}" onclick="analysisSub='ai';render()">AI 학습 상담</button><button class="${analysisSub==='stats'?'active':''}" onclick="analysisSub='stats';render()">오답 분석</button></div>`;
  if(analysisSub==='ai') html+=renderAIPlaceholder(); else html+=renderStats();
  main.innerHTML=html;
  if(analysisSub==='stats') setTimeout(drawAllCharts,0);
}
function renderAIPlaceholder(){
  const total=db.records.length;
  const counts={wrong:0,unsure:0,guess:0};
  db.records.forEach(r=>counts[r.status]++);
  const hasKey=!!db.settings.geminiApiKey;
  const lastAI=localStorage.getItem('samuErrorNote.lastAIAnalysis') || '';
  return `<div class="hero-card ai-hero">
    <div class="ai-title-row"><div><div class="ai-kicker">GEMINI AI</div><h2>AI 학습 상담</h2></div><span class="api-key-status ${hasKey?'saved':''}">${hasKey?'API 연결 준비됨':'API 키 필요'}</span></div>
    <p>지금까지 기록한 오답의 단원·상태·틀린 이유·모의고사별 변화를 앱에서 먼저 계산한 뒤, Gemini가 학습 패턴을 해석하고 공부 방향을 제안합니다.</p>
    <button class="primary-btn full" style="margin-top:14px" onclick="runAIAnalysis()" ${hasKey?'':'disabled'}>🤖 AI 분석하기</button>
    ${!hasKey?`<div class="helper" style="margin-top:9px">⚙️ 설정에서 Gemini API 키를 먼저 저장하세요.</div>`:''}
    ${lastAI?`<div class="helper" style="margin-top:9px">마지막 분석: ${esc(lastAI)}</div>`:''}
  </div>
  <div id="aiResultArea">${renderStoredAIResult()}</div>
  <div class="analysis-card"><h3>현재 기록</h3><p>AI가 분석할 원본 데이터입니다.</p><div class="metric-row"><div class="metric"><b>${total}</b><span>전체 기록</span></div><div class="metric"><b>${counts.wrong}</b><span>🔴 틀림</span></div><div class="metric"><b>${counts.unsure}</b><span>🟡 헷갈림</span></div><div class="metric"><b>${counts.guess}</b><span>🔵 찍음</span></div></div></div>`;
}
function renderStoredAIResult(){
  const raw=localStorage.getItem('samuErrorNote.aiResult');
  if(!raw)return '';
  try{
    const data=JSON.parse(raw);
    if(!data?.text)return '';
    return `<div class="analysis-card ai-result-card"><div class="ai-result-head"><div><div class="ai-kicker">AI ANALYSIS</div><h3>최근 AI 학습 상담</h3></div><button class="secondary-btn" onclick="clearAIResult()">결과 지우기</button></div><div class="ai-result-meta">${esc(data.generatedAt||'')}</div><div class="ai-result-text">${formatAIText(data.text)}</div></div>`;
  }catch{return '';}
}
function formatAIText(text){
  return esc(text).replace(/^### (.+)$/gm,'<h4>$1</h4>').replace(/^## (.+)$/gm,'<h3>$1</h3>').replace(/^# (.+)$/gm,'<h3>$1</h3>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/^[-•] (.+)$/gm,'<li>$1</li>').replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g,'$1').replace(/\n\n/g,'<div class="ai-gap"></div>').replace(/\n/g,'<br>');
}
function clearAIResult(){ localStorage.removeItem('samuErrorNote.aiResult'); localStorage.removeItem('samuErrorNote.lastAIAnalysis'); render(); }
function buildAIStats(){
  const topicStats=TOPICS.map(t=>{
    const rs=db.records.filter(r=>Number(r.topic_id)===t.id);
    const reasons={};
    rs.forEach(r=>r.reasons.forEach(id=>{reasons[id]=(reasons[id]||0)+1;}));
    return {id:t.id,name:t.name,count:rs.length,status:{wrong:rs.filter(r=>r.status==='wrong').length,unsure:rs.filter(r=>r.status==='unsure').length,guess:rs.filter(r=>r.status==='guess').length},reasons:Object.entries(reasons).sort((a,b)=>b[1]-a[1]).map(([id,count])=>({reason:reason(id),count})).slice(0,5)};
  }).filter(x=>x.count>0);
  const reasonStats={};
  db.records.forEach(r=>r.reasons.forEach(id=>{reasonStats[id]=(reasonStats[id]||0)+1;}));
  const examStats=sortedExams().map(e=>{const rs=db.records.filter(r=>r.exam_id===e.id);return {name:e.name,date:e.date,total:rs.length,status:{wrong:rs.filter(r=>r.status==='wrong').length,unsure:rs.filter(r=>r.status==='unsure').length,guess:rs.filter(r=>r.status==='guess').length}};});
  const records=db.records.map(r=>({exam:db.exams.find(e=>e.id===r.exam_id)?.name||'알 수 없음',date:db.exams.find(e=>e.id===r.exam_id)?.date||'',question:Number(r.question_number),topic:topic(r.topic_id)?.name||'',status:STATUS[r.status],reasons:r.reasons.map(reason),improvement:r.improvement||''}));
  return {total:db.records.length,statusCounts:{...Object.fromEntries(Object.entries(reasonStats).map(([k])=>[k,reason(k)]))},topicStats,reasonRanking:Object.entries(reasonStats).sort((a,b)=>b[1]-a[1]).map(([id,count])=>({reason:reason(id),count})),examStats,records};
}
async function runAIAnalysis(){
  const key=db.settings.geminiApiKey?.trim();
  if(!key){toast('설정에서 Gemini API 키를 먼저 저장하세요.');return;}
  if(!db.records.length){toast('먼저 오답 기록을 하나 이상 추가하세요.');return;}
  const btn=document.querySelector('.ai-hero .primary-btn');
  if(btn){btn.disabled=true;btn.textContent='🤖 분석 중...';}
  const stats=buildAIStats();
  const prompt=`너는 한국 고등학교 사회·문화(사문) 수능 대비 학습 상담 AI다. 사용자의 오답 기록을 분석해 실제 공부에 바로 쓸 수 있는 조언을 해라.\n\n중요 규칙:\n- 숫자를 새로 계산하거나 기록에 없는 사실을 만들지 마라. 제공된 통계와 기록만 사용하라.\n- '틀림/헷갈림/찍음'은 앱의 기록 상태이며 세 상태 모두 전체 기록 통계에 포함된다.\n- 특정 단원이 많이 기록됐다는 사실만으로 실제 오답률이 높다고 단정하지 마라. 전체 응시 문항 수가 없기 때문이다.\n- 개선 방안은 사용자가 직접 쓴 계획이므로 반복되는 패턴과 연결해 평가하되, 없는 계획을 지어내지 마라.\n- 막연한 '열심히 공부하세요' 대신 구체적인 공부 행동을 제안하라.\n- 분석은 다음 순서로 작성하라: 1) 핵심 문제 2) 단원별 분석 3) 반복되는 틀린 이유 4) 최근 변화 5) 우선 학습 행동 6) 사용자가 적어둔 개선 방안에 대한 피드백.\n- 각 항목은 짧은 문단이나 bullet로 작성하고, 고3 수능 공부에 바로 적용할 수 있는 수준으로 말하라.\n- 불확실한 부분은 '기록만으로는 판단하기 어렵다'고 명시하라.\n\n앱에서 계산한 데이터:\n${JSON.stringify(stats,null,2)}`;
  try{
    const model=db.settings.geminiModel || DEFAULT.settings.geminiModel;
    const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.35,maxOutputTokens:1800}})});
    const data=await res.json();
    if(!res.ok){
      const msg=data?.error?.message||`API 요청 실패 (${res.status})`;
      throw new Error(msg);
    }
    const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
    if(!text)throw new Error('Gemini가 분석 결과를 반환하지 않았습니다.');
    const now=new Date();
    const generatedAt=`${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    localStorage.setItem('samuErrorNote.aiResult',JSON.stringify({text,generatedAt}));
    localStorage.setItem('samuErrorNote.lastAIAnalysis',generatedAt);
    toast('AI 분석이 완료되었습니다.');
  }catch(err){
    console.error(err);
    toast(`AI 분석 실패: ${err.message||'알 수 없는 오류'}`);
  }finally{render();}
}

function renderStats(){
  const total=db.records.length; const counts={wrong:0,unsure:0,guess:0}; db.records.forEach(r=>counts[r.status]++);
  const topics=TOPICS.map(t=>({...t,count:db.records.filter(r=>Number(r.topic_id)===t.id).length}));
  return `<div class="analysis-card"><h3>전체 기록</h3><p>🔴·🟡·🔵 세 상태를 모두 합친 기록 수입니다. 실제 전체 문항 대비 오답률이 아니라, 이 앱에 기록한 문항 기준입니다.</p><div class="metric-row"><div class="metric"><b>${total}</b><span>전체 기록</span></div><div class="metric"><b>${counts.wrong}</b><span>🔴 틀림</span></div><div class="metric"><b>${counts.unsure+counts.guess}</b><span>🟡·🔵</span></div></div></div>
  <div class="analysis-card"><h3>모의고사별 상태 추이</h3><p>점을 누르거나 터치하면 정확한 수치를 확인할 수 있습니다.</p><div class="chart-wrap" id="chartExam"><canvas></canvas><div class="tooltip-bubble"></div></div></div>
  <div class="analysis-card"><h3>16개 단원 기록 현황</h3><p>현재까지 각 단원에 몇 문제를 기록했는지 확인합니다.</p><div class="chart-wrap" id="chartTopics"><canvas></canvas><div class="tooltip-bubble"></div></div></div>
  <div class="analysis-card"><h3>단원별 추이</h3><p>단원을 선택하면 모의고사별 기록 변화가 나타납니다.</p><div class="chart-controls"><select class="select" onchange="selectedAnalysisTopic=Number(this.value);drawAllCharts()">${TOPICS.map(t=>`<option value="${t.id}" ${selectedAnalysisTopic===t.id?'selected':''}>${String(t.id).padStart(2,'0')}. ${esc(t.name)}</option>`).join('')}</select></div><div class="chart-wrap" id="chartTopicTrend"><canvas></canvas><div class="tooltip-bubble"></div></div></div>
  <div class="analysis-card"><h3>선택 단원의 틀린 이유 추이</h3><p>이 단원에서 어떤 이유가 반복되는지 모의고사별로 확인합니다.</p><div class="chart-wrap" id="chartReasonTrend"><canvas></canvas><div class="tooltip-bubble"></div></div></div>`;
}

function renderSettings(main){
  const hasKey=!!db.settings.geminiApiKey;
  main.innerHTML=`<div class="settings-section"><div class="settings-title">AI 설정</div><div class="settings-card api-key-card"><div class="api-key-head"><div><strong>Gemini API 키</strong><small>Google AI Studio에서 발급받은 API 키를 입력하세요.</small></div><span class="api-key-status ${hasKey?'saved':''}">${hasKey?'저장됨':'미입력'}</span></div><div class="api-key-row"><input id="geminiApiKeyInput" class="input" type="password" autocomplete="off" spellcheck="false" placeholder="AIza..." value="${esc(db.settings.geminiApiKey)}" /><button class="secondary-btn" type="button" onclick="toggleApiKeyVisibility()" id="apiKeyToggle">보기</button></div><div class="api-key-actions"><button class="primary-btn" type="button" onclick="saveGeminiApiKey()">API 키 저장</button>${hasKey?'<button class="secondary-btn" type="button" onclick="clearGeminiApiKey()">삭제</button>':''}</div><div class="field" style="margin-top:16px"><label class="field-label">AI 모델</label><select class="select" id="geminiModelSelect" onchange="saveGeminiModel(this.value)">${GEMINI_MODELS.map(m=>`<option value="${m.id}" ${db.settings.geminiModel===m.id?'selected':''}>${m.name} — ${m.note}</option>`).join('')}</select><div class="helper">기본 모델은 최신 안정형 Flash-Lite인 Gemini 3.5 Flash-Lite입니다.</div></div><div class="helper">키와 모델 설정은 이 브라우저의 localStorage에 저장됩니다. 백업 JSON에는 API 키가 포함되지 않습니다.</div><div class="notice api-key-warning">⚠️ 이 방식은 개인용으로 간단하게 쓰기 위한 방식입니다. GitHub Pages의 웹앱에서는 브라우저에 저장된 API 키를 완전히 비공개로 숨길 수 없습니다.</div></div></div>
  <div class="settings-section"><div class="settings-title">데이터 관리</div><div class="settings-card"><button class="settings-btn" onclick="backupData()"><span>💾 데이터 백업<small>모의고사와 오답 기록을 JSON 파일로 저장</small></span><b>›</b></button><button class="settings-btn" onclick="document.getElementById('restoreInput').click()"><span>📥 데이터 복원<small>백업 JSON을 추가하거나 전체 교체</small></span><b>›</b></button></div></div>
  <div class="settings-section"><div class="settings-title">사용 설정</div><div class="settings-card" style="padding:15px"><div style="font-weight:800;font-size:13px">기록 저장 후 동작</div><div class="theme-options"><button class="${db.settings.afterSave==='next'?'active':''}" onclick="db.settings.afterSave='next';saveDB();render()">바로 다음<br>문제 기록</button><button class="${db.settings.afterSave==='list'?'active':''}" onclick="db.settings.afterSave='list';saveDB();render()">기록 목록으로<br>이동</button></div><div style="font-weight:800;font-size:13px;margin-top:18px">테마</div><div class="theme-options"><button class="${db.settings.theme==='system'?'active':''}" onclick="setTheme('system')">시스템</button><button class="${db.settings.theme==='light'?'active':''}" onclick="setTheme('light')">라이트</button><button class="${db.settings.theme==='dark'?'active':''}" onclick="setTheme('dark')">다크</button></div></div></div>
  <div class="settings-section"><div class="settings-title">앱 정보</div><div class="settings-card"><div class="settings-btn"><span>버전<small>1.0.0 · AI 기능 준비 중</small></span></div><div class="settings-btn"><span>데이터 저장 방식<small>이 기기의 브라우저 localStorage에 저장됩니다.</small></span></div><button class="settings-btn" onclick="resetData()"><span style="color:var(--danger)">모든 데이터 삭제<small>모의고사와 오답 기록을 모두 삭제합니다.</small></span><b>›</b></button></div></div>
  <input id="restoreInput" type="file" accept="application/json,.json" hidden onchange="restoreData(event)" />`;
}
function setTheme(t){ db.settings.theme=t; saveDB(); render(); }
function saveGeminiApiKey(){ const input=document.getElementById('geminiApiKeyInput'); if(!input)return; const key=input.value.trim(); if(!key){ toast('API 키를 입력하세요.'); input.focus(); return; } db.settings.geminiApiKey=key; saveDB(); toast('Gemini API 키를 저장했습니다.'); render(); }
function saveGeminiModel(model){ if(!GEMINI_MODELS.some(m=>m.id===model)) return; db.settings.geminiModel=model; saveDB(); toast('AI 모델을 변경했습니다.'); }
function clearGeminiApiKey(){ if(!confirm('저장된 Gemini API 키를 삭제할까요?'))return; db.settings.geminiApiKey=''; saveDB(); toast('API 키를 삭제했습니다.'); render(); }
function toggleApiKeyVisibility(){ const input=document.getElementById('geminiApiKeyInput'); const btn=document.getElementById('apiKeyToggle'); if(!input||!btn)return; const showing=input.type==='text'; input.type=showing?'password':'text'; btn.textContent=showing?'보기':'숨기기'; }


function openRecordForm(recordId=null){
  editingRecordId=recordId; const r=recordId?db.records.find(x=>x.id===recordId):null;
  const defaultExam=r?db.exams.find(e=>e.id===r.exam_id):sortedExams()[0];
  const modal=document.getElementById('modalRoot');
  modal.innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-head"><h3>${r?'오답 기록 수정':'새 오답 기록'}</h3><button class="close-btn" onclick="closeModal()">×</button></div><form onsubmit="submitRecord(event)">
    <div class="form-card"><div class="field"><label class="field-label">모의고사 <span class="required">*</span></label><button type="button" class="secondary-btn full" id="examPicker" onclick="openExamPicker()">${defaultExam?esc(defaultExam.name):'모의고사를 선택하세요'} ▾</button><div class="helper">최근 모의고사부터 선택할 수 있으며, 없으면 바로 추가할 수 있습니다.</div><input type="hidden" id="examId" value="${defaultExam?.id||''}" /></div>
    <div class="field"><label class="field-label">문제 번호 <span class="required">*</span></label><input class="input" id="questionNumber" type="number" min="1" step="1" inputmode="numeric" required value="${r?esc(r.question_number):''}" placeholder="예: 15" /></div></div>
    <div class="form-card"><div class="field"><label class="field-label">이 문제에서 핵심적으로 어려웠던 주제 <span class="required">*</span></label><div class="helper">복합 개념 문제라면 실제 오류의 핵심 원인이 된 주제 하나만 선택하세요.</div><select class="select" id="topicId" required><option value="">주제를 선택하세요</option>${TOPICS.map(t=>`<option value="${t.id}" ${r&&Number(r.topic_id)===t.id?'selected':''}>${String(t.id).padStart(2,'0')}. ${esc(t.name)}</option>`).join('')}</select></div>
    <div class="field"><label class="field-label">문제 상태 <span class="required">*</span></label><div class="status-grid">${Object.entries(STATUS).map(([k,v])=>`<div class="status-option"><input id="st_${k}" type="radio" name="status" value="${k}" ${r?.status===k?'checked':''} required><label for="st_${k}">${v}</label></div>`).join('')}</div></div></div>
    <div class="form-card"><div class="field"><label class="field-label">틀린 이유 <span class="required">*</span> <span class="muted">복수 선택</span></label><div class="reason-grid">${REASONS.map(([id,name])=>`<div class="reason-option"><input id="rs_${id}" type="checkbox" name="reasons" value="${id}" ${r?.reasons.includes(id)?'checked':''} onchange="toggleOtherReason()"><label for="rs_${id}">${esc(name)}</label></div>`).join('')}</div><div id="otherReasonWrap" class="other-wrap" style="display:${r?.reasons.includes('other')?'block':'none'}"><input class="input" id="otherReasonText" placeholder="어떤 이유였나요?" value="${esc(r?.other_reason_text||'')}" /></div></div>
    <div class="field"><label class="field-label">개선 방안 <span class="muted">선택</span></label><textarea class="textarea" id="improvement" rows="4" placeholder="예: 사회 이동 개념 다시 정리하고 관련 기출 5문제 풀기">${esc(r?.improvement||'')}</textarea><div class="helper">통계에는 포함하지 않으며, 나중에 AI 학습 상담을 연결할 때 참고 자료로 사용합니다.</div></div></div>
    <div class="form-actions"><button type="button" class="secondary-btn" onclick="closeModal()">취소</button><button class="primary-btn" type="submit">${r?'수정 저장':'기록 저장'}</button></div>
  </form></div></div>`;
}
function toggleOtherReason(){ const x=document.getElementById('rs_other'); const w=document.getElementById('otherReasonWrap'); if(x&&w)w.style.display=x.checked?'block':'none'; }
function closeModal(){ document.getElementById('modalRoot').innerHTML=''; editingRecordId=null; }
function openExamPicker(){
  const current=document.getElementById('examId')?.value||'';
  const modal=document.getElementById('modalRoot');
  modal.innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)openRecordForm(editingRecordId)"><div class="modal"><div class="modal-head"><h3>모의고사 선택</h3><button class="close-btn" onclick="openRecordForm(editingRecordId)">×</button></div><input class="search-box" id="examSearch" placeholder="모의고사 검색" oninput="filterExamChoices()" /><div id="examChoices" class="exam-list">${examChoicesHTML(current)}</div><button class="inline-add" onclick="openNewExamDialog()">＋ 새 모의고사 추가</button></div></div>`;
}
function examChoicesHTML(current,query=''){ return sortedExams().filter(e=>`${e.name} ${e.date}`.toLowerCase().includes(query.toLowerCase())).map(e=>`<button class="exam-choice" onclick="selectExam('${e.id}')"><strong>${esc(e.name)} ${e.id===current?'✓':''}</strong><span>${fmtDate(e.date)}</span></button>`).join('') || '<div class="empty" style="padding:20px">검색 결과가 없습니다.</div>'; }
function filterExamChoices(){ const q=document.getElementById('examSearch').value; document.getElementById('examChoices').innerHTML=examChoicesHTML(document.getElementById('examId')?.value||'',q); }
function selectExam(id){ const exam=db.exams.find(e=>e.id===id); const record=editingRecordId; openRecordForm(record); setTimeout(()=>{ document.getElementById('examId').value=id; document.getElementById('examPicker').innerHTML=`${esc(exam.name)} ▾`; },0); }
function openNewExamDialog(){
  const back=editingRecordId; document.getElementById('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>새 모의고사 추가</h3><button class="close-btn" onclick="openExamPicker()">×</button></div><div class="field"><label class="field-label">모의고사 이름 *</label><input class="input" id="newExamName" placeholder="예: 2027학년도 9월 모의평가" /></div><div class="field"><label class="field-label">시험 날짜 *</label><input class="input" id="newExamDate" type="date" /></div><button class="primary-btn full" onclick="createExamInline()">추가하고 선택</button></div></div>`;
}
function createExamInline(){ const name=document.getElementById('newExamName').value.trim(); const date=document.getElementById('newExamDate').value; if(!name||!date)return toast('이름과 날짜를 모두 입력하세요.'); if(db.exams.some(e=>e.name===name&&e.date===date))return toast('같은 이름과 날짜의 모의고사가 이미 있습니다.'); const e={id:uid('exam_'),name,date}; db.exams.push(e); saveDB(); openRecordForm(editingRecordId); setTimeout(()=>{document.getElementById('examId').value=e.id;document.getElementById('examPicker').innerHTML=`${esc(e.name)} ▾`;},0); toast('모의고사를 추가했습니다.'); }
function submitRecord(ev){
  ev.preventDefault();
  const examId=document.getElementById('examId').value; const q=Number(document.getElementById('questionNumber').value); const topicId=Number(document.getElementById('topicId').value); const status=document.querySelector('input[name="status"]:checked')?.value; const reasons=[...document.querySelectorAll('input[name="reasons"]:checked')].map(x=>x.value); const other=document.getElementById('otherReasonText')?.value.trim()||''; const improvement=document.getElementById('improvement').value.trim();
  if(!examId||!q||!topicId||!status||!reasons.length)return toast('필수 항목을 모두 입력하세요.');
  const dup=db.records.find(x=>x.exam_id===examId && Number(x.question_number)===q && x.id!==editingRecordId); if(dup){ if(confirm(`이미 이 모의고사의 ${q}번이 기록되어 있습니다.\n\n기존 기록을 수정하시겠습니까?`)){closeModal();openRecordForm(dup.id);} return; }
  if(editingRecordId){ const r=db.records.find(x=>x.id===editingRecordId); Object.assign(r,{exam_id:examId,question_number:q,topic_id:topicId,status,reasons,other_reason_text:other,improvement}); saveDB(); closeModal(); toast('수정했습니다.'); render(); return; }
  db.records.push({id:uid('rec_'),exam_id:examId,question_number:q,topic_id:topicId,status,reasons,other_reason_text:other,improvement,created_at:new Date().toISOString()}); saveDB();
  if(db.settings.afterSave==='list'){closeModal();toast('기록했습니다.');render();} else { const selected=examId; closeModal();toast('기록했습니다.');openRecordForm(null);setTimeout(()=>{document.getElementById('examId').value=selected; const e=db.exams.find(x=>x.id===selected); document.getElementById('examPicker').innerHTML=`${esc(e.name)} ▾`;},0); }
}
function openRecordDetail(id){ const r=db.records.find(x=>x.id===id); if(!r)return; const e=db.exams.find(x=>x.id===r.exam_id); const t=topic(r.topic_id); document.getElementById('modalRoot').innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-head"><h3>${esc(e?.name||'모의고사')}</h3><button class="close-btn" onclick="closeModal()">×</button></div><div class="detail-grid"><div class="detail-item"><span>문제</span><strong>${esc(r.question_number)}번</strong></div><div class="detail-item"><span>상태</span><strong>${STATUS[r.status]}</strong></div><div class="detail-item"><span>핵심 주제</span><strong>${esc(t?.name||'')}</strong></div><div class="detail-item"><span>기록일</span><strong>${fmtDateTime(r.created_at)}</strong></div></div><div class="field"><label class="field-label">틀린 이유</label><div class="reason-tags">${r.reasons.map(x=>`<span class="reason-tag">${esc(reason(x))}${x==='other'&&r.other_reason_text?` · ${esc(r.other_reason_text)}`:''}</span>`).join('')}</div></div><div class="field"><label class="field-label">개선 방안</label><div class="notice">${r.improvement?esc(r.improvement).replace(/\n/g,'<br>'):'입력하지 않음'}</div></div><div class="form-actions"><button class="secondary-btn" onclick="openRecordForm('${r.id}')">수정</button><button class="danger-btn" onclick="deleteRecord('${r.id}')">삭제</button></div></div></div>`; }
function deleteRecord(id){ const r=db.records.find(x=>x.id===id); if(!r)return; if(confirm(`이 기록을 삭제할까요?\n삭제하면 통계에서도 제외됩니다.`)){db.records=db.records.filter(x=>x.id!==id);saveDB();closeModal();toast('삭제했습니다.');render();} }

function backupData(){ const safeSettings={...db.settings,geminiApiKey:''}; const payload={app:'사문 오답 분석',version:1,exported_at:new Date().toISOString(),exams:db.exams,records:db.records,settings:safeSettings}; const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`사문_오답노트_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); toast('백업 파일을 만들었습니다.'); }
function restoreData(ev){ const file=ev.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{ try { const x=JSON.parse(reader.result); if(!Array.isArray(x.exams)||!Array.isArray(x.records))throw new Error('형식'); showRestoreChoice(x); } catch { toast('올바른 사문 오답 백업 파일이 아닙니다.'); } ev.target.value=''; }; reader.readAsText(file); }
function showRestoreChoice(x){
  const validReasons=new Set(REASONS.map(r=>r[0])); const cleanRecords=x.records.filter(r=>r.exam_id&&r.question_number&&TOPICS.some(t=>t.id===Number(r.topic_id))&&STATUS[r.status]&&Array.isArray(r.reasons)&&r.reasons.every(v=>validReasons.has(v))).map(r=>({...r,id:r.id||uid('rec_'),created_at:r.created_at||new Date().toISOString()}));
  const cleanExams=x.exams.filter(e=>e.name&&e.date).map(e=>({...e,id:e.id||uid('exam_')}));
  const preview=`모의고사 ${cleanExams.length}개 · 오답 기록 ${cleanRecords.length}개`;
  document.getElementById('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>백업 데이터 복원</h3><button class="close-btn" onclick="closeModal()">×</button></div><div class="notice">${preview}</div><div class="field" style="margin-top:14px"><button class="secondary-btn full" onclick="mergeRestore(${JSON.stringify({exams:cleanExams,records:cleanRecords}).replace(/</g,'\\u003c')})">기존 데이터를 유지하고 추가</button></div><div class="field"><button class="danger-btn full" onclick="replaceRestore(${JSON.stringify({exams:cleanExams,records:cleanRecords}).replace(/</g,'\\u003c')})">기존 데이터를 모두 지우고 복원</button></div></div></div>`;
}
function mergeRestore(x){
  const examKey=new Map(db.exams.map(e=>[`${e.name}|${e.date}`,e.id])); const idMap=new Map(); x.exams.forEach(e=>{ const k=`${e.name}|${e.date}`; if(!examKey.has(k)){ const id=uid('exam_'); db.exams.push({...e,id}); examKey.set(k,id); } idMap.set(e.id,examKey.get(k)); });
  let added=0; x.records.forEach(r=>{ const eid=idMap.get(r.exam_id); if(!eid)return; if(db.records.some(z=>z.exam_id===eid&&Number(z.question_number)===Number(r.question_number)))return; db.records.push({...r,id:uid('rec_'),exam_id:eid}); added++; }); saveDB();closeModal();toast(`${added}개 기록을 추가했습니다.`);render(); }
function replaceRestore(x){ if(!confirm('기존 오답 기록이 모두 삭제되고 백업 파일의 데이터로 교체됩니다.\n\n정말 복원할까요?'))return; db={exams:x.exams,records:x.records,settings:{...DEFAULT.settings,...db.settings}}; saveDB();closeModal();toast('백업 데이터로 복원했습니다.');render(); }
function resetData(){ if(!confirm('모의고사와 오답 기록을 포함한 모든 데이터가 삭제됩니다.\n\n이 작업은 되돌릴 수 없습니다.'))return; db=structuredClone(DEFAULT);saveDB();toast('모든 데이터를 삭제했습니다.');render(); }

function drawAllCharts(){ drawExamChart(); drawTopicOverview(); drawTopicTrend(); drawReasonTrend(); }
function setupCanvas(container){ const canvas=container?.querySelector('canvas'); if(!canvas)return null; const rect=canvas.getBoundingClientRect(); const dpr=devicePixelRatio||1; canvas.width=rect.width*dpr; canvas.height=rect.height*dpr; const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr); return {canvas,ctx,w:rect.width,h:rect.height,tooltip:container.querySelector('.tooltip-bubble')}; }
function baseChart(c){ c.ctx.clearRect(0,0,c.w,c.h); c.ctx.font='11px -apple-system, BlinkMacSystemFont, sans-serif'; c.ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--muted'); }
function chartLine(containerId, series, labels, formatter){ const c=setupCanvas(document.getElementById(containerId)); if(!c)return; baseChart(c); const {ctx,w,h}=c; const pad={l:34,r:12,t:20,b:30}; const pw=w-pad.l-pad.r, ph=h-pad.t-pad.b; const all=series.flatMap(s=>s.values); const max=Math.max(1,...all); const step=labels.length>1?pw/(labels.length-1):pw/2; const points=[];
  ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--line');ctx.lineWidth=1; for(let i=0;i<=4;i++){const y=pad.t+ph*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(String(Math.round(max*(4-i)/4)),4,y+4);}
  labels.forEach((lab,i)=>{const x=labels.length>1?pad.l+step*i:pad.l+pw/2;ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--muted');ctx.textAlign='center';ctx.fillText(lab,x,h-9);}); ctx.textAlign='left';
  series.forEach((s,si)=>{ctx.strokeStyle=s.color;ctx.lineWidth=2;ctx.beginPath();s.values.forEach((v,i)=>{const x=labels.length>1?pad.l+step*i:pad.l+pw/2;const y=pad.t+ph-(v/max)*ph;points.push({x,y,label:labels[i],series:s.name,value:v,color:s.color,container:c});if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();s.values.forEach((v,i)=>{const x=labels.length>1?pad.l+step*i:pad.l+pw/2;const y=pad.t+ph-(v/max)*ph;ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();});});
  const legendY=4; let lx=pad.l; series.forEach(s=>{ctx.fillStyle=s.color;ctx.fillRect(lx,legendY,10,3);ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--muted');ctx.fillText(s.name,lx+14,legendY+5);lx+=ctx.measureText(s.name).width+30;});
  c.canvas.onpointermove=(e)=>{const rect=c.canvas.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;let hit=null,min=12;points.forEach(p=>{const d=Math.hypot(p.x-x,p.y-y);if(d<min){min=d;hit=p;}});if(hit){c.tooltip.style.display='block';c.tooltip.style.left=hit.x+'px';c.tooltip.style.top=hit.y+'px';c.tooltip.textContent=`${hit.label} · ${hit.series}: ${formatter(hit.value)}`;}else c.tooltip.style.display='none';}; c.canvas.onpointerleave=()=>c.tooltip.style.display='none';
}
function drawExamChart(){ const exams=sortedExams(); const labels=exams.map(e=>e.name.length>8?e.name.slice(0,8)+'…':e.name); chartLine('chartExam',[{name:'전체 기록',color:'#3f4d3f',values:exams.map(e=>db.records.filter(r=>r.exam_id===e.id).length)}],labels,v=>`${v}개`); }
function drawTopicOverview(){ const container=document.getElementById('chartTopics'); const c=setupCanvas(container);if(!c)return;baseChart(c);const ctx=c.ctx,w=c.w,h=c.h;const data=TOPICS.map(t=>db.records.filter(r=>Number(r.topic_id)===t.id).length);const max=Math.max(1,...data);const pad={l:32,r:10,t:14,b:38};const pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;const bw=Math.max(8,pw/data.length*.58);ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--line');for(let i=0;i<=4;i++){const y=pad.t+ph*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--muted');ctx.fillText(String(Math.round(max*(4-i)/4)),4,y+4);}data.forEach((v,i)=>{const x=pad.l+(i+.5)*pw/data.length;const bh=(v/max)*ph;ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--accent');ctx.fillRect(x-bw/2,pad.t+ph-bh,bw,bh);ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--muted');ctx.textAlign='center';ctx.fillText(String(i+1),x,h-15);});ctx.textAlign='left';c.canvas.onpointermove=e=>{const rect=c.canvas.getBoundingClientRect();const x=e.clientX-rect.left;const i=Math.max(0,Math.min(data.length-1,Math.floor((x-pad.l)/(pw/data.length))));const center=pad.l+(i+.5)*pw/data.length;if(Math.abs(x-center)<pw/data.length*.7){c.tooltip.style.display='block';c.tooltip.style.left=center+'px';c.tooltip.style.top=(pad.t+ph-(data[i]/max)*ph)+'px';c.tooltip.textContent=`${String(i+1).padStart(2,'0')}. ${TOPICS[i].name}: ${data[i]}개`;}else c.tooltip.style.display='none';};c.canvas.onpointerleave=()=>c.tooltip.style.display='none'; }
function drawTopicTrend(){ const exams=sortedExams(); const labels=exams.map(e=>e.name.length>8?e.name.slice(0,8)+'…':e.name); const values=exams.map(e=>db.records.filter(r=>r.exam_id===e.id&&Number(r.topic_id)===selectedAnalysisTopic).length); chartLine('chartTopicTrend',[{name:topic(selectedAnalysisTopic).name,color:'#56789c',values}],labels,v=>`${v}개`); }
function drawReasonTrend(){ const exams=sortedExams(); const labels=exams.map(e=>e.name.length>8?e.name.slice(0,8)+'…':e.name); const rCounts=REASONS.filter(r=>r[0]!=='other').map(([id,name])=>({id,name,values:exams.map(e=>db.records.filter(x=>x.exam_id===e.id&&Number(x.topic_id)===selectedAnalysisTopic&&x.reasons.includes(id)).length)})).filter(s=>s.values.some(v=>v>0)).sort((a,b)=>b.values.reduce((x,y)=>x+y,0)-a.values.reduce((x,y)=>x+y,0)).slice(0,5); const colors=['#3f4d3f','#56789c','#a8842e','#b75a58','#77736b']; chartLine('chartReasonTrend',rCounts.map((s,i)=>({name:s.name,color:colors[i],values:s.values})),labels,v=>`${v}회`); }

// Navigation
for(const b of document.querySelectorAll('.nav-btn')) b.addEventListener('click',()=>{currentTab=b.dataset.tab;render();});
document.getElementById('headerAddBtn').addEventListener('click',()=>openRecordForm());
window.addEventListener('resize',()=>{if(currentTab==='analysis'&&analysisSub==='stats')drawAllCharts();});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>render());
Object.assign(window,{render,openRecordForm,openExamPicker,openNewExamDialog,selectExam,filterExamChoices,createExamInline,toggleOtherReason,submitRecord,openRecordDetail,deleteRecord,closeModal,backupData,restoreData,mergeRestore,replaceRestore,resetData,setTheme,saveGeminiApiKey,clearGeminiApiKey,toggleApiKeyVisibility,drawAllCharts});
render();
