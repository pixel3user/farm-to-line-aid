import type { Timestamp } from 'firebase-admin/firestore';

export interface ConversationHistoryItem {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string | number | Date | Timestamp;
}

interface ConversationPlanInput {
  message: string;
  history?: ConversationHistoryItem[];
}

interface ConversationPlan {
  text?: string;
  functionCalls: Array<{ name: string }>;
}

function detectIntent(message: string): ConversationPlan {
  const lowered = message.trim().toLowerCase();
  const calls: Array<{ name: string }> = [];

  if (!lowered) {
    return { text: '我可以如何協助您管理農產業務？', functionCalls: calls };
  }

  if (/(產品|product|inventory|stock)/.test(lowered)) {
    calls.push({ name: 'show_product_tools' });
  }
  if (/(店|store|buyer|客戶|market)/.test(lowered)) {
    calls.push({ name: 'show_store_tools' });
  }
  if (/(行銷|marketing|promote|宣傳)/.test(lowered)) {
    calls.push({ name: 'show_marketing_tools' });
  }
  if (/(分析|analytics|report|數據)/.test(lowered)) {
    calls.push({ name: 'show_analytics_tools' });
  }
  if (/(dashboard|控制台|open liff|web app|打開|開啟).*/.test(lowered)) {
    calls.push({ name: 'open_dashboard' });
  }
  if (/(help|幫助|說明|指引)/.test(lowered)) {
    calls.push({ name: 'show_help_options' });
  }

  if (!calls.length) {
    return {
      text:
        '我已經記錄下您的問題，以下是一些可以嘗試的選項：產品管理、店家拓展、行銷素材或營運分析。告訴我您想先處理哪一項。',
      functionCalls: [],
    };
  }

  const summaryIntro =
    '為您整理了一些相關的工具與建議，請選擇下方建議或提出更多需求。';

  return { text: summaryIntro, functionCalls: calls };
}

export async function generateConversationPlan({ message }: ConversationPlanInput): Promise<ConversationPlan> {
  return detectIntent(message);
}

export async function generateOutOfScopeAnswer({
  message,
}: {
  message: string;
  history?: ConversationHistoryItem[];
}): Promise<string> {
  return `我目前無法直接處理「${message.trim() || '這個問題'}」，但您可以從功能選單中選擇產品管理、店家關係或行銷工具，我可以協助您更進一步。`;
}

export async function analyzeImageWithGemini({
  prompt,
}: {
  base64Image: string;
  history?: ConversationHistoryItem[];
  prompt: string;
}): Promise<string> {
  return `${prompt} 我已收到您的影像，建議您可以透過行銷素材工具產生宣傳文案，或使用產品管理功能更新相關商品資訊。`;
}
