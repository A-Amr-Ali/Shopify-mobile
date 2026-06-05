#!/usr/bin/env python3
"""Generate Sofie SEO landing page templates (templates/page.<handle>.json).

Each page targets a high-intent Egypt beauty query. Content is written to be
genuinely useful (not thin/spammy) so it ranks and converts. Re-run to refresh.
"""
import json, os, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
TPL = ROOT / "templates"

# Sibling internal links shared across pages (built per-page, excluding self).
ALL_PAGES = {
    "rare-beauty-egypt": "Rare Beauty Egypt",
    "huda-beauty-egypt": "Huda Beauty Egypt",
    "charlotte-tilbury-egypt": "Charlotte Tilbury Egypt",
    "makeup-by-mario-egypt": "Makeup by Mario Egypt",
    "nars-egypt": "NARS Egypt",
    "luxury-makeup-egypt": "Luxury Makeup Egypt",
    "original-makeup-egypt": "Original Makeup Egypt",
    "authentic-makeup-egypt": "Authentic Makeup Egypt",
}

PAGES = {
    "rare-beauty-egypt": {
        "h1": "Rare Beauty Egypt",
        "collection": "rare-beauty",
        "eyebrow": "Authentic Rare Beauty • In Egypt • Delivered Fast",
        "intro": "Shop 100% authentic Rare Beauty by Selena Gomez in Egypt at Sofie's Makeup Store. Soft Pinch Liquid Blush, Positive Light Highlighter, Kind Words and more — curated by experts and delivered nationwide.",
        "blocks": [
            ("Authentic Rare Beauty in Egypt",
             "<p>Rare Beauty has become one of the most loved prestige makeup brands in the world, and at Sofie's Makeup Store you can shop it in Egypt with total confidence. Every Rare Beauty product we carry is 100% authentic, sourced through authorized channels — never a counterfeit, ever.</p>"),
            ("Best-selling Rare Beauty products",
             "<ul><li><strong>Soft Pinch Liquid Blush</strong> — the viral, long-wear blush in weightless liquid form.</li><li><strong>Positive Light Liquid Luminizer</strong> — a lit-from-within highlighter glow.</li><li><strong>Kind Words Matte Lipstick & Liner</strong> — comfortable, full-coverage colour.</li><li><strong>Soft Pinch Tinted Lip Oil</strong> — sheer, hydrating, glossy tint.</li></ul>"),
            ("Why buy Rare Beauty from Sofie's",
             "<ul><li>100% authentic — guaranteed</li><li>10+ years of beauty expertise</li><li>Fast delivery to every governorate in Egypt</li><li>Shop in person at Marassi M-Porium & Akti by Zahra</li></ul>"),
        ],
        "faq": [
            ("Is Rare Beauty available in Egypt?",
             "<p>Yes. Sofie's Makeup Store stocks 100% authentic Rare Beauty in Egypt, available online with nationwide delivery and in our Marassi and Akti by Zahra boutiques.</p>"),
            ("Is your Rare Beauty original?",
             "<p>Always. Every Rare Beauty product is 100% authentic and sourced from authorized channels.</p>"),
            ("What is the most popular Rare Beauty product?",
             "<p>The Soft Pinch Liquid Blush is Rare Beauty's most iconic, best-selling product — a little goes a long way.</p>"),
        ],
    },
    "huda-beauty-egypt": {
        "h1": "Huda Beauty Egypt",
        "collection": "huda-beauty",
        "eyebrow": "Authentic Huda Beauty • In Egypt • Delivered Fast",
        "intro": "Discover 100% authentic Huda Beauty in Egypt at Sofie's Makeup Store. Faux Filter foundation, eyeshadow palettes, lip and complexion icons — curated by experts and delivered across Egypt.",
        "blocks": [
            ("Authentic Huda Beauty in Egypt",
             "<p>Founded by Huda Kattan, Huda Beauty is a global powerhouse in complexion, eyes and lips. At Sofie's Makeup Store you can shop authentic Huda Beauty in Egypt with confidence — sourced through authorized channels and loved by our community for years.</p>"),
            ("Best-selling Huda Beauty products",
             "<ul><li><strong>#FauxFilter Foundation & Concealer</strong> — full coverage, flawless finish.</li><li><strong>Eyeshadow Palettes</strong> — richly pigmented, blendable colour stories.</li><li><strong>Easy Bake Loose Powder</strong> — for a smooth, set complexion.</li><li><strong>Liquid Matte Lipsticks</strong> — long-wearing, iconic shades.</li></ul>"),
            ("Why buy Huda Beauty from Sofie's",
             "<ul><li>100% authentic — guaranteed</li><li>10+ years of beauty expertise</li><li>Fast delivery across Egypt</li><li>Boutiques at Marassi M-Porium & Akti by Zahra</li></ul>"),
        ],
        "faq": [
            ("Is Huda Beauty available in Egypt?",
             "<p>Yes — shop 100% authentic Huda Beauty in Egypt at Sofie's Makeup Store, online with nationwide delivery and in store.</p>"),
            ("Is your Huda Beauty authentic?",
             "<p>Yes, 100% authentic and sourced from authorized channels.</p>"),
        ],
    },
    "charlotte-tilbury-egypt": {
        "h1": "Charlotte Tilbury Egypt",
        "collection": "charlotte-tilbury",
        "eyebrow": "Authentic Charlotte Tilbury • In Egypt • Delivered Fast",
        "intro": "Shop 100% authentic Charlotte Tilbury in Egypt at Sofie's Makeup Store. Pillow Talk, Magic Cream, Flawless Filter and the full icon line — curated by experts, delivered nationwide.",
        "blocks": [
            ("Authentic Charlotte Tilbury in Egypt",
             "<p>Charlotte Tilbury is the gold standard of glamour — and at Sofie's Makeup Store you can shop it in Egypt with complete peace of mind. Every product is 100% authentic, sourced through authorized channels.</p>"),
            ("Best-selling Charlotte Tilbury products",
             "<ul><li><strong>Pillow Talk</strong> — the world-famous lip and cheek edit.</li><li><strong>Charlotte's Magic Cream</strong> — cult-favourite hydrating moisturiser.</li><li><strong>Hollywood Flawless Filter</strong> — the complexion booster for lit-from-within glow.</li><li><strong>Airbrush Flawless Setting Spray</strong> — all-day wear.</li></ul>"),
            ("Why buy Charlotte Tilbury from Sofie's",
             "<ul><li>100% authentic — guaranteed</li><li>10+ years of beauty expertise</li><li>Fast delivery across Egypt</li><li>Boutiques at Marassi M-Porium & Akti by Zahra</li></ul>"),
        ],
        "faq": [
            ("Is Charlotte Tilbury available in Egypt?",
             "<p>Yes — shop 100% authentic Charlotte Tilbury in Egypt at Sofie's Makeup Store, online and in store.</p>"),
            ("What is Charlotte Tilbury best known for?",
             "<p>Pillow Talk, Magic Cream and Hollywood Flawless Filter are among the most iconic, best-selling products.</p>"),
        ],
    },
    "makeup-by-mario-egypt": {
        "h1": "Makeup by Mario Egypt",
        "collection": "makeup-by-mario",
        "eyebrow": "Authentic Makeup by Mario • In Egypt • Delivered Fast",
        "intro": "Shop 100% authentic Makeup by Mario in Egypt at Sofie's Makeup Store. Master Mattes palettes, SurrealSkin foundation, Ultra Suede lipsticks — curated by experts and delivered nationwide.",
        "blocks": [
            ("Authentic Makeup by Mario in Egypt",
             "<p>Created by celebrity makeup artist Mario Dedivanovic, Makeup by Mario is built on pro-level artistry. At Sofie's Makeup Store you can shop it in Egypt with confidence — 100% authentic, from authorized channels.</p>"),
            ("Best-selling Makeup by Mario products",
             "<ul><li><strong>Master Mattes & Master Metallics</strong> eyeshadow palettes.</li><li><strong>SurrealSkin Foundation</strong> — second-skin, natural finish.</li><li><strong>Ultra Suede Lipsticks</strong> — comfortable, flattering nudes and reds.</li><li><strong>Master Secret Glow</strong> — the artist's highlight.</li></ul>"),
            ("Why buy Makeup by Mario from Sofie's",
             "<ul><li>100% authentic — guaranteed</li><li>10+ years of beauty expertise</li><li>Fast delivery across Egypt</li><li>Boutiques at Marassi M-Porium & Akti by Zahra</li></ul>"),
        ],
        "faq": [
            ("Is Makeup by Mario available in Egypt?",
             "<p>Yes — shop 100% authentic Makeup by Mario in Egypt at Sofie's Makeup Store, online and in store.</p>"),
        ],
    },
    "nars-egypt": {
        "h1": "NARS Egypt",
        "collection": "nars",
        "eyebrow": "Authentic NARS • In Egypt • Delivered Fast",
        "intro": "Shop 100% authentic NARS in Egypt at Sofie's Makeup Store. Radiant Creamy Concealer, Orgasm blush, Light Reflecting foundation and more — curated by experts, delivered nationwide.",
        "blocks": [
            ("Authentic NARS in Egypt",
             "<p>NARS is a modern classic, famous for its complexion and cheek icons. At Sofie's Makeup Store you can shop authentic NARS in Egypt with full confidence — sourced from authorized channels.</p>"),
            ("Best-selling NARS products",
             "<ul><li><strong>Radiant Creamy Concealer</strong> — the cult-favourite, full-coverage concealer.</li><li><strong>Blush in Orgasm</strong> — the legendary peachy-pink glow.</li><li><strong>Light Reflecting Foundation</strong> — skincare-infused, natural finish.</li><li><strong>Climax Mascara</strong> — volume and drama.</li></ul>"),
            ("Why buy NARS from Sofie's",
             "<ul><li>100% authentic — guaranteed</li><li>10+ years of beauty expertise</li><li>Fast delivery across Egypt</li><li>Boutiques at Marassi M-Porium & Akti by Zahra</li></ul>"),
        ],
        "faq": [
            ("Is NARS available in Egypt?",
             "<p>Yes — shop 100% authentic NARS in Egypt at Sofie's Makeup Store, online and in store.</p>"),
        ],
    },
    "luxury-makeup-egypt": {
        "h1": "Luxury Makeup Egypt",
        "collection": "makeup",
        "eyebrow": "100% Authentic Luxury Beauty • In Egypt",
        "intro": "Discover luxury makeup in Egypt at Sofie's Makeup Store — the home of prestige beauty for over 10 years. Rare Beauty, Charlotte Tilbury, NARS, Huda Beauty, Makeup by Mario and more, all 100% authentic.",
        "blocks": [
            ("Egypt's destination for luxury makeup",
             "<p>For more than a decade, Sofie's Makeup Store has been Egypt's trusted home for luxury makeup. We curate the world's most coveted prestige brands so you can shop with confidence — every product 100% authentic, sourced from authorized channels.</p>"),
            ("The prestige brands we carry",
             "<p>From Rare Beauty and Charlotte Tilbury to NARS, Huda Beauty, Makeup by Mario, Hourglass, Laura Mercier, Glossier, Saie and more — discover the luxury beauty the world is talking about, in Egypt.</p>"),
            ("Why shop luxury makeup with Sofie's",
             "<ul><li>100% authentic — guaranteed</li><li>Expertly curated over 10+ years</li><li>Fast delivery across every governorate in Egypt</li><li>Visit our boutiques at Marassi M-Porium & Akti by Zahra</li></ul>"),
        ],
        "faq": [
            ("Where can I buy luxury makeup in Egypt?",
             "<p>At Sofie's Makeup Store — online with nationwide delivery, and in our Marassi and Akti by Zahra boutiques. Every product is 100% authentic.</p>"),
            ("Are the luxury brands authentic?",
             "<p>Yes, 100% authentic. We source only through authorized channels.</p>"),
        ],
    },
    "original-makeup-egypt": {
        "h1": "Original Makeup Egypt",
        "collection": "makeup",
        "eyebrow": "Guaranteed Original • In Egypt",
        "intro": "Shop original, 100% authentic makeup in Egypt at Sofie's Makeup Store. We guarantee every product is genuine — sourced from official brands and authorized distributors, with 10+ years of trust.",
        "blocks": [
            ("Original makeup you can trust in Egypt",
             "<p>Counterfeit beauty is a real risk online. At Sofie's Makeup Store, originality is our promise: every product is genuine, sourced from official brands and authorized distributors. For over 10 years, customers across Egypt have trusted us for original makeup.</p>"),
            ("How we guarantee originality",
             "<ul><li>We buy only through official brands and authorized distributors.</li><li>Our team has 10+ years of prestige-beauty expertise.</li><li>You can see and shop our products in person at Marassi M-Porium & Akti by Zahra.</li></ul>"),
        ],
        "faq": [
            ("Is your makeup original?",
             "<p>Yes — 100% original and authentic, sourced from official brands and authorized distributors.</p>"),
            ("How do I know the makeup is not fake?",
             "<p>We source exclusively through authorized channels, have a 10+ year track record, and operate physical boutiques you can visit in Egypt.</p>"),
        ],
    },
    "authentic-makeup-egypt": {
        "h1": "Authentic Makeup Egypt",
        "collection": "makeup",
        "eyebrow": "100% Authentic • In Egypt",
        "intro": "Shop 100% authentic makeup in Egypt at Sofie's Makeup Store. Genuine prestige beauty from the brands you love — Rare Beauty, NARS, Charlotte Tilbury, Huda Beauty and more — delivered nationwide.",
        "blocks": [
            ("100% authentic makeup in Egypt",
             "<p>At Sofie's Makeup Store, authenticity is everything. Every product is 100% authentic, sourced from official brands and authorized distributors. We've earned the trust of beauty lovers across Egypt for over a decade.</p>"),
            ("Authentic prestige brands",
             "<p>Shop authentic Rare Beauty, NARS, Charlotte Tilbury, Huda Beauty, Makeup by Mario, Hourglass and more — all genuine, all curated by experts, all delivered with care across Egypt.</p>"),
        ],
        "faq": [
            ("Is your makeup 100% authentic?",
             "<p>Yes — every single product is 100% authentic and sourced from authorized channels.</p>"),
        ],
    },
}


