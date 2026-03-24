# Placeholder AI orchestration
# This module should contain functions that call OpenAI (or other providers)
# and apply business rules before returning responses.

import os
import openai
from ..models.models import Product
from ..database import SessionLocal
from typing import Optional, Dict, Any

openai.api_key = os.getenv('OPENAI_API_KEY', '')


def find_product(db, text: str) -> Optional[Product]:
    """Try to find a product by wood type or size keywords in the incoming text."""
    if not text:
        return None
    txt = text.lower()
    # try wood type match first
    wood_types = db.query(Product).with_entities(Product.wood_type).distinct()
    # simple search: look for known wood types in text
    for wt_row in wood_types:
        wt = (wt_row[0] or "").lower()
        if wt and wt in txt:
            prod = db.query(Product).filter(Product.wood_type.ilike(f"%{wt}%")).first()
            if prod:
                return prod
    # try size match
    sizes = ["4x2", "3x2", "2x2", "4x1", "3x1"]
    for sz in sizes:
        if sz in txt:
            prod = db.query(Product).filter(Product.size.ilike(f"%{sz}%")).first()
            if prod:
                return prod
    # fallback: return first product
    return db.query(Product).first()


def extract_size_and_quantity(text: str):
    import re
    sizes = ["4x2", "3x2", "2x2", "4x1", "3x1"]
    found_size = None
    for sz in sizes:
        if sz in (text or "").lower():
            found_size = sz
            break
    qty_match = re.search(r"(\d+)\s*(pieces|pcs|pieces)?", text or "")
    qty = int(qty_match.group(1)) if qty_match else None
    return found_size, qty


def check_stock(product: Product, requested_quantity: Optional[int] = None) -> Dict[str, Any]:
    available = product.stock_quantity if product else 0
    ok = True
    if requested_quantity is not None:
        ok = available >= requested_quantity
    return {"available_quantity": available, "stock_ok": ok}


def get_price(product: Product) -> Optional[float]:
    return product.price if product else None


def calculate_delivery(location: Optional[str]) -> int:
    if not location:
        return 5000
    loc = location.lower()
    zone_rates = {
        "nairobi": 1000,
        "ruaka": 1200,
        "rongai": 1500,
        "kitengela": 2000,
        "kiambu": 1800,
    }
    for k, v in zone_rates.items():
        if k in loc:
            return v
    return 4000


def build_quote(product: Product, size: Optional[str], quantity: Optional[int], location: Optional[str]) -> Dict[str, Any]:
    qty = quantity or 0
    unit_price = get_price(product) or 0
    subtotal = unit_price * qty
    delivery_fee = calculate_delivery(location)
    total = subtotal + delivery_fee
    return {
        "product_found": bool(product),
        "stock_available": (product.stock_quantity >= qty) if product and qty > 0 else (product.stock_quantity > 0 if product else False),
        "product_name": product.wood_type if product else None,
        "size": size,
        "price": unit_price,
        "quantity": qty,
        "delivery_location": location,
        "delivery_fee": delivery_fee,
        "total_quote": total,
        "subtotal": subtotal,
    }


def determine_next_question(conversation_state: str, structured: Dict[str, Any]) -> str:
    state = conversation_state or "greeting"
    if state == "greeting":
        return "Which timber type or size do you need today?"
    if state == "awaiting_product":
        return "Which timber type do you need — cedar, cypress, or another?"
    if state == "awaiting_size":
        return "Which size do you need? e.g. 4x2, 3x2, 2x2"
    if state == "awaiting_quantity":
        return "How many pieces do you need?"
    if state == "awaiting_location":
        return "Where should we deliver?"
    if state == "awaiting_quote_confirmation":
        return "Would you like to confirm this order?"
    return "How can I help you further?"


def render_natural_language(structured: Dict[str, Any]) -> str:
    # Given a structured object, produce a natural sentence. Use OpenAI if available, otherwise a template.
    if not openai.api_key:
        # simple deterministic template
        if structured.get("product_found") and structured.get("quantity"):
            return (
                f"{structured.get('quantity')} pieces of {structured.get('product_name')} {structured.get('size')} to {structured.get('delivery_location')} "
                f"totals KSh {structured.get('total_quote')}. Would you like to confirm the order?"
            )
        return determine_next_question(structured.get("conversation_state", "greeting"), structured)

    system_prompt = (
        "You are a timber sales assistant. Always use the structured data provided and never invent prices or stock. "
        "Use the structured object keys to render a clear customer-facing sentence."
    )
    user_prompt = f"Render this structured object for a customer: {structured}"
    try:
        resp = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=150,
            temperature=0.2,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        # fallback
        return determine_next_question(structured.get("conversation_state", "greeting"), structured)


def orchestrate_reply(db, conv, incoming_text: str) -> Dict[str, Any]:
    """Main orchestration entry. Operates using caller-provided DB session. Returns dict with keys: structured, ai_text."""
    # Update conv fields in DB if product/size/quantity detectable
    product = None
    if not conv.current_product or not conv.current_size:
        product = find_product(db, incoming_text)
        if product and not conv.current_product:
            conv.current_product = product.wood_type
        if product and not conv.current_size and product.size:
            conv.current_size = product.size
    else:
        # try to resolve current product from DB
        product = db.query(Product).filter(Product.wood_type.ilike(f"%{conv.current_product}%")).first()

    # quantity detection already may be in conv; use it
    qty = conv.current_quantity

    structured = build_quote(product, conv.current_size, qty, conv.current_location)
    structured["conversation_state"] = conv.conversation_state

    # If state requires prompting before quoting, do not include price
    if conv.conversation_state in ["greeting", "awaiting_product", "awaiting_size", "awaiting_quantity", "awaiting_location"]:
        structured["price_shown"] = False
        # build next question
        structured["next_question"] = determine_next_question(conv.conversation_state, structured)
        ai_text = render_natural_language({"conversation_state": conv.conversation_state})
    else:
        # ready to quote
        structured["price_shown"] = True
        ai_text = render_natural_language({**structured})

    # Do not commit here; caller will persist conv and messages
    conv.quote_amount = structured.get("total_quote")
    return {"structured": structured, "ai_text": ai_text}


def ask_ai(prompt: str) -> str:
    """Simple AI response for WebSocket or basic queries."""
    if not openai.api_key:
        return "Thanks for your message! Our AI assistant is processing your request."
    
    try:
        resp = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful timber sales assistant. Keep responses concise and friendly."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=100,
            temperature=0.7,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        return "Thanks for your message! Our AI assistant is processing your request."
