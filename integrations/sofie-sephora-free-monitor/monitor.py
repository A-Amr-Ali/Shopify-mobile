"""Free authorized-feed monitor for SOFIE. No Shopify calls, ever."""
import csv, io, json, os, urllib.parse, urllib.request
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from datetime import datetime, timezone

PROTECTED_COLLECTION = "gid://shopify/Collection/349396566087"
EXPECTED = {"US":"USD", "UAE":"AED"}
MAX_BYTES = 12 * 1024 * 1024

def calculate(market, price, weight_kg, item_count):
    if market not in EXPECTED: raise ValueError("Invalid market")
    amount = Decimal(str(price)); weight = Decimal(str(weight_kg))
    if not amount.is_finite() or not weight.is_finite() or amount < 0 or weight < 0 or item_count < 1:
        raise ValueError("Invalid price, weight, or quantity")
    multiplier, shipping = (Decimal("112"),Decimal("2500")) if market=="US" else (Decimal("27"),Decimal("900"))
    return (amount*multiplier+weight*shipping+Decimal("500")*item_count).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def read_feed(data, market, kind="csv"):
    if kind=="json":
        obj=json.loads(data)
        rows=obj["products"] if isinstance(obj,dict) else obj
    else:
        rows=list(csv.DictReader(io.StringIO(data)))
    if not isinstance(rows,list) or not rows: raise ValueError("Empty feed")
    items={}
    for row in rows:
        key=str(row.get("source_id") or "").strip()
        brand=str(row.get("brand") or "").strip()
        title=str(row.get("title") or "").strip()
        currency=str(row.get("currency") or "").upper()
        status=str(row.get("stock_status") or "unknown").lower()
        if not key or not brand or not title or currency!=EXPECTED[market]: raise ValueError("Missing identity or invalid currency")
        if status not in ("in_stock","out_of_stock","unknown"): raise ValueError("Invalid stock status")
        if key in items: raise ValueError("Duplicate source_id")
        p=Decimal(str(row.get("price","")))
        weight_str=str(row.get("weight_kg") or "").strip()
        w=Decimal(weight_str) if weight_str else None
        n=int(str(row.get("item_count") or 1))
        if not p.is_finite() or p<0 or (w is not None and (not w.is_finite() or w<0)) or n<1: raise ValueError("Invalid price, shipping weight or unit count")
        items[key]={"id":key,"brand":brand,"title":title,"variant":str(row.get("variant") or ""),
                    "barcode":str(row.get("barcode") or ""),"currency":currency,"price":p,
                    "weight_kg":w,"item_count":n,"status":status}
    return items

def licensed_https(url):
    if os.getenv("SOURCE_RIGHTS_CONFIRMED","false").lower()!="true":
        raise PermissionError("Commercial reuse permission not verified")
    u=urllib.parse.urlparse(url)
    hosts={x.strip().lower() for x in os.getenv("AUTHORIZED_FEED_HOSTS","").split(",") if x.strip()}
    if u.scheme!="https" or u.hostname not in hosts or u.username or u.password or u.port not in (None,443):
        raise PermissionError("Unapproved source host")
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,req,fp,code,msg,headers,newurl): raise PermissionError("Redirect denied")
    opener=urllib.request.build_opener(NoRedirect)
    with opener.open(urllib.request.Request(url,headers={"User-Agent":"SOFIE-Authorized-Catalog-Feed/1.0"}),timeout=20) as resp:
        raw=resp.read(MAX_BYTES+1)
    if len(raw)>MAX_BYTES: raise ValueError("Feed too large")
    return raw.decode("utf-8-sig")

