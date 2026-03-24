import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import SessionLocal
from backend.app.models.models import Customer, ConversationSession, ConversationMessage, Product, Order

client = TestClient(app)


def create_admin_and_token():
    # register admin
    resp = client.post('/auth/register', json={"name": "Admin", "email": "admin@test", "password": "pass123", "role": "owner"})
    assert resp.status_code == 200
    data = resp.json()
    return data['access_token']


def test_full_message_flow_and_order_creation():
    token = create_admin_and_token()
    headers = {"Authorization": f"Bearer {token}"}

    # prepare DB fixtures
    db = SessionLocal()
    cust = Customer(name="Test Cust", phone="+254700000001", preferred_channel="whatsapp")
    db.add(cust)
    db.commit(); db.refresh(cust)

    # add product that matches
    prod = Product(name="Cedar 4x2", wood_type="cedar", size="4x2", price=200.0, stock_quantity=500)
    db.add(prod); db.commit(); db.refresh(prod)

    # create session and messages
    sess = ConversationSession(customer_id=cust.id, channel="whatsapp", status="active", conversation_state="awaiting_quantity", current_product="cedar", current_size="4x2", current_quantity=50, current_location="ruaka", quote_amount=50*200)
    db.add(sess); db.commit(); db.refresh(sess)

    # create some customer messages (unread)
    m1 = ConversationMessage(session_id=sess.id, sender="customer", message_text="Need 50 cedar", read=False)
    m2 = ConversationMessage(session_id=sess.id, sender="customer", message_text="Can you deliver to Ruaka?", read=False)
    m3 = ConversationMessage(session_id=sess.id, sender="assistant", message_text="We can quote", read=True)
    db.add_all([m1, m2, m3]); db.commit()

    # call sessions list
    res = client.get('/admin/sessions?status=active&page=1&page_size=10', headers=headers)
    assert res.status_code == 200
    payload = res.json()
    assert payload['total'] >= 1
    # find our session in response
    found = [s for s in payload['sessions'] if s['session_id'] == sess.id]
    assert len(found) == 1
    assert found[0]['unread_count'] == 2

    # list messages
    res2 = client.get(f'/admin/sessions/{sess.id}/messages?page=1&page_size=50&sort=asc', headers=headers)
    assert res2.status_code == 200
    msgs = res2.json()['messages']
    assert any(m['message_text'] == 'Need 50 cedar' for m in msgs)

    # mark one message read
    msg_id = msgs[0]['id']
    res3 = client.post(f'/admin/sessions/{sess.id}/messages/{msg_id}/mark_read', headers=headers)
    assert res3.status_code == 200

    # unread count should reduce
    res4 = client.get(f'/admin/sessions?status=active&page=1&page_size=10', headers=headers)
    payload2 = res4.json()
    found2 = [s for s in payload2['sessions'] if s['session_id'] == sess.id][0]
    assert found2['unread_count'] == 1

    # send admin quote confirmation to create order
    res5 = client.post(f'/admin/sessions/{sess.id}/messages/send', params={'content': 'quote: confirm'}, headers=headers)
    assert res5.status_code == 200

    # check order created
    db.refresh(sess)
    orders = db.query(Order).filter(Order.customer_id == cust.id).all()
    assert len(orders) >= 1
    db.close()
