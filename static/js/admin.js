/* ============================================================
   admin.js — approve / reject pending users
   ============================================================ */

async function approve(empId){
  const res = await fetch('/api/approve', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({emp_id: empId})
  });
  if(res.ok){
    const row = document.getElementById('row-'+empId);
    if(row) row.remove();
  }else{
    alert('Could not approve. Please try again.');
  }
}

async function reject(empId){
  if(!confirm('Reject and remove this sign-up request?')) return;
  const res = await fetch('/api/reject', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({emp_id: empId})
  });
  if(res.ok){
    const row = document.getElementById('row-'+empId);
    if(row) row.remove();
  }else{
    alert('Could not reject. Please try again.');
  }
}

async function doSignOut(){
  try{ await fetch('/api/logout', {method:'POST'}); }catch(e){}
  location.href = '/';
}
