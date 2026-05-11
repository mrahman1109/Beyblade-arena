"""
FastAPI webhook server — receives real-time events from Odoo and immediately
pushes changes to Skytrust.

Start: uvicorn webhook_server:app --host 0.0.0.0 --port 8000

Odoo setup (Settings → Technical → Webhooks  *or*  Automated Actions):
  URL : http://<your-server>:8000/webhooks/odoo/<model>
  Method : POST
  Secret header: X-Odoo-Webhook-Secret: <WEBHOOK_SECRET from .env>
"""
import hashlib
import hmac
import logging
import os
from datetime import datetime

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

import sync_engine

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("webhook")

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")

app = FastAPI(title="Odoo→Skytrust Live Sync", version="1.0.0")


# ── Security ──────────────────────────────────────────────────────────────────

def _verify_secret(provided: str | None) -> None:
    """Reject requests that don't carry the expected webhook secret."""
    if not WEBHOOK_SECRET:
        return  # secret not configured — skip check (dev mode)
    if not provided or not hmac.compare_digest(provided, WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid webhook secret")


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}


# ── Odoo webhook endpoints ────────────────────────────────────────────────────

@app.post("/webhooks/odoo/employee")
async def odoo_employee(
    request: Request,
    x_odoo_webhook_secret: str | None = Header(default=None),
):
    """
    Triggered by Odoo when an hr.employee record is created or updated.
    Expected payload: the employee record fields as a JSON object.
    """
    _verify_secret(x_odoo_webhook_secret)
    payload = await request.json()
    log.info("Employee webhook: %s", payload.get("name") or payload.get("id"))

    # Odoo Automated Actions send {"id": ..., "model": ..., "ids": [...]}
    # Odoo native Webhooks send the record fields directly.
    if "ids" in payload:
        # Automated Action style — fetch full record from Odoo
        for eid in payload["ids"]:
            emp = sync_engine.odoo().get_employee(eid)
            result = sync_engine.push_employee_to_skytrust(emp)
            log.info("Employee %s: %s", eid, result)
    else:
        # Native webhook style — payload IS the record
        result = sync_engine.push_employee_to_skytrust(payload)
        log.info("Employee webhook result: %s", result)

    return JSONResponse({"ok": True})


@app.post("/webhooks/odoo/timesheet")
async def odoo_timesheet(
    request: Request,
    x_odoo_webhook_secret: str | None = Header(default=None),
):
    """
    Triggered when an account.analytic.line (timesheet) is created/updated.
    """
    _verify_secret(x_odoo_webhook_secret)
    payload = await request.json()
    log.info("Timesheet webhook received")

    if "ids" in payload:
        ts_list = sync_engine.odoo().list_timesheets(limit=len(payload["ids"]))
        ts_list = [t for t in ts_list if t["id"] in payload["ids"]]
    else:
        ts_list = [payload]

    index = sync_engine._st_email_index()
    pushed = []
    for ts in ts_list:
        emp_ref = ts.get("employee_id")
        if not emp_ref:
            continue
        emp_id = emp_ref[0] if isinstance(emp_ref, list) else emp_ref
        emp = sync_engine.odoo().get_employee(emp_id)
        email = (emp.get("work_email") or "").lower()
        st_emp = index.get(email)
        if not st_emp:
            log.warning("Timesheet webhook: no Skytrust match for %s", email)
            continue
        project_name = ""
        if ts.get("project_id"):
            project_name = ts["project_id"][1] if isinstance(ts["project_id"], list) else ""
        sync_engine.st().create_timesheet(
            str(st_emp["id"]), ts["date"], ts["unit_amount"],
            project_name, ts.get("name", ""),
        )
        pushed.append(email)

    return JSONResponse({"ok": True, "pushed": pushed})


@app.post("/webhooks/odoo/task")
async def odoo_task(
    request: Request,
    x_odoo_webhook_secret: str | None = Header(default=None),
):
    """
    Triggered when a project.task is created or updated.
    Currently just acknowledges — extend to mirror tasks in Skytrust if needed.
    """
    _verify_secret(x_odoo_webhook_secret)
    payload = await request.json()
    log.info("Task webhook: %s", payload.get("name") or payload.get("ids"))
    return JSONResponse({"ok": True, "note": "task event received"})


@app.post("/webhooks/odoo/attendance")
async def odoo_attendance(
    request: Request,
    x_odoo_webhook_secret: str | None = Header(default=None),
):
    """
    Triggered when an hr.attendance record is created (check-in/out).
    Pushes the attendance record to Skytrust as an HR record.
    """
    _verify_secret(x_odoo_webhook_secret)
    payload = await request.json()
    log.info("Attendance webhook received")

    date = datetime.utcnow().strftime("%Y-%m-%d")
    result = sync_engine.sync_attendance_to_skytrust(date)
    return JSONResponse({"ok": True, "result": result})


@app.post("/webhooks/odoo/incident")
async def odoo_incident(
    request: Request,
    x_odoo_webhook_secret: str | None = Header(default=None),
):
    """
    Optional: if you manage WHS incidents in Odoo and want to mirror them
    to Skytrust. Payload should contain incident fields.
    """
    _verify_secret(x_odoo_webhook_secret)
    payload = await request.json()
    log.info("Incident webhook: %s", payload.get("name") or payload.get("ids"))
    # Extend here to push incidents into Skytrust
    return JSONResponse({"ok": True, "note": "incident event received"})
