import os
import urllib.parse

import requests

POKEMON_TCG_BASE = "https://api.pokemontcg.io/v2"

# Map Claude variant labels → TCGPlayer price keys
VARIANT_MAP = {
    "holo rare": "holofoil",
    "holo": "holofoil",
    "1st edition holo": "1stEditionHolofoil",
    "1st edition": "1stEditionNormal",
    "reverse holo": "reverseHolofoil",
    "reverse holofoil": "reverseHolofoil",
    "normal": "normal",
    "base": "normal",
    "v": "normal",
    "vmax": "normal",
    "ex": "normal",
    "gx": "normal",
    "vstar": "normal",
}


def _headers():
    key = os.environ.get("POKEMON_TCG_API_KEY", "")
    return {"X-Api-Key": key} if key else {}


def _extract_prices(tcgplayer: dict, variant_hint: str) -> dict | None:
    prices = tcgplayer.get("prices", {})
    if not prices:
        return None

    hint = (variant_hint or "").lower()
    preferred_key = VARIANT_MAP.get(hint)

    # Try preferred key first, then any available key
    for key in ([preferred_key] if preferred_key else []) + list(prices.keys()):
        if key and key in prices:
            p = prices[key]
            low = p.get("low")
            high = p.get("high")
            mid = p.get("mid") or p.get("market")
            if any(v is not None for v in [low, high, mid]):
                return {
                    "low": low,
                    "avg": mid,
                    "high": high,
                    "price_type": key,
                    "currency": "USD",
                }
    return None


def _search(q: str) -> list:
    params = {"q": q, "pageSize": 5}
    try:
        r = requests.get(f"{POKEMON_TCG_BASE}/cards", params=params, headers=_headers(), timeout=10)
        r.raise_for_status()
        return r.json().get("data", [])
    except requests.RequestException:
        return []


def get_pokemon_prices(card_info: dict) -> dict:
    """
    Returns pricing dict with keys: prices, image_url, card_url, search_url, source, card_data
    """
    name = card_info.get("name", "")
    set_name = card_info.get("set", "")
    number = card_info.get("number", "").split("/")[0].lstrip("0") or card_info.get("number", "")
    variant = card_info.get("variant", "")

    result = {
        "prices": None,
        "image_url": None,
        "card_url": None,
        "source": "TCGPlayer via Pokémon TCG API",
        "search_url": None,
    }

    # Build TCGPlayer search URL as fallback
    query_str = f"{name} {set_name} {variant}".strip()
    result["search_url"] = (
        "https://www.tcgplayer.com/search/pokemon/product"
        f"?q={urllib.parse.quote(query_str)}&view=grid"
    )

    # Try progressively broader queries
    queries = []
    if name and set_name and number:
        queries.append(f'name:"{name}" number:{number} set.name:"{set_name}"')
    if name and set_name:
        queries.append(f'name:"{name}" set.name:"{set_name}"')
    if name:
        queries.append(f'name:"{name}"')

    cards = []
    for q in queries:
        cards = _search(q)
        if cards:
            break

    if not cards:
        return result

    card = cards[0]
    images = card.get("images", {})
    result["image_url"] = images.get("large") or images.get("small")

    tcgplayer_data = card.get("tcgplayer", {})
    if tcgplayer_data:
        result["card_url"] = tcgplayer_data.get("url")
        prices = _extract_prices(tcgplayer_data, variant)
        if prices:
            result["prices"] = prices

    # Try cardmarket (EU) as supplemental
    cardmarket_data = card.get("cardmarket", {})
    if cardmarket_data:
        cm_prices = cardmarket_data.get("prices", {})
        cm_result = {}
        if cm_prices.get("averageSellPrice"):
            cm_result["avg"] = cm_prices["averageSellPrice"]
        if cm_prices.get("lowPrice"):
            cm_result["low"] = cm_prices["lowPrice"]
        if cm_prices.get("trendPrice"):
            cm_result["high"] = cm_prices["trendPrice"]
        if cm_result:
            cm_result["currency"] = "EUR"
            result["cardmarket_prices"] = cm_result

    return result
