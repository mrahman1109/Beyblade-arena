"""
MCP server exposing Odoo Online and Skytrust tools to Claude.
Run: python server.py
"""
import json
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

from odoo_client import OdooClient
from skytrust_client import SkytrustClient

app = Server("odoo-skytrust-mcp")

_odoo: OdooClient | None = None
_skytrust: SkytrustClient | None = None


def odoo() -> OdooClient:
    global _odoo
    if _odoo is None:
        _odoo = OdooClient()
    return _odoo


def skytrust() -> SkytrustClient:
    global _skytrust
    if _skytrust is None:
        _skytrust = SkytrustClient()
    return _skytrust


# ── Tool registry ─────────────────────────────────────────────────────────────

@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        # ── Odoo: Employees ──────────────────────────────────────────────────
        types.Tool(
            name="odoo_list_employees",
            description="List active employees in Odoo.",
            inputSchema={"type": "object", "properties": {
                "limit": {"type": "integer", "default": 100, "description": "Max records to return"}
            }},
        ),
        types.Tool(
            name="odoo_get_employee",
            description="Get a single Odoo employee by ID.",
            inputSchema={"type": "object", "required": ["employee_id"], "properties": {
                "employee_id": {"type": "integer"}
            }},
        ),
        types.Tool(
            name="odoo_create_employee",
            description="Create a new employee in Odoo.",
            inputSchema={"type": "object", "required": ["name"], "properties": {
                "name": {"type": "string"},
                "job_title": {"type": "string"},
                "work_email": {"type": "string"},
                "department_id": {"type": "integer"},
            }},
        ),
        # ── Odoo: Projects & Tasks ───────────────────────────────────────────
        types.Tool(
            name="odoo_list_projects",
            description="List active projects in Odoo.",
            inputSchema={"type": "object", "properties": {
                "limit": {"type": "integer", "default": 50}
            }},
        ),
        types.Tool(
            name="odoo_list_tasks",
            description="List tasks in Odoo, optionally filtered by project.",
            inputSchema={"type": "object", "properties": {
                "project_id": {"type": "integer", "description": "Filter by project ID"},
                "limit": {"type": "integer", "default": 100},
            }},
        ),
        types.Tool(
            name="odoo_create_task",
            description="Create a task in an Odoo project.",
            inputSchema={"type": "object", "required": ["name", "project_id"], "properties": {
                "name": {"type": "string"},
                "project_id": {"type": "integer"},
                "description": {"type": "string"},
                "deadline": {"type": "string", "description": "YYYY-MM-DD"},
                "user_ids": {"type": "array", "items": {"type": "integer"},
                             "description": "Assignee user IDs"},
            }},
        ),
        # ── Odoo: Timesheets ─────────────────────────────────────────────────
        types.Tool(
            name="odoo_list_timesheets",
            description="List timesheet entries from Odoo.",
            inputSchema={"type": "object", "properties": {
                "employee_id": {"type": "integer"},
                "project_id": {"type": "integer"},
                "limit": {"type": "integer", "default": 200},
            }},
        ),
        types.Tool(
            name="odoo_create_timesheet",
            description="Log a timesheet entry in Odoo.",
            inputSchema={"type": "object",
                         "required": ["employee_id", "project_id", "date", "hours"],
                         "properties": {
                             "employee_id": {"type": "integer"},
                             "project_id": {"type": "integer"},
                             "date": {"type": "string", "description": "YYYY-MM-DD"},
                             "hours": {"type": "number"},
                             "description": {"type": "string"},
                             "task_id": {"type": "integer"},
                         }},
        ),
        # ── Odoo: Attendance ─────────────────────────────────────────────────
        types.Tool(
            name="odoo_list_attendance",
            description="List attendance records from Odoo.",
            inputSchema={"type": "object", "properties": {
                "employee_id": {"type": "integer"},
                "limit": {"type": "integer", "default": 200},
            }},
        ),
        # ── Skytrust: Employees ──────────────────────────────────────────────
        types.Tool(
            name="skytrust_list_employees",
            description="List employees in Skytrust.",
            inputSchema={"type": "object", "properties": {
                "page": {"type": "integer", "default": 1},
                "page_size": {"type": "integer", "default": 100},
            }},
        ),
        types.Tool(
            name="skytrust_get_employee",
            description="Get a Skytrust employee by ID.",
            inputSchema={"type": "object", "required": ["employee_id"], "properties": {
                "employee_id": {"type": "string"}
            }},
        ),
        types.Tool(
            name="skytrust_create_employee",
            description="Create a new employee in Skytrust.",
            inputSchema={"type": "object",
                         "required": ["first_name", "last_name", "email"],
                         "properties": {
                             "first_name": {"type": "string"},
                             "last_name": {"type": "string"},
                             "email": {"type": "string"},
                             "position": {"type": "string"},
                             "department": {"type": "string"},
                         }},
        ),
        # ── Skytrust: WHS Incidents ──────────────────────────────────────────
        types.Tool(
            name="skytrust_list_incidents",
            description="List WHS incidents from Skytrust.",
            inputSchema={"type": "object", "properties": {
                "status": {"type": "string", "description": "Filter by status (e.g. Open, Closed)"},
                "page": {"type": "integer", "default": 1},
                "page_size": {"type": "integer", "default": 100},
            }},
        ),
        types.Tool(
            name="skytrust_get_incident",
            description="Get a Skytrust WHS incident by ID.",
            inputSchema={"type": "object", "required": ["incident_id"], "properties": {
                "incident_id": {"type": "string"}
            }},
        ),
        types.Tool(
            name="skytrust_create_incident",
            description="Report a new WHS incident in Skytrust.",
            inputSchema={"type": "object",
                         "required": ["title", "description", "incident_date"],
                         "properties": {
                             "title": {"type": "string"},
                             "description": {"type": "string"},
                             "incident_date": {"type": "string", "description": "YYYY-MM-DD"},
                             "location": {"type": "string"},
                             "severity": {"type": "string",
                                          "enum": ["Low", "Medium", "High", "Critical"],
                                          "default": "Low"},
                             "reported_by_id": {"type": "string"},
                         }},
        ),
        # ── Skytrust: HR Records ─────────────────────────────────────────────
        types.Tool(
            name="skytrust_list_hr_records",
            description="List HR records from Skytrust.",
            inputSchema={"type": "object", "properties": {
                "employee_id": {"type": "string"},
                "record_type": {"type": "string"},
                "page": {"type": "integer", "default": 1},
                "page_size": {"type": "integer", "default": 100},
            }},
        ),
        # ── Skytrust: Timesheets ─────────────────────────────────────────────
        types.Tool(
            name="skytrust_list_timesheets",
            description="List timesheet entries from Skytrust.",
            inputSchema={"type": "object", "properties": {
                "employee_id": {"type": "string"},
                "date_from": {"type": "string", "description": "YYYY-MM-DD"},
                "date_to": {"type": "string", "description": "YYYY-MM-DD"},
                "page": {"type": "integer", "default": 1},
                "page_size": {"type": "integer", "default": 200},
            }},
        ),
        types.Tool(
            name="skytrust_create_timesheet",
            description="Create a timesheet entry in Skytrust.",
            inputSchema={"type": "object",
                         "required": ["employee_id", "date", "hours"],
                         "properties": {
                             "employee_id": {"type": "string"},
                             "date": {"type": "string", "description": "YYYY-MM-DD"},
                             "hours": {"type": "number"},
                             "project": {"type": "string"},
                             "notes": {"type": "string"},
                         }},
        ),
        # ── Cross-platform sync ──────────────────────────────────────────────
        types.Tool(
            name="sync_employees_odoo_to_skytrust",
            description=(
                "Read all active employees from Odoo and create any that are "
                "missing in Skytrust (matched by email). Returns a summary."
            ),
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="sync_timesheets_odoo_to_skytrust",
            description=(
                "Read Odoo timesheets for a date range and push them into "
                "Skytrust. Requires employee emails to match between systems."
            ),
            inputSchema={"type": "object",
                         "required": ["date_from", "date_to"],
                         "properties": {
                             "date_from": {"type": "string", "description": "YYYY-MM-DD"},
                             "date_to": {"type": "string", "description": "YYYY-MM-DD"},
                         }},
        ),
    ]


