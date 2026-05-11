# MCP Server — Odoo Online ↔ Skytrust

An MCP server that lets Claude read and write data across **Odoo Online** and
**Skytrust** — covering employees, projects/tasks, timesheets, attendance, and
WHS incidents.

---

## Step 1 — Get API Credentials

### Odoo Online
1. Log in to your Odoo instance (e.g. `https://yourcompany.odoo.com`).
2. Go to **Settings → Technical → API Keys** (enable developer mode first:
   Settings → Activate Developer Mode).
3. Click **New** → give the key a label → copy the generated key.
4. Note your **database name** (shown in Settings → General Settings under
   "About").

### Skytrust
1. Log in to your Skytrust tenant.
2. Go to **Settings → Integrations** (or **API Access**).
3. Generate or copy your **API Key**.
4. Contact **support@skytrust.com.au** if the Integrations menu is not visible —
   API access may need to be enabled on your subscription.
5. Ask support for the **API reference PDF** to verify the endpoint paths used in
   `skytrust_client.py`.

---

## Step 2 — Configure Environment

```bash
cp .env.example .env
# Edit .env and fill in all values
```

---

## Step 3 — Install Dependencies

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

---

## Step 4 — Connect to Claude Desktop

Add the following block to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "odoo-skytrust": {
      "command": "/absolute/path/to/.venv/bin/python",
      "args": ["/absolute/path/to/mcp-odoo-skytrust/server.py"],
      "env": {
        "ODOO_URL": "https://yourinstance.odoo.com",
        "ODOO_DB": "your_database_name",
        "ODOO_USERNAME": "admin@yourcompany.com",
        "ODOO_API_KEY": "your_odoo_api_key",
        "SKYTRUST_URL": "https://yourcompany.skytrust.com.au",
        "SKYTRUST_API_KEY": "your_skytrust_api_key"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

---

## Available Tools (20 total)

| Tool | Description |
|------|-------------|
| `odoo_list_employees` | List active Odoo employees |
| `odoo_get_employee` | Get one Odoo employee by ID |
| `odoo_create_employee` | Create an employee in Odoo |
| `odoo_list_projects` | List active Odoo projects |
| `odoo_list_tasks` | List tasks (optionally by project) |
| `odoo_create_task` | Create a task in Odoo |
| `odoo_list_timesheets` | List timesheet entries from Odoo |
| `odoo_create_timesheet` | Log a timesheet in Odoo |
| `odoo_list_attendance` | List attendance records from Odoo |
| `skytrust_list_employees` | List Skytrust employees |
| `skytrust_get_employee` | Get one Skytrust employee |
| `skytrust_create_employee` | Create an employee in Skytrust |
| `skytrust_list_incidents` | List WHS incidents |
| `skytrust_get_incident` | Get one WHS incident |
| `skytrust_create_incident` | Report a WHS incident |
| `skytrust_list_hr_records` | List HR records |
| `skytrust_list_timesheets` | List Skytrust timesheets |
| `skytrust_create_timesheet` | Create a Skytrust timesheet entry |
| `sync_employees_odoo_to_skytrust` | Sync all Odoo employees → Skytrust |
| `sync_timesheets_odoo_to_skytrust` | Sync Odoo timesheets → Skytrust for a date range |

---

## Example Prompts

```
List all employees in Odoo.
Show me open WHS incidents in Skytrust.
Create a task called "Onboarding checklist" in Odoo project 5.
Sync all employees from Odoo to Skytrust.
Sync timesheets from 2026-05-01 to 2026-05-11 from Odoo to Skytrust.
Report a High severity incident: "Forklift near-miss" at Warehouse A on 2026-05-10.
```

---

## Notes on Skytrust API

Skytrust's API is not publicly documented. The endpoint paths in
`skytrust_client.py` (e.g. `/api/v1/employees`, `/api/v1/incidents`) follow
their standard REST conventions but **must be verified** against the API
reference provided by Skytrust support. If an endpoint returns 404, update the
path in `skytrust_client.py` to match the actual route.
