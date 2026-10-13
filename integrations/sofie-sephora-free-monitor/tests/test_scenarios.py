"""CI scenario tests for the free authorized feed monitor.

These tests do not access Shopify, Supabase, or Sephora.
"""
import csv
import io
import json
import sys
import types
import unittest
from unittest.mock import patch
from decimal import Decimal
from monitor import calculate, read_feed, ingest, licensed_https

def item(product_id="sku-1", price="100", status="in_stock", weight="0.5", item_count=1):
    return {"id":product_id,"brand":"Example Brand","title":"Example Product","variant":"Rose",
            "barcode":"000000000001","currency":"USD","price":Decimal(price),
            "weight_kg":Decimal(weight) if weight is not None else None,
            "item_count":item_count,"status":status}

class MemoryDB:
    def __init__(self, allowed=True):
        self.allowed=allowed
        self.products={}
        self.events=[]
        self.next_id=1

    def connect(self, _url, connect_timeout):
        db=self
        class Conn:
            def __enter__(self):return self
            def __exit__(self,*_args):return False
            def cursor(self):
                class Cursor:
                    def __enter__(self):return self
                    def __exit__(self,*_args):return False
                    def execute(self, sql, params):
                        if "SELECT authorization_status" in sql:
                            self.result=("verified",True) if db.allowed else ("not_verified",False)
                        elif "SELECT id,source_price" in sql:
                            self.result=db.products.get((params[0],params[1]))
                        elif "INSERT INTO sofie_catalog_sync.source_products" in sql:
                            market,source_id,canonical,gtin,title,currency,price,weight,count,status=params
                            old=db.products.get((market,source_id))
                            pk=old[0] if old else db.next_id
                            if not old: db.next_id+=1
                            db.products[(market,source_id)]=(pk,price,status,weight,count)
                            self.result=(pk,)
                        elif "INSERT INTO sofie_catalog_sync.change_events" in sql:
                            db.events.append(params[1])
                            self.result=None
                        else:
                            raise AssertionError("Unexpected SQL: "+sql)
                    def fetchone(self): return self.result
                return Cursor()
        return Conn()

class SourceScenarioTests(unittest.TestCase):
    def run_sync(self, db, products):
        with patch.dict(sys.modules,{"psycopg":types.SimpleNamespace(connect=db.connect)}):
            return ingest("US",products,"unused-fake-url")

    def test_first_sighting_is_new(self):
        db=MemoryDB()
        ev=self.run_sync(db,{"sku-1":item()})
        self.assertEqual([x["event"] for x in ev],["new"])
        self.assertEqual(db.events,["new"])

    def test_repeat_identical_snapshot_does_not_duplicate_events(self):
        db=MemoryDB()
        products={"sku-1":item()}
        self.run_sync(db,products)
        self.assertEqual(self.run_sync(db,products),[])
        self.assertEqual(db.events,["new"])

    def test_restock_and_price_change(self):
        db=MemoryDB()
        self.run_sync(db,{"sku-1":item(status="out_of_stock")})
        changes=self.run_sync(db,{"sku-1":item(price="110",status="in_stock")})
        self.assertEqual({x["event"] for x in changes},{"restocked","price_changed"})

    def test_sold_out(self):
        db=MemoryDB()
        self.run_sync(db,{"sku-1":item()})
        changes=self.run_sync(db,{"sku-1":item(status="out_of_stock")})
        self.assertEqual([x["event"] for x in changes],["sold_out"])

    def test_absent_row_does_not_mean_sold_out(self):
        db=MemoryDB()
        self.run_sync(db,{"sku-1":item()})
        changes=self.run_sync(db,{})
        self.assertEqual(changes,[])
        self.assertEqual(db.products[("US","sku-1")][2],"in_stock")

    def test_weight_and_set_count_change(self):
        db=MemoryDB()
        self.run_sync(db,{"sku-1":item()})
        changes=self.run_sync(db,{"sku-1":item(weight="0.75",item_count=2)})
        self.assertEqual([x["event"] for x in changes],["shipping_or_bundle_changed"])

    def test_unverified_license_blocks_database_ingest(self):
        db=MemoryDB(allowed=False)
        with self.assertRaises(PermissionError):
            self.run_sync(db,{"sku-1":item()})
        self.assertEqual(db.events,[])

    def test_price_and_bundle_formulas(self):
        self.assertEqual(calculate("US",100,"0.5",1),Decimal("12950.00"))
        self.assertEqual(calculate("US",100,"0.5",2),Decimal("13450.00"))
        self.assertEqual(calculate("UAE",100,"0.5",2),Decimal("4150.00"))

    def test_json_feed_variants(self):
        payload=json.dumps({"products":[{"source_id":"aa","brand":"Example","title":"Blush",
              "currency":"AED","price":99,"weight_kg":0.2,"item_count":1,
              "stock_status":"out_of_stock","variant":"Pink"}]})
        d=read_feed(payload,"UAE","json")
        self.assertEqual(d["aa"]["variant"],"Pink")
        self.assertEqual(d["aa"]["status"],"out_of_stock")

    def test_missing_weight_is_not_silently_zero(self):
        payload="source_id,brand,title,currency,price,weight_kg,item_count,stock_status\nx1,Example,Cream,USD,100,,1,in_stock\n"
        d=read_feed(payload,"US")
        self.assertIsNone(d["x1"]["weight_kg"])

    def test_duplicate_source_ids_rejected(self):
        payload="source_id,brand,title,currency,price\nx1,Example,Cream,USD,100\nx1,Example,Cream,USD,100\n"
        with self.assertRaises(ValueError):
            read_feed(payload,"US")

    def test_invalid_prices_blocked(self):
        for value in ("-2","NaN","Infinity"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    read_feed("source_id,brand,title,currency,price\nx1,Example,Cream,USD,"+value+"\n","US")

    def test_no_unapproved_url_access(self):
        with patch.dict("os.environ",{"SOURCE_RIGHTS_CONFIRMED":"true","AUTHORIZED_FEED_HOSTS":"catalog.example.com"}):
            with self.assertRaises(PermissionError):licensed_https("https://sephora.com/product.json")

if __name__=="__main__": unittest.main()
