from __future__ import annotations
import io, logging, os
from datetime import datetime, timedelta
from typing import Optional
logger = logging.getLogger(__name__)
COMPANY_NAME='Elecon Timberyard'
COMPANY_TAGLINE='Quality Timber for Every Project'
COMPANY_ADDRESS='Industrial Area, Nairobi, Kenya'
COMPANY_PHONE='+254 700 000 000'
COMPANY_EMAIL='info@elecontimberyard.co.ke'
COMPANY_KRA_PIN='P000000000A'
VAT_RATE=0.16
QUOTE_VALIDITY_DAYS=14
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image as RLImage
W,H=A4
MARGIN=20*mm
TIMBER_ORANGE=HexColor('#d4872a')
SAND_DARK=HexColor('#2d2920')
SAND_MID=HexColor('#675f48')
SAND_LIGHT=HexColor('#e8e6d8')
SAND_PALE=HexColor('#fdf8f0')
ASSETS_DIR=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','assets'))
LOGO_PATH=os.path.join(ASSETS_DIR,'elecon-logo-dark.png')
def _styles():
    S=ParagraphStyle
    return {
        'company':     S('company',    fontSize=22,textColor=TIMBER_ORANGE,fontName='Helvetica-Bold',leading=26),
        'company_sub': S('company_sub',fontSize=9, textColor=SAND_MID,    fontName='Helvetica',     leading=13),
        'doc_title':   S('doc_title',  fontSize=26,textColor=SAND_DARK,   fontName='Helvetica-Bold',leading=30),
        'doc_meta':    S('doc_meta',   fontSize=10,textColor=SAND_MID,    fontName='Helvetica',     leading=14),
        'sec_hdr':     S('sec_hdr',    fontSize=8, textColor=white,       fontName='Helvetica-Bold',leading=12),
        'body':        S('body',       fontSize=9, textColor=SAND_DARK,   fontName='Helvetica',     leading=14),
        'body_bold':   S('body_bold',  fontSize=9, textColor=SAND_DARK,   fontName='Helvetica-Bold',leading=14),
        'small':       S('small',      fontSize=8, textColor=SAND_MID,    fontName='Helvetica',     leading=12),
        'right':       S('right',      fontSize=9, textColor=SAND_DARK,   fontName='Helvetica',     leading=14,alignment=TA_RIGHT),
        'grand_total': S('grand_total',fontSize=13,textColor=white,       fontName='Helvetica-Bold',leading=17),
        'footer':      S('footer',     fontSize=8, textColor=SAND_MID,    fontName='Helvetica',     leading=11,alignment=TA_CENTER),
    }
def _brand_block(s):
    parts=[]
    if os.path.exists(LOGO_PATH):
        parts.append(RLImage(LOGO_PATH,width=58*mm,height=15*mm))
        parts.append(Spacer(1,1*mm))
    else:
        parts.append(Paragraph(COMPANY_NAME,s['company']))
    parts.append(Paragraph(COMPANY_TAGLINE,s['company_sub']))
    parts.append(Paragraph(COMPANY_ADDRESS,s['company_sub']))
    parts.append(Paragraph(f'{COMPANY_PHONE}  .  {COMPANY_EMAIL}',s['company_sub']))
    return parts
def _header(s,doc_type,ref,issue_date,extra):
    story=_brand_block(s)+[Spacer(1,8*mm),HRFlowable(width='100%',thickness=2,color=TIMBER_ORANGE,spaceAfter=4*mm)]
    meta=['<b>'+doc_type+'</b>',f'Ref: <b>{ref}</b>',f'Date: {issue_date}']+[f'{k}: {v}' for k,v in extra.items()]
    t=Table([[Paragraph(doc_type,s['doc_title']),Paragraph('<br/>'.join(meta),s['doc_meta'])]],colWidths=[(W-2*MARGIN)*0.5]*2)
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('ALIGN',(1,0),(1,0),'RIGHT')]))
    story.append(t)
    story.append(Spacer(1,6*mm))
    return story