# ── Dispatcher ────────────────────────────────────────────────────────────────

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    try:
        result = _dispatch(name, arguments)
    except Exception as exc:
        result = {"error": str(exc)}
    return [types.TextContent(type="text", text=json.dumps(result, indent=2, default=str))]


def _dispatch(name: str, args: dict):  # noqa: C901
    # ── Odoo employees
    if name == "odoo_list_employees":
        return odoo().list_employees(limit=args.get("limit", 100))
    if name == "odoo_get_employee":
        return odoo().get_employee(args["employee_id"])
    if name == "odoo_create_employee":
        eid = odoo().create_employee(
            args["name"], args.get("job_title", ""),
            args.get("work_email", ""), args.get("department_id"),
        )
        return {"created_id": eid}

    # ── Odoo projects / tasks
    if name == "odoo_list_projects":
        return odoo().list_projects(limit=args.get("limit", 50))
    if name == "odoo_list_tasks":
        return odoo().list_tasks(args.get("project_id"), limit=args.get("limit", 100))
    if name == "odoo_create_task":
        tid = odoo().create_task(
            args["name"], args["project_id"],
            args.get("description", ""), args.get("deadline", ""),
            args.get("user_ids"),
        )
        return {"created_id": tid}

    # ── Odoo timesheets
    if name == "odoo_list_timesheets":
        return odoo().list_timesheets(
            args.get("employee_id"), args.get("project_id"), args.get("limit", 200)
        )
    if name == "odoo_create_timesheet":
        lid = odoo().create_timesheet(
            args["employee_id"], args["project_id"], args["date"],
            args["hours"], args.get("description", ""), args.get("task_id"),
        )
        return {"created_id": lid}

    # ── Odoo attendance
    if name == "odoo_list_attendance":
        return odoo().list_attendance(args.get("employee_id"), args.get("limit", 200))

    # ── Skytrust employees
    if name == "skytrust_list_employees":
        return skytrust().list_employees(args.get("page", 1), args.get("page_size", 100))
    if name == "skytrust_get_employee":
        return skytrust().get_employee(args["employee_id"])
    if name == "skytrust_create_employee":
        return skytrust().create_employee(
            args["first_name"], args["last_name"], args["email"],
            args.get("position", ""), args.get("department", ""),
        )

    # ── Skytrust incidents
    if name == "skytrust_list_incidents":
        return skytrust().list_incidents(
            args.get("status", ""), args.get("page", 1), args.get("page_size", 100)
        )
    if name == "skytrust_get_incident":
        return skytrust().get_incident(args["incident_id"])
    if name == "skytrust_create_incident":
        return skytrust().create_incident(
            args["title"], args["description"], args["incident_date"],
            args.get("location", ""), args.get("severity", "Low"),
            args.get("reported_by_id", ""),
        )

    # ── Skytrust HR records
    if name == "skytrust_list_hr_records":
        return skytrust().list_hr_records(
            args.get("employee_id", ""), args.get("record_type", ""),
            args.get("page", 1), args.get("page_size", 100),
        )

    # ── Skytrust timesheets
    if name == "skytrust_list_timesheets":
        return skytrust().list_timesheets(
            args.get("employee_id", ""), args.get("date_from", ""),
            args.get("date_to", ""), args.get("page", 1), args.get("page_size", 200),
        )
    if name == "skytrust_create_timesheet":
        return skytrust().create_timesheet(
            args["employee_id"], args["date"], args["hours"],
            args.get("project", ""), args.get("notes", ""),
        )

    # ── Sync: employees Odoo → Skytrust
    if name == "sync_employees_odoo_to_skytrust":
        return _sync_employees_odoo_to_skytrust()

    # ── Sync: timesheets Odoo → Skytrust
    if name == "sync_timesheets_odoo_to_skytrust":
        return _sync_timesheets_odoo_to_skytrust(args["date_from"], args["date_to"])

    return {"error": f"Unknown tool: {name}"}


