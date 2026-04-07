import io
import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

load_dotenv()

from card_app.identify import identify_card
from card_app.pricing.pokemon import get_pokemon_prices
from card_app.pricing.sports import get_sports_prices

app = Flask(__name__, static_folder="static")

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB


# ---------------------------------------------------------------------------
# Static routes
# ---------------------------------------------------------------------------

@app.route("/")
def beyblade():
    return send_from_directory(".", "index.html")


@app.route("/card")
def card_app():
    return send_from_directory("static", "card.html")


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/identify", methods=["POST"])
def identify():
    # Support both multipart form upload and JSON base64 body
    image_bytes = None
    media_type = "image/jpeg"

    if request.content_type and "multipart/form-data" in request.content_type:
        file = request.files.get("image")
        if not file:
            return jsonify({"error": "No image file provided", "code": "NO_IMAGE"}), 400
        media_type = file.content_type or "image/jpeg"
        if media_type not in ALLOWED_TYPES:
            return jsonify({"error": f"Unsupported image type: {media_type}", "code": "BAD_TYPE"}), 415
        image_bytes = file.read()
    elif request.is_json:
        data = request.get_json()
        import base64
        raw = data.get("image")
        if not raw:
            return jsonify({"error": "No image data provided", "code": "NO_IMAGE"}), 400
        media_type = data.get("media_type", "image/jpeg")
        try:
            image_bytes = base64.b64decode(raw)
        except Exception:
            return jsonify({"error": "Invalid base64 image data", "code": "BAD_IMAGE"}), 400
    else:
        return jsonify({"error": "Expected multipart/form-data or JSON body", "code": "BAD_REQUEST"}), 400

    if len(image_bytes) > MAX_IMAGE_BYTES:
        return jsonify({"error": "Image too large (max 10MB)", "code": "TOO_LARGE"}), 413

    # --- Identify the card ---
    try:
        card_info = identify_card(image_bytes, media_type)
    except Exception as e:
        return jsonify({"error": f"Card identification failed: {str(e)}", "code": "IDENTIFY_ERROR"}), 500

    card_type = card_info.get("type", "unknown")

    # --- Fetch prices ---
    pricing = {}
    if card_type == "pokemon":
        try:
            pricing = get_pokemon_prices(card_info)
        except Exception as e:
            pricing = {"prices": None, "error": str(e)}
    elif card_type == "sports":
        try:
            pricing = get_sports_prices(card_info)
        except Exception as e:
            pricing = {"prices": None, "error": str(e)}

    return jsonify({
        "card": card_info,
        "pricing": pricing,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
