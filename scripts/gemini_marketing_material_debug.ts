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

const languageName = argValue('language') || 'English';
const objective = argValue('objective') || 'social_post';
const audience = argValue('audience') || 'local_restaurants';
const tone = argValue('tone') || 'friendly';

const objectiveDescriptions: Record<string, string> = {
  social_post:
    'Create a high-performing social media post (LINE, Facebook or Instagram) with a compelling hook, concise body copy, and a clear call-to-action. Keep it under 120 words.',
  farm_flyer:
    'Write copy for a single-page flyer or poster that can be printed and shared locally. Use persuasive storytelling and highlight what makes the farm special. Keep paragraphs short.',
  newsletter:
    'Draft a friendly email newsletter announcing the product, including a short story, reasons to buy, and a closing call-to-action.',
  recipe_card:
    'Create a recipe card that uses the product as a hero ingredient. Include recipe name, short story, directions, and serving suggestion.'
};

const toneHints: Record<string, string> = {
  friendly: 'warm, conversational, community-focused',
  professional: 'confident, trustworthy, quality-focused',
  playful: 'energetic, lively, engaging',
  premium: 'luxurious, refined, detail-oriented'
};

const productSummary = {
  name: argValue('name') || 'Farm Fresh Milk',
  category: argValue('category') || 'Dairy',
  summary:
    argValue('summary') ||
    'Fresh whole milk from a local farm, minimally processed for a rich, creamy taste.',
  uniqueSellingPoints: ['Same-day freshness', 'Creamy flavour', 'Local farm traceability', 'Small-batch care'],
  idealCustomers: ['Cafe owners', 'Bakeries', 'Households', 'Meal prep services'],
  flavorNotes: 'Creamy, clean finish, naturally sweet',
  seasonality: ['Year-round'],
  storyAngle: 'Family-run dairy focused on animal welfare and quality.',
  priceGuidance: 'Position as premium local dairy; offer volume pricing for restaurants.',
  language: languageName
};

const prompt = `
You are crafting marketing content for a farmer in Taiwan.
Objective: ${objectiveDescriptions[objective] ?? objectiveDescriptions.social_post}
Target audience: ${audience}
Desired tone: ${toneHints[tone] ?? toneHints.friendly}
Primary language: ${languageName}

Product summary:
${JSON.stringify(productSummary, null, 2)}

Special offer or notes: None
Preferred channel focus: No specific channel
Additional creative direction: None

Return JSON matching this schema:
{
  "title": string,
  "hook": string,
  "primaryMessage": string,
  "supportingPoints": string[],
  "callToAction": string,
  "hashtags": string[],
  "channelRecommendations": [
    { "channel": string, "idea": string }
  ],
  "scheduleIdeas": string[],
  "designNotes": string[],
  "language": string
}

Return ONLY valid JSON (no markdown, no commentary, no trailing commas).
Limit hashtags to five relevant tags (omit if not appropriate for the channel).
Provide practical schedule suggestions and concise design/art-direction notes.
`.trim();

const ai = new GoogleGenerativeAI(apiKey);
const model = ai.getGenerativeModel({ model: MODEL_ID });

const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: {
    temperature: 0.4,
    maxOutputTokens: 1200,
    responseMimeType: 'application/json'
  } as any,
  safetySettings: SAFETY_SETTINGS
} as any);

const raw = (result.response.text() || '').trim();
console.log(raw);

const outDir = resolve(process.cwd(), 'tmp');
await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, 'gemini_marketing_material_raw.txt'), raw, 'utf8');
console.error(`\nSaved raw response to tmp/gemini_marketing_material_raw.txt (length=${raw.length})`);

