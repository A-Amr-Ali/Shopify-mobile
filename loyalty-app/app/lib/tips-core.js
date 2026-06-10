// Pure rules-based tips (no I/O) — safe to import in tests without a DB driver.

// skin_type -> AM/PM routine template.
const ROUTINES = {
  dry: { am: ["Gentle cream cleanser", "Hydrating serum", "Rich moisturizer", "SPF 50"], pm: ["Cleanse", "Hyaluronic serum", "Night cream"] },
  oily: { am: ["Gel cleanser", "Niacinamide serum", "Oil-free moisturizer", "SPF 50 (matte)"], pm: ["Double cleanse", "BHA 2x/week", "Light gel moisturizer"] },
  combo: { am: ["Gentle cleanser", "Balancing serum", "Lightweight moisturizer", "SPF 50"], pm: ["Cleanse", "Treat T-zone", "Moisturize drier areas"] },
  normal: { am: ["Gentle cleanser", "Antioxidant serum", "Moisturizer", "SPF 50"], pm: ["Cleanse", "Treatment of choice", "Moisturizer"] },
  sensitive: { am: ["Fragrance-free cleanser", "Soothing serum (centella)", "Barrier cream", "Mineral SPF 50"], pm: ["Gentle cleanse", "Barrier repair", "Calming moisturizer"] },
};

const UNDERTONE_TIP = {
  warm: "Golden, peach, and bronze tones flatter your warm undertone — reach for warm nudes and terracotta blush.",
  cool: "Rosy, berry, and blue-based reds suit your cool undertone beautifully — try a cool-pink blush.",
  neutral: "Your neutral undertone is versatile — both warm and cool shades work, so play freely.",
};

/** Build deterministic rules-based tips from a profile. */
export function buildRulesTips(profile) {
  if (!profile) return [];
  const tips = [];

  if (profile.skin_type && ROUTINES[profile.skin_type]) {
    const r = ROUTINES[profile.skin_type];
    tips.push({
      title: `Your ${profile.skin_type} skin routine`,
      body: `AM: ${r.am.join(" → ")}. PM: ${r.pm.join(" → ")}. In Egypt's heat, never skip the SPF.`,
    });
  }

  if (profile.undertone && UNDERTONE_TIP[profile.undertone]) {
    tips.push({ title: "Shades that flatter you", body: UNDERTONE_TIP[profile.undertone] });
  }

  if (profile.lip_finish_pref) {
    tips.push({
      title: `You love a ${profile.lip_finish_pref} lip`,
      body: `Look for ${profile.lip_finish_pref} formulas from Rare Beauty, Charlotte Tilbury, and Makeup by Mario — all in stock and authentic.`,
    });
  }

  const owned = Array.isArray(profile.current_products) ? profile.current_products : [];
  if (owned.length) {
    const brands = [...new Set(owned.map((p) => p.brand).filter(Boolean))].slice(0, 3);
    if (brands.length) {
      tips.push({
        title: "Complete your routine",
        body: `Since you already use ${brands.join(", ")}, a setting spray and a hydrating primer would lock everything in through a long Cairo day.`,
      });
    }
  }

  if (Array.isArray(profile.skin_concerns) && profile.skin_concerns.length) {
    tips.push({
      title: "Targeted for your concerns",
      body: `For ${profile.skin_concerns.join(", ")}, layer a targeted serum under moisturizer and give it 4-6 weeks to show results.`,
    });
  }

  return tips;
}
