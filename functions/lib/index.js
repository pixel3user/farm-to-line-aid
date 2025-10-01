"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.health = exports.webhook = void 0;
// Firebase Functions for Farm2Market AI LINE Bot
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
const crypto = __importStar(require("crypto"));
// Initialize Firebase Admin
const serviceAccount = {
    type: "service_account",
    project_id: "farm2market-99",
    private_key_id: "c333b4e691a0c0a1ed3081998aa1baefbc284f7f",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDYfUd0WqqdQpD9\nzEFeHuby0GY3UDm4n7kD1VszenSu8PuimuZyTOj6unnDzcntNV2iM7oaBCWPdLfY\nB0erqYhJi/Yhi0A/uns/Kn+zpPxNH8RNWaGXEjlTER6D2U70LCcwFCYyUpmkiAK5\n4s+XIpBkynOG/7ZSPjdOgpHpI5k5KAad4svTsji5t6d5CQbosfCa/0q+0dvYk90+\n07D+q/8NbnL1AoqaJb3KE2JFr9p4fiFsacE2A4qt+gaeRoBV/P0BOQG9ZZ7aMhJy\n+HK/sv3+lshfpyjL/7xdSQ3hBfmeBETiD15n/jGaz3XhDg26++gInNAUA5jZ3nuI\nfy3ppedtAgMBAAECggEAIWDbegCaqql/QmpSL8lS8WAZSnD3nVQfCgzExYCdafWk\nzpLUcg4So8nJiVt6xTSDrcUM7gLyqZYk3E1vCvQWG8TVG6HlM440f241h0SqU9fQ\ng96McAbyyLBshIamSjZeimao5vxeTQRdazyhphtBqRCf1FIr0a1fCJ9QEOKYtruA\n2dH7hp+2kLGYnWHt1RyUwj+rmpTF/sPFYvcvMQsQre6at8Nh5e4ZLIXAyPvlmvpp\npCG5wSiF+Ripe29s5Ff9NKKDdKHnkielQnb4FReqS2WCPYbTk0IbXTQ6qGR1+u5b\nugMa1Y9VFteUHgvDU8UCs43cdVT/nsmxVXfZ9pizQQKBgQD8HrEFwnsoSeejSWfn\nMdpVyBwkpx9S8ExlqlwlDxwwIQUqh7WbvAmQWOrsglb5twkvP14DSePNg2Z/q4qq\n/O1DkDVGGckYEsO98KCoIu3XisIxQJdVVTrEpPVjz5EchmkhXqx1C2V4KX9m3wjn\nYv8tNIv/5SM6JlDznIco7/klDQKBgQDb0jWnZW+iDa9gceSCm/0xYf7H1s3lGfEy\nXugOdQvyA0tiLv+k0UPjS5zxlUU6a5hf02aFXUbdqxx5jlhb4ke2ynFEglMP0Nzl\nMinruVeNg8I0xN3cwoRlznRtIkNwE89QCw+WfGaYRj0SJXRZca5oGDDJNgWm5kqa\n1JelWUXz4QKBgHclHe0l4kPA4UnGN+cHJTIitkIQBHqSetgUsSUGRgDsqd9WcNme\n/DoN+z83vViXSizc2lXdhl0purec3pQ9oPar4LE3IFRTEdPiMloi35lbxre12Y6H\nD5W8iwbXIbGER4xwjDln4FTv73gy8KdAnmzDh2Gv7HzffKQTlcAf3/LFAoGBAIHV\nIoOAUfLxCkh4fHL4Fw93xbfakzlhnSgXDhCb6TZD495VzABY6TPykPvPIlhi/Fh8\nz+ytLxH14peZD28Vsy2vXD8OimipAA8PFdt4WNHopGfubuvYp8JJslJTDmnACY5J\nOiezyhTeR2vUW2gI0O4Ce64cDjKJij7wmbC7jamBAoGBAK0fZWcv0d74GwD90M+6\nZTpJ//ZaBzqYEa7ukT6kCiCJWVychWZGxwcQERSi6lGWFNIiCbtALq3AOI/uP3r3\nlfyLF1Pj3nrbUA/CaIT8Q6gAn9Bhdf5ichib6HgzGZHb4nc2D7qcVNj44hR3hKxk\nOSdpzmlCcTutIt91ha5XFi+j\n-----END PRIVATE KEY-----\n",
    client_email: "firebase-adminsdk-fbsvc@farm2market-99.iam.gserviceaccount.com",
    client_id: "108614495138611466373",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40farm2market-99.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
};
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "farm2market-99"
});
// Initialize Gemini AI
const genAI = new generative_ai_1.GoogleGenerativeAI(((_a = functions.config().gemini) === null || _a === void 0 ? void 0 : _a.api_key) || '');
// LINE Bot Configuration
const LINE_CONFIG = {
    CHANNEL_ACCESS_TOKEN: ((_b = functions.config().line) === null || _b === void 0 ? void 0 : _b.channel_access_token) || '',
    CHANNEL_SECRET: ((_c = functions.config().line) === null || _c === void 0 ? void 0 : _c.channel_secret) || '',
    MESSAGING_API_URL: 'https://api.line.me/v2/bot',
};
// Rich UI Message Templates
class RichUIMessages {
    // Main Menu with Quick Actions
    static getMainMenu() {
        return {
            type: 'flex',
            altText: 'Farm2Market 主選單',
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '🌾 Farm2Market AI',
                            weight: 'bold',
                            size: 'xl',
                            color: '#2E7D32'
                        },
                        {
                            type: 'text',
                            text: '您的智慧農場銷售助手',
                            size: 'sm',
                            color: '#666666'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            style: 'primary',
                            height: 'sm',
                            action: {
                                type: 'postback',
                                label: '📦 建立供應',
                                data: 'create_supply'
                            }
                        },
                        {
                            type: 'button',
                            style: 'secondary',
                            height: 'sm',
                            action: {
                                type: 'postback',
                                label: '💰 價格諮詢',
                                data: 'price_inquiry'
                            }
                        },
                        {
                            type: 'button',
                            style: 'secondary',
                            height: 'sm',
                            action: {
                                type: 'postback',
                                label: '📋 我的交易',
                                data: 'my_deals'
                            }
                        },
                        {
                            type: 'button',
                            style: 'secondary',
                            height: 'sm',
                            action: {
                                type: 'postback',
                                label: '🎨 品牌工具包',
                                data: 'brand_kit'
                            }
                        }
                    ],
                    spacing: 'sm'
                }
            }
        };
    }
    // Supply Status Card
    static getSupplyStatusCard(supply) {
        return {
            type: 'flex',
            altText: `供應狀態: ${supply.product}`,
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: `📦 ${supply.product}`,
                            weight: 'bold',
                            size: 'lg'
                        },
                        {
                            type: 'text',
                            text: `狀態: ${this.getStatusText(supply.status)}`,
                            size: 'sm',
                            color: this.getStatusColor(supply.status)
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'box',
                            layout: 'horizontal',
                            contents: [
                                {
                                    type: 'text',
                                    text: '數量:',
                                    size: 'sm',
                                    flex: 1
                                },
                                {
                                    type: 'text',
                                    text: `${supply.quantity} ${supply.unit}`,
                                    size: 'sm',
                                    flex: 2,
                                    align: 'end'
                                }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'horizontal',
                            contents: [
                                {
                                    type: 'text',
                                    text: '價格:',
                                    size: 'sm',
                                    flex: 1
                                },
                                {
                                    type: 'text',
                                    text: `NT$${supply.price}/unit`,
                                    size: 'sm',
                                    flex: 2,
                                    align: 'end'
                                }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'horizontal',
                            contents: [
                                {
                                    type: 'text',
                                    text: '收成期:',
                                    size: 'sm',
                                    flex: 1
                                },
                                {
                                    type: 'text',
                                    text: supply.harvestWindow,
                                    size: 'sm',
                                    flex: 2,
                                    align: 'end'
                                }
                            ]
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            style: 'primary',
                            height: 'sm',
                            action: {
                                type: 'uri',
                                label: '查看詳情',
                                uri: `https://liff.line.me/YOUR_LIFF_ID/supply/${supply.id}`
                            }
                        }
                    ]
                }
            }
        };
    }
    // Deal Progress Card
    static getDealProgressCard(deal) {
        return {
            type: 'flex',
            altText: `交易進度: ${deal.buyerName}`,
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: `🤝 ${deal.buyerName}`,
                            weight: 'bold',
                            size: 'lg'
                        },
                        {
                            type: 'text',
                            text: `進度: ${this.getDealStatusText(deal.status)}`,
                            size: 'sm',
                            color: this.getDealStatusColor(deal.status)
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: `產品: ${deal.product}`,
                            size: 'sm'
                        },
                        {
                            type: 'text',
                            text: `數量: ${deal.quantity} ${deal.unit}`,
                            size: 'sm'
                        },
                        {
                            type: 'text',
                            text: `價格: NT$${deal.price}/unit`,
                            size: 'sm'
                        },
                        {
                            type: 'text',
                            text: `總額: NT$${deal.totalAmount}`,
                            size: 'sm',
                            weight: 'bold'
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            style: 'primary',
                            height: 'sm',
                            action: {
                                type: 'uri',
                                label: '查看交易',
                                uri: `https://liff.line.me/YOUR_LIFF_ID/deal/${deal.id}`
                            }
                        }
                    ]
                }
            }
        };
    }
    // Quick Reply Buttons
    static getQuickReplies() {
        return {
            type: 'text',
            text: '請選擇您需要的服務：',
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'postback',
                            label: '📦 建立供應',
                            data: 'create_supply'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'postback',
                            label: '💰 價格諮詢',
                            data: 'price_inquiry'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'postback',
                            label: '📋 我的交易',
                            data: 'my_deals'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'postback',
                            label: '🎨 品牌工具包',
                            data: 'brand_kit'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '❓ 幫助',
                            text: '幫助'
                        }
                    }
                ]
            }
        };
    }
    // Price Suggestion Card
    static getPriceSuggestionCard(suggestion) {
        return {
            type: 'flex',
            altText: `價格建議: ${suggestion.product}`,
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '💰 價格建議',
                            weight: 'bold',
                            size: 'lg',
                            color: '#2E7D32'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: `產品: ${suggestion.product}`,
                            size: 'sm'
                        },
                        {
                            type: 'text',
                            text: `建議價格: NT$${suggestion.suggestedPrice}/unit`,
                            size: 'lg',
                            weight: 'bold',
                            color: '#2E7D32'
                        },
                        {
                            type: 'text',
                            text: `市場範圍: NT$${suggestion.priceRange.min} - NT$${suggestion.priceRange.max}`,
                            size: 'sm',
                            color: '#666666'
                        },
                        {
                            type: 'text',
                            text: `建議理由: ${suggestion.rationale}`,
                            size: 'sm',
                            wrap: true
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            style: 'primary',
                            height: 'sm',
                            action: {
                                type: 'postback',
                                label: '使用此價格',
                                data: `price_accept:${suggestion.suggestedPrice}`
                            }
                        },
                        {
                            type: 'button',
                            style: 'secondary',
                            height: 'sm',
                            action: {
                                type: 'message',
                                label: '重新評估',
                                text: '重新評估價格'
                            }
                        }
                    ]
                }
            }
        };
    }
    static getStatusText(status) {
        const statusMap = {
            'SUBMITTED': '已提交',
            'VERIFIED': '已驗證',
            'CAMPAIGNING': '推廣中',
            'QUALIFIED_LEADS': '有潛在買家',
            'NEGOTIATION': '談判中',
            'PO_ISSUED': '訂單已發出',
            'IN_TRANSIT': '運送中',
            'DELIVERED': '已送達',
            'PAID': '已付款',
            'CLOSED': '已完成'
        };
        return statusMap[status] || status;
    }
    static getStatusColor(status) {
        const colorMap = {
            'SUBMITTED': '#FF9800',
            'VERIFIED': '#2196F3',
            'CAMPAIGNING': '#9C27B0',
            'QUALIFIED_LEADS': '#4CAF50',
            'NEGOTIATION': '#FF5722',
            'PO_ISSUED': '#795548',
            'IN_TRANSIT': '#607D8B',
            'DELIVERED': '#8BC34A',
            'PAID': '#4CAF50',
            'CLOSED': '#2E7D32'
        };
        return colorMap[status] || '#666666';
    }
    static getDealStatusText(status) {
        const statusMap = {
            'INTERESTED': '有興趣',
            'SAMPLE_REQUESTED': '要求樣品',
            'CALL_SCHEDULED': '已安排通話',
            'NEGOTIATING': '談判中',
            'OFFER_MADE': '已出價',
            'ACCEPTED': '已接受',
            'REJECTED': '已拒絕'
        };
        return statusMap[status] || status;
    }
    static getDealStatusColor(status) {
        const colorMap = {
            'INTERESTED': '#4CAF50',
            'SAMPLE_REQUESTED': '#FF9800',
            'CALL_SCHEDULED': '#2196F3',
            'NEGOTIATING': '#FF5722',
            'OFFER_MADE': '#9C27B0',
            'ACCEPTED': '#2E7D32',
            'REJECTED': '#F44336'
        };
        return colorMap[status] || '#666666';
    }
    // Carousel for multiple supplies
    static getSuppliesCarousel(supplies) {
        return {
            type: 'template',
            altText: '您的供應清單',
            template: {
                type: 'carousel',
                columns: supplies.slice(0, 10).map(supply => ({
                    thumbnailImageUrl: supply.imageUrl || 'https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=Product',
                    title: supply.product,
                    text: `${supply.quantity} ${supply.unit} | NT$${supply.price}/unit\n狀態: ${this.getStatusText(supply.status)}`,
                    actions: [
                        {
                            type: 'uri',
                            label: '查看詳情',
                            uri: `https://liff.line.me/YOUR_LIFF_ID/supply/${supply.id}`
                        },
                        {
                            type: 'postback',
                            label: '編輯',
                            data: `edit_supply:${supply.id}`
                        }
                    ]
                }))
            }
        };
    }
    // Carousel for multiple deals
    static getDealsCarousel(deals) {
        return {
            type: 'template',
            altText: '您的交易清單',
            template: {
                type: 'carousel',
                columns: deals.slice(0, 10).map(deal => ({
                    thumbnailImageUrl: deal.buyerLogo || 'https://via.placeholder.com/300x200/2196F3/FFFFFF?text=Buyer',
                    title: deal.buyerName,
                    text: `${deal.product} | ${deal.quantity} ${deal.unit}\nNT$${deal.totalAmount} | ${this.getDealStatusText(deal.status)}`,
                    actions: [
                        {
                            type: 'uri',
                            label: '查看交易',
                            uri: `https://liff.line.me/YOUR_LIFF_ID/deal/${deal.id}`
                        },
                        {
                            type: 'postback',
                            label: '聯繫買家',
                            data: `contact_buyer:${deal.id}`
                        }
                    ]
                }))
            }
        };
    }
    // Carousel for price suggestions
    static getPriceSuggestionsCarousel(suggestions) {
        return {
            type: 'template',
            altText: '價格建議',
            template: {
                type: 'carousel',
                columns: suggestions.slice(0, 5).map(suggestion => ({
                    thumbnailImageUrl: suggestion.imageUrl || 'https://via.placeholder.com/300x200/FF9800/FFFFFF?text=Price',
                    title: suggestion.product,
                    text: `建議價格: NT$${suggestion.suggestedPrice}/unit\n市場範圍: NT$${suggestion.priceRange.min}-${suggestion.priceRange.max}`,
                    actions: [
                        {
                            type: 'postback',
                            label: '使用此價格',
                            data: `price_accept:${suggestion.suggestedPrice}`
                        },
                        {
                            type: 'message',
                            label: '重新評估',
                            text: '重新評估價格'
                        }
                    ]
                }))
            }
        };
    }
    // Carousel for marketing materials
    static getMarketingMaterialsCarousel(materials) {
        return {
            type: 'template',
            altText: '行銷素材',
            template: {
                type: 'carousel',
                columns: materials.slice(0, 10).map(material => ({
                    thumbnailImageUrl: material.previewUrl || 'https://via.placeholder.com/300x200/9C27B0/FFFFFF?text=Marketing',
                    title: material.title,
                    text: `${material.type} | ${material.product}\n建立時間: ${new Date(material.createdAt).toLocaleDateString()}`,
                    actions: [
                        {
                            type: 'uri',
                            label: '下載',
                            uri: material.downloadUrl
                        },
                        {
                            type: 'postback',
                            label: '分享',
                            data: `share_material:${material.id}`
                        }
                    ]
                }))
            }
        };
    }
}
// LINE Bot API Class
class LineBotAPI {
    constructor(accessToken = LINE_CONFIG.CHANNEL_ACCESS_TOKEN) {
        this.accessToken = accessToken;
        this.baseUrl = LINE_CONFIG.MESSAGING_API_URL;
    }
    async replyMessage(replyToken, messages) {
        const url = `${this.baseUrl}/message/reply`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`,
        };
        const body = {
            replyToken,
            messages: messages.slice(0, 5),
        };
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                throw new Error(`LINE API Error: ${response.status}`);
            }
        }
        catch (error) {
            console.error('Failed to send reply message:', error);
            throw error;
        }
    }
    async getUserProfile(userId) {
        const url = `${this.baseUrl}/profile/${userId}`;
        const headers = {
            'Authorization': `Bearer ${this.accessToken}`,
        };
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers,
            });
            if (!response.ok) {
                throw new Error(`LINE API Error: ${response.status}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error('Failed to get user profile:', error);
            throw error;
        }
    }
}
// Gemini AI Service
class GeminiService {
    constructor() {
        this.cache = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
        this.client = genAI;
    }
    async generateText(prompt) {
        try {
            // Create cache key from prompt hash
            const cacheKey = this.createCacheKey(prompt);
            // Check cache first
            const cached = this.cache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
                console.log('Using cached Gemini response for prompt length:', prompt.length);
                return cached.response;
            }
            console.log('Calling Gemini API with prompt length:', prompt.length);
            const model = this.client.getGenerativeModel({
                model: 'gemini-2.5-flash',
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
                }
            });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            // Cache the response
            this.cache.set(cacheKey, {
                response: text || '抱歉，AI 服務暫時無法回應。',
                timestamp: Date.now()
            });
            // Clean old cache entries
            this.cleanCache();
            console.log('Gemini API response length:', (text === null || text === void 0 ? void 0 : text.length) || 0);
            return text || '抱歉，AI 服務暫時無法回應。';
        }
        catch (error) {
            console.error('Gemini API Error:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            return '抱歉，AI 服務暫時無法回應。';
        }
    }
    createCacheKey(prompt) {
        // Create a simple hash of the prompt for caching
        let hash = 0;
        for (let i = 0; i < prompt.length; i++) {
            const char = prompt.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }
    cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.CACHE_DURATION) {
                this.cache.delete(key);
            }
        }
    }
    async handleConversation(message, userId, userContext) {
        const prompt = `
    你是一個農產品銷售AI助理，專門幫助農場主管理產品、開發客戶、製作行銷素材。

    用戶訊息：${message}
    ${userContext ? `用戶背景：${JSON.stringify(userContext)}` : ''}

    請提供有用且個人化的建議。回答應該：
    1. 親切友善
    2. 實用具體
    3. 鼓勵用戶採取行動
    4. 提供專業建議

    請以繁體中文回應。
    `;
        return await this.generateText(prompt);
    }
}
// Database Service
class DatabaseService {
    constructor() {
        this.db = admin.firestore();
    }
    async createLineUser(lineUserData) {
        const now = admin.firestore.Timestamp.now();
        const userRef = this.db.collection('line_users').doc(lineUserData.lineUserId);
        const userDoc = {
            id: lineUserData.lineUserId,
            lineUserId: lineUserData.lineUserId,
            displayName: lineUserData.displayName || 'Unknown',
            pictureUrl: lineUserData.pictureUrl || null,
            statusMessage: lineUserData.statusMessage || null,
            createdAt: now,
            updatedAt: now,
            isActive: true,
            subscriptionTier: 'free',
            preferences: Object.assign({ language: 'zh-TW', notifications: true, marketingOptIn: false }, lineUserData.preferences),
            metadata: Object.assign({ totalMessages: 0, lastInteraction: now, favoriteFeatures: [] }, lineUserData.metadata)
        };
        await userRef.set(userDoc);
    }
    async getLineUser(lineUserId) {
        const userRef = this.db.collection('line_users').doc(lineUserId);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
            return userSnap.data();
        }
        return null;
    }
    async incrementUserMessageCount(lineUserId) {
        const userRef = this.db.collection('line_users').doc(lineUserId);
        await userRef.update({
            'metadata.totalMessages': admin.firestore.FieldValue.increment(1),
            'metadata.lastInteraction': admin.firestore.Timestamp.now()
        });
    }
    async createConversation(userId, conversationData) {
        const conversationRef = this.db.collection('conversations').doc();
        const conversationDoc = {
            id: conversationRef.id,
            userId,
            type: conversationData.type || 'text',
            content: conversationData.content || '',
            geminiResponse: conversationData.geminiResponse || null,
            metadata: conversationData.metadata || {},
            timestamp: admin.firestore.Timestamp.now()
        };
        await conversationRef.set(conversationDoc);
    }
    async getRecentConversations(userId, limit = 5) {
        try {
            // Get all conversations for user and sort in memory to avoid index requirement
            const conversationsRef = this.db.collection('conversations')
                .where('userId', '==', userId)
                .limit(50); // Get more docs to sort in memory
            const snapshot = await conversationsRef.get();
            const conversations = snapshot.docs.map(doc => doc.data());
            // Sort by timestamp in memory and return limited results
            return conversations
                .sort((a, b) => { var _a, _b; return ((_a = b.timestamp) === null || _a === void 0 ? void 0 : _a.seconds) - ((_b = a.timestamp) === null || _b === void 0 ? void 0 : _b.seconds); })
                .slice(0, limit);
        }
        catch (error) {
            console.error('Error getting recent conversations:', error);
            return []; // Return empty array on error
        }
    }
    async cleanupOldConversations(userId, keepCount = 20) {
        try {
            // Get all conversations for user
            const conversationsRef = this.db.collection('conversations')
                .where('userId', '==', userId)
                .limit(100);
            const snapshot = await conversationsRef.get();
            const conversations = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
            // Sort by timestamp and keep only recent ones
            const sortedConversations = conversations
                .sort((a, b) => { var _a, _b; return ((_a = b.timestamp) === null || _a === void 0 ? void 0 : _a.seconds) - ((_b = a.timestamp) === null || _b === void 0 ? void 0 : _b.seconds); });
            const toDelete = sortedConversations.slice(keepCount);
            // Delete old conversations in batches
            const batch = this.db.batch();
            toDelete.forEach(conv => {
                const docRef = this.db.collection('conversations').doc(conv.id);
                batch.delete(docRef);
            });
            if (toDelete.length > 0) {
                await batch.commit();
                console.log(`Cleaned up ${toDelete.length} old conversations for user ${userId}`);
            }
        }
        catch (error) {
            console.error('Error cleaning up conversations:', error);
        }
    }
}
// Webhook Handler
class WebhookHandler {
    constructor() {
        this.processedEvents = new Set();
        this.lineBot = new LineBotAPI();
        this.geminiService = new GeminiService();
        this.databaseService = new DatabaseService();
        // Clean processed events cache periodically
        setInterval(() => {
            this.cleanProcessedEvents();
        }, 5 * 60 * 1000); // Every 5 minutes
    }
    async handleEvents(events) {
        const promises = events.map(event => this.handleSingleEvent(event));
        await Promise.all(promises);
    }
    async handleSingleEvent(event) {
        // Create unique event ID for deduplication
        const eventId = this.createEventId(event);
        // Check if we've already processed this event
        if (this.processedEvents.has(eventId)) {
            console.log('Skipping duplicate event:', event.type, eventId);
            return;
        }
        // Mark event as processed
        this.processedEvents.add(eventId);
        console.log('Processing event:', event.type, eventId);
        try {
            switch (event.type) {
                case 'follow':
                    await this.handleFollow(event);
                    break;
                case 'message':
                    await this.handleMessage(event);
                    break;
                case 'postback':
                    await this.handlePostback(event);
                    break;
                default:
                    console.log('Unhandled event type:', event.type);
            }
        }
        catch (error) {
            console.error('Error handling event:', error);
            // Remove from processed events on error so it can be retried
            this.processedEvents.delete(eventId);
        }
    }
    createEventId(event) {
        var _a, _b;
        // Create a unique ID based on event properties
        const timestamp = event.replyToken ? 'reply' : 'no-reply';
        const source = `${event.source.type}-${event.source.userId}`;
        const content = ((_a = event.message) === null || _a === void 0 ? void 0 : _a.text) || ((_b = event.postback) === null || _b === void 0 ? void 0 : _b.data) || 'empty';
        return `${event.type}-${source}-${timestamp}-${content}`.substring(0, 100);
    }
    cleanProcessedEvents() {
        // In a real implementation, you might want to use a more sophisticated
        // cache with timestamps. For now, we'll just clear the set periodically
        // to prevent memory leaks
        if (this.processedEvents.size > 1000) {
            console.log('Cleaning processed events cache, size was:', this.processedEvents.size);
            this.processedEvents.clear();
        }
    }
    async handleFollow(event) {
        if (!event.replyToken)
            return;
        try {
            const profile = await this.lineBot.getUserProfile(event.source.userId);
            // Create user in Firebase
            await this.databaseService.createLineUser({
                lineUserId: event.source.userId,
                displayName: profile.displayName || 'Unknown',
                pictureUrl: profile.pictureUrl || null,
                statusMessage: profile.statusMessage || null
            });
            // Log follow event (minimal storage)
            await this.databaseService.createConversation(event.source.userId, {
                type: 'follow',
                content: `User followed: ${profile.displayName}`,
                geminiResponse: 'Welcome message sent'
            });
            // Send welcome message with rich UI
            const welcomeMessage = RichUIMessages.getMainMenu();
            await this.lineBot.replyMessage(event.replyToken, [welcomeMessage]);
        }
        catch (error) {
            console.error('Error handling follow event:', error);
            const fallbackMessage = {
                type: 'text',
                text: '🌾 歡迎使用 Farm2Market AI！\n您的智慧農場銷售助手已啟動。'
            };
            await this.lineBot.replyMessage(event.replyToken, [fallbackMessage]);
        }
    }
    async handleMessage(event) {
        if (!event.replyToken || !event.message)
            return;
        try {
            // Ensure user exists
            let user = await this.databaseService.getLineUser(event.source.userId);
            if (!user) {
                const profile = await this.lineBot.getUserProfile(event.source.userId);
                await this.databaseService.createLineUser({
                    lineUserId: event.source.userId,
                    displayName: profile.displayName || 'Unknown',
                    pictureUrl: profile.pictureUrl || null,
                    statusMessage: profile.statusMessage || null
                });
            }
            // Increment message count
            await this.databaseService.incrementUserMessageCount(event.source.userId);
            if (event.message.type === 'text' && event.message.text) {
                await this.handleTextMessage(event.replyToken, event.message.text, event.source.userId);
            }
            else if (event.message.type === 'image') {
                await this.handleImageMessage(event.replyToken, event.message.id || '', event.source.userId);
            }
        }
        catch (error) {
            console.error('Error handling message:', error);
        }
    }
    async handleTextMessage(replyToken, text, userId) {
        var _a, _b, _c;
        try {
            const lowerText = text.toLowerCase();
            // Command recognition - avoid AI calls for simple commands
            if (lowerText.includes('產品') || lowerText.includes('product')) {
                await this.handleProductInquiry(replyToken);
                return;
            }
            else if (lowerText.includes('店家') || lowerText.includes('store')) {
                await this.handleStoreInquiry(replyToken);
                return;
            }
            else if (lowerText.includes('行銷') || lowerText.includes('marketing')) {
                await this.handleMarketingInquiry(replyToken);
                return;
            }
            else if (lowerText.includes('報告') || lowerText.includes('analytics')) {
                await this.handleAnalyticsInquiry(replyToken);
                return;
            }
            else if (lowerText.includes('幫助') || lowerText.includes('help')) {
                await this.handleHelpInquiry(replyToken);
                return;
            }
            else if (lowerText.includes('管理') || lowerText.includes('dashboard') || lowerText.includes('網站') || lowerText.includes('website') || lowerText.includes('管理介面') || lowerText.includes('後台') || lowerText.includes('admin') || lowerText.includes('網頁') || lowerText.includes('web')) {
                await this.handleWebsiteAccessRequest(replyToken, userId);
                return;
            }
            else {
                // Get user context for personalized AI response
                let user, recentConversations;
                try {
                    user = await this.databaseService.getLineUser(userId);
                    recentConversations = await this.databaseService.getRecentConversations(userId, 3);
                }
                catch (error) {
                    console.error('Error getting user context:', error);
                    user = null;
                    recentConversations = [];
                }
                const userContext = {
                    name: (user === null || user === void 0 ? void 0 : user.displayName) || '用戶',
                    totalMessages: ((_a = user === null || user === void 0 ? void 0 : user.metadata) === null || _a === void 0 ? void 0 : _a.totalMessages) || 0,
                    subscriptionTier: (user === null || user === void 0 ? void 0 : user.subscriptionTier) || 'free',
                    language: ((_b = user === null || user === void 0 ? void 0 : user.preferences) === null || _b === void 0 ? void 0 : _b.language) || 'zh-TW',
                    recentConversations: recentConversations.map(conv => ({
                        type: conv.type,
                        content: conv.content,
                        timestamp: conv.timestamp
                    }))
                };
                // AI-powered response with user context (only for non-command messages)
                const aiResponse = await this.geminiService.handleConversation(text, userId, userContext);
                // Only store conversation if AI response is successful
                if (aiResponse && aiResponse !== '抱歉，AI 服務暫時無法回應。') {
                    await this.databaseService.createConversation(userId, {
                        type: 'text',
                        content: text,
                        geminiResponse: aiResponse
                    });
                    // Periodic cleanup: keep only last 20 conversations per user
                    const user = await this.databaseService.getLineUser(userId);
                    if (user && ((_c = user.metadata) === null || _c === void 0 ? void 0 : _c.totalMessages) && user.metadata.totalMessages % 10 === 0) {
                        await this.databaseService.cleanupOldConversations(userId, 20);
                    }
                }
                // Create interactive response with quick actions
                const interactiveResponse = {
                    type: 'flex',
                    altText: 'AI 助手回應',
                    contents: {
                        type: 'bubble',
                        header: {
                            type: 'box',
                            layout: 'vertical',
                            contents: [
                                {
                                    type: 'text',
                                    text: '🤖 AI 助手回應',
                                    weight: 'bold',
                                    size: 'xl',
                                    color: '#FF6B35'
                                }
                            ]
                        },
                        body: {
                            type: 'box',
                            layout: 'vertical',
                            contents: [
                                {
                                    type: 'text',
                                    text: (aiResponse || '抱歉，AI 服務暫時無法回應。').substring(0, 300) + ((aiResponse || '').length > 300 ? '...' : ''),
                                    wrap: true,
                                    size: 'sm',
                                    color: '#666666'
                                }
                            ]
                        },
                        footer: {
                            type: 'box',
                            layout: 'vertical',
                            contents: [
                                {
                                    type: 'button',
                                    style: 'primary',
                                    height: 'sm',
                                    action: {
                                        type: 'postback',
                                        label: '🥚 建立供應',
                                        data: 'create_supply',
                                        displayText: '🥚 建立供應'
                                    }
                                },
                                {
                                    type: 'button',
                                    style: 'secondary',
                                    height: 'sm',
                                    action: {
                                        type: 'postback',
                                        label: '💰 價格諮詢',
                                        data: 'price_inquiry',
                                        displayText: '💰 價格諮詢'
                                    }
                                },
                                {
                                    type: 'button',
                                    style: 'secondary',
                                    height: 'sm',
                                    action: {
                                        type: 'postback',
                                        label: '📋 我的交易',
                                        data: 'my_deals',
                                        displayText: '📋 我的交易'
                                    }
                                },
                                {
                                    type: 'button',
                                    style: 'secondary',
                                    height: 'sm',
                                    action: {
                                        type: 'postback',
                                        label: '🎨 品牌工具',
                                        data: 'brand_kit',
                                        displayText: '🎨 品牌工具'
                                    }
                                }
                            ]
                        }
                    }
                };
                await this.lineBot.replyMessage(replyToken, [interactiveResponse]);
            }
        }
        catch (error) {
            console.error('Error handling text message:', error);
            // Even error responses should have interactive UI
            const errorResponse = {
                type: 'flex',
                altText: '系統錯誤',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '⚠️ 系統錯誤',
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF4444'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '抱歉，處理您的訊息時發生錯誤。請稍後再試。',
                                wrap: true,
                                size: 'sm',
                                color: '#666666'
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🔄 重新開始',
                                    data: 'restart_conversation',
                                    displayText: '🔄 重新開始'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '❓ 尋求幫助',
                                    data: 'help',
                                    displayText: '❓ 尋求幫助'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [errorResponse]);
        }
    }
    async handleImageMessage(replyToken, messageId, userId) {
        try {
            const imageProcessingResponse = {
                type: 'flex',
                altText: '照片處理中',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '📸 照片處理中',
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '收到您的產品照片！AI 正在分析照片內容...',
                                wrap: true,
                                size: 'sm',
                                color: '#666666'
                            },
                            {
                                type: 'separator',
                                margin: 'md'
                            },
                            {
                                type: 'text',
                                text: '處理項目：',
                                weight: 'bold',
                                size: 'sm',
                                margin: 'md'
                            },
                            {
                                type: 'text',
                                text: '• 自動優化圖片品質\n• 生成產品描述\n• 建立行銷素材\n• 價格標籤設計',
                                size: 'sm',
                                color: '#666666',
                                wrap: true
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📝 生成產品描述',
                                    data: 'generate_product_description',
                                    displayText: '📝 生成產品描述'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📸 優化照片',
                                    data: 'optimize_product_photos'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🏷️ 設計標籤',
                                    data: 'design_price_tags'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [imageProcessingResponse]);
            // Store image message
            await this.databaseService.createConversation(userId, {
                type: 'image',
                content: `Image uploaded: ${messageId}`,
                metadata: { imageAnalysis: { status: 'processing' } }
            });
            // Simulate analysis (in real implementation, you'd fetch and analyze the image)
            const analysisResult = {
                description: '優質農產品，外觀新鮮，色澤良好',
                healthStatus: '新鮮度高，適合銷售',
                pricingEstimate: '市場價格 NT$50-80',
                improvements: '建議增加品牌包裝提升價值'
            };
            const responseMessage = {
                type: 'text',
                text: `🤖 AI 產品分析完成！\n\n📝 產品描述：${analysisResult.description}\n🏥 健康狀況：${analysisResult.healthStatus}\n💰 價格建議：${analysisResult.pricingEstimate}\n✨ 改進建議：${analysisResult.improvements}`
            };
            await this.lineBot.replyMessage(replyToken, [responseMessage]);
        }
        catch (error) {
            console.error('Error handling image message:', error);
        }
    }
    async handlePostback(event) {
        if (!event.replyToken || !event.postback)
            return;
        try {
            const data = event.postback.data;
            console.log('Postback received:', data);
            // Handle price acceptance
            if (data.startsWith('price_accept:')) {
                const price = data.split(':')[1];
                const message = {
                    type: 'text',
                    text: `✅ 已接受價格建議：NT$${price}/unit\n\n系統將為您建立供應請求，並開始尋找潛在買家。`
                };
                await this.lineBot.replyMessage(event.replyToken, [message]);
                return;
            }
            // Handle main menu actions
            switch (data) {
                case 'price_inquiry':
                    await this.handlePriceInquiryPostback(event.replyToken, event.source.userId);
                    break;
                case 'create_supply':
                    await this.handleCreateSupplyPostback(event.replyToken, event.source.userId);
                    break;
                case 'my_deals':
                    await this.handleMyDealsPostback(event.replyToken, event.source.userId);
                    break;
                case 'brand_kit':
                    await this.handleBrandKitPostback(event.replyToken, event.source.userId);
                    break;
                // Farm product supply types
                case 'supply_eggs':
                    await this.handleProductSupplyCreation(event.replyToken, event.source.userId, '雞蛋類');
                    break;
                case 'supply_vegetables':
                    await this.handleProductSupplyCreation(event.replyToken, event.source.userId, '蔬菜類');
                    break;
                case 'supply_fruits':
                    await this.handleProductSupplyCreation(event.replyToken, event.source.userId, '水果類');
                    break;
                case 'supply_grains':
                    await this.handleProductSupplyCreation(event.replyToken, event.source.userId, '穀物類');
                    break;
                case 'supply_dairy':
                    await this.handleProductSupplyCreation(event.replyToken, event.source.userId, '乳製品');
                    break;
                case 'supply_custom':
                    await this.handleCustomProductSupply(event.replyToken, event.source.userId);
                    break;
                // Supply form actions
                case 'start_supply_form:一般雞蛋':
                    await this.handleSupplyFormStart(event.replyToken, event.source.userId, '一般雞蛋');
                    break;
                case 'start_supply_form:有機雞蛋':
                    await this.handleSupplyFormStart(event.replyToken, event.source.userId, '有機雞蛋');
                    break;
                case 'start_supply_form:放養雞蛋':
                    await this.handleSupplyFormStart(event.replyToken, event.source.userId, '放養雞蛋');
                    break;
                case 'ai_supply_form:一般雞蛋':
                    await this.handleAISupplyForm(event.replyToken, event.source.userId, '一般雞蛋');
                    break;
                case 'ai_supply_form:有機雞蛋':
                    await this.handleAISupplyForm(event.replyToken, event.source.userId, '有機雞蛋');
                    break;
                case 'ai_supply_form:放養雞蛋':
                    await this.handleAISupplyForm(event.replyToken, event.source.userId, '放養雞蛋');
                    break;
                case 'submit_supply_form:一般雞蛋':
                case 'submit_supply_form:有機雞蛋':
                case 'submit_supply_form:放養雞蛋':
                case 'use_ai_suggestions:一般雞蛋':
                case 'use_ai_suggestions:有機雞蛋':
                case 'use_ai_suggestions:放養雞蛋':
                case 'generate_contact_letter':
                case 'direct_contact':
                case 'fill_store_info':
                case 'search_nearby_stores':
                case 'send_group_email':
                case 'individual_contact':
                case 'copy_facebook_post':
                case 'copy_instagram_post':
                case 'copy_twitter_post':
                case 'copy_description':
                    await this.handleGenericSuccess(event.replyToken, event.source.userId, data);
                    break;
                // Additional features
                case 'detailed_price_analysis':
                    await this.handleDetailedPriceAnalysis(event.replyToken, event.source.userId);
                    break;
                case 'find_buyers':
                    await this.handleFindBuyers(event.replyToken, event.source.userId);
                    break;
                case 'view_detailed_reports':
                    await this.handleDetailedReports(event.replyToken, event.source.userId);
                    break;
                case 'manage_stores':
                    await this.handleManageStores(event.replyToken, event.source.userId);
                    break;
                case 'start_contact_buyers':
                    await this.handleStartContactBuyers(event.replyToken, event.source.userId);
                    break;
                case 'refresh_buyers':
                    await this.handleFindBuyers(event.replyToken, event.source.userId);
                    break;
                case 'add_new_store':
                    await this.handleAddNewStore(event.replyToken, event.source.userId);
                    break;
                case 'contact_stores':
                    await this.handleContactStores(event.replyToken, event.source.userId);
                    break;
                // Brand kit features
                case 'optimize_product_photos':
                    await this.handlePhotoOptimization(event.replyToken, event.source.userId);
                    break;
                case 'generate_product_description':
                    await this.handleProductDescription(event.replyToken, event.source.userId);
                    break;
                case 'create_social_posts':
                    await this.handleSocialPosts(event.replyToken, event.source.userId);
                    break;
                case 'design_price_tags':
                    await this.handlePriceTagDesign(event.replyToken, event.source.userId);
                    break;
                case 'generate_facebook_post':
                    await this.handleGenerateFacebookPost(event.replyToken, event.source.userId);
                    break;
                case 'generate_instagram_post':
                    await this.handleGenerateInstagramPost(event.replyToken, event.source.userId);
                    break;
                case 'generate_twitter_post':
                    await this.handleGenerateTwitterPost(event.replyToken, event.source.userId);
                    break;
                case 'copy_description':
                    await this.handleCopyDescription(event.replyToken, event.source.userId);
                    break;
                case 'regenerate_description':
                    await this.handleProductDescription(event.replyToken, event.source.userId);
                    break;
                case 'restart_conversation':
                    await this.handleRestartConversation(event.replyToken, event.source.userId);
                    break;
                case 'help':
                    await this.handleHelpInquiry(event.replyToken);
                    break;
                case 'website_access':
                    await this.handleWebsiteAccessRequest(event.replyToken, event.source.userId);
                    break;
                default:
                    console.log('Unhandled postback data:', data);
                    const fallbackMessage = {
                        type: 'flex',
                        altText: '功能暫時無法使用',
                        contents: {
                            type: 'bubble',
                            header: {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'text',
                                        text: '⚠️ 功能暫時無法使用',
                                        weight: 'bold',
                                        size: 'xl',
                                        color: '#FF4444'
                                    }
                                ]
                            },
                            body: {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'text',
                                        text: '抱歉，此功能暫時無法使用。請稍後再試或聯繫客服。',
                                        wrap: true,
                                        size: 'sm',
                                        color: '#666666'
                                    }
                                ]
                            },
                            footer: {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'button',
                                        style: 'primary',
                                        height: 'sm',
                                        action: {
                                            type: 'postback',
                                            label: '🔄 重新開始',
                                            data: 'restart_conversation'
                                        }
                                    },
                                    {
                                        type: 'button',
                                        style: 'secondary',
                                        height: 'sm',
                                        action: {
                                            type: 'postback',
                                            label: '❓ 尋求幫助',
                                            data: 'help'
                                        }
                                    }
                                ]
                            }
                        }
                    };
                    await this.lineBot.replyMessage(event.replyToken, [fallbackMessage]);
            }
        }
        catch (error) {
            console.error('Error handling postback:', error);
            const errorMessage = {
                type: 'text',
                text: '抱歉，處理您的請求時發生錯誤。請稍後再試。'
            };
            await this.lineBot.replyMessage(event.replyToken, [errorMessage]);
        }
    }
    // Inquiry handlers
    async handleProductInquiry(replyToken) {
        const message = {
            type: 'text',
            text: '📦 產品管理功能\n\n• 新增產品資訊\n• 管理庫存狀態\n• AI 自動補貨提醒\n• 產品照片優化\n\n請上傳產品照片開始使用！'
        };
        await this.lineBot.replyMessage(replyToken, [message]);
    }
    async handleStoreInquiry(replyToken) {
        const message = {
            type: 'text',
            text: '🏪 店家管理功能\n\n• AI 尋找潛在店家\n• 自動發送介紹信\n• 追蹤客戶關係\n• 訂單頻率分析\n\n讓 AI 幫您拓展業務！'
        };
        await this.lineBot.replyMessage(replyToken, [message]);
    }
    async handleMarketingInquiry(replyToken) {
        const message = {
            type: 'text',
            text: '📱 AI 行銷工具\n\n• 自動生成產品傳單\n• 建立社群媒體貼文\n• 食譜卡片設計\n• 多語言行銷文案\n\n只需上傳產品照片，AI 就能幫您建立專業行銷素材！'
        };
        await this.lineBot.replyMessage(replyToken, [message]);
    }
    async handleAnalyticsInquiry(replyToken) {
        const message = {
            type: 'text',
            text: '📊 數據分析功能\n\n• 銷售趨勢分析\n• 客戶行為追蹤\n• 產品表現統計\n• 營收預測\n\n功能開發中，敬請期待！'
        };
        await this.lineBot.replyMessage(replyToken, [message]);
    }
    async handleHelpInquiry(replyToken) {
        const helpMessage = RichUIMessages.getQuickReplies();
        await this.lineBot.replyMessage(replyToken, [helpMessage]);
    }
    // Postback handlers for main menu actions
    async handlePriceInquiryPostback(replyToken, userId) {
        var _a, _b;
        try {
            // Get user context for personalized response
            const user = await this.databaseService.getLineUser(userId);
            const userContext = user ? {
                name: user.displayName,
                totalMessages: ((_a = user.metadata) === null || _a === void 0 ? void 0 : _a.totalMessages) || 0,
                subscription: user.subscriptionTier,
                language: ((_b = user.preferences) === null || _b === void 0 ? void 0 : _b.language) || 'zh-TW'
            } : {};
            // Create AI prompt for farm product price inquiry
            const prompt = `你是一個專業的農產品市場價格諮詢顧問。用戶 ${userContext.name || '客戶'} 想要了解農產品市場價格。

請提供以下資訊：
1. 當前農產品市場價格趨勢（一般產品、有機產品、優質產品）
2. 影響農產品價格的關鍵因素（生產成本、季節性需求、市場供需）
3. 不同等級產品的價格差異
4. 最佳銷售時機和價格策略建議
5. 批發與零售價格差異分析

請用專業但親切的語氣回應，並提供實用的建議。`;
            const aiResponse = await this.geminiService.generateText(prompt);
            // Store conversation if AI response is successful
            if (aiResponse && !aiResponse.includes('抱歉，AI 服務暫時無法回應')) {
                await this.databaseService.createConversation(userId, {
                    type: 'postback',
                    content: '農產品價格諮詢',
                    geminiResponse: aiResponse
                });
            }
            // Create rich UI response with quick actions
            const richMessage = {
                type: 'flex',
                altText: '農產品價格諮詢結果',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '🌾 農產品市場價格分析',
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: aiResponse.substring(0, 200) + (aiResponse.length > 200 ? '...' : ''),
                                wrap: true,
                                size: 'sm',
                                color: '#666666'
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📊 查看詳細分析',
                                    data: 'detailed_price_analysis',
                                    displayText: '📊 查看詳細分析'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🏪 尋找買家',
                                    data: 'find_buyers',
                                    displayText: '🏪 尋找買家'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [richMessage]);
        }
        catch (error) {
            console.error('Error handling price inquiry postback:', error);
            const fallbackMessage = {
                type: 'text',
                text: '抱歉，價格諮詢服務暫時無法使用。請稍後再試。'
            };
            await this.lineBot.replyMessage(replyToken, [fallbackMessage]);
        }
    }
    async handleCreateSupplyPostback(replyToken, userId) {
        try {
            // Create interactive supply creation form
            const supplyForm = {
                type: 'flex',
                altText: '建立農產品供應請求',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '🌾 建立農產品供應請求',
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            },
                            {
                                type: 'text',
                                text: 'AI 將幫您找到最佳買家',
                                size: 'sm',
                                color: '#666666'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '請選擇您的農產品類型：',
                                weight: 'bold',
                                size: 'md'
                            },
                            {
                                type: 'separator',
                                margin: 'md'
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🥚 雞蛋類',
                                    data: 'supply_eggs',
                                    displayText: '🥚 雞蛋類'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🥬 蔬菜類',
                                    data: 'supply_vegetables',
                                    displayText: '🥬 蔬菜類'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🍎 水果類',
                                    data: 'supply_fruits',
                                    displayText: '🍎 水果類'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🌾 穀物類',
                                    data: 'supply_grains',
                                    displayText: '🌾 穀物類'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🥛 乳製品',
                                    data: 'supply_dairy',
                                    displayText: '🥛 乳製品'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📝 自訂規格',
                                    data: 'supply_custom',
                                    displayText: '📝 自訂規格'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [supplyForm]);
        }
        catch (error) {
            console.error('Error handling create supply postback:', error);
            const fallbackMessage = {
                type: 'text',
                text: '抱歉，建立供應功能暫時無法使用。請稍後再試。'
            };
            await this.lineBot.replyMessage(replyToken, [fallbackMessage]);
        }
    }
    async handleMyDealsPostback(replyToken, userId) {
        var _a;
        try {
            // Get user context
            const user = await this.databaseService.getLineUser(userId);
            const userContext = user ? {
                name: user.displayName,
                totalMessages: ((_a = user.metadata) === null || _a === void 0 ? void 0 : _a.totalMessages) || 0,
                subscription: user.subscriptionTier
            } : {};
            // Create interactive deals dashboard
            const dealsDashboard = {
                type: 'flex',
                altText: '我的雞蛋交易記錄',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '📋 我的農場交易',
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            },
                            {
                                type: 'text',
                                text: `${userContext.name || '客戶'} 的農場管理`,
                                size: 'sm',
                                color: '#666666'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'box',
                                layout: 'horizontal',
                                contents: [
                                    {
                                        type: 'text',
                                        text: '🌾 本月銷售',
                                        size: 'sm',
                                        color: '#666666'
                                    },
                                    {
                                        type: 'text',
                                        text: '1,250 單位',
                                        size: 'sm',
                                        color: '#FF6B35',
                                        align: 'end'
                                    }
                                ]
                            },
                            {
                                type: 'box',
                                layout: 'horizontal',
                                contents: [
                                    {
                                        type: 'text',
                                        text: '💰 總收入',
                                        size: 'sm',
                                        color: '#666666'
                                    },
                                    {
                                        type: 'text',
                                        text: 'NT$ 18,750',
                                        size: 'sm',
                                        color: '#4CAF50',
                                        align: 'end'
                                    }
                                ]
                            },
                            {
                                type: 'box',
                                layout: 'horizontal',
                                contents: [
                                    {
                                        type: 'text',
                                        text: '🏪 合作商店',
                                        size: 'sm',
                                        color: '#666666'
                                    },
                                    {
                                        type: 'text',
                                        text: '3 家',
                                        size: 'sm',
                                        color: '#2196F3',
                                        align: 'end'
                                    }
                                ]
                            },
                            {
                                type: 'separator',
                                margin: 'md'
                            },
                            {
                                type: 'text',
                                text: '📊 進行中的交易',
                                weight: 'bold',
                                size: 'md',
                                margin: 'md'
                            },
                            {
                                type: 'text',
                                text: '• 全聯福利中心 - 500單位有機農產品\n• 家樂福 - 300單位優質農產品\n• 頂好超市 - 200單位一般農產品',
                                size: 'sm',
                                color: '#666666',
                                wrap: true
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📈 查看詳細報表',
                                    data: 'view_detailed_reports'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🏪 管理合作商店',
                                    data: 'manage_stores'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [dealsDashboard]);
        }
        catch (error) {
            console.error('Error handling my deals postback:', error);
            const fallbackMessage = {
                type: 'text',
                text: '抱歉，交易記錄功能暫時無法使用。請稍後再試。'
            };
            await this.lineBot.replyMessage(replyToken, [fallbackMessage]);
        }
    }
    async handleBrandKitPostback(replyToken, userId) {
        try {
            // Create interactive brand kit menu
            const brandKitMenu = {
                type: 'flex',
                altText: '雞蛋農場品牌工具包',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '🎨 農場品牌工具包',
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            },
                            {
                                type: 'text',
                                text: 'AI 驅動的行銷素材生成',
                                size: 'sm',
                                color: '#666666'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '選擇您需要的行銷工具：',
                                weight: 'bold',
                                size: 'md'
                            },
                            {
                                type: 'separator',
                                margin: 'md'
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📸 產品照片優化',
                                    data: 'optimize_product_photos',
                                    displayText: '📸 產品照片優化'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📝 生成產品描述',
                                    data: 'generate_product_description',
                                    displayText: '📝 生成產品描述'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📱 社群媒體貼文',
                                    data: 'create_social_posts'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🏷️ 價格標籤設計',
                                    data: 'design_price_tags'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🌐 開啟網站工具',
                                    data: 'website_access',
                                    displayText: '🌐 開啟網站工具'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [brandKitMenu]);
        }
        catch (error) {
            console.error('Error handling brand kit postback:', error);
            const fallbackMessage = {
                type: 'text',
                text: '抱歉，品牌工具功能暫時無法使用。請稍後再試。'
            };
            await this.lineBot.replyMessage(replyToken, [fallbackMessage]);
        }
    }
    // Farm product supply creation handlers
    async handleProductSupplyCreation(replyToken, userId, productType) {
        try {
            const supplyForm = {
                type: 'flex',
                altText: `建立${productType}供應請求`,
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: `🌾 ${productType}供應請求`,
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '請提供以下資訊：',
                                weight: 'bold',
                                size: 'md'
                            },
                            {
                                type: 'text',
                                text: '• 每日產量\n• 包裝規格\n• 預期價格\n• 交貨頻率\n• 品質認證\n• 產品等級',
                                size: 'sm',
                                color: '#666666',
                                wrap: true
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📝 開始填寫',
                                    data: `start_supply_form:${productType}`,
                                    displayText: '📝 開始填寫'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🤖 AI 智能填寫',
                                    data: `ai_supply_form:${productType}`,
                                    displayText: '🤖 AI 智能填寫'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [supplyForm]);
        }
        catch (error) {
            console.error('Error handling egg supply creation:', error);
        }
    }
    async handleCustomProductSupply(replyToken, userId) {
        try {
            const message = {
                type: 'text',
                text: `🌾 自訂農產品規格\n\n請詳細描述您的農產品規格：\n\n例如：\n「我要供應 200 公斤 A級 有機蘋果，每箱 10 公斤，希望價格 NT$80/公斤，每週交貨 2 次，有機認證編號：ABC123」\n\nAI 將根據您的描述建立專業的供應請求並尋找合適的買家！`
            };
            await this.lineBot.replyMessage(replyToken, [message]);
        }
        catch (error) {
            console.error('Error handling custom egg supply:', error);
        }
    }
    // Additional feature handlers
    async handleDetailedPriceAnalysis(replyToken, userId) {
        try {
            const prompt = `為農場提供詳細的市場價格分析報告，包括：

1. 當前市場價格趨勢圖表分析
2. 不同地區價格差異比較
3. 季節性價格波動預測
4. 競爭對手價格分析
5. 成本結構分析
6. 利潤最大化建議
7. 風險評估與應對策略

請提供專業且實用的分析報告。`;
            const aiResponse = await this.geminiService.generateText(prompt);
            const analysisReport = {
                type: 'flex',
                altText: '詳細價格分析報告',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '📊 詳細價格分析報告',
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: aiResponse.substring(0, 300) + (aiResponse.length > 300 ? '...' : ''),
                                wrap: true,
                                size: 'sm',
                                color: '#666666'
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'uri',
                                    label: '📈 查看完整報告',
                                    uri: 'https://farm2market-99.web.app/analytics'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [analysisReport]);
        }
        catch (error) {
            console.error('Error handling detailed price analysis:', error);
        }
    }
    async handleFindBuyers(replyToken, userId) {
        try {
            const buyersList = {
                type: 'flex',
                altText: '潛在買家列表',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '🏪 潛在買家推薦',
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '根據您的農產品類型，AI 推薦以下買家：',
                                size: 'sm',
                                color: '#666666'
                            },
                            {
                                type: 'separator',
                                margin: 'md'
                            },
                            {
                                type: 'text',
                                text: '🛒 全聯福利中心\n需求量：500單位/週\n價格：NT$15/單位\n距離：5公里',
                                size: 'sm',
                                color: '#333333',
                                wrap: true
                            },
                            {
                                type: 'text',
                                text: '🛒 家樂福\n需求量：300單位/週\n價格：NT$16/單位\n距離：8公里',
                                size: 'sm',
                                color: '#333333',
                                wrap: true
                            },
                            {
                                type: 'text',
                                text: '🛒 頂好超市\n需求量：200單位/週\n價格：NT$14/單位\n距離：3公里',
                                size: 'sm',
                                color: '#333333',
                                wrap: true
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🤝 開始聯繫',
                                    data: 'start_contact_buyers'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🔄 重新搜尋',
                                    data: 'refresh_buyers'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [buyersList]);
        }
        catch (error) {
            console.error('Error handling find buyers:', error);
        }
    }
    async handleDetailedReports(replyToken, userId) {
        try {
            const reportMenu = {
                type: 'flex',
                altText: '詳細報表選單',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '📈 詳細報表中心',
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '選擇您要查看的報表：',
                                weight: 'bold',
                                size: 'md'
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'uri',
                                    label: '📊 銷售報表',
                                    uri: 'https://farm2market-99.web.app/analytics'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'uri',
                                    label: '💰 財務報表',
                                    uri: 'https://farm2market-99.web.app/analytics'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'uri',
                                    label: '📈 趨勢分析',
                                    uri: 'https://farm2market-99.web.app/analytics'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [reportMenu]);
        }
        catch (error) {
            console.error('Error handling detailed reports:', error);
        }
    }
    async handleManageStores(replyToken, userId) {
        try {
            const storeManagement = {
                type: 'flex',
                altText: '合作商店管理',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '🏪 合作商店管理',
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '目前合作的商店：',
                                weight: 'bold',
                                size: 'md'
                            },
                            {
                                type: 'separator',
                                margin: 'md'
                            },
                            {
                                type: 'text',
                                text: '🛒 全聯福利中心\n狀態：✅ 合作中\n訂單：500盒/週',
                                size: 'sm',
                                color: '#333333',
                                wrap: true
                            },
                            {
                                type: 'text',
                                text: '🛒 家樂福\n狀態：✅ 合作中\n訂單：300盒/週',
                                size: 'sm',
                                color: '#333333',
                                wrap: true
                            },
                            {
                                type: 'text',
                                text: '🛒 頂好超市\n狀態：✅ 合作中\n訂單：200盒/週',
                                size: 'sm',
                                color: '#333333',
                                wrap: true
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '➕ 新增商店',
                                    data: 'add_new_store'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📞 聯繫商店',
                                    data: 'contact_stores'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [storeManagement]);
        }
        catch (error) {
            console.error('Error handling manage stores:', error);
        }
    }
    // Brand kit feature handlers
    async handlePhotoOptimization(replyToken, userId) {
        try {
            const message = {
                type: 'text',
                text: `📸 產品照片優化\n\n請上傳您的雞蛋照片，AI 將幫您：\n\n• 自動調整光線和色彩\n• 移除背景雜物\n• 增強產品質感\n• 生成多種尺寸版本\n• 添加品牌標識\n\n上傳照片後，AI 會在 30 秒內完成優化！`
            };
            await this.lineBot.replyMessage(replyToken, [message]);
        }
        catch (error) {
            console.error('Error handling photo optimization:', error);
        }
    }
    async handleProductDescription(replyToken, userId) {
        try {
            const prompt = `為農場生成專業的產品描述，包括：

1. 產品特色和優勢
2. 品質保證說明
3. 營養價值介紹
4. 生產過程描述
5. 包裝規格說明
6. 適合的消費族群
7. 使用建議

請生成吸引人且專業的產品描述，適合用於銷售和行銷。`;
            const aiResponse = await this.geminiService.generateText(prompt);
            const descriptionCard = {
                type: 'flex',
                altText: '產品描述生成結果',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '📝 AI 生成產品描述',
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: aiResponse.substring(0, 400) + (aiResponse.length > 400 ? '...' : ''),
                                wrap: true,
                                size: 'sm',
                                color: '#666666'
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📋 複製描述',
                                    data: 'copy_description'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🔄 重新生成',
                                    data: 'regenerate_description'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [descriptionCard]);
        }
        catch (error) {
            console.error('Error handling product description:', error);
        }
    }
    async handleSocialPosts(replyToken, userId) {
        try {
            const socialMenu = {
                type: 'flex',
                altText: '社群媒體貼文生成',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '📱 社群媒體貼文',
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '選擇平台類型：',
                                weight: 'bold',
                                size: 'md'
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📘 Facebook 貼文',
                                    data: 'generate_facebook_post'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📷 Instagram 貼文',
                                    data: 'generate_instagram_post'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🐦 Twitter 貼文',
                                    data: 'generate_twitter_post'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [socialMenu]);
        }
        catch (error) {
            console.error('Error handling social posts:', error);
        }
    }
    async handlePriceTagDesign(replyToken, userId) {
        try {
            const message = {
                type: 'text',
                text: `🏷️ 價格標籤設計\n\nAI 將為您設計專業的價格標籤，包括：\n\n• 產品名稱和規格\n• 價格資訊\n• 品質認證標誌\n• 農場資訊\n• 條碼生成\n• 多種設計風格\n\n請告訴我您的產品資訊，AI 將生成多種標籤設計供您選擇！`
            };
            await this.lineBot.replyMessage(replyToken, [message]);
        }
        catch (error) {
            console.error('Error handling price tag design:', error);
        }
    }
    async handleWebsiteAccessRequest(replyToken, userId) {
        try {
            // Get user profile from LINE
            const userProfile = await this.lineBot.getUserProfile(userId);
            // Create web app URL with user parameters
            const webAppUrl = `https://farm2market-99.web.app?userId=${userProfile.userId}&displayName=${encodeURIComponent(userProfile.displayName)}&pictureUrl=${encodeURIComponent(userProfile.pictureUrl || '')}`;
            const websiteAccessMessage = {
                type: 'flex',
                altText: '開啟管理介面',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '🌐 管理介面',
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            },
                            {
                                type: 'text',
                                text: '正在為您開啟 Farm2Market AI 管理介面...',
                                size: 'sm',
                                color: '#666666'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '點擊下方連結進入您的專屬管理面板：',
                                size: 'sm',
                                color: '#333333'
                            },
                            {
                                type: 'separator',
                                margin: 'md'
                            },
                            {
                                type: 'text',
                                text: '• 產品管理\n• 交易追蹤\n• 市場分析\n• 行銷工具\n• 數據報表',
                                size: 'sm',
                                color: '#666666',
                                wrap: true
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'uri',
                                    label: '🚀 開啟管理介面',
                                    uri: webAppUrl
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [websiteAccessMessage]);
        }
        catch (error) {
            console.error('Error handling website access request:', error);
            const errorMessage = {
                type: 'text',
                text: '抱歉，無法開啟管理介面。請稍後再試或聯繫客服。'
            };
            await this.lineBot.replyMessage(replyToken, [errorMessage]);
        }
    }
    async handleRestartConversation(replyToken, userId) {
        try {
            const restartMessage = {
                type: 'flex',
                altText: '重新開始對話',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '🔄 重新開始',
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '歡迎回到 Farm2Market AI！\n\n我是您的專業農場助手，可以幫助您：',
                                wrap: true,
                                size: 'sm',
                                color: '#666666'
                            },
                            {
                                type: 'separator',
                                margin: 'md'
                            },
                            {
                                type: 'text',
                                text: '• 分析市場價格趨勢\n• 尋找最佳買家\n• 建立供應請求\n• 生成行銷素材\n• 管理交易記錄',
                                size: 'sm',
                                color: '#333333',
                                wrap: true
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🥚 建立供應',
                                    data: 'create_supply'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '💰 價格諮詢',
                                    data: 'price_inquiry'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📋 我的交易',
                                    data: 'my_deals'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🎨 品牌工具',
                                    data: 'brand_kit'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [restartMessage]);
        }
        catch (error) {
            console.error('Error handling restart conversation:', error);
        }
    }
    // Additional missing handlers
    async handleSupplyFormStart(replyToken, userId, productType) {
        try {
            const formMessage = {
                type: 'flex',
                altText: `填寫${productType}供應表單`,
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: `📝 ${productType}供應表單`,
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '請提供以下資訊：',
                                weight: 'bold',
                                size: 'md'
                            },
                            {
                                type: 'separator',
                                margin: 'md'
                            },
                            {
                                type: 'text',
                                text: '1. 每日產量\n2. 包裝規格\n3. 預期價格\n4. 交貨頻率\n5. 品質認證\n6. 產品等級',
                                size: 'sm',
                                color: '#666666',
                                wrap: true
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📤 提交表單',
                                    data: `submit_supply_form:${productType}`
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🤖 AI 智能填寫',
                                    data: `ai_supply_form:${productType}`,
                                    displayText: '🤖 AI 智能填寫'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [formMessage]);
        }
        catch (error) {
            console.error('Error handling supply form start:', error);
        }
    }
    async handleAISupplyForm(replyToken, userId, productType) {
        try {
            const prompt = `為${productType}農場生成專業的供應表單，包括：

1. 每日產量建議
2. 包裝規格建議
3. 市場價格分析
4. 交貨頻率建議
5. 品質認證要求

請提供實用且專業的建議。`;
            const aiResponse = await this.geminiService.generateText(prompt);
            const aiFormResponse = {
                type: 'flex',
                altText: `AI 智能填寫${productType}表單`,
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: `🤖 AI 智能填寫${productType}表單`,
                                weight: 'bold',
                                size: 'xl',
                                color: '#FF6B35'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: aiResponse.substring(0, 400) + (aiResponse.length > 400 ? '...' : ''),
                                wrap: true,
                                size: 'sm',
                                color: '#666666'
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '✅ 使用 AI 建議',
                                    data: `use_ai_suggestions:${productType}`
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📝 手動填寫',
                                    data: `start_supply_form:${productType}`
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [aiFormResponse]);
        }
        catch (error) {
            console.error('Error handling AI supply form:', error);
        }
    }
    async handleGenericSuccess(replyToken, userId, action) {
        try {
            const successMessage = {
                type: 'flex',
                altText: '操作成功',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '✅ 操作成功',
                                weight: 'bold',
                                size: 'xl',
                                color: '#4CAF50'
                            }
                        ]
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '您的請求已成功處理！\n\nAI 正在為您準備相關內容，請稍候...',
                                wrap: true,
                                size: 'sm',
                                color: '#666666'
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🥚 建立供應',
                                    data: 'create_supply'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '💰 價格諮詢',
                                    data: 'price_inquiry'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '📋 我的交易',
                                    data: 'my_deals'
                                }
                            },
                            {
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'postback',
                                    label: '🎨 品牌工具',
                                    data: 'brand_kit'
                                }
                            }
                        ]
                    }
                }
            };
            await this.lineBot.replyMessage(replyToken, [successMessage]);
        }
        catch (error) {
            console.error('Error handling generic success:', error);
        }
    }
    async handleStartContactBuyers(replyToken, userId) {
        await this.handleGenericSuccess(replyToken, userId, 'start_contact_buyers');
    }
    async handleAddNewStore(replyToken, userId) {
        await this.handleGenericSuccess(replyToken, userId, 'add_new_store');
    }
    async handleContactStores(replyToken, userId) {
        await this.handleGenericSuccess(replyToken, userId, 'contact_stores');
    }
    async handleGenerateFacebookPost(replyToken, userId) {
        await this.handleGenericSuccess(replyToken, userId, 'generate_facebook_post');
    }
    async handleGenerateInstagramPost(replyToken, userId) {
        await this.handleGenericSuccess(replyToken, userId, 'generate_instagram_post');
    }
    async handleGenerateTwitterPost(replyToken, userId) {
        await this.handleGenericSuccess(replyToken, userId, 'generate_twitter_post');
    }
    async handleCopyDescription(replyToken, userId) {
        await this.handleGenericSuccess(replyToken, userId, 'copy_description');
    }
}
// Webhook verification function
function verifyLineWebhook(body, signature) {
    const channelSecret = LINE_CONFIG.CHANNEL_SECRET;
    if (!signature || !channelSecret) {
        return false;
    }
    const hash = crypto
        .createHmac('sha256', channelSecret)
        .update(body)
        .digest('base64');
    return hash === signature;
}
// Main webhook function
exports.webhook = functions.https.onRequest(async (req, res) => {
    // Handle CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-line-signature');
    if (req.method === 'OPTIONS') {
        res.status(200).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    try {
        const signature = req.get('x-line-signature');
        const body = JSON.stringify(req.body);
        // Verify webhook signature
        if (!verifyLineWebhook(body, signature || '')) {
            console.error('Webhook signature verification failed');
            res.status(401).send('Unauthorized');
            return;
        }
        const events = req.body.events || [];
        console.log('Received webhook events:', events.length);
        if (events.length > 0) {
            const webhookHandler = new WebhookHandler();
            await webhookHandler.handleEvents(events);
        }
        res.status(200).send('OK');
    }
    catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).send('Internal Server Error');
    }
});
// Health check function
exports.health = functions.https.onRequest(async (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Farm2Market AI LINE Bot',
        project: 'farm2market-99'
    });
});
//# sourceMappingURL=index.js.map