def _address(s,bill_to,ship_to=None):
    def cell(title,d):
        lines=['<b>'+title+'</b>']+[d[k] for k in ('name','phone','email','address') if d.get(k)]
        return Paragraph('<br/>'.join(lines),s['body'])
    cells=[cell('BILL TO',bill_to)]
    widths=[W-2*MARGIN]
    if ship_to:
        cells.append(cell('DELIVER TO',ship_to))
        widths=[(W-2*MARGIN)*0.5]*2
    t=Table([cells],colWidths=widths)
    t.setStyle(TableStyle([('BOX',(0,0),(-1,-1),0.5,SAND_LIGHT),('INNERGRID',(0,0),(-1,-1),0.5,SAND_LIGHT),('BACKGROUND',(0,0),(-1,-1),SAND_PALE),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('LEFTPADDING',(0,0),(-1,-1),8)]))
    return [t,Spacer(1,6*mm)]
def _items_table(s,items):
    CW=[(W-2*MARGIN)*r for r in [0.40,0.10,0.10,0.18,0.22]]
    header=[Paragraph(h,s['sec_hdr']) for h in ('DESCRIPTION','QTY','UNIT','UNIT PRICE','AMOUNT')]
    data=[header]
    subtotal=0.0
    for item in items:
        up=float(item.get('unit_price',0));qty=float(item.get('qty',1));line=float(item.get('subtotal',up*qty));subtotal+=line
        data.append([Paragraph(item.get('description',''),s['body']),Paragraph(str(qty),s['body']),Paragraph(item.get('unit','m'),s['body']),Paragraph(f'KES {up:,.0f}',s['right']),Paragraph(f'KES {line:,.0f}',s['right'])])
    vat=subtotal*VAT_RATE;total=subtotal+vat
    def row(label,val,bold=False):
        st=s['body_bold'] if bold else s['body']
        return ['','','',Paragraph(label,st),Paragraph(f'KES {val:,.0f}',s['right'])]
    data.append(row('Subtotal (excl. VAT)',subtotal))
    data.append(row(f'VAT ({int(VAT_RATE*100)}%)',vat))
    gt=len(data)
    data.append(['','','',Paragraph('TOTAL DUE',s['grand_total']),Paragraph(f'KES {total:,.2f}',s['grand_total'])])
    t=Table(data,colWidths=CW,repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),TIMBER_ORANGE),('FONTSIZE',(0,0),(-1,0),8),('TOPPADDING',(0,0),(-1,0),6),('BOTTOMPADDING',(0,0),(-1,0),6),('FONTSIZE',(0,1),(-1,-1),9),('TOPPADDING',(0,1),(-1,-1),5),('BOTTOMPADDING',(0,1),(-1,-1),5),('ROWBACKGROUNDS',(0,1),(-1,gt-1),[white,SAND_PALE]),('LINEABOVE',(0,gt-2),(-1,gt-2),1,SAND_LIGHT),('BACKGROUND',(0,gt),(-1,gt),SAND_DARK),('TOPPADDING',(0,gt),(-1,gt),8),('BOTTOMPADDING',(0,gt),(-1,gt),8),('GRID',(0,0),(-1,gt-1),0.3,SAND_LIGHT),('ALIGN',(3,0),(-1,-1),'RIGHT'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('SPAN',(0,gt-2),(2,gt))]))
    return [t]
def _footer(s,note=''):
    parts=[Spacer(1,8*mm),HRFlowable(width='100%',thickness=0.5,color=SAND_LIGHT),Paragraph(f'{COMPANY_NAME}  .  {COMPANY_ADDRESS}  .  {COMPANY_PHONE}  .  KRA PIN: {COMPANY_KRA_PIN}',s['footer'])]
    if note: parts+=[Spacer(1,3*mm),Paragraph(note,s['footer'])]
    return parts
