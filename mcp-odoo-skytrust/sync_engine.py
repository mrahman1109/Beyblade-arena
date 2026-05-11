"""
Core sync logic shared between the webhook server and the scheduler.
Each function is idempotent — safe to call more than once for the same record.
"""
import logging
from datetime import datetime, timedelta

from odoo_client import OdooClient
from skytrust_client import SkytrustClient

log = logging.getLogger(__name__)

# Module-level singletons (initialised lazily)
_odoo: OdooClient | None = None
_st: SkytrustClient | None = None


def odoo() -> OdooClient:
    global _odoo
    if _odoo is None:
        _odoo = OdooClient()
    return _odoo


def st() -> SkytrustClient:
    global _st
    if _st is None:
        _st = SkytrustClient()
    return _st


# ── Helpers ───────────────────────────────────────────────────────────────────

def _st_email_index(page_size: int = 500) -> dict[str, dict]:
    """Return {email_lower: skytrust_employee} for all Skytrust employees."""
    employees = st().list_employees(page_size=page_size)
    return {e.get("email", "").lower(): e for e in employees if e.get("email")}


def _split_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split(" ", 1)
    return parts[0], parts[1] if len(parts) > 1 else ""


# ── Employee sync ─────────────────────────────────────────────────────────────

def push_employee_to_skytrust(odoo_employee: dict) -> dict:
    """
    Push a single Odoo employee dict into Skytrust.
    Creates the record if the email is new, updates it if it already exists.
    Returns {"action": "created"|"updated"|"skipped", "email": ...}
    """
    email = (odoo_employee.get("work_email") or "").lower()
    if not email:
        return {"action": "skipped", "reason": "no work_email"}

    first, last = _split_name(odoo_employee.get("name", ""))
    dept = ""
    if odoo_employee.get("department_id"):
        dept = odoo_employee["department_id"][1] if isinstance(odoo_employee["department_id"], list) else ""

    index = _st_email_index()

    if email in index:
        st_id = index[email].get("id")
        st().update_employee(str(st_id), {
            "firstName": first,
            "lastName": last,
            "position": odoo_employee.get("job_title", ""),
            "department": dept,
        })
        log.info("Updated Skytrust employee %s (%s)", st_id, email)
        return {"action": "updated", "email": email, "skytrust_id": st_id}
    else:
        result = st().create_employee(first, last, email,
                                      odoo_employee.get("job_title", ""), dept)
        log.info("Created Skytrust employee for %s", email)
        return {"action": "created", "email": email, "skytrust_id": result.get("id")}


def sync_all_employees() -> dict:
    """Full reconciliation: all active Odoo employees → Skytrust."""
    employees = odoo().list_employees(limit=1000)
    results = [push_employee_to_skytrust(e) for e in employees]
    summary = {"created": 0, "updated": 0, "skipped": 0}
    for r in results:
        summary[r["action"]] = summary.get(r["action"], 0) + 1
    log.info("Employee sync complete: %s", summary)
    return summary


# ── Timesheet sync ────────────────────────────────────────────────────────────

def sync_timesheets(date_from: str, date_to: str) -> dict:
    """Push Odoo timesheets for the given date range into Skytrust."""
    index = _st_email_index()
    all_ts = odoo().list_timesheets(limit=2000)
    in_range = [t for t in all_ts if date_from <= (t.get("date") or "") <= date_to]

    pushed, skipped = [], []
    for ts in in_range:
        emp_ref = ts.get("employee_id")
        if not emp_ref:
            skipped.append({"reason": "no employee_id", "ts": ts.get("id")})
            continue
        emp_id = emp_ref[0] if isinstance(emp_ref, list) else emp_ref
        emp = odoo().get_employee(emp_id)
        email = (emp.get("work_email") or "").lower()
        st_emp = index.get(email)
        if not st_emp:
            skipped.append({"reason": "employee not in Skytrust", "email": email})
            continue
        project_name = ""
        if ts.get("project_id"):
            project_name = ts["project_id"][1] if isinstance(ts["project_id"], list) else ""
        st().create_timesheet(str(st_emp["id"]), ts["date"],
                              ts["unit_amount"], project_name, ts.get("name", ""))
        pushed.append({"date": ts["date"], "hours": ts["unit_amount"], "email": email})

    log.info("Timesheet sync %s–%s: %d pushed, %d skipped", date_from, date_to,
             len(pushed), len(skipped))
    return {"pushed": pushed, "skipped": skipped}


def sync_timesheets_last_n_minutes(minutes: int = 10) -> dict:
    """Convenience wrapper used by the scheduler."""
    now = datetime.utcnow()
    date_from = (now - timedelta(minutes=minutes)).strftime("%Y-%m-%d")
    date_to = now.strftime("%Y-%m-%d")
    return sync_timesheets(date_from, date_to)


# ── WHS Incident sync (Skytrust → Odoo notes) ─────────────────────────────────

def sync_incidents_to_odoo_notes() -> dict:
    """
    Pull open Skytrust incidents and log them as Odoo project task notes.
    Matches on incident title — skips if a task with the same name exists.
    """
    incidents = st().list_incidents(status="Open", page_size=200)
    projects = odoo().list_projects(limit=10)
    # Use the first project as the WHS project, or skip if none
    if not projects:
        return {"skipped": "no Odoo projects found"}
    whs_project_id = projects[0]["id"]

    existing_tasks = odoo().list_tasks(project_id=whs_project_id, limit=500)
    existing_names = {t["name"].lower() for t in existing_tasks}

    created = []
    for inc in incidents:
        title = inc.get("title", "Untitled incident")
        if title.lower() in existing_names:
            continue
        desc = (f"Skytrust WHS Incident\n"
                f"Severity: {inc.get('severity', 'Unknown')}\n"
                f"Date: {inc.get('incidentDate', '')}\n"
                f"Location: {inc.get('location', '')}\n\n"
                f"{inc.get('description', '')}")
        odoo().create_task(title, whs_project_id, description=desc)
        created.append(title)
        existing_names.add(title.lower())

    log.info("Incident→Odoo sync: %d tasks created", len(created))
    return {"created_tasks": created}


# ── Attendance sync (Odoo → Skytrust HR records) ──────────────────────────────

def sync_attendance_to_skytrust(date: str) -> dict:
    """Push today's Odoo attendance check-ins as Skytrust HR records."""
    index = _st_email_index()
    records = odoo().list_attendance(limit=500)
    day_records = [r for r in records if (r.get("check_in") or "").startswith(date)]

    pushed = []
    for rec in day_records:
        emp_ref = rec.get("employee_id")
        if not emp_ref:
            continue
        emp_id = emp_ref[0] if isinstance(emp_ref, list) else emp_ref
        emp = odoo().get_employee(emp_id)
        email = (emp.get("work_email") or "").lower()
        st_emp = index.get(email)
        if not st_emp:
            continue
        st().create_hr_record(
            str(st_emp["id"]),
            record_type="Attendance",
            title=f"Attendance {date}",
            details={"checkIn": rec.get("check_in"), "checkOut": rec.get("check_out"),
                     "workedHours": rec.get("worked_hours")},
        )
        pushed.append(email)

    log.info("Attendance sync %s: %d records pushed", date, len(pushed))
    return {"date": date, "pushed": pushed}
