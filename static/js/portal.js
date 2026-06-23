/* ============================================================
   portal.js — runs the learner experience
   - Shows Induction modules in order
   - Sequential lock: must PASS (>=90%) to unlock the next module
   - Plays slides, then a shuffled quiz
   - Saves each attempt to the Python backend (/api/save-score)
   ============================================================ */

const PASS = 90;                  // pass percentage
let progress = {};                // {moduleId: {best, passed}}
let cur = null;                   // current module being viewed
let slideIdx = 0;

const $ = id => document.getElementById(id);

/* ---- shuffle helper (anti-cheat: order changes each load) ---- */
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

/* ---- load progress from backend, then draw the grid ---- */
async function boot(){
  try{
    const res = await fetch('/api/my-progress');
    const body = await res.json();
    progress = (body && body.progress) || {};
  }catch(e){ progress = {}; }
  drawGrid();
}

function isUnlocked(i){
  if(i===0) return true;                       // first module always open
  const prev = INDUCTION[i-1];
  return progress[prev.id] && progress[prev.id].passed;   // need previous passed
}

function drawGrid(){
  const grid = $('ind-grid');
  grid.innerHTML = '';
  INDUCTION.forEach((m, i)=>{
    const unlocked = isUnlocked(i);
    const done = progress[m.id] && progress[m.id].passed;
    const card = document.createElement('div');
    card.className = 'mod ' + (unlocked ? 'open' : 'locked');
    card.innerHTML = `
      <div class="num">${m.num}</div>
      <h3>${m.title}</h3>
      <p>${m.summary}</p>
      ${ done ? '<span class="badge b-done">✓ Passed</span>'
              : unlocked ? '<span class="badge b-open">Start ›</span>'
                         : '<span class="badge b-lock">🔒 Locked</span>' }
      ${ unlocked ? '' : '<div class="lockicon">🔒</div>' }
    `;
    if(unlocked) card.onclick = ()=> openModule(m);
    grid.appendChild(card);
  });
}

/* ---------- slides ---------- */
function openModule(m){
  cur = m; slideIdx = 0;
  $('p-home').classList.add('hide');
  $('p-quiz').classList.add('hide');
  $('p-view').classList.remove('hide');
  drawSlide();
}

function drawSlide(){
  const s = cur.slides[slideIdx];
  const last = slideIdx === cur.slides.length - 1;
  $('slidearea').innerHTML = `
    <div class="slide">
      <div class="eye">${s.eye}</div>
      <h2>${s.h}</h2>
      <p>${s.body}</p>
      ${ s.bullets ? '<ul>'+s.bullets.map(b=>`<li>${b}</li>`).join('')+'</ul>' : '' }
      <div class="qrow">
        <button class="btn btn-sec" onclick="prevSlide()" ${slideIdx===0?'style="visibility:hidden"':''}>‹ Previous</button>
        <button class="btn btn-pri" onclick="${ last ? 'startQuiz()' : 'nextSlide()' }">
          ${ last ? 'Take Assessment ›' : 'Next ›' }
        </button>
      </div>
      <div style="text-align:center;margin-top:14px;font-size:12px;color:var(--muted)">
        Slide ${slideIdx+1} of ${cur.slides.length}
      </div>
    </div>`;
}
function nextSlide(){ if(slideIdx<cur.slides.length-1){slideIdx++; drawSlide();} }
function prevSlide(){ if(slideIdx>0){slideIdx--; drawSlide();} }

/* ---------- quiz ---------- */
let quizQs = [];      // shuffled questions for this attempt
let answers = {};     // {questionIndex: selectedOptionIndex}

function startQuiz(){
  // shuffle questions AND each question's options (anti-cheat)
  quizQs = shuffle(cur.quiz).map(q=>{
    const opts = q.options.map((text,idx)=>({text, correct: idx===q.answer}));
    return { q:q.q, options: shuffle(opts) };
  });
  answers = {};
  $('p-view').classList.add('hide');
  $('p-quiz').classList.remove('hide');
  drawQuiz();
}

function drawQuiz(){
  let html = `<h2 style="margin:4px 0 4px">${cur.title} — Assessment</h2>
    <p style="color:var(--muted);font-size:14px;margin:0 0 16px">
      Answer all questions. You need ${PASS}% to pass and unlock the next module.</p>`;
  quizQs.forEach((q, qi)=>{
    html += `<div class="q"><h4>${qi+1}. ${q.q}</h4>`;
    q.options.forEach((o, oi)=>{
      const sel = answers[qi]===oi ? 'sel' : '';
      html += `<label class="opt ${sel}" onclick="pick(${qi},${oi})">${o.text}</label>`;
    });
    html += `</div>`;
  });
  html += `<button class="btn btn-pri" style="width:100%;margin-top:6px" onclick="submitQuiz()">Submit Assessment</button>`;
  $('quizarea').innerHTML = html;
}

function pick(qi, oi){ answers[qi]=oi; drawQuiz(); }

async function submitQuiz(){
  if(Object.keys(answers).length < quizQs.length){
    alert('Please answer all questions before submitting.'); return;
  }
  let correct = 0;
  quizQs.forEach((q, qi)=>{ if(q.options[answers[qi]].correct) correct++; });
  const total = quizQs.length;
  const percent = Math.round((correct/total)*100);
  const passed = percent >= PASS;

  // save to backend
  try{
    await fetch('/api/save-score', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ module_id: cur.id, set_no:1, score: correct, total })
    });
  }catch(e){ /* keep going even if save fails */ }

  if(passed){
    progress[cur.id] = { best: percent, passed: true };
  }

  $('quizarea').innerHTML = `
    <div class="result">
      <div class="big ${passed?'pass':'fail'}">${percent}%</div>
      <h2 style="margin:6px 0">${passed ? 'Passed! 🎉' : 'Not passed yet'}</h2>
      <p style="color:var(--muted)">You answered ${correct} of ${total} correctly.
         ${ passed ? 'The next module is now unlocked.' : `You need ${PASS}% to pass. Review the slides and try again.` }</p>
      <div style="margin-top:18px;display:flex;gap:10px;justify-content:center">
        ${ passed ? '' : '<button class="btn btn-sec" onclick="openModule(cur)">Review &amp; Retry</button>' }
        <button class="btn btn-pri" onclick="goHome()">Back to Modules</button>
      </div>
    </div>`;
}

/* ---------- navigation ---------- */
function goHome(){
  $('p-view').classList.add('hide');
  $('p-quiz').classList.add('hide');
  $('p-home').classList.remove('hide');
  drawGrid();
}

async function doSignOut(){
  try{ await fetch('/api/logout', {method:'POST'}); }catch(e){}
  location.href = '/';
}

/* start */
boot();
