"""
Entry point: starts the webhook server (FastAPI/uvicorn) and the APScheduler
in the same process.

Usage:
    python run.py
    python run.py --host 0.0.0.0 --port 8000
"""
import argparse
import logging
import signal
import sys

import uvicorn

from scheduler import build_scheduler
from webhook_server import app  # noqa: F401 — imported so uvicorn can find it

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("run")


def main() -> None:
    parser = argparse.ArgumentParser(description="Odoo ↔ Skytrust live sync service")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    # Start background scheduler
    scheduler = build_scheduler()
    scheduler.start()
    log.info("Scheduler started with %d jobs", len(scheduler.get_jobs()))
    for job in scheduler.get_jobs():
        log.info("  • %s (every %s)", job.name, job.trigger)

    def _shutdown(sig, frame):
        log.info("Shutting down...")
        scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    # Start webhook server (blocking)
    log.info("Webhook server listening on %s:%s", args.host, args.port)
    uvicorn.run(
        "webhook_server:app",
        host=args.host,
        port=args.port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
