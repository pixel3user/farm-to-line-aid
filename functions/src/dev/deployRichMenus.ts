/**
 * Deploy three LINE rich menus using local images:
 * - role_selector.jpg (onboarding / role picker)
 * - farmers.jpg (farmer menu)
 * - market.jpg (market menu)
 *
 * Usage (from repo root):
 *   LINE_CHANNEL_ACCESS_TOKEN=xxx LIFF_URL=https://your-liff-url \
 *   npx tsx functions/src/dev/deployRichMenus.ts
 *
 * You will get three richMenuIds; copy them into:
 *   LINE_RICHMENU_ONBOARDING_ID=
 *   LINE_RICHMENU_FARMER_ID=
 *   LINE_RICHMENU_MARKET_ID=
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { RichMenuManager, LINE_CONFIG } from '../api/lineBot';
import runtimeConfig from '../lib/runtimeConfig';

const root = path.resolve(__dirname, '../../');
const images = {
  onboarding: path.join(root, 'role_selector.jpg'),
  farmer: path.join(root, 'farmers.jpg'),
  market: path.join(root, 'market.jpg'),
};

const baseUrl = process.env.LIFF_URL || runtimeConfig.liffUrl || runtimeConfig.frontendBaseUrl || 'https://farm2market.tw';
const channelAccessToken =
  process.env.LINE_CHANNEL_ACCESS_TOKEN ||
  process.env.CHANNEL_ACCESS_TOKEN ||
  runtimeConfig.lineAccessToken;

if (!channelAccessToken) {
  console.error('LINE_CHANNEL_ACCESS_TOKEN is required to deploy rich menus.');
  process.exit(1);
}

async function readImage2500x1686(filePath: string): Promise<Buffer> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Image not found: ${filePath}`);
  }
  const input = fs.readFileSync(filePath);
  const metadata = await sharp(input).metadata();
  const isCorrectSize = metadata.width === 2500 && metadata.height === 1686;
  if (isCorrectSize) {
    return input;
  }
  console.log(`Resizing ${path.basename(filePath)} from ${metadata.width}x${metadata.height} -> 2500x1686`);
  return sharp(input)
    .resize(2500, 1686, { fit: 'cover' })
    .jpeg({ quality: 90 })
    .toBuffer();
}

const size = { width: 2500, height: 1686 };

const onboardingConfig = {
  size,
  selected: true,
  name: 'Onboarding Menu',
  chatBarText: '選擇角色',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 1250, height: 1686 },
      action: {
        type: 'postback',
        data: 'source=richmenu&action=set_role&role=farmer',
        label: '我是農友',
        displayText: '✅ 我是農友',
      },
    },
    {
      bounds: { x: 1250, y: 0, width: 1250, height: 1686 },
      action: {
        type: 'postback',
        data: 'source=richmenu&action=set_role&role=market',
        label: '我是市場買家',
        displayText: '✅ 我是市場買家',
      },
    },
  ],
};

const farmerConfig = {
  size,
  selected: false,
  name: 'Farmer Menu',
  chatBarText: '農友選單',
  areas: [
    { bounds: { x: 0, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: `${baseUrl}?tab=dashboard&role=farmer`, label: '儀表板' } },
    { bounds: { x: 833, y: 0, width: 834, height: 843 }, action: { type: 'uri', uri: `${baseUrl}?tab=products&role=farmer`, label: '產品管理' } },
    { bounds: { x: 1667, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: `${baseUrl}?tab=stores&role=farmer`, label: '店家列表' } },
    { bounds: { x: 0, y: 843, width: 833, height: 843 }, action: { type: 'uri', uri: `${baseUrl}?tab=marketing&role=farmer`, label: '行銷工具' } },
    { bounds: { x: 833, y: 843, width: 834, height: 843 }, action: { type: 'uri', uri: `${baseUrl}?tab=products&action=add&role=farmer`, label: '新增產品' } },
    { bounds: { x: 1667, y: 843, width: 833, height: 843 }, action: { type: 'uri', uri: `${baseUrl}/demo/line`, label: '幫助中心' } },
  ],
};

const marketConfig = {
  size,
  selected: false,
  name: 'Market Menu',
  chatBarText: '市場選單',
  areas: [
    { bounds: { x: 0, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: `${baseUrl}/market`, label: '儀表板' } },
    { bounds: { x: 833, y: 0, width: 834, height: 843 }, action: { type: 'uri', uri: `${baseUrl}?tab=products&role=market`, label: '尋找產品' } },
    { bounds: { x: 1667, y: 0, width: 833, height: 843 }, action: { type: 'uri', uri: `${baseUrl}?tab=stores&role=market`, label: '我的供應商' } },
    { bounds: { x: 0, y: 843, width: 833, height: 843 }, action: { type: 'uri', uri: `${baseUrl}/market/schedule`, label: '採購單' } },
    { bounds: { x: 833, y: 843, width: 834, height: 843 }, action: { type: 'uri', uri: `${baseUrl}/market/ratings`, label: '數據分析' } },
    { bounds: { x: 1667, y: 843, width: 833, height: 843 }, action: { type: 'uri', uri: `${baseUrl}/demo/line`, label: '幫助中心' } },
  ],
};

async function createMenu(manager: RichMenuManager, config: any, imagePath: string, setDefault = false) {
  const richMenuId = await manager.createRichMenu(config);
  console.log(`Created rich menu ${config.name} → ${richMenuId}, uploading image ${path.basename(imagePath)}...`);
  const buffer = await readImage2500x1686(imagePath);
  await manager.uploadRichMenuImage(richMenuId, buffer, 'image/jpeg');
  if (setDefault) {
    await manager.setDefaultRichMenu(richMenuId);
  }
  return richMenuId;
}

async function main() {
  const manager = new RichMenuManager(channelAccessToken);

  console.log('Deploying onboarding rich menu (role selector)...');
  const onboardingId = await createMenu(manager, onboardingConfig, images.onboarding, true);
  console.log('Onboarding richMenuId:', onboardingId);

  console.log('Deploying farmer rich menu...');
  const farmerId = await createMenu(manager, farmerConfig, images.farmer, false);
  console.log('Farmer richMenuId:', farmerId);

  console.log('Deploying market rich menu...');
  const marketId = await createMenu(manager, marketConfig, images.market, false);
  console.log('Market richMenuId:', marketId);

  console.log('\nCopy these into your env:');
  console.log('LINE_RICHMENU_ONBOARDING_ID=', onboardingId);
  console.log('LINE_RICHMENU_FARMER_ID=', farmerId);
  console.log('LINE_RICHMENU_MARKET_ID=', marketId);
}

main().catch((error) => {
  console.error('Failed to deploy rich menus:', error);
  process.exit(1);
});