def build(handle, data):
    # internal links: other sibling pages + brands collection
    links = {"heading": "Explore More"}
    i = 1
    for h, title in ALL_PAGES.items():
        if h == handle:
            continue
        links[f"label_{i}"] = title
        links[f"link_{i}"] = f"shopify://pages/{h}"
        i += 1
        if i > 6:
            break

    text_blocks = {}
    order = []
    for idx, (heading, body) in enumerate(data["blocks"], start=1):
        bid = f"t{idx}"
        text_blocks[bid] = {"type": "text", "settings": {"heading": heading, "body": body}}
        order.append(bid)
    text_blocks["links"] = {"type": "links", "settings": links}
    order.append("links")

    faq_blocks, faq_order = {}, []
    for idx, (q, a) in enumerate(data["faq"], start=1):
        fid = f"f{idx}"
        faq_blocks[fid] = {"type": "qa", "settings": {"question": q, "answer": a}}
        faq_order.append(fid)

    tpl = {
        "_comment": f"SEO landing page for '{data['h1']}'. Assign to a Page with handle '{handle}'.",
        "sections": {
            "main": {
                "type": "lux-seo-landing",
                "blocks": text_blocks,
                "block_order": order,
                "settings": {
                    "eyebrow": data["eyebrow"],
                    "h1": data["h1"],
                    "intro": data["intro"],
                    "cta": "Shop the Collection",
                    "cta_link": f"shopify://collections/{data['collection']}",
                    "cta2": "Explore All Brands",
                    "cta2_link": "shopify://collections",
                    "collection": data["collection"],
                    "products_heading": f"Shop {data['h1'].replace(' Egypt','')}",
                    "limit": 8,
                },
            },
            "faq": {
                "type": "lux-faq",
                "blocks": faq_blocks,
                "block_order": faq_order,
                "settings": {"heading": "Frequently Asked Questions", "emit_schema": True, "open_first": True},
            },
        },
        "order": ["main", "faq"],
    }
    out = TPL / f"page.{handle}.json"
    out.write_text(json.dumps(tpl, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return out.name


if __name__ == "__main__":
    os.makedirs(TPL, exist_ok=True)
    for handle, data in PAGES.items():
        print("wrote", build(handle, data))