# ── Sync helpers ──────────────────────────────────────────────────────────────

def _sync_employees_odoo_to_skytrust() -> dict:
    odoo_employees = odoo().list_employees(limit=500)
    st_employees = skytrust().list_employees(page_size=500)

    existing_emails = {e.get("email", "").lower() for e in st_employees}
    created, skipped = [], []

    for emp in odoo_employees:
        email = (emp.get("work_email") or "").lower()
        if not email or email in existing_emails:
            skipped.append(emp.get("name"))
            continue
        name_parts = emp["name"].split(" ", 1)
        first = name_parts[0]
        last = name_parts[1] if len(name_parts) > 1 else ""
        dept = emp.get("department_id", [None, ""])[1] if emp.get("department_id") else ""
        skytrust().create_employee(first, last, email,
                                   emp.get("job_title", ""), dept)
        created.append(emp["name"])

    return {"created_in_skytrust": created, "skipped_already_exist": skipped}


def _sync_timesheets_odoo_to_skytrust(date_from: str, date_to: str) -> dict:
    # Build email → Skytrust employee ID map
    st_employees = skytrust().list_employees(page_size=500)
    email_to_st_id = {e.get("email", "").lower(): e.get("id") for e in st_employees}

    odoo_ts = odoo().list_timesheets(limit=1000)
    # Filter by date range
    odoo_ts = [t for t in odoo_ts if date_from <= t.get("date", "") <= date_to]

    pushed, skipped = [], []
    for ts in odoo_ts:
        emp_id_odoo = ts.get("employee_id", [None])[0] if ts.get("employee_id") else None
        if emp_id_odoo is None:
            skipped.append(ts)
            continue
        # Fetch email for this Odoo employee
        emp = odoo().get_employee(emp_id_odoo)
        email = (emp.get("work_email") or "").lower()
        st_id = email_to_st_id.get(email)
        if not st_id:
            skipped.append({"reason": "no matching Skytrust employee", "email": email})
            continue
        project_name = ts.get("project_id", [None, ""])[1] if ts.get("project_id") else ""
        skytrust().create_timesheet(st_id, ts["date"], ts["unit_amount"],
                                    project_name, ts.get("name", ""))
        pushed.append({"date": ts["date"], "hours": ts["unit_amount"], "email": email})

    return {"pushed_to_skytrust": pushed, "skipped": skipped}


# ── Entry point ───────────────────────────────────────────────────────────────

async def main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
