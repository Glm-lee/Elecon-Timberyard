import requests

s = requests.post('http://localhost:8000/chat/session', json={'channel':'website','customer_phone':'+254700000001'})
print('session', s.status_code, s.text)
if s.status_code == 200:
    sid = s.json().get('id')
    r = requests.post(f'http://localhost:8000/chat/sessions/{sid}/messages', json={'message':'I need roofing timber','sender':'customer'})
    print('send', r.status_code, r.text)
