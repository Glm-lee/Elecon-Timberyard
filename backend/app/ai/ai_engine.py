from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional, Tuple

from openai import OpenAI
from sqlalchemy.orm import Session

from ..models.models import ConversationMessage, Product

GENERIC_NAME_TOKENS = {
    "timber",
    "board",
    "beam",
    "plank",
    "treated",
    "structural",
    "roof",
    "batten",
    "post",
    "pole",
    "marine",
    "plywood",
    "sheet",
    "wood",
}

GREETINGS = {"hi", "hello", "hey", "good morning", "good afternoon", "good evening", "mambo", "sasa"}

INTENT_KEYWORDS = {
    "confirm": ["confirm", "go ahead", "proceed", "place order", "book it", "yes"],
    "order": ["order", "buy", "need", "want", "take", "lorry", "truck"],
    "price": ["price", "prices", "cost", "how much", "rate", "quote", "quotation"],
    "stock": ["stock", "available", "availability", "in stock", "have"],
    "delivery": ["delivery", "deliver", "drop off", "transport", "next week", "tomorrow"],
}

HUMAN_HANDOFF_KEYWORDS = [
    "human",
    "agent",
    "person",
    "customer care",
    "sales person",
    "speak to",
    "talk to someone",
    "representative",
    "manager",
    "call me",
]

FRUSTRATION_KEYWORDS = [
    "you don't understand",
    "you do not understand",
    "not helping",
    "this bot",
    "useless",
    "stop repeating",
    "not useful",
]

PICKUP_LOCATION_LABEL = "Pickup at Juja Yard"


def _normalize(text: Optional[str]) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text.lower()).strip()


def _compact_size(size: Optional[str]) -> Optional[str]:
    if not size:
        return None
    m = re.search(r"(\d{1,2})\s*[xX]\s*(\d{1,2})", size)
    if not m:
        return _normalize(size)
    return f"{m.group(1)}x{m.group(2)}"


def _extract_size(text: str) -> Optional[str]:
    txt = _normalize(text)
    match = re.search(r"\b(\d{1,2})\s*(?:x|by)\s*(\d{1,2})\b", txt)
    if match:
        return f"{match.group(1)}x{match.group(2)}"
    return None


def _extract_quantity(text: str) -> Tuple[Optional[int], Optional[str]]:
    txt = _normalize(text)
    if any(word in txt for word in ["lorry", "truck", "full load"]):
        return None, "lorry"

    unit_match = re.search(r"\b(\d+)\s*(pieces?|pcs?|lengths?|boards?|timbers?|meters?|metres?|m)\b", txt)
    if unit_match:
        return int(unit_match.group(1)), unit_match.group(2)

    # Avoid treating size dimensions as quantity.
    for whole in re.findall(r"\b\d+\b", txt):
        if f"{whole}x" in txt or f"x{whole}" in txt:
            continue
        if any(k in txt for k in ["order", "need", "want", "take", "buy"]):
            return int(whole), "pieces"
    return None, None


def _extract_delivery_time(text: str) -> Optional[str]:
    txt = _normalize(text)
    phrases = [
        "today",
        "tomorrow",
        "next week",
        "this week",
        "next month",
        "asap",
        "urgent",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]
    for phrase in phrases:
        if phrase in txt:
            return phrase
    return None


def _extract_location(text: str) -> Optional[str]:
    txt = _normalize(text)
    known_places = [
        "juja",
        "nairobi",
        "westlands",
        "ruaka",
        "rongai",
        "kitengela",
        "kiambu",
        "ruiru",
        "thika",
        "syokimau",
        "south b",
        "south c",
    ]
    for place in known_places:
        if re.search(rf"\b{re.escape(place)}\b", txt):
            return place.title()

    # Prefer explicit delivery phrasing to avoid false positives like "want to order".
    phrase_match = re.search(
        r"\b(?:deliver|delivery|send|ship|drop(?:\s*off)?)\s+(?:to\s+)?([a-z][a-z\s-]{2,40})",
        txt,
    )
    if not phrase_match and txt.startswith("to "):
        phrase_match = re.search(r"^to\s+([a-z][a-z\s-]{2,40})", txt)
    if not phrase_match:
        return None

    raw = phrase_match.group(1).strip(" .,!?:;")
    if raw in {"next week", "this week", "tomorrow", "today"}:
        return None
    return " ".join(part.capitalize() for part in raw.split())


