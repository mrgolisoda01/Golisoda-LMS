"""
============================================================
 Mr. Golisoda Training Portal — Python (Flask) Backend
============================================================
 Self-contained LMS backend. Uses:
   - Flask     -> web server / backend
   - SQLite    -> database (single file: golisoda.db)
   - Werkzeug  -> secure password hashing

 DELIVERY 1 UPGRADE (admin dashboard + employee management)
   - Dashboard stats (totals, completion rate, avg score)
   - Full employee list (name, emp_id, designation, phone, role, status)
   - Edit employee / change role / delete employee
   - Admin-driven password reset (temporary password)
   - Bulk add employees via CSV
   All EXISTING routes (signup, login, approve, scores) are unchanged.

 DEFAULT ADMIN LOGIN (change after first login)
   Employee ID:  ADMIN
   Password:     Golisoda@2026
============================================================
"""

import os
import io
import csv
import sqlite3
from datetime import datetime
from flask import (Flask, request, session, redirect, url_for,
                   render_template, jsonify, g)
from werkzeug.security import generate_password_hash, check_password_hash

# ---------------------------------------------------------------
#  Basic setup
# ---------------------------------------------------------------
app = Flask(__name__)
# IMPORTANT: change this secret to any long random string before going live
app.secret_key = "CHANGE-THIS-TO-A-LONG-RANDOM-SECRET-STRING-2026"

DB_PATH = os.path.join(os.path.dirname(__file__), "golisoda.db")

DEFAULT_ADMIN_ID = "ADMIN"
DEFAULT_ADMIN_PW = "Golisoda@2026"

# Roles allowed in the system
VALID_ROLES = ("staff", "instructor", "admin")


# ---------------------------------------------------------------
#  Database helpers
# ---------------------------------------------------------------
def get_db():
    """Open a database connection for this request."""
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()


_db_ready = False
@app.before_request
def _ensure_db():
    global _db_ready
    if not _db_ready:
        init_db()
        _db_ready = True


def _column_exists(db, table, column):
    cols = db.execute(f"PRAGMA table_info({table})").fetchall()
    return any(c[1] == column for c in cols)


