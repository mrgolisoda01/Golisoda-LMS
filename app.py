"""
============================================================
 Mr. Golisoda Training Portal — Python (Flask) Backend
============================================================
 This is a self-contained version of the LMS portal that runs
 on ANY normal server (no Firebase needed). It uses:
   - Flask        -> the web server / backend
   - SQLite       -> the database (a single file: golisoda.db)
   - Werkzeug     -> secure password hashing

 WHAT IT DOES
   - New joiners sign up  -> saved as "pending"
   - Admin approves them  -> they can then log in
   - Staff log in with Employee ID + password
   - Induction modules + 90%-pass quizzes, sequential unlock
   - Scores saved to the database
   - Simple admin page to approve users and see progress

 HOW TO RUN (your colleague will know this)
   1. Install Python 3.10+  (https://python.org)
   2. In this folder, run:   pip install -r requirements.txt
   3. Then run:              python app.py
   4. Open browser at:       http://localhost:5000
   The database file (golisoda.db) is created automatically.

 DEFAULT ADMIN LOGIN (change after first login)
   Employee ID:  ADMIN
   Password:     Golisoda@2026
============================================================
"""

import os
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


def init_db():
    """Create tables and the default admin if they do not exist."""
    db = sqlite3.connect(DB_PATH)
    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            emp_id        TEXT UNIQUE NOT NULL,
            name          TEXT NOT NULL,
            phone         TEXT,
            designation   TEXT,
            password_hash TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT 'pending',   -- pending / approved
            role          TEXT NOT NULL DEFAULT 'staff',     -- staff / admin
            created_at    TEXT
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS scores (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            emp_id     TEXT NOT NULL,
            module_id  TEXT NOT NULL,
            set_no     INTEGER NOT NULL,
            score      INTEGER NOT NULL,    -- correct answers
            total      INTEGER NOT NULL,    -- total questions
            percent    INTEGER NOT NULL,
            passed     INTEGER NOT NULL,    -- 1 = pass, 0 = fail
            taken_at   TEXT
        )
    """)
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
    db = get_db()
    pending = db.execute("SELECT * FROM users WHERE status='pending' ORDER BY created_at").fetchall()
    approved = db.execute("SELECT * FROM users WHERE status='approved' AND role='staff' ORDER BY name").fetchall()
    return render_template("admin.html", pending=pending, approved=approved, user=current_user())


# ---------------------------------------------------------------
#  API: signup / login / logout
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
    dest = url_for("admin_page") if u["role"] == "admin" else url_for("portal_page")
    return jsonify(ok=True, redirect=dest)


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify(ok=True)


# ---------------------------------------------------------------
#  API: quiz score saving + progress
# ---------------------------------------------------------------
@app.route("/api/save-score", methods=["POST"])
@login_required
def api_save_score():
    d = request.get_json(force=True)
    u = current_user()
    score = int(d.get("score", 0))
    total = int(d.get("total", 0))
    percent = round((score / total) * 100) if total else 0
    passed = 1 if percent >= 90 else 0   # 90% pass rule
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
#  API: admin approve / progress
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
    db.execute("DELETE FROM users WHERE emp_id = ? AND role='staff'", (emp_id,))
    db.commit()
    return jsonify(ok=True)


# ---------------------------------------------------------------
#  Start
# ---------------------------------------------------------------
if __name__ == "__main__":
    init_db()
    # host=0.0.0.0 lets other devices on the network reach it too
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