def generate_quote_pdf(quote_data:dict)->bytes:
    buf=io.BytesIO()
    doc=SimpleDocTemplate(buf,pagesize=A4,leftMargin=MARGIN,rightMargin=MARGIN,topMargin=MARGIN,bottomMargin=MARGIN)
    s=_styles()
    issue_date=quote_data.get('issue_date',datetime.utcnow().strftime('%d %B %Y'))
    valid_until=quote_data.get('valid_until',(datetime.utcnow()+timedelta(days=QUOTE_VALIDITY_DAYS)).strftime('%d %B %Y'))
    ref=quote_data.get('quote_number',f'QT-{datetime.utcnow().strftime("%Y%m%d%H%M")}')
    story=_header(s,'QUOTATION',ref,issue_date,{'Valid until':valid_until})
    story+=_address(s,quote_data.get('customer',{}),quote_data.get('delivery_addr'))
    story+=_items_table(s,quote_data.get('items',[]))
    terms='Terms: Quote valid 14 days. Prices inclusive of 16% VAT. 50% deposit required on confirmation.'
    story.append(Spacer(1,6*mm))
    if quote_data.get('notes'): story.append(Paragraph('<b>Notes:</b> '+quote_data['notes'],s['small']));story.append(Spacer(1,3*mm))
    story.append(Paragraph(terms,s['small']))
    story+=_footer(s,'Thank you for choosing Elecon Timberyard.')
    doc.build(story)
    return buf.getvalue()
def generate_invoice_pdf(invoice_data:dict)->bytes:
    buf=io.BytesIO()
    doc=SimpleDocTemplate(buf,pagesize=A4,leftMargin=MARGIN,rightMargin=MARGIN,topMargin=MARGIN,bottomMargin=MARGIN)
    s=_styles()
    issue_date=invoice_data.get('issue_date',datetime.utcnow().strftime('%d %B %Y'))
    ref=invoice_data.get('invoice_number',f'INV-{invoice_data.get("order_id","000")}')
    extra={}
    if invoice_data.get('mpesa_receipt'): extra['M-Pesa receipt']=invoice_data['mpesa_receipt']
    extra['Payment']=invoice_data.get('payment_status','pending').upper()
    story=_header(s,'TAX INVOICE',ref,issue_date,extra)
    story+=_address(s,invoice_data.get('customer',{}),invoice_data.get('delivery_addr'))
    story+=_items_table(s,invoice_data.get('items',[]))
    story.append(Spacer(1,6*mm))
    if invoice_data.get('payment_status','pending') in ('pending','unpaid'): story.append(Paragraph('<b>Payment:</b> M-Pesa Paybill XXXXXXX  Account: invoice number above',s['small']))
    if invoice_data.get('notes'): story.append(Spacer(1,3*mm));story.append(Paragraph('<b>Notes:</b> '+invoice_data['notes'],s['small']))
    story.append(Spacer(1,3*mm));story.append(Paragraph('Computer-generated document - no physical signature required.',s['small']))
    story+=_footer(s,'Thank you for your business!')
    doc.build(story)
    return buf.getvalue()
def invoice_data_from_order(order,payment=None)->dict:
    items=[]
    for item in (order.items if hasattr(order,'items') and order.items else []):
        product=getattr(item,'product',None)
        name=product.name if product else f'Product #{item.product_id}'
        size=product.size if product else ''
        items.append({'description':f'{name} ({size})' if size else name,'qty':item.quantity,'unit':'m','unit_price':item.unit_price,'subtotal':item.subtotal})
    customer=getattr(order,'customer',None)
    return {'invoice_number':f'INV-{order.id:05d}','order_id':order.id,'issue_date':datetime.utcnow().strftime('%d %B %Y'),'customer':{'name':customer.name if customer else 'Customer','phone':customer.phone if customer else '','email':customer.email if customer else '','address':order.delivery_location or ''},'items':items,'mpesa_receipt':payment.mpesa_receipt if payment else None,'payment_status':payment.status if payment else order.payment_status,'notes':''}