def _extract_fulfillment_preference(text: str) -> Optional[str]:
    txt = _normalize(text)
    if not txt:
        return None

    pickup_phrases = [
        "pickup",
        "pick up",
        "collect",
        "collection",
        "self pickup",
        "self pick up",
        "i will pick",
        "i'll pick",
        "no delivery",
        "not delivered",
        "myself",
    ]
    delivery_phrases = [
        "deliver",
        "delivery",
        "drop off",
        "ship",
        "send to",
    ]

    if any(p in txt for p in pickup_phrases):
        return "pickup"
    if any(p in txt for p in delivery_phrases):
        return "delivery"
    return None


def _is_pickup_location(location: Optional[str]) -> bool:
    return _normalize(location).startswith("pickup")


def _detect_intent(text: str) -> str:
    txt = _normalize(text)
    if not txt:
        return "general"

    if txt in GREETINGS or (len(txt.split()) <= 3 and any(g in txt for g in GREETINGS)):
        return "greeting"

    for intent in ["confirm", "order", "price", "stock", "delivery"]:
        if any(kw in txt for kw in INTENT_KEYWORDS[intent]):
            return intent
    return "general"


def _wants_human_handoff(text: str) -> bool:
    txt = _normalize(text)
    if not txt:
        return False
    if any(k in txt for k in HUMAN_HANDOFF_KEYWORDS):
        return True
    if any(k in txt for k in FRUSTRATION_KEYWORDS):
        return True
    return False


def _is_affirmative(text: str) -> bool:
    txt = _normalize(text)
    phrases = ["yes", "confirm", "proceed", "go ahead", "place order", "book it", "sawa", "ok", "okay"]
    return any(p in txt for p in phrases)


def _meaningful_tokens(product_name: str) -> List[str]:
    tokens = re.findall(r"[a-z0-9]+", _normalize(product_name))
    return [t for t in tokens if t not in GENERIC_NAME_TOKENS and len(t) > 2 and not t.isdigit()]


def _load_products(db: Session) -> List[Product]:
    return db.query(Product).all()


def _extract_category(text: str, products: List[Product]) -> Optional[str]:
    txt = _normalize(text)
    categories = sorted({_normalize(p.wood_type) for p in products if p.wood_type}, key=len, reverse=True)
    for category in categories:
        if category and re.search(rf"\b{re.escape(category)}\b", txt):
            return category
    return None


def _all_categories(products: List[Product]) -> List[str]:
    return sorted({_normalize(p.wood_type) for p in products if p.wood_type})


def _extract_product_term(text: str, products: List[Product]) -> Optional[str]:
    txt = _normalize(text)
    if not txt:
        return None

    token_bank = set()
    for product in products:
        token_bank.update(_meaningful_tokens(product.name or ""))
        token_bank.update(_meaningful_tokens(product.wood_type or ""))

    matched = [token for token in token_bank if re.search(rf"\b{re.escape(token)}\b", txt)]
    if not matched:
        return None

    # Prefer longer terms first (e.g. "mahogany" over "oak")
    matched.sort(key=len, reverse=True)
    return matched[0]


def _filter_products(
    products: List[Product],
    term: Optional[str] = None,
    category: Optional[str] = None,
    size: Optional[str] = None,
) -> List[Product]:
    clean_term = _normalize(term)
    clean_category = _normalize(category)
    clean_size = _compact_size(size)

    out: List[Product] = []
    for product in products:
        name = _normalize(product.name)
        wood_type = _normalize(product.wood_type)
        product_size = _compact_size(product.size)

        if clean_term and clean_term not in name and clean_term not in wood_type:
            continue
        if clean_category and clean_category not in wood_type and clean_category not in name:
            continue
        if clean_size and clean_size != product_size:
            continue
        out.append(product)

    return sorted(out, key=lambda p: (p.stock_quantity or 0, -(p.price or 0), p.id), reverse=True)


def _render_product_lines(products: List[Product], limit: int = 4) -> str:
    lines: List[str] = []
    for p in products[:limit]:
        lines.append(f"- {p.name} ({p.size}) - KES {p.price:,.0f} per piece, stock {p.stock_quantity}")
    return "\n".join(lines)


def _calculate_delivery(location: Optional[str]) -> int:
    if not location:
        return 5000
    loc = _normalize(location)
    if _is_pickup_location(loc):
        return 0
    zone_rates = {
        "nairobi": 1000,
        "ruaka": 1200,
        "rongai": 1500,
        "kitengela": 2000,
        "kiambu": 1800,
        "juja": 1800,
        "westlands": 1200,
        "ruiru": 1700,
        "thika": 2400,
    }
    for zone, fee in zone_rates.items():
        if zone in loc:
            return fee
    return 4000


