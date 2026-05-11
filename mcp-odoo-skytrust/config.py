import os
from dotenv import load_dotenv

load_dotenv()


class OdooConfig:
    url: str = os.getenv("ODOO_URL", "")
    db: str = os.getenv("ODOO_DB", "")
    username: str = os.getenv("ODOO_USERNAME", "")
    api_key: str = os.getenv("ODOO_API_KEY", "")

    @classmethod
    def validate(cls) -> None:
        missing = [k for k, v in {"ODOO_URL": cls.url, "ODOO_DB": cls.db,
                                   "ODOO_USERNAME": cls.username, "ODOO_API_KEY": cls.api_key}.items() if not v]
        if missing:
            raise ValueError(f"Missing Odoo config: {', '.join(missing)}")


class SkytrustConfig:
    url: str = os.getenv("SKYTRUST_URL", "")
    api_key: str = os.getenv("SKYTRUST_API_KEY", "")
    client_id: str = os.getenv("SKYTRUST_CLIENT_ID", "")
    client_secret: str = os.getenv("SKYTRUST_CLIENT_SECRET", "")

    @classmethod
    def validate(cls) -> None:
        missing = [k for k, v in {"SKYTRUST_URL": cls.url, "SKYTRUST_API_KEY": cls.api_key}.items() if not v]
        if missing:
            raise ValueError(f"Missing Skytrust config: {', '.join(missing)}")