def init_db():
    """Create tables and the default admin if they do not exist.
    Also safely adds any new columns to existing databases (migration)."""
    db = sqlite3.connect(DB_PATH)
    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            emp_id        TEXT UNIQUE NOT NULL,
            name          TEXT NOT NULL,
            phone         TEXT,
            designation   TEXT,
            password_hash TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT 'pending',
            role          TEXT NOT NULL DEFAULT 'staff',
            created_at    TEXT
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS scores (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            emp_id     TEXT NOT NULL,
            module_id  TEXT NOT NULL,
            set_no     INTEGER NOT NULL,
            score      INTEGER NOT NULL,
            total      INTEGER NOT NULL,
            percent    INTEGER NOT NULL,
            passed     INTEGER NOT NULL,
            taken_at   TEXT
        )
    """)

    # --- Safe migration: add columns that may not exist on older DBs ---
    if not _column_exists(db, "users", "must_reset"):
        db.execute("ALTER TABLE users ADD COLUMN must_reset INTEGER NOT NULL DEFAULT 0")
    if not _column_exists(db, "users", "last_login"):
        db.execute("ALTER TABLE users ADD COLUMN last_login TEXT")

    # Create default admin if not present
    cur = db.execute("SELECT 1 FROM users WHERE emp_id = ?", (DEFAULT_ADMIN_ID,))
    if cur.fetchone() is None:
        db.execute(
            "INSERT INTO users (emp_id,name,phone,designation,password_hash,status,role,created_at) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (DEFAULT_ADMIN_ID, "Administrator", "", "Management / Leadership",
             generate_password_hash(DEFAULT_ADMIN_PW), "approved", "admin",
             datetime.utcnow().isoformat())
        )
    db.commit()
    db.close()


# ---------------------------------------------------------------
#  Auth helpers
# ---------------------------------------------------------------
def current_user():
    if "emp_id" not in session:
        return None
    db = get_db()
    return db.execute("SELECT * FROM users WHERE emp_id = ?",
                      (session["emp_id"],)).fetchone()


def login_required(view):
    from functools import wraps
    @wraps(view)
    def wrapped(*a, **k):
        if current_user() is None:
            return redirect(url_for("login_page"))
        return view(*a, **k)
    return wrapped


def admin_required(view):
    from functools import wraps
    @wraps(view)
    def wrapped(*a, **k):
        u = current_user()
        if u is None or u["role"] != "admin":
            return redirect(url_for("login_page"))
        return view(*a, **k)
    return wrapped


# ---------------------------------------------------------------
#  Pages
# ---------------------------------------------------------------
@app.route("/")
def login_page():
    if current_user():
        return redirect(url_for("portal_page"))
    return render_template("login.html")


@app.route("/portal")
@login_required
def portal_page():
    return render_template("portal.html", user=current_user())


@app.route("/admin")
@admin_required
def admin_page():
    return render_template("admin.html", user=current_user())


# ---------------------------------------------------------------
#  API: signup / login / logout  (UNCHANGED behaviour)
# ---------------------------------------------------------------
@app.route("/api/signup", methods=["POST"])
def api_signup():
    d = request.get_json(force=True)
    name = (d.get("name") or "").strip()
    emp_id = (d.get("emp_id") or "").strip()
    phone = (d.get("phone") or "").strip()
    desg = (d.get("designation") or "").strip()
    pw = d.get("password") or ""

    if not all([name, emp_id, phone, desg, pw]):
        return jsonify(ok=False, msg="Please fill in all fields."), 400
    if len(pw) < 6:
        return jsonify(ok=False, msg="Password must be at least 6 characters."), 400

    db = get_db()
    exists = db.execute("SELECT 1 FROM users WHERE emp_id = ?", (emp_id,)).fetchone()
    if exists:
        return jsonify(ok=False, msg="This Employee ID is already registered. Try signing in."), 400

    db.execute(
        "INSERT INTO users (emp_id,name,phone,designation,password_hash,status,role,created_at) "
        "VALUES (?,?,?,?,?,?,?,?)",
        (emp_id, name, phone, desg, generate_password_hash(pw),
         "pending", "staff", datetime.utcnow().isoformat())
    )
    db.commit()
    return jsonify(ok=True, msg="Request submitted! An admin will approve your account shortly.")


@app.route("/api/login", methods=["POST"])
def api_login():
    d = request.get_json(force=True)
    emp_id = (d.get("emp_id") or "").strip()
    pw = d.get("password") or ""
    if not emp_id or not pw:
        return jsonify(ok=False, msg="Enter your Employee ID and password."), 400

    db = get_db()
    u = db.execute("SELECT * FROM users WHERE emp_id = ?", (emp_id,)).fetchone()
    if u is None or not check_password_hash(u["password_hash"], pw):
        return jsonify(ok=False, msg="Employee ID or password is incorrect."), 401
    if u["status"] == "pending":
        return jsonify(ok=False, msg="Your account is awaiting admin approval."), 403

    session["emp_id"] = u["emp_id"]
    # record last login time
    db.execute("UPDATE users SET last_login = ? WHERE emp_id = ?",
               (datetime.utcnow().isoformat(), u["emp_id"]))
    db.commit()
    dest = url_for("admin_page") if u["role"] == "admin" else url_for("portal_page")
    return jsonify(ok=True, redirect=dest)


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify(ok=True)


# ---------------------------------------------------------------
#  API: quiz score saving + progress  (UNCHANGED)
# ---------------------------------------------------------------
@app.route("/api/save-score", methods=["POST"])
@login_required
def api_save_score():
    d = request.get_json(force=True)
    u = current_user()
    score = int(d.get("score", 0))
    total = int(d.get("total", 0))
    percent = round((score / total) * 100) if total else 0
    passed = 1 if percent >= 90 else 0
    db = get_db()
    db.execute(
        "INSERT INTO scores (emp_id,module_id,set_no,score,total,percent,passed,taken_at) "
        "VALUES (?,?,?,?,?,?,?,?)",
        (u["emp_id"], d.get("module_id", ""), int(d.get("set_no", 1)),
         score, total, percent, passed, datetime.utcnow().isoformat())
    )
    db.commit()
    return jsonify(ok=True, percent=percent, passed=bool(passed))


@app.route("/api/my-progress")
@login_required
def api_my_progress():
    u = current_user()
    db = get_db()
    rows = db.execute(
        "SELECT module_id, MAX(percent) AS best, MAX(passed) AS passed "
        "FROM scores WHERE emp_id = ? GROUP BY module_id", (u["emp_id"],)
    ).fetchall()
    return jsonify(ok=True, progress={r["module_id"]: {"best": r["best"], "passed": bool(r["passed"])} for r in rows})


# ---------------------------------------------------------------
#  API: admin approve / reject  (UNCHANGED)
# ---------------------------------------------------------------
@app.route("/api/approve", methods=["POST"])
@admin_required
def api_approve():
    d = request.get_json(force=True)
    emp_id = (d.get("emp_id") or "").strip()
    db = get_db()
    db.execute("UPDATE users SET status='approved' WHERE emp_id = ?", (emp_id,))
    db.commit()
    return jsonify(ok=True)


@app.route("/api/reject", methods=["POST"])
@admin_required
def api_reject():
    d = request.get_json(force=True)
    emp_id = (d.get("emp_id") or "").strip()
    db = get_db()
    db.execute("DELETE FROM users WHERE emp_id = ? AND role != 'admin'", (emp_id,))
    db.commit()
    return jsonify(ok=True)


# ===============================================================
#  NEW — DELIVERY 1: Admin dashboard + employee management
# ===============================================================

@app.route("/api/admin/dashboard")
@admin_required
def api_admin_dashboard():
    """Stats for the dashboard home + full employee list."""
    db = get_db()

    total = db.execute("SELECT COUNT(*) c FROM users WHERE role != 'admin'").fetchone()["c"]
    pending = db.execute("SELECT COUNT(*) c FROM users WHERE status='pending'").fetchone()["c"]
    approved = db.execute("SELECT COUNT(*) c FROM users WHERE status='approved' AND role != 'admin'").fetchone()["c"]

    # learners who have passed at least one module / total approved learners
    passed_any = db.execute(
        "SELECT COUNT(DISTINCT emp_id) c FROM scores WHERE passed = 1"
    ).fetchone()["c"]
    completion = round((passed_any / approved) * 100) if approved else 0

    avg_row = db.execute("SELECT AVG(percent) a FROM scores").fetchone()
    avg_score = round(avg_row["a"]) if avg_row["a"] is not None else 0

    # full employee list (include admins too, marked, so all accounts are visible)
    rows = db.execute(
        "SELECT emp_id,name,phone,designation,role,status,created_at,last_login "
        "FROM users ORDER BY (status='pending') DESC, name"
    ).fetchall()
    employees = [dict(r) for r in rows]

    u = current_user()
    me = {
        "emp_id": u["emp_id"],
        "name": u["name"],
        "last_login": u["last_login"] if "last_login" in u.keys() else None,
    }

    return jsonify(
        ok=True,
        stats={"total": total, "pending": pending,
               "approved": approved, "completion": completion, "avg": avg_score},
        employees=employees,
        me=me,
    )


@app.route("/api/admin/update-user", methods=["POST"])
@admin_required
def api_admin_update_user():
    """Edit an employee's name, phone, designation, or role."""
    d = request.get_json(force=True)
    emp_id = (d.get("emp_id") or "").strip()
    if not emp_id:
        return jsonify(ok=False, msg="Missing employee ID."), 400

    db = get_db()
    target = db.execute("SELECT * FROM users WHERE emp_id = ?", (emp_id,)).fetchone()
    if target is None:
        return jsonify(ok=False, msg="Employee not found."), 404

    name = (d.get("name") or target["name"]).strip()
    phone = (d.get("phone") or target["phone"] or "").strip()
    desg = (d.get("designation") or target["designation"] or "").strip()
    role = (d.get("role") or target["role"]).strip()
    if role not in VALID_ROLES:
        return jsonify(ok=False, msg="Invalid role."), 400

    # Safety: never allow the last admin to be demoted (lockout protection)
    if target["role"] == "admin" and role != "admin":
        admin_count = db.execute("SELECT COUNT(*) c FROM users WHERE role='admin'").fetchone()["c"]
        if admin_count <= 1:
            return jsonify(ok=False, msg="Cannot change role: this is the only admin account."), 400

    db.execute("UPDATE users SET name=?, phone=?, designation=?, role=? WHERE emp_id=?",
               (name, phone, desg, role, emp_id))
    db.commit()
    return jsonify(ok=True, msg="Employee updated.")