def _build_quote(product: Product, quantity: int, location: Optional[str]) -> Dict[str, Any]:
    subtotal = (product.price or 0) * quantity
    delivery_fee = _calculate_delivery(location)
    total = subtotal + delivery_fee
    return {
        "product_name": product.name,
        "size": product.size,
        "quantity": quantity,
        "unit_price": product.price or 0,
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "delivery_location": location,
        "total_quote": total,
    }


def _latest_assistant_message(db: Session, session_id: int) -> str:
    msg = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.session_id == session_id, ConversationMessage.sender == "assistant")
        .order_by(ConversationMessage.timestamp.desc())
        .first()
    )
    return msg.message_text if msg else ""


def _customer_history_text(db: Session, session_id: int, limit: int = 25) -> str:
    rows = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.session_id == session_id, ConversationMessage.sender == "customer")
        .order_by(ConversationMessage.timestamp.asc())
        .limit(limit)
        .all()
    )
    return " ".join((r.message_text or "") for r in rows)


def _resolve_product_from_session(products: List[Product], current_product: Optional[str], current_size: Optional[str]) -> Optional[Product]:
    if not current_product:
        return None
    matches = _filter_products(products, term=current_product, size=current_size)
    if not matches:
        matches = _filter_products(products, term=current_product)
    return matches[0] if matches else None


def _avoid_repeat(last_assistant_text: str, candidate_reply: str) -> str:
    if _normalize(last_assistant_text) == _normalize(candidate_reply):
        return candidate_reply + " You can also send all order details in one message for a faster quote."
    return candidate_reply


def determine_next_question(conversation_state: str, structured: Dict[str, Any]) -> str:
    state = conversation_state or "greeting"
    if state == "greeting":
        return "What timber type and size do you need?"
    if state == "awaiting_product":
        return "Which timber type do you want?"
    if state == "awaiting_size":
        return "What size do you need? For example 4x2 or 3x2."
    if state == "awaiting_quantity":
        return "How many pieces do you need?"
    if state == "awaiting_location":
        return "Where should we deliver?"
    if state == "awaiting_quote_confirmation":
        return "Would you like me to confirm this order?"
    return "How can I help you with your timber order?"


def render_natural_language(structured: Dict[str, Any]) -> str:
    # Kept for backwards compatibility. Orchestration now returns ready-to-send text directly.
    state = structured.get("conversation_state", "greeting")
    return determine_next_question(state, structured)