def ingest(market, products, db_url):
    import psycopg
    events=[]
    with psycopg.connect(db_url, connect_timeout=12) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT authorization_status,ingestion_enabled FROM sofie_catalog_sync.source_registry WHERE market=%s",(market,))
            if cur.fetchone()!=("verified",True): raise PermissionError("Provider not authorized in Supabase registry")
            for item in products.values():
                cur.execute("SELECT id,source_price,source_status,total_weight_kg,item_count FROM sofie_catalog_sync.source_products WHERE market=%s AND source_product_id=%s FOR UPDATE",(market,item["id"]))
                old=cur.fetchone()
                changes=[]
                if old is None: changes=["new"]
                else:
                    if old[1]!=item["price"]: changes.append("price_changed")
                    if old[2]!=item["status"]:
                        changes.append("restocked" if old[2]=="out_of_stock" and item["status"]=="in_stock"
                           else "sold_out" if old[2]=="in_stock" and item["status"]=="out_of_stock"
                           else "stock_status_changed")
                    if old[3]!=item["weight_kg"] or old[4]!=item["item_count"]:
                        changes.append("shipping_or_bundle_changed")
                canonical="|".join((item["brand"].lower(),item["barcode"],item["variant"].lower()))
                cur.execute("""INSERT INTO sofie_catalog_sync.source_products
                   (market,source_product_id,canonical_key,gtin,title,source_currency,source_price,total_weight_kg,item_count,source_status,last_seen_at)
                   VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())
                   ON CONFLICT(market,source_product_id) DO UPDATE SET
                   canonical_key=EXCLUDED.canonical_key,gtin=EXCLUDED.gtin,title=EXCLUDED.title,
                   source_price=EXCLUDED.source_price,total_weight_kg=EXCLUDED.total_weight_kg,
                   item_count=EXCLUDED.item_count,source_status=EXCLUDED.source_status,last_seen_at=now()
                   RETURNING id""",(market,item["id"],canonical,item["barcode"] or None,item["title"],
                                      item["currency"],item["price"],item["weight_kg"],item["item_count"],item["status"]))
                pk=cur.fetchone()[0]
                for kind in changes:
                    cur.execute("""INSERT INTO sofie_catalog_sync.change_events(source_product_id,event_type,old_values,new_values)
                        VALUES(%s,%s,%s::jsonb,%s::jsonb)""",(pk,kind,
                        json.dumps({"price":str(old[1]),"status":old[2]} if old else None),
                        json.dumps({"price":str(item["price"]),"status":item["status"]})))
                    events.append({"key":f"{market}:{item['id']}","event":kind})
    return events

def main():
    report={"checked_at":datetime.now(timezone.utc).isoformat(),"mode":"source_monitor_only",
            "shopify_writes":0,"sofie_now_writes":0,"sources":{},"changes":[],"proposals":[],"warnings":[]}
    db=os.getenv("SUPABASE_DB_URL")
    for market in ("US","UAE"):
        url=os.getenv(f"FEED_{market}_URL")
        if not url:
            report["sources"][market]="not_configured"
            continue
        try:
            data=licensed_https(url)
            items=read_feed(data,market,"json" if url.split("?")[0].endswith(".json") else "csv")
            if not db: raise RuntimeError("SUPABASE_DB_URL missing; history unavailable")
            report["changes"]+=ingest(market,items,db)
            for item in items.values():
                weight=item["weight_kg"]
                report["proposals"].append({"market":market,"source_id":item["id"],"name":item["title"],
                    "egp_price":str(calculate(market,item["price"],weight,item["item_count"])) if weight is not None else None,
                    "hold": "missing_shipping_weight" if weight is None else "manual_review_required",
                    "shopify_write_allowed":False})
            report["sources"][market]=f"processed_{len(items)}"
        except Exception as exc:
            report["sources"][market]="blocked_or_failed"
            report["warnings"].append(f"{market}: {type(exc).__name__}: {exc}")
    Path("reports").mkdir(exist_ok=True)
    Path("reports/latest.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps({"sources":report["sources"],"changes":len(report["changes"]),
                      "warnings":report["warnings"],"shopify_writes":0},indent=2))
    if any(x=="blocked_or_failed" for x in report["sources"].values()):
        raise SystemExit(1)

if __name__=="__main__": main()
