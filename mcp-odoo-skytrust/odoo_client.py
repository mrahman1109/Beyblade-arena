"""
Odoo Online client using the JSON-RPC API.
Docs: https://www.odoo.com/documentation/17.0/developer/reference/external_api.html
"""
import xmlrpc.client
from typing import Any
from config import OdooConfig


class OdooClient:
    def __init__(self) -> None:
        OdooConfig.validate()
        self._url = OdooConfig.url.rstrip("/")
        self._db = OdooConfig.db
        self._username = OdooConfig.username
        self._api_key = OdooConfig.api_key
        self._uid: int | None = None

        common = xmlrpc.client.ServerProxy(f"{self._url}/xmlrpc/2/common")
        self._uid = common.authenticate(self._db, self._username, self._api_key, {})
        if not self._uid:
            raise ConnectionError("Odoo authentication failed — check ODOO_USERNAME and ODOO_API_KEY.")
        self._models = xmlrpc.client.ServerProxy(f"{self._url}/xmlrpc/2/object")

    def _call(self, model: str, method: str, args: list, kwargs: dict | None = None) -> Any:
        return self._models.execute_kw(
            self._db, self._uid, self._api_key,
            model, method, args, kwargs or {}
        )

    # ── Employees ────────────────────────────────────────────────────────────

    def list_employees(self, limit: int = 100) -> list[dict]:
        fields = ["id", "name", "job_title", "department_id", "work_email",
                  "work_phone", "active", "employee_type"]
        return self._call("hr.employee", "search_read", [[["active", "=", True]]],
                          {"fields": fields, "limit": limit})

    def get_employee(self, employee_id: int) -> dict:
        records = self._call("hr.employee", "read", [[employee_id]],
                             {"fields": ["id", "name", "job_title", "department_id",
                                         "work_email", "work_phone", "active",
                                         "employee_type", "birthday", "country_id"]})
        return records[0] if records else {}

    def create_employee(self, name: str, job_title: str = "", work_email: str = "",
                        department_id: int | None = None) -> int:
        vals: dict[str, Any] = {"name": name}
        if job_title:
            vals["job_title"] = job_title
        if work_email:
            vals["work_email"] = work_email
        if department_id:
            vals["department_id"] = department_id
        return self._call("hr.employee", "create", [vals])

    def update_employee(self, employee_id: int, vals: dict) -> bool:
        return self._call("hr.employee", "write", [[employee_id], vals])

    # ── Projects & Tasks ─────────────────────────────────────────────────────

    def list_projects(self, limit: int = 50) -> list[dict]:
        fields = ["id", "name", "description", "partner_id", "date_start",
                  "date", "user_id", "tag_ids", "task_count"]
        return self._call("project.project", "search_read", [[["active", "=", True]]],
                          {"fields": fields, "limit": limit})

    def get_project(self, project_id: int) -> dict:
        records = self._call("project.project", "read", [[project_id]],
                             {"fields": ["id", "name", "description", "partner_id",
                                         "date_start", "date", "user_id", "task_count"]})
        return records[0] if records else {}

    def list_tasks(self, project_id: int | None = None, limit: int = 100) -> list[dict]:
        domain: list = []
        if project_id:
            domain.append(["project_id", "=", project_id])
        fields = ["id", "name", "project_id", "user_ids", "stage_id",
                  "priority", "date_deadline", "description", "tag_ids"]
        return self._call("project.task", "search_read", [domain],
                          {"fields": fields, "limit": limit})

    def create_task(self, name: str, project_id: int, description: str = "",
                    deadline: str = "", user_ids: list[int] | None = None) -> int:
        vals: dict[str, Any] = {"name": name, "project_id": project_id}
        if description:
            vals["description"] = description
        if deadline:
            vals["date_deadline"] = deadline
        if user_ids:
            vals["user_ids"] = [(6, 0, user_ids)]
        return self._call("project.task", "create", [vals])

    def update_task(self, task_id: int, vals: dict) -> bool:
        return self._call("project.task", "write", [[task_id], vals])

    # ── Timesheets ───────────────────────────────────────────────────────────

    def list_timesheets(self, employee_id: int | None = None,
                        project_id: int | None = None, limit: int = 200) -> list[dict]:
        domain: list = []
        if employee_id:
            domain.append(["employee_id", "=", employee_id])
        if project_id:
            domain.append(["project_id", "=", project_id])
        fields = ["id", "date", "employee_id", "project_id", "task_id",
                  "name", "unit_amount"]
        return self._call("account.analytic.line", "search_read", [domain],
                          {"fields": fields, "limit": limit})

    def create_timesheet(self, employee_id: int, project_id: int, date: str,
                         hours: float, description: str = "",
                         task_id: int | None = None) -> int:
        vals: dict[str, Any] = {
            "employee_id": employee_id,
            "project_id": project_id,
            "date": date,
            "unit_amount": hours,
            "name": description or "/",
        }
        if task_id:
            vals["task_id"] = task_id
        return self._call("account.analytic.line", "create", [vals])

    # ── Attendance ───────────────────────────────────────────────────────────

    def list_attendance(self, employee_id: int | None = None, limit: int = 200) -> list[dict]:
        domain: list = []
        if employee_id:
            domain.append(["employee_id", "=", employee_id])
        fields = ["id", "employee_id", "check_in", "check_out", "worked_hours"]
        return self._call("hr.attendance", "search_read", [domain],
                          {"fields": fields, "limit": limit})

    def create_attendance(self, employee_id: int, check_in: str,
                          check_out: str = "") -> int:
        vals: dict[str, Any] = {"employee_id": employee_id, "check_in": check_in}
        if check_out:
            vals["check_out"] = check_out
        return self._call("hr.attendance", "create", [vals])
