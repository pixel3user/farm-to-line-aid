import admin from '../lib/firebaseAdmin';
import { buildProductSearchTokens } from '../lib/search';

type TranslationMap = Record<string, string>;

type ProductDoc = {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  aliases?: string[];
  nameTranslations?: TranslationMap;
};

const API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const TARGETS = ['en', 'zh-TW'] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseArgs = () => {
  const args = process.argv.slice(2);
  const limit = Number(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 0);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  return {
    limit: Number.isFinite(limit) ? limit : 0,
    dryRun,
    force,
  };
};

const translateCache = new Map<string, string>();

const translateText = async (text: string, target: typeof TARGETS[number]): Promise<string> => {
  if (!API_KEY) {
    throw new Error('Missing GOOGLE_TRANSLATE_API_KEY in environment.');
  }
  const key = `${text}::${target}`;
  const cached = translateCache.get(key);
  if (cached) return cached;

  const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, target }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Translate API error (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as {
    data?: { translations?: Array<{ translatedText?: string }> };
  };
  const translated = payload.data?.translations?.[0]?.translatedText?.trim() || '';
  if (!translated) {
    throw new Error(`Translate API returned empty result for target ${target}.`);
  }

  translateCache.set(key, translated);
  return translated;
};

const buildTranslations = async (name: string, existing: TranslationMap | undefined, force: boolean) => {
  const next: TranslationMap = { ...(existing || {}) };
  for (const target of TARGETS) {
    if (!force && next[target]) continue;
    const translated = await translateText(name, target);
    next[target] = translated;
  }
  return next;
};

const run = async () => {
  const { limit, dryRun, force } = parseArgs();
  const firestore = admin.firestore();
  let query: FirebaseFirestore.Query = firestore.collection('products').orderBy('createdAt', 'desc');
  if (limit > 0) query = query.limit(limit);

  const snapshot = await query.get();
  if (snapshot.empty) {
    console.log('No products found.');
    return;
  }

  console.log(`Found ${snapshot.size} products. dryRun=${dryRun} force=${force}`);
  let updatedCount = 0;
  let skippedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() as ProductDoc;
    const name = String(data.name || '').trim();
    if (!name) {
      skippedCount += 1;
      continue;
    }

    const hasAll = TARGETS.every((lang) => data.nameTranslations?.[lang]);
    if (hasAll && !force) {
      skippedCount += 1;
      continue;
    }

    const nameTranslations = await buildTranslations(name, data.nameTranslations, force);
    const searchTokens = buildProductSearchTokens({
      name,
      description: data.description,
      category: data.category,
      tags: data.tags,
      aliases: data.aliases,
      nameTranslations,
    });

    if (!dryRun) {
      await doc.ref.update({
        nameTranslations,
        searchTokens,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    updatedCount += 1;
    if (updatedCount % 10 === 0) {
      console.log(`Updated ${updatedCount} products...`);
    }

    await sleep(100);
  }

  console.log(`Done. Updated: ${updatedCount}, skipped: ${skippedCount}`);
};

run().catch((error) => {
  console.error('Translation backfill failed:', error);
  process.exitCode = 1;
});
