"""
APScheduler periodic sync jobs.
Handles the pull-based direction (Skytrust → Odoo) and catch-up syncs
for anything that missed a webhook.

Jobs:
  Every 5 min  — push recent Odoo timesheets to Skytrust (rolling window)
  Every 15 min — push today's Odoo attendance to Skytrust
  Every 1 hr   — full employee reconciliation (Odoo → Skytrust)
  Every 1 hr   — pull open Skytrust incidents → create Odoo tasks
"""
import logging
import os
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

import sync_engine

log = logging.getLogger("scheduler")

TIMESHEET_INTERVAL_MINUTES = int(os.getenv("TIMESHEET_SYNC_INTERVAL_MINUTES", "5"))
ATTENDANCE_INTERVAL_MINUTES = int(os.getenv("ATTENDANCE_SYNC_INTERVAL_MINUTES", "15"))
EMPLOYEE_INTERVAL_MINUTES = int(os.getenv("EMPLOYEE_SYNC_INTERVAL_MINUTES", "60"))
INCIDENT_INTERVAL_MINUTES = int(os.getenv("INCIDENT_SYNC_INTERVAL_MINUTES", "60"))


def _job_sync_timesheets() -> None:
    try:
        result = sync_engine.sync_timesheets_last_n_minutes(
            minutes=TIMESHEET_INTERVAL_MINUTES + 1  # +1 min overlap to avoid gaps
        )
        log.info("Scheduled timesheet sync: %d pushed, %d skipped",
                 len(result.get("pushed", [])), len(result.get("skipped", [])))
    except Exception:
        log.exception("Timesheet sync job failed")


def _job_sync_attendance() -> None:
    try:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        result = sync_engine.sync_attendance_to_skytrust(today)
        log.info("Scheduled attendance sync: %d records pushed", len(result.get("pushed", [])))
    except Exception:
        log.exception("Attendance sync job failed")


def _job_sync_employees() -> None:
    try:
        result = sync_engine.sync_all_employees()
        log.info("Scheduled employee sync: %s", result)
    except Exception:
        log.exception("Employee sync job failed")


def _job_sync_incidents() -> None:
    try:
        result = sync_engine.sync_incidents_to_odoo_notes()
        log.info("Scheduled incident sync: %s", result)
    except Exception:
        log.exception("Incident sync job failed")


def build_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone="UTC")

    scheduler.add_job(
        _job_sync_timesheets,
        trigger=IntervalTrigger(minutes=TIMESHEET_INTERVAL_MINUTES),
        id="sync_timesheets",
        name="Odoo timesheets → Skytrust",
        replace_existing=True,
    )
    scheduler.add_job(
        _job_sync_attendance,
        trigger=IntervalTrigger(minutes=ATTENDANCE_INTERVAL_MINUTES),
        id="sync_attendance",
        name="Odoo attendance → Skytrust",
        replace_existing=True,
    )
    scheduler.add_job(
        _job_sync_employees,
        trigger=IntervalTrigger(minutes=EMPLOYEE_INTERVAL_MINUTES),
        id="sync_employees",
        name="Full employee reconciliation",
        replace_existing=True,
    )
    scheduler.add_job(
        _job_sync_incidents,
        trigger=IntervalTrigger(minutes=INCIDENT_INTERVAL_MINUTES),
        id="sync_incidents",
        name="Skytrust incidents → Odoo tasks",
        replace_existing=True,
    )

    return scheduler


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    import time
    scheduler = build_scheduler()
    scheduler.start()
    log.info("Scheduler started. Jobs: %s", [j.name for j in scheduler.get_jobs()])
    try:
        while True:
            time.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        log.info("Scheduler stopped.")
