/* ============================================================
   content-admin.js — Admin/Instructor content management (Delivery 2)
   Manages Induction modules, Training modules, and Videos.
   Files are stored on Google Drive — admin pastes the link.
   ============================================================ */

let C_MODULES = [], C_VIDEOS = [], C_ROLES = [], C_ISADMIN = true;
let EDIT_MOD = null, EDIT_VID = null;

const $c = (id) => document.getElementById(id);

async function apiC(url, body){
  const opt = { method: body ? "POST" : "GET", headers:{ "Content-Type":"application/json" } };
  if(body) opt.body = JSON.stringify(body);
  return (await fetch(url, opt)).json();
}
function toastC(m){ const t=document.getElementById("toast"); if(!t){alert(m);return;} t.textContent=m; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),3000); }
function escC(s){ return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

async function loadContent(){
  const d = await apiC("/api/admin/modules");
  if(!d.ok){ toastC("Not allowed."); return; }
  C_MODULES = d.modules || []; C_VIDEOS = d.videos || [];
  C_ROLES = d.role_choices || []; C_ISADMIN = d.is_admin;
  renderInduction(); renderTraining(); renderVideos();
  buildContentRoleChecks();
}

function buildContentRoleChecks(){
  ["mRoleChecks"].forEach(boxId=>{
    const box = $c(boxId); if(!box) return;
    box.innerHTML = C_ROLES.map(r=>
      `<label style="display:inline-flex;align-items:center;gap:5px;margin:3px 10px 3px 0;font-size:13px">
         <input type="checkbox" class="mroleck" value="${r}" style="width:auto"> ${r}</label>`).join("");
  });
}

function moduleRow(m){
  const statusPill = m.status === "live"
    ? '<span class="pill p-approved">Live</span>'
    : '<span class="pill p-pending">Pending approval</span>';
  const approveBtn = (m.status !== "live" && C_ISADMIN)
    ? `<button class="btn" onclick="approveModule(${m.id})" style="color:var(--mg-green)">Approve</button>` : "";
  return `<div style="border:1px solid var(--mg-line);border-radius:10px;padding:13px;margin-bottom:10px;background:#fff">
    <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;flex-wrap:wrap">
      <div>
        <div style="font-weight:700">${escC(m.title)} ${statusPill}</div>
        <div style="font-size:12px;color:var(--mg-muted);margin-top:3px">${escC(m.description||"")}</div>
        <div style="font-size:12px;color:var(--mg-muted);margin-top:5px">
          ${(m.file_type||"file").toUpperCase()} · For: <b>${escC(m.roles)}</b> · Min time: <b>${m.min_minutes} min</b> · Order: ${m.sort_order}
        </div>
        <a href="${escC(m.link)}" target="_blank" style="font-size:12px;color:var(--mg-blue)">Open link ↗</a>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${approveBtn}
        <button class="btn" onclick="editModule(${m.id})">Edit</button>
        <button class="btn" onclick="deleteModule(${m.id})" style="color:var(--mg-red)">Delete</button>
      </div>
    </div></div>`;
}

function renderInduction(){
  const box = $c("indList"); if(!box) return;
  const list = C_MODULES.filter(m=>m.kind==="induction");
  box.innerHTML = list.length ? list.map(moduleRow).join("") : '<div class="empty">No induction modules yet.</div>';
}
function renderTraining(){
  const box = $c("trnList"); if(!box) return;
  const list = C_MODULES.filter(m=>m.kind==="training");
  box.innerHTML = list.length ? list.map(moduleRow).join("") : '<div class="empty">No training modules yet.</div>';
}
function renderVideos(){
  const box = $c("vidList"); if(!box) return;
  box.innerHTML = C_VIDEOS.length ? C_VIDEOS.map(v=>{
    const statusPill = v.status === "live" ? '<span class="pill p-approved">Live</span>' : '<span class="pill p-pending">Pending</span>';
    const approveBtn = (v.status !== "live" && C_ISADMIN) ? `<button class="btn" onclick="approveVideo(${v.id})" style="color:var(--mg-green)">Approve</button>` : "";
    return `<div style="border:1px solid var(--mg-line);border-radius:10px;padding:13px;margin-bottom:10px;background:#fff">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;flex-wrap:wrap">
        <div><div style="font-weight:700">🎥 ${escC(v.title)} ${statusPill}</div>
          <div style="font-size:12px;color:var(--mg-muted);margin-top:3px">${escC(v.description||"")}</div>
          <div style="font-size:12px;color:var(--mg-muted);margin-top:4px">For: <b>${escC(v.roles)}</b></div>
          <a href="${escC(v.link)}" target="_blank" style="font-size:12px;color:var(--mg-blue)">Open video ↗</a></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${approveBtn}
          <button class="btn" onclick="editVideo(${v.id})">Edit</button>
          <button class="btn" onclick="deleteVideo(${v.id})" style="color:var(--mg-red)">Delete</button></div>
      </div></div>`;
  }).join("") : '<div class="empty">No videos yet.</div>';
}

/* ---- module modal ---- */
function openModuleForm(kind){
  EDIT_MOD = null;
  $c("mFormTitle").textContent = "Add " + (kind==="training"?"training":"induction") + " module";
  $c("mKind").value = kind;
  $c("mTitle").value=""; $c("mDesc").value=""; $c("mLink").value="";
  $c("mType").value="pdf"; $c("mMins").value="5"; $c("mOrder").value="1";
  document.querySelectorAll(".mroleck").forEach(c=>c.checked=false);
  $c("moduleOv").classList.add("show");
}
function editModule(id){
  const m = C_MODULES.find(x=>x.id===id); if(!m) return;
  EDIT_MOD = id;
  $c("mFormTitle").textContent = "Edit module";
  $c("mKind").value = m.kind;
  $c("mTitle").value = m.title; $c("mDesc").value = m.description||"";
  $c("mLink").value = m.link; $c("mType").value = m.file_type||"pdf";
  $c("mMins").value = m.min_minutes; $c("mOrder").value = m.sort_order;
  const checked = (m.roles||"all").split(",").map(s=>s.trim().toLowerCase());
  document.querySelectorAll(".mroleck").forEach(c=>{ c.checked = checked.includes(c.value.toLowerCase()); });
  $c("moduleOv").classList.add("show");
}
async function saveModule(){
  const checked = Array.from(document.querySelectorAll(".mroleck:checked")).map(c=>c.value);
  const roles = checked.length ? checked.join(",") : "all";
  const body = {
    id: EDIT_MOD, kind: $c("mKind").value,
    title: $c("mTitle").value.trim(), description: $c("mDesc").value.trim(),
    link: $c("mLink").value.trim(), file_type: $c("mType").value,
    min_minutes: $c("mMins").value, roles, sort_order: $c("mOrder").value
  };
  if(!body.title || !body.link){ toastC("Title and link are required."); return; }
  const r = await apiC("/api/admin/save-module", body);
  if(r.ok){ $c("moduleOv").classList.remove("show"); toastC(r.msg); loadContent(); }
  else toastC(r.msg||"Could not save.");
}
async function approveModule(id){ const r=await apiC("/api/admin/approve-module",{id}); if(r.ok){toastC(r.msg);loadContent();} }
async function deleteModule(id){ if(!confirm("Delete this module?"))return; const r=await apiC("/api/admin/delete-module",{id}); if(r.ok){toastC("Deleted.");loadContent();} }

/* ---- video modal ---- */
function openVideoForm(){
  EDIT_VID = null;
  $c("vFormTitle").textContent = "Add video";
  $c("vTitle").value=""; $c("vDesc").value=""; $c("vLink").value=""; $c("vOrder").value="1";
  document.querySelectorAll(".vroleck").forEach(c=>c.checked=false);
  $c("videoOv").classList.add("show");
}
function editVideo(id){
  const v = C_VIDEOS.find(x=>x.id===id); if(!v) return;
  EDIT_VID = id; $c("vFormTitle").textContent="Edit video";
  $c("vTitle").value=v.title; $c("vDesc").value=v.description||""; $c("vLink").value=v.link; $c("vOrder").value=v.sort_order;
  const checked = (v.roles||"all").split(",").map(s=>s.trim().toLowerCase());
  document.querySelectorAll(".vroleck").forEach(c=>{ c.checked = checked.includes(c.value.toLowerCase()); });
  $c("videoOv").classList.add("show");
}
async function saveVideo(){
  const checked = Array.from(document.querySelectorAll(".vroleck:checked")).map(c=>c.value);
  const roles = checked.length ? checked.join(",") : "all";
  const body = { id: EDIT_VID, title: $c("vTitle").value.trim(), description: $c("vDesc").value.trim(),
                 link: $c("vLink").value.trim(), roles, sort_order: $c("vOrder").value };
  if(!body.title || !body.link){ toastC("Title and link are required."); return; }
  const r = await apiC("/api/admin/save-video", body);
  if(r.ok){ $c("videoOv").classList.remove("show"); toastC(r.msg); loadContent(); }
  else toastC(r.msg||"Could not save.");
}
async function approveVideo(id){ const r=await apiC("/api/admin/approve-video",{id}); if(r.ok){toastC("Approved.");loadContent();} }
async function deleteVideo(id){ if(!confirm("Delete this video?"))return; const r=await apiC("/api/admin/delete-video",{id}); if(r.ok){toastC("Deleted.");loadContent();} }

function buildVideoRoleChecks(){
  const box = $c("vRoleChecks"); if(!box) return;
  box.innerHTML = C_ROLES.map(r=>`<label style="display:inline-flex;align-items:center;gap:5px;margin:3px 10px 3px 0;font-size:13px"><input type="checkbox" class="vroleck" value="${r}" style="width:auto"> ${r}</label>`).join("");
}
