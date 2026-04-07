import re
import urllib.parse

import requests

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def _build_ebay_url(card_info: dict) -> str:
    parts = [
        card_info.get("player", ""),
        card_info.get("year", ""),
        card_info.get("brand", ""),
        card_info.get("number", ""),
        card_info.get("variant", ""),
    ]
    query = " ".join(p for p in parts if p).strip()
    return (
        "https://www.ebay.com/sch/i.html"
        f"?_nkw={urllib.parse.quote(query)}"
        "&LH_Complete=1"
        "&LH_Sold=1"
        "&_sop=13"
        "&_sacat=261328"
    )


def _try_130point(card_info: dict) -> dict | None:
    """
    Attempt to scrape 130point.com for recent sold prices.
    Returns price dict or None on any failure.
    """
    parts = [
        card_info.get("player", ""),
        card_info.get("year", ""),
        card_info.get("brand", ""),
        card_info.get("variant", ""),
    ]
    query = " ".join(p for p in parts if p).strip()
    if not query:
        return None

    url = f"https://www.130point.com/sales/?search={urllib.parse.quote(query)}"

    try:
        r = requests.get(url, headers=HEADERS, timeout=8)
        if r.status_code != 200:
            return None

        # Extract dollar amounts from the page
        prices_raw = re.findall(r"\$\s*([\d,]+(?:\.\d{2})?)", r.text)
        prices = []
        for p in prices_raw:
            try:
                val = float(p.replace(",", ""))
                # Filter out suspiciously high/low values (likely page artifacts)
                if 0.25 <= val <= 250000:
                    prices.append(val)
            except ValueError:
                continue

        if len(prices) < 2:
            return None

        # Use median-centric approach: exclude outliers
        prices.sort()
        # Take middle 80% to remove extreme outliers
        trim = max(1, len(prices) // 10)
        trimmed = prices[trim:-trim] if len(prices) > 4 else prices

        return {
            "low": round(min(trimmed), 2),
            "avg": round(sum(trimmed) / len(trimmed), 2),
            "high": round(max(trimmed), 2),
            "currency": "USD",
            "sample_size": len(trimmed),
        }
    except Exception:
        return None


def get_sports_prices(card_info: dict) -> dict:
    """
    Returns pricing dict with keys: prices, search_url, source
    """
    result = {
        "prices": None,
        "search_url": _build_ebay_url(card_info),
        "source": "eBay Completed Sales",
    }

    scraped = _try_130point(card_info)
    if scraped:
        result["prices"] = scraped
        result["source"] = "130point (eBay completed sales)"

    return result
