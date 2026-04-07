import base64
import json
import os
import re

import anthropic

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return _client


SYSTEM_PROMPT = (
    "You are a trading card identification expert with deep knowledge of Pokémon TCG "
    "and sports cards (basketball, baseball, football, hockey). "
    "Analyze the image carefully and respond ONLY with a valid JSON object. "
    "No markdown, no code fences, no explanation — raw JSON only."
)

USER_PROMPT = """Identify the trading card in this image. Return ONLY a JSON object matching one of these schemas:

For Pokémon cards:
{"type":"pokemon","name":"<card name>","set":"<official set name>","number":"<card number e.g. 4/102>","variant":"<e.g. Holo Rare, V, VMAX, EX, GX, Base>","year":"<year if visible>","language":"<EN or JP>"}

For sports cards:
{"type":"sports","sport":"<basketball|baseball|football|hockey>","player":"<full name>","year":"<year>","brand":"<e.g. Fleer, Topps, Panini, Upper Deck, Donruss>","number":"<card number if visible>","variant":"<e.g. Rookie Card, Base, Prizm, Refractor, Auto>","team":"<team name>"}

If you cannot identify it:
{"type":"unknown","description":"<brief description of what you see>"}

Be as specific as possible. Use official set names for Pokémon cards."""


def _parse_json_response(text: str) -> dict:
    text = text.strip()
    # Strip markdown fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def identify_card(image_bytes: bytes, media_type: str = "image/jpeg") -> dict:
    """
    Send image to Claude Vision and return parsed card identification dict.
    Retries once with a stricter prompt on JSON parse failure.
    """
    client = _get_client()
    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    for attempt in range(2):
        prompt = USER_PROMPT if attempt == 0 else USER_PROMPT + "\n\nCRITICAL: Output ONLY the JSON object, nothing else."
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )

        raw = response.content[0].text
        try:
            return _parse_json_response(raw)
        except (json.JSONDecodeError, IndexError):
            if attempt == 1:
                return {"type": "unknown", "description": "Could not parse card details", "raw": raw}

    return {"type": "unknown", "description": "Identification failed"}
