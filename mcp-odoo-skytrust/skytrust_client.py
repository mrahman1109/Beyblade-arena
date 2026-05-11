"""
Skytrust REST API client.

NOTE: Skytrust's API docs are provided privately by their support team.
      Contact support@skytrust.com.au or visit Settings → Integrations in your
      Skytrust tenant to obtain docs and credentials.
      The endpoints and payload shapes below follow Skytrust's standard REST
      conventions — verify them against your tenant's actual API reference.
"""
import httpx
from typing import Any
from config import SkytrustConfig


class SkytrustClient:
    def __init__(self) -> None:
        SkytrustConfig.validate()
        self._base = SkytrustConfig.url.rstrip("/") + "/api/v1"
        self._headers = {
            "Authorization": f"Bearer {SkytrustConfig.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        self._client = httpx.Client(headers=self._headers, timeout=30)

    def _get(self, path: str, params: dict | None = None) -> Any:
        r = self._client.get(f"{self._base}{path}", params=params)
        r.raise_for_status()
        return r.json()

    def _post(self, path: str, body: dict) -> Any:
        r = self._client.post(f"{self._base}{path}", json=body)
        r.raise_for_status()
        return r.json()

    def _patch(self, path: str, body: dict) -> Any:
        r = self._client.patch(f"{self._base}{path}", json=body)
        r.raise_for_status()
        return r.json()

    # ── Employees ────────────────────────────────────────────────────────────

    def list_employees(self, page: int = 1, page_size: int = 100) -> list[dict]:
        data = self._get("/employees", {"page": page, "pageSize": page_size})
        return data.get("data", data) if isinstance(data, dict) else data

    def get_employee(self, employee_id: str) -> dict:
        return self._get(f"/employees/{employee_id}")

    def create_employee(self, first_name: str, last_name: str,
                        email: str, position: str = "",
                        department: str = "") -> dict:
        payload: dict[str, Any] = {
            "firstName": first_name,
            "lastName": last_name,
            "email": email,
        }
        if position:
            payload["position"] = position
        if department:
            payload["department"] = department
        return self._post("/employees", payload)

    def update_employee(self, employee_id: str, fields: dict) -> dict:
        return self._patch(f"/employees/{employee_id}", fields)

    # ── WHS Incidents ────────────────────────────────────────────────────────

    def list_incidents(self, status: str = "", page: int = 1,
                       page_size: int = 100) -> list[dict]:
        params: dict[str, Any] = {"page": page, "pageSize": page_size}
        if status:
            params["status"] = status
        data = self._get("/incidents", params)
        return data.get("data", data) if isinstance(data, dict) else data

    def get_incident(self, incident_id: str) -> dict:
        return self._get(f"/incidents/{incident_id}")

    def create_incident(self, title: str, description: str,
                        incident_date: str, location: str = "",
                        severity: str = "Low",
                        reported_by_id: str = "") -> dict:
        """
        severity: Low | Medium | High | Critical
        incident_date: ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
        """
        payload: dict[str, Any] = {
            "title": title,
            "description": description,
            "incidentDate": incident_date,
            "severity": severity,
        }
        if location:
            payload["location"] = location
        if reported_by_id:
            payload["reportedById"] = reported_by_id
        return self._post("/incidents", payload)

    def update_incident(self, incident_id: str, fields: dict) -> dict:
        return self._patch(f"/incidents/{incident_id}", fields)

    # ── HR Records ───────────────────────────────────────────────────────────

    def list_hr_records(self, employee_id: str = "", record_type: str = "",
                        page: int = 1, page_size: int = 100) -> list[dict]:
        params: dict[str, Any] = {"page": page, "pageSize": page_size}
        if employee_id:
            params["employeeId"] = employee_id
        if record_type:
            params["type"] = record_type
        data = self._get("/hr-records", params)
        return data.get("data", data) if isinstance(data, dict) else data

    def create_hr_record(self, employee_id: str, record_type: str,
                         title: str, details: dict | None = None) -> dict:
        payload: dict[str, Any] = {
            "employeeId": employee_id,
            "type": record_type,
            "title": title,
            "details": details or {},
        }
        return self._post("/hr-records", payload)

    # ── Timesheets ───────────────────────────────────────────────────────────

    def list_timesheets(self, employee_id: str = "", date_from: str = "",
                        date_to: str = "", page: int = 1,
                        page_size: int = 200) -> list[dict]:
        params: dict[str, Any] = {"page": page, "pageSize": page_size}
        if employee_id:
            params["employeeId"] = employee_id
        if date_from:
            params["dateFrom"] = date_from
        if date_to:
            params["dateTo"] = date_to
        data = self._get("/timesheets", params)
        return data.get("data", data) if isinstance(data, dict) else data

    def create_timesheet(self, employee_id: str, date: str,
                         hours: float, project: str = "",
                         notes: str = "") -> dict:
        payload: dict[str, Any] = {
            "employeeId": employee_id,
            "date": date,
            "hours": hours,
        }
        if project:
            payload["project"] = project
        if notes:
            payload["notes"] = notes
        return self._post("/timesheets", payload)

    def __del__(self) -> None:
        self._client.close()