@app.route("/api/admin/reset-password", methods=["POST"])
@admin_required
def api_admin_reset_password():
    """Admin sets a temporary password for an employee."""
    d = request.get_json(force=True)
    emp_id = (d.get("emp_id") or "").strip()
    new_pw = d.get("new_password") or ""
    if not emp_id or not new_pw:
        return jsonify(ok=False, msg="Missing employee ID or new password."), 400
    if len(new_pw) < 6:
        return jsonify(ok=False, msg="Temporary password must be at least 6 characters."), 400

    db = get_db()
    target = db.execute("SELECT 1 FROM users WHERE emp_id = ?", (emp_id,)).fetchone()
    if target is None:
        return jsonify(ok=False, msg="Employee not found."), 404

    db.execute("UPDATE users SET password_hash=?, must_reset=1 WHERE emp_id=?",
               (generate_password_hash(new_pw), emp_id))
    db.commit()
    return jsonify(ok=True, msg="Password reset. Share the temporary password with the employee.")


@app.route("/api/admin/delete-user", methods=["POST"])
@admin_required
def api_admin_delete_user():
    """Delete an employee (and their scores). Admin accounts are protected."""
    d = request.get_json(force=True)
    emp_id = (d.get("emp_id") or "").strip()
    if not emp_id:
        return jsonify(ok=False, msg="Missing employee ID."), 400

    db = get_db()
    target = db.execute("SELECT * FROM users WHERE emp_id = ?", (emp_id,)).fetchone()
    if target is None:
        return jsonify(ok=False, msg="Employee not found."), 404
    if target["role"] == "admin":
        return jsonify(ok=False, msg="Admin accounts cannot be deleted here."), 400

    db.execute("DELETE FROM users WHERE emp_id = ?", (emp_id,))
    db.execute("DELETE FROM scores WHERE emp_id = ?", (emp_id,))
    db.commit()
    return jsonify(ok=True, msg="Employee deleted.")


