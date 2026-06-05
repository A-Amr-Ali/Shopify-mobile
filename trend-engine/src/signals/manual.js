// Manual TikTok / Instagram trend feed.
// Since social platforms have no usable trends API, you (or a VA) paste what's
// visibly viral into data/manual-trends.csv. Each line: keyword,weight
// e.g.:
//   rare beauty soft pinch,1.0
//   lip oil,0.8
//   charlotte tilbury,0.6
// Lines starting with # are ignored. Weight defaults to 1 if omitted.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "..", "..", "data", "manual-trends.csv");

export async function manualScores() {
  let text;
  try {
    text = await readFile(CSV_PATH, "utf8");
  } catch {
    return new Map(); // no manual file = no manual signal (fine)
  }
  const scores = new Map();
  for (const line of text.split(/\r?\n/)) {
    const row = line.trim();
    if (!row || row.startsWith("#")) continue;
    const [kw, w] = row.split(",");
    if (!kw) continue;
    const weight = w == null || w === "" ? 1 : Number(w);
    if (!Number.isFinite(weight)) continue;
    scores.set(kw.trim().toLowerCase(), Math.max(0, Math.min(1, weight)));
  }
  return scores;
}