def orchestrate_reply(db: Session, conv, incoming_text: str) -> Dict[str, Any]:
    incoming = (incoming_text or "").strip()
    normalized_incoming = _normalize(incoming)
    previous_state = conv.conversation_state or "greeting"

    if _wants_human_handoff(incoming):
        conv.status = "pending_human"
        conv.conversation_state = "awaiting_human"
        return {
            "structured": {"intent": "handoff", "conversation_state": "awaiting_human"},
            "ai_text": "Understood. I have alerted our human sales team to take over this chat now. Please share your name and phone number if you would like a faster callback.",
        }

    if conv.status == "pending_human":
        return {
            "structured": {"intent": "handoff_wait", "conversation_state": conv.conversation_state or "awaiting_human"},
            "ai_text": "A human sales agent will reply shortly. I have already flagged your chat for priority follow-up.",
        }

    products = _load_products(db)
    history_text = _customer_history_text(db, conv.id)
    intent = _detect_intent(incoming)
    incoming_category = _extract_category(incoming, products)
    extracted_term = _extract_product_term(incoming, products)
    # Keep category from session only if current_product itself is a category value.
    session_product_text = _normalize(conv.current_product)
    category = incoming_category
    if not category and not extracted_term and session_product_text in _all_categories(products):
        category = session_product_text
    size = _extract_size(incoming) or _compact_size(conv.current_size) or _extract_size(history_text)
    quantity, quantity_unit = _extract_quantity(incoming)
    delivery_time = _extract_delivery_time(incoming) or _extract_delivery_time(history_text)
    fulfillment_preference = _extract_fulfillment_preference(incoming)
    location = _extract_location(incoming) or _extract_location(history_text) or conv.current_location
    if fulfillment_preference == "pickup":
        location = PICKUP_LOCATION_LABEL
    elif fulfillment_preference == "delivery" and _is_pickup_location(location):
        # Customer switched from pickup to delivery and still needs to provide a location.
        location = None

    wants_lorry = "lorry" in normalized_incoming or "truck" in normalized_incoming or "lorry" in _normalize(history_text)
    if quantity is None:
        quantity = conv.current_quantity

    term = extracted_term or _normalize(conv.current_product)
    selected_product: Optional[Product] = None

    exact_matches = _filter_products(products, term=term, category=category, size=size)
    broad_matches = _filter_products(products, term=term, category=category, size=None) if (term or category) else []
    category_matches = _filter_products(products, category=category) if category else []

    if len(exact_matches) == 1:
        selected_product = exact_matches[0]
    elif len(exact_matches) > 1 and size:
        selected_product = exact_matches[0]
    elif not exact_matches and term and not extracted_term:
        session_product = _resolve_product_from_session(products, conv.current_product, conv.current_size)
        if session_product:
            selected_product = session_product
    elif len(broad_matches) == 1:
        selected_product = broad_matches[0]

    if selected_product:
        conv.current_product = selected_product.name
        conv.current_size = _compact_size(size or selected_product.size)
    elif term:
        conv.current_product = term
        if size:
            conv.current_size = _compact_size(size)
    elif category:
        conv.current_product = category
        if size:
            conv.current_size = _compact_size(size)

    if quantity is not None:
        conv.current_quantity = quantity
    if location:
        conv.current_location = location

    has_product = bool(selected_product)
    has_size = bool(conv.current_size)

    structured: Dict[str, Any] = {
        "intent": intent,
        "conversation_state": previous_state,
        "product_term": term,
        "category": category,
        "selected_product": selected_product.name if selected_product else None,
        "size": conv.current_size,
        "quantity": conv.current_quantity,
        "quantity_unit": quantity_unit,
        "delivery_location": conv.current_location,
        "delivery_time": delivery_time,
        "fulfillment_preference": fulfillment_preference,
        "wants_lorry": wants_lorry,
        "candidate_count": len(exact_matches),
    }

    reply = ""

    # 1) Greetings with no concrete details.
    if intent == "greeting" and not any([term, category, size, quantity]):
        conv.conversation_state = "awaiting_product"
        reply = "Welcome to Elecon Timberyard. Tell me the timber type, size, and quantity you need, and I will quote instantly."
        return {"structured": structured, "ai_text": _avoid_repeat(_latest_assistant_message(db, conv.id), reply)}

    # 2) Handle category / product price and stock questions.
    if intent in {"price", "stock"} and (category_matches or broad_matches or exact_matches or selected_product):
        display_matches = exact_matches or broad_matches or category_matches
        if selected_product and not display_matches:
            display_matches = [selected_product]

        if len(display_matches) == 1:
            p = display_matches[0]
            conv.conversation_state = "awaiting_quantity"
            reply = (
                f"{p.name} ({p.size}) is KES {p.price:,.0f} per piece, and we have {p.stock_quantity} in stock. "
                "How many pieces would you like?"
            )
        else:
            conv.conversation_state = "awaiting_product"
            reply = "Here are current options:\n" + _render_product_lines(display_matches) + "\nWhich one should I quote for you?"
        return {"structured": structured, "ai_text": _avoid_repeat(_latest_assistant_message(db, conv.id), reply)}

    # 3) If no exact match but close options exist for same term.
    if term and size and not exact_matches and broad_matches:
        conv.conversation_state = "awaiting_size"
        reply = (
            f"I do not currently have {term.title()} in {size}. "
            "Closest available options are:\n"
            f"{_render_product_lines(broad_matches)}\n"
            "Which size would you like?"
        )
        return {"structured": structured, "ai_text": _avoid_repeat(_latest_assistant_message(db, conv.id), reply)}

    # 4) If user only asked category, prompt with live options.
    if category and not selected_product and category_matches:
        conv.conversation_state = "awaiting_product"
        reply = (
            f"For {category.title()}, we currently have:\n"
            f"{_render_product_lines(category_matches)}\n"
            "Tell me the one you want and quantity, then I will prepare your quote."
        )
        return {"structured": structured, "ai_text": _avoid_repeat(_latest_assistant_message(db, conv.id), reply)}

    # 5) If product still unknown, ask once with helpful guidance.
    if not has_product:
        conv.conversation_state = "awaiting_product"
        available_types = sorted({_normalize(p.wood_type).title() for p in products if p.wood_type})
        if available_types:
            types_text = ", ".join(available_types[:6])
            reply = (
                "I can help you place the order quickly. "
                f"Which timber type do you need? Available categories include: {types_text}."
            )
        else:
            reply = "Which timber type do you need? For example Cypress, Mahogany, or Structural timber."
        return {"structured": structured, "ai_text": _avoid_repeat(_latest_assistant_message(db, conv.id), reply)}

    # 6) Ask for size if still missing.
    if not has_size:
        conv.conversation_state = "awaiting_size"
        reply = f"Great choice. What size do you need for {selected_product.name if selected_product else conv.current_product}? For example 4x2 or 3x2."
        return {"structured": structured, "ai_text": _avoid_repeat(_latest_assistant_message(db, conv.id), reply)}

    # 7) Ask for quantity.
    if conv.current_quantity is None:
        conv.conversation_state = "awaiting_quantity"
        if wants_lorry and selected_product:
            reply = (
                f"{selected_product.name} ({selected_product.size}) is available at KES {selected_product.price:,.0f} per piece "
                f"with stock {selected_product.stock_quantity}. For a lorry order, share your estimated pieces so I can quote accurately."
            )
        else:
            reply = "How many pieces would you like for this size?"
        return {"structured": structured, "ai_text": _avoid_repeat(_latest_assistant_message(db, conv.id), reply)}

    # 8) Validate stock before quote.
    if selected_product and conv.current_quantity and selected_product.stock_quantity < conv.current_quantity:
        conv.conversation_state = "awaiting_quantity"
        reply = (
            f"We currently have {selected_product.stock_quantity} pieces of {selected_product.name} ({selected_product.size}) in stock. "
            "Please share a lower quantity or choose another product."
        )
        return {"structured": structured, "ai_text": _avoid_repeat(_latest_assistant_message(db, conv.id), reply)}

    # 9) Ask for location.
    if not conv.current_location:
        conv.conversation_state = "awaiting_location"
        reply = "Noted. Which location should we deliver to so I can include transport in the quote?"
        return {"structured": structured, "ai_text": _avoid_repeat(_latest_assistant_message(db, conv.id), reply)}

    # 10) Build quote and ask for confirmation.
    quote = _build_quote(selected_product, conv.current_quantity, conv.current_location)
    conv.quote_amount = quote["total_quote"]

    # If user is confirming after quote, move to awaiting_payment.
    if previous_state == "awaiting_quote_confirmation" and _is_affirmative(incoming):
        conv.conversation_state = "awaiting_payment"
        reply = (
            "Order captured successfully.\n"
            f"- Product: {selected_product.name} ({selected_product.size})\n"
            f"- Quantity: {conv.current_quantity} pieces\n"
            + (
                "- Fulfillment: Pickup at Juja yard"
                if _is_pickup_location(conv.current_location)
                else f"- Delivery: {conv.current_location}"
            )
        )
        if delivery_time:
            reply += f"\n- Delivery timing: {delivery_time.title()}"
        reply += (
            f"\n- Total estimate: KES {quote['total_quote']:,.0f}\n"
            "Our sales team can now finalize payment and dispatch details."
        )
    else:
        conv.conversation_state = "awaiting_quote_confirmation"
        reply = (
            "Perfect. Here is your estimate:\n"
            f"- Product: {selected_product.name} ({selected_product.size})\n"
            f"- Quantity: {conv.current_quantity} pieces at KES {quote['unit_price']:,.0f} each\n"
            f"- Subtotal: KES {quote['subtotal']:,.0f}\n"
            + (
                "- Fulfillment: Pickup at Juja yard (delivery fee KES 0)"
                if _is_pickup_location(conv.current_location)
                else f"- Delivery to {conv.current_location}: KES {quote['delivery_fee']:,.0f}"
            )
        )
        if delivery_time:
            reply += f"\n- Delivery timing: {delivery_time.title()}"
        reply += f"\n- Total: KES {quote['total_quote']:,.0f}\nReply YES to confirm this order."

    return {"structured": structured, "ai_text": _avoid_repeat(_latest_assistant_message(db, conv.id), reply)}


def ask_ai(prompt: str) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return "Thanks for your message. I can help with prices, stock checks, and order placement."

    try:
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful timber sales assistant. Be concise and practical.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=180,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return "Thanks for your message. I can help with prices, stock checks, and order placement."