@app.route("/api/admin/bulk-add", methods=["POST"])
@admin_required
def api_admin_bulk_add():
    """Bulk add employees from CSV text.
    Expected columns: name, emp_id, phone, designation, password (optional).
    If password missing, a default is set and must_reset flagged."""
    d = request.get_json(force=True)
    csv_text = d.get("csv") or ""
    default_status = "approved" if d.get("auto_approve") else "pending"
    if not csv_text.strip():
        return jsonify(ok=False, msg="No CSV content received."), 400

    db = get_db()
    reader = csv.DictReader(io.StringIO(csv_text))
    added, skipped, errors = 0, 0, []

    for i, raw in enumerate(reader, start=2):
        row = { (k or "").strip().lower(): (v or "").strip() for k, v in raw.items() }
        name = row.get("name", "")
        emp_id = row.get("emp_id") or row.get("employee_id") or row.get("emp id", "")
        phone = row.get("phone", "")
        desg = row.get("designation") or row.get("role_title", "")
        pw = row.get("password", "") or "Golisoda@123"

        if not name or not emp_id:
            errors.append(f"Row {i}: missing name or emp_id")
            continue
        exists = db.execute("SELECT 1 FROM users WHERE emp_id = ?", (emp_id,)).fetchone()
        if exists:
            skipped += 1
            continue
        db.execute(
            "INSERT INTO users (emp_id,name,phone,designation,password_hash,status,role,created_at,must_reset) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (emp_id, name, phone, desg, generate_password_hash(pw),
             default_status, "staff", datetime.utcnow().isoformat(), 1)
        )
        added += 1

    db.commit()
    return jsonify(ok=True, added=added, skipped=skipped, errors=errors,
                   msg=f"Added {added}, skipped {skipped} (already existed).")


# ---------------------------------------------------------------
#  Start
# ---------------------------------------------------------------
init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
