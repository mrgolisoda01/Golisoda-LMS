/* ============================================================
   assess-admin.js — Admin Assessment management (Delivery 3)
   Loaded on the admin page. Adds the Assessments panel.
   ============================================================ */

let ASSESSMENTS = [];
let ROLE_CHOICES = [];

const $a = (id) => document.getElementById(id);

async function apiA(url, body){
  const opt = { method: body ? "POST" : "GET", headers:{ "Content-Type":"application/json" } };
  if(body) opt.body = JSON.stringify(body);
  const res = await fetch(url, opt);
  return res.json();
}

function toastA(msg){
  const t = document.getElementById("toast");
  if(!t){ alert(msg); return; }
  t.textContent = msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 3000);
}

async function loadAssessments(){
  const d = await apiA("/api/admin/assessments");
  if(!d.ok) return;
  ASSESSMENTS = d.assessments || [];
  ROLE_CHOICES = d.role_choices || [];
  renderAssessments();
  buildRoleChecks();
}

function buildRoleChecks(){
  const box = $a("roleChecks");
  if(!box) return;
  box.innerHTML = ROLE_CHOICES.map(r=>
    `<label style="display:inline-flex;align-items:center;gap:5px;margin:3px 10px 3px 0;font-size:13px">
       <input type="checkbox" class="roleck" value="${r}" style="width:auto"> ${r}
     </label>`
  ).join("");
}

function renderAssessments(){
  const box = $a("assessList");
  if(!box) return;
  if(ASSESSMENTS.length === 0){
    box.innerHTML = '<div class="empty">No assessments yet. Create one above.</div>';
    return;
  }
  box.innerHTML = ASSESSMENTS.map(a=>{
    const timer = a.time_limit > 0 ? a.time_limit + " min" : "Untimed";
    const status = a.active
      ? '<span class="pill p-approved">Active</span>'
      : '<span class="pill p-pending">Paused</span>';
    return `<div style="border:1px solid var(--mg-line);border-radius:10px;padding:14px;margin-bottom:10px;background:#fff">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;flex-wrap:wrap">
        <div>
          <div style="font-weight:700;font-size:15px">${escA(a.title)} ${status}</div>
          <div style="font-size:12px;color:var(--mg-muted);margin-top:3px">${escA(a.description||"")}</div>
          <div style="font-size:12px;color:var(--mg-muted);margin-top:6px">
            For: <b>${escA(a.roles)}</b> · Pool: <b>${a.question_count}</b> Qs · Each learner gets: <b>${a.num_questions}</b> ·
            Pass: <b>${a.pass_percent}%</b> · ${timer} · Attempts: <b>${a.attempt_count}</b>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn" onclick="viewResults(${a.id},'${escA(a.title)}')">Results</button>
          <button class="btn" onclick="toggleAssess(${a.id})">${a.active?"Pause":"Activate"}</button>
          <button class="btn" onclick="deleteAssess(${a.id})" style="color:var(--mg-red)">Delete</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

function escA(s){ return String(s||"").replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }

async function createAssessment(){
  const title = $a("asTitle").value.trim();
  const desc = $a("asDesc").value.trim();
  const csv = $a("asCsv").value;
  const num = $a("asNum").value;
  const pass = $a("asPass").value;
  const timed = $a("asTimed").checked;
  const tlimit = timed ? ($a("asTime").value || 0) : 0;

  const checked = Array.from(document.querySelectorAll(".roleck:checked")).map(c=>c.value);
  const roles = checked.length ? checked.join(",") : "all";

  if(!title){ toastA("Give the assessment a title."); return; }
  if(!csv.trim()){ toastA("Paste your question CSV."); return; }

  const r = await apiA("/api/admin/create-assessment", {
    title, description: desc, roles,
    num_questions: num, pass_percent: pass, time_limit: tlimit, csv
  });
  if(r.ok){
    let m = r.msg;
    if(r.errors && r.errors.length) m += " — " + r.errors.length + " row(s) skipped";
    toastA(m);
    // clear form
    $a("asTitle").value=""; $a("asDesc").value=""; $a("asCsv").value="";
    document.querySelectorAll(".roleck:checked").forEach(c=>c.checked=false);
    loadAssessments();
  } else {
    let m = r.msg || "Could not create.";
    if(r.errors && r.errors.length) m += "\n" + r.errors.slice(0,5).join("\n");
    toastA(m);
  }
}

async function toggleAssess(id){
  const r = await apiA("/api/admin/toggle-assessment", { id });
  if(r.ok){ toastA(r.active?"Activated":"Paused"); loadAssessments(); }
}
async function deleteAssess(id){
  if(!confirm("Delete this assessment, its questions, and all results? This cannot be undone.")) return;
  const r = await apiA("/api/admin/delete-assessment", { id });
  if(r.ok){ toastA("Deleted."); loadAssessments(); }
}

async function viewResults(id, title){
  const d = await apiA("/api/admin/assessment-results?id=" + id);
  if(!d.ok) return;
  const rows = d.results || [];
  window._lastResults = { title, rows };
  const box = $a("resultsBox");
  if(rows.length === 0){
    box.innerHTML = `<h3 style="margin-top:0">${escA(title)} — Results</h3><div class="empty">No attempts yet.</div>`;
  } else {
    box.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
         <h3 style="margin:0">${escA(title)} — Results (${rows.length})</h3>
         <button class="btn primary" onclick="exportResults()">⬇ Export CSV</button>
       </div>
       <div class="tbl-wrap" style="margin-top:10px">
        <table><thead><tr><th>Name</th><th>Emp ID</th><th>Designation</th><th>Score</th><th>Result</th><th>Date</th></tr></thead>
        <tbody>` +
        rows.map(x=>`<tr>
          <td>${escA(x.name||"")}</td><td>${escA(x.emp_id)}</td><td>${escA(x.designation||"")}</td>
          <td>${x.percent}% (${x.score}/${x.total})</td>
          <td>${x.passed?'<span class="pill p-approved">Pass</span>':'<span class="pill p-pending">Fail</span>'}</td>
          <td style="font-size:12px;color:var(--mg-muted)">${fmtA(x.taken_at)}</td>
        </tr>`).join("") +
        `</tbody></table></div>`;
  }
  $a("resultsOv").classList.add("show");
}

function fmtA(iso){ if(!iso) return ""; try{ return new Date(iso+(iso.endsWith("Z")?"":"Z")).toLocaleString(); }catch(e){ return iso; } }

function exportResults(){
  const data = window._lastResults;
  if(!data) return;
  let csv = "Name,Emp ID,Designation,Score %,Correct,Total,Result,Date\n";
  data.rows.forEach(x=>{
    csv += `"${(x.name||"").replace(/"/g,'""')}","${x.emp_id}","${(x.designation||"").replace(/"/g,'""')}",${x.percent},${x.score},${x.total},${x.passed?"Pass":"Fail"},"${fmtA(x.taken_at)}"\n`;
  });
  const blob = new Blob([csv], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = (data.title||"results").replace(/[^a-z0-9]/gi,"_") + ".csv";
  a.click(); URL.revokeObjectURL(url);
}

/* timer toggle show/hide */
function onTimedToggle(){
  const wrap = $a("asTimeWrap");
  if(wrap) wrap.style.display = $a("asTimed").checked ? "block" : "none";
}
