import unittest
from decimal import Decimal
from monitor import calculate,read_feed,licensed_https
class EngineTests(unittest.TestCase):
    def test_us_example(self):
        self.assertEqual(calculate("US",100,"0.5",1),Decimal("12950.00"))
    def test_bundle(self):
        self.assertEqual(calculate("US",100,"0.5",2),Decimal("13450.00"))
    def test_uae(self):
        self.assertEqual(calculate("UAE",100,"0.5",2),Decimal("4150.00"))
    def test_currency(self):
        with self.assertRaises(ValueError):read_feed("source_id,brand,title,currency,price\\n1,X,A,USD,100", "UAE")
    def test_rights(self):
        with self.assertRaises(PermissionError):licensed_https("https://sephora.com/")
if __name__=="__main__":unittest.main()
