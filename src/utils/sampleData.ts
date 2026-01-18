// Sample data creation utilities for testing
import { DatabaseService } from '@/lib/database';
import { Timestamp } from 'firebase/firestore';

export const createSampleDataForUser = async (userId: string) => {
  try {
    // Create sample products
    const sampleProducts = [
      {
        name: "農場新鮮 A 級雞蛋",
        description: "來自健康雞隻的新鮮雞蛋，營養豐富，適合各種料理",
        category: "雞蛋",
        price: 180,
        unit: "每 30 顆裝",
        stock: 45,
        images: [],
        tags: ["新鮮", "營養", "農場直送", "A級"],
        geminiData: {
          aiGeneratedDescription: "這些 A 級雞蛋來自我們精心照料的健康雞隻，確保每一顆都達到最高品質標準。",
          marketingCopy: "新鮮直送，營養滿分！農場 A 級雞蛋，讓您的每一餐都充滿活力。",
          nutritionalInfo: "富含優質蛋白質、維生素 A、D、E 和 B 群維生素"
        }
      },
      {
        name: "有機放養雞蛋",
        description: "有機認證的放養雞蛋，雞隻自由活動，蛋黃飽滿",
        category: "雞蛋",
        price: 280,
        unit: "每 30 顆裝",
        stock: 8,
        images: [],
        tags: ["有機", "放養", "認證", "優質"],
        geminiData: {
          aiGeneratedDescription: "通過有機認證的放養雞蛋，雞隻在自然環境中自由活動，產出的雞蛋營養價值更高。",
          marketingCopy: "有機認證，自然放養！每一顆都是大自然的恩賜，讓您品嚐最純淨的美味。",
          nutritionalInfo: "有機認證，富含 Omega-3 脂肪酸，蛋黃顏色更深，營養更豐富"
        }
      },
      {
        name: "優質鴨蛋",
        description: "新鮮鴨蛋，蛋黃飽滿，適合製作鹹蛋和皮蛋",
        category: "鴨蛋",
        price: 320,
        unit: "每 20 顆裝",
        stock: 22,
        images: [],
        tags: ["鴨蛋", "新鮮", "優質", "傳統"],
        geminiData: {
          aiGeneratedDescription: "精選優質鴨蛋，蛋黃飽滿，蛋白濃稠，是製作傳統美食的最佳選擇。",
          marketingCopy: "傳統美味，現代品質！優質鴨蛋，傳承經典風味。",
          nutritionalInfo: "蛋白質含量高，富含鐵質和維生素 B12，適合製作各種傳統料理"
        }
      }
    ];

    // Create sample stores
    const sampleStores = [
      {
        name: "綠色有機超市",
        type: "supermarket" as const,
        location: "新竹市東區中央路 102 號",
        contact: {
          name: "張經理",
          phone: "+886-3-123-4567",
          email: "orders@greenmart.tw",
          website: "https://greenmart.tw"
        },
        status: "customer" as const,
        metadata: {
          firstContact: Timestamp.now(),
          lastOrder: Timestamp.now(),
          totalOrders: 24,
          totalRevenue: 5760,
          notes: ["長期合作夥伴", "品質要求高", "每週固定訂單"]
        },
        geminiData: {
          aiSuggestedOutreach: "建議每週三主動聯繫確認訂單，並提供新產品資訊",
          relationshipStage: "established",
          nextAction: "維持良好關係，考慮擴大合作品項"
        }
      },
      {
        name: "新鮮便利超商",
        type: "supermarket" as const,
        location: "新竹縣竹北市光明六路東二段 100 號",
        contact: {
          name: "李店長",
          phone: "+886-3-987-6543",
          email: "supply@freshmart.tw"
        },
        status: "customer" as const,
        metadata: {
          firstContact: Timestamp.now(),
          lastOrder: Timestamp.now(),
          totalOrders: 32,
          totalRevenue: 8960,
          notes: ["快速週轉", "價格敏感", "重視新鮮度"]
        },
        geminiData: {
          aiSuggestedOutreach: "建議提供快速配送服務，並定期更新庫存狀況",
          relationshipStage: "established",
          nextAction: "討論擴大訂購量，提供批量折扣"
        }
      },
      {
        name: "有機谷市場",
        type: "farmers_market" as const,
        location: "新竹縣新埔鎮中正路 330 號",
        contact: {
          name: "王老闆",
          phone: "+886-3-555-7890",
          email: "orders@organicvalley.tw"
        },
        status: "potential" as const,
        metadata: {
          firstContact: Timestamp.now(),
          totalOrders: 0,
          totalRevenue: 0,
          notes: ["新聯絡人", "對有機產品有興趣", "需要樣品"]
        },
        geminiData: {
          aiSuggestedOutreach: "建議提供樣品試用，並安排農場參觀",
          relationshipStage: "prospecting",
          nextAction: "安排會面，展示產品品質和農場環境"
        }
      },
      {
        name: "北大路友善食材店",
        type: "supermarket" as const,
        location: "新竹市北區北大路 120 號",
        contact: {
          name: "陳店長",
          phone: "+886-3-234-5678",
          email: "hello@friendlyfoods.tw"
        },
        status: "contacted" as const,
        metadata: {
          firstContact: Timestamp.now(),
          lastOrder: Timestamp.now(),
          totalOrders: 6,
          totalRevenue: 1480,
          notes: ["試單合作", "偏好在地蔬果", "週末進貨"]
        },
        geminiData: {
          aiSuggestedOutreach: "可提供小量多樣組合，提高回購",
          relationshipStage: "engaged",
          nextAction: "跟進週末補貨需求"
        }
      },
      {
        name: "竹科午餐合作社",
        type: "restaurant" as const,
        location: "新竹市東區新安路 2 號",
        contact: {
          name: "林主廚",
          phone: "+886-3-222-3344",
          email: "kitchen@scilunch.tw",
          website: "https://scilunch.tw"
        },
        status: "potential" as const,
        metadata: {
          firstContact: Timestamp.now(),
          totalOrders: 0,
          totalRevenue: 0,
          notes: ["園區團膳", "需要穩定供貨", "重視交期"]
        },
        geminiData: {
          aiSuggestedOutreach: "提供固定供貨時段與報價方案",
          relationshipStage: "prospecting",
          nextAction: "安排試菜與樣品"
        }
      },
      {
        name: "城隍廟小農攤位",
        type: "farmers_market" as const,
        location: "新竹市北區中山路 75 號",
        contact: {
          name: "謝小姐",
          phone: "+886-3-333-2211"
        },
        status: "customer" as const,
        metadata: {
          firstContact: Timestamp.now(),
          lastOrder: Timestamp.now(),
          totalOrders: 14,
          totalRevenue: 3360,
          notes: ["觀光人潮多", "需求變動大", "偏好小包裝"]
        },
        geminiData: {
          aiSuggestedOutreach: "建議提供週末限定組合包",
          relationshipStage: "established",
          nextAction: "確認下一次出攤量"
        }
      }
    ];

    // Create sample marketing materials
    const sampleMarketingMaterials = [
      {
        productId: "", // Will be set after products are created
        type: "flyer" as const,
        title: "農場新鮮雞蛋傳單",
        content: "新鮮直送，營養滿分！農場 A 級雞蛋，讓您的每一餐都充滿活力。",
        imageUrl: "",
        generatedBy: "gemini" as const,
        usage: {
          timesUsed: 12,
          lastUsed: Timestamp.now()
        }
      },
      {
        productId: "", // Will be set after products are created
        type: "recipe_card" as const,
        title: "有機雞蛋食譜卡",
        content: "有機認證，自然放養！每一顆都是大自然的恩賜，讓您品嚐最純淨的美味。",
        imageUrl: "",
        generatedBy: "gemini" as const,
        usage: {
          timesUsed: 8,
          lastUsed: Timestamp.now()
        }
      }
    ];

    // Create products and get their IDs
    const createdProducts = [];
    for (const productData of sampleProducts) {
      const result = await DatabaseService.createProduct(userId, productData);
      createdProducts.push({ id: result.id });
    }

    // Create stores
    for (const storeData of sampleStores) {
      await DatabaseService.createStore(userId, storeData);
    }

    // Create marketing materials with product IDs
    for (let i = 0; i < sampleMarketingMaterials.length && i < createdProducts.length; i++) {
      const materialData = {
        ...sampleMarketingMaterials[i],
        productId: createdProducts[i].id
      };
      await DatabaseService.createMarketingMaterial(userId, materialData);
    }

    console.log('Sample data created successfully for user:', userId);
    return true;
  } catch (error) {
    console.error('Failed to create sample data:', error);
    return false;
  }
};

export default createSampleDataForUser;
