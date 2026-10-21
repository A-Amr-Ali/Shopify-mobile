# Product cutout assets

Mode: built-in imagegen editing of the store's real product photographs. Each photograph was inspected before editing. Final assets retain transparency and were resized and encoded as WebP after generation. No programmatic background removal was used.

Common brief: isolate one upright, complete product from its reference photograph on a transparent canvas; preserve its real packaging, material, label, proportions and colour. Remove the photo background, extra objects, applicators, badges and duplicate bottles. Keep a natural standing product suitable for a boutique shelf.

| Asset | Product | Final project path |
| --- | --- | --- |
| milk | Rhode Glazing Milk | theme/assets/sfbr-milk-cutout.webp |
| filter | Charlotte Tilbury Hollywood Flawless Filter | theme/assets/sfbr-filter-cutout.webp |
| rare | Rare Beauty Soft Pinch Liquid Blush | theme/assets/sfbr-rare-cutout.webp |
| pocket | Rhode Pocket Blush | theme/assets/sfbr-pocket-cutout.webp |
| tint | Rhode Peptide Lip Tint | theme/assets/sfbr-tint-cutout.webp |
| matte | Charlotte Tilbury Matte Revolution | theme/assets/sfbr-matte-cutout.webp |
| oil | Dior Addict Lip Glow Oil | theme/assets/sfbr-oil-cutout.webp |
| mist | Sol de Janeiro Cheirosa 40 | theme/assets/sfbr-mist-cutout.webp |

`generated-assets.json` records the original generation outputs. `alpha-check.json` records transparency verification. Pocket Blush, Glazing Milk, Lip Tint and Dior Lip Oil also supply the four moving characters' bodies; their limbs and animation are native CSS/JS.

## Repaired assets · 2026-10-21

Both edits used the built-in image-generation tool with genuine transparency. The selected outputs were copied unchanged into the project and uploaded to Shopify Files. Product catalog photographs remain unchanged.

### Peptide Lip Treatment

Saved asset: `theme/assets/sfbr-treatment-cutout-v2.png`.

Prompt:

> Use case: background-extraction. Edit target: the supplied official photograph of Rhode Peptide Lip Treatment, a soft grey tube with pink rhode lettering. Create a clean product cutout on genuine transparent alpha. Remove ONLY the grey studio background and the cast shadow. Preserve the ENTIRE original tube: the complete grey body, crimped top, curved sides, cap and all pink lettering and label detail. The product itself is grey and must remain fully opaque — do not erase any grey or pale part of the packaging. Keep the same exact geometry, colors, branding, perspective and proportions. Center the single full tube upright in a square transparent canvas with modest clear margins. No extra objects, no floor, no background color or checkerboard, no redesign.

### Patrick Ta Blush Duo

Saved asset: `theme/assets/sfbr-patrick-cutout-v2.png`.

Prompt:

> Use case: background-extraction. Edit target: the supplied Patrick Ta Major Headlines Double-Take Creme and Powder Blush Duo product photograph. Remove ONLY the white background. Preserve the exact complete open rose-gold compact, upright portrait orientation, mirror/lid, two pink pans and the PATRICK TA and FOR FACE labels. All metal surfaces and both powder and cream pans remain fully opaque. Do not erase any pale metallic part or alter colors. One faithful photoreal product cutout with genuine transparent alpha, clean outer contours, square canvas modest transparent margin, no shadow or floor or backdrop, no other products, no branding changes.

The unmodified official lip-shape reference is `theme/assets/sfbr-lip-shape-reference.png`; native UI selects one stick. `catalog/repaired-alpha-check.json` records opacity checks.

### Dior Backstage Glow Maximizer

Saved asset: `theme/assets/sfbr-dior-palette-cutout-v2.png`. Built-in image-generation edit with transparency enabled.

Prompt:

> Use case: background-extraction. Edit target: the exact supplied Dior Backstage Glow Maximizer face palette product photograph. Remove only the light studio backdrop and the cast shadow. Preserve the COMPLETE clear acrylic compact, every pale/white/silver rim, the black and chrome hinge strip, all four powder pans (pearl white, champagne, pink, bronze), and crucially the entire partially open transparent lid with its smooth continuous reflections and Dior engraving. Do not punch holes through the packaging or turn the lid into floating broken fragments. Keep the original perspective, square compact shape, exact layout, materials, branding, colors and proportions. Single centered product, real transparent alpha surrounding it; translucent glass may keep subtle continuous reflections. No redesign, no extra products, no floor or backdrop.
