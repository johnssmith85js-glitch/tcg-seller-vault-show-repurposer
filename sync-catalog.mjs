import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

const base = "https://tcgcsv.com/tcgplayer";
const out = join(process.cwd(), "catalog");
const only = (process.env.TCG_CATEGORY_IDS || "")
  .split(",")
  .filter(Boolean)
  .map(Number);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function get(url) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "TCG-Seller-Vault-Show-Repurposer/0.3 (catalog sync)"
      }
    });

    if (response.ok) return response.json();

    const retryAfter = Number(response.headers.get("retry-after")) || 0;
    const backoff = Math.min(60000, 1500 * (2 ** attempt));
    const wait = Math.max(retryAfter * 1000, backoff) + Math.floor(Math.random() * 750);
    console.warn(`Catalog request returned ${response.status}; retrying in ${Math.ceil(wait / 1000)}s`);
    await sleep(wait);
  }

  throw new Error(`Catalog request failed after 10 attempts: ${url}`);
}

const unwrap = value => value.results || value;

await rm(out, { recursive: true, force: true });
await mkdir(join(out, "shards"), { recursive: true });

const categories = unwrap(await get(`${base}/categories`))
  .filter(category => !only.length || only.includes(category.categoryId));
const shards = new Map();
let products = 0;

for (const [categoryIndex, category] of categories.entries()) {
  await sleep(1000);
  const groups = unwrap(await get(`${base}/${category.categoryId}/groups`));

  for (const group of groups) {
    await sleep(300);
    const productsResponse = unwrap(
      await get(`${base}/${category.categoryId}/${group.groupId}/products`)
    );
    await sleep(300);
    const prices = unwrap(
      await get(`${base}/${category.categoryId}/${group.groupId}/prices`)
    );

    const priceMap = new Map();
    for (const price of prices) {
      const rows = priceMap.get(price.productId) || [];
      rows.push({ f: price.subTypeName, m: price.marketPrice });
      priceMap.set(price.productId, rows);
    }

    for (const product of productsResponse) {
      const name = String(product.name || "").trim();
      const normalized = name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      const variantFinish = /\(foil\)\s*$/i.test(name) ? "foil" : null;
      const key = normalized.replace(/\s+foil$/, "");
      if (normalized.length < 2) continue;

      const extended = Object.fromEntries(
        (product.extendedData || []).map(entry => [entry.name, entry.value])
      );
      const item = {
        id: product.productId,
        n: normalized,
        k: key,
        name,
        vf: variantFinish,
        game: category.name,
        set: group.name,
        printing: extended.Printing || extended.Rarity || "",
        p: priceMap.get(product.productId) || []
      };
      const prefixes = new Set([
        key.slice(0, 2),
        ...key.split(" ").filter(word => word.length > 2).map(word => word.slice(0, 2))
      ]);

      for (const prefix of prefixes) {
        if (!shards.has(prefix)) shards.set(prefix, []);
        shards.get(prefix).push(item);
      }
      products++;
    }
  }

  console.log(`${categoryIndex + 1}/${categories.length} ${category.name}`);
}

for (const [key, items] of shards) {
  await writeFile(join(out, "shards", `${key}.json`), JSON.stringify(items));
}

await writeFile(
  join(out, "manifest.json"),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    categoryCount: categories.length,
    productCount: products,
    source: "TCGCSV / TCGplayer",
    categories: categories.map(category => ({ id: category.categoryId, name: category.name }))
  })
);

console.log(`Wrote ${products} products across ${shards.size} shards`);

