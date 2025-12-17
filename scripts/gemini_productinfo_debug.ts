import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
] as const;

const argValue = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing API key. Set `GEMINI_API_KEY` or `VITE_GEMINI_API_KEY`.');
  process.exit(1);
}

const MODEL_ID = process.env.GEMINI_MODEL_ID || 'gemini-2.5-flash';

const name = argValue('name') || 'Farm-Fresh Whole Milk';
const category = argValue('category') || 'Dairy';
const description = argValue('description') || 'Fresh whole milk from a local farm.';
const unit = argValue('unit') || 'bottle';
const price = argValue('price') || '';
const languageName = argValue('language') || 'English';

const prompt = `
You are an experienced agricultural marketer helping a farmer describe their product.
Summarise the product in clear marketing language and return JSON that matches this shape:
{
  "name": string,
  "category": string,
  "summary": string,
  "uniqueSellingPoints": string[],
  "idealCustomers": string[],
  "flavorNotes": string,
  "seasonality": string[],
  "storyAngle": string,
  "priceGuidance": string,
  "language": string
}

Return ONLY valid JSON (no markdown, no commentary, no trailing commas).
The copy must be written in ${languageName}. Keep arrays to at most four bullet points each.
Focus on practical benefits for buyers (e.g. freshness, sustainability, taste, farm story).

Product data:
${JSON.stringify(
  {
    name,
    category,
    description,
    unit,
    price
  },
  null,
  2
)}
`.trim();

const ai = new GoogleGenerativeAI(apiKey);
const model = ai.getGenerativeModel({ model: MODEL_ID });

const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: {
    temperature: 0.4,
    maxOutputTokens: 900,
    responseMimeType: 'application/json'
  } as any,
  safetySettings: SAFETY_SETTINGS
} as any);

const raw = (result.response.text() || '').trim();
console.log(raw);

const outDir = resolve(process.cwd(), 'tmp');
await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, 'gemini_productinfo_raw.txt'), raw, 'utf8');
console.error(`\nSaved raw response to tmp/gemini_productinfo_raw.txt (length=${raw.length})`);

