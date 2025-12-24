
import { GoogleGenAI, Type } from "@google/genai";
import { ArticleData } from "../types";

// الموديلات المسموح بها حسب التوجيهات الفنية
const CANDIDATE_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemini-flash-lite-latest'
];

/**
 * اكتشاف أفضل موديل متاح للمفتاح الحالي
 */
export async function findBestWorkingModel(apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  for (const modelName of CANDIDATE_MODELS) {
    try {
      // Corrected: When using maxOutputTokens with Reasoning models, thinkingBudget must be set.
      const response = await ai.models.generateContent({
        model: modelName,
        contents: "Ping check",
        config: { 
          maxOutputTokens: 20,
          thinkingConfig: { thinkingBudget: 10 }
        }
      });
      if (response.text) return modelName;
    } catch (e) {
      console.warn(`Model ${modelName} is not accessible for this key.`);
      continue;
    }
  }
  throw new Error("ALL_MODELS_FAILED");
}

/**
 * تنفيذ بحث استخباراتي استراتيجي باستخدام Google Search Grounding
 * يقوم بالبحث في الويب المفتوح وليس فقط المصادر الثابتة
 */
export async function performStrategicSearch(directive: string, apiKey: string, modelName: string): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey });
  const now = new Date().toLocaleString('ar-EG');
  
  try {
    const response = await ai.models.generateContent({
      model: modelName, // يدعم البحث من جوجل
      contents: `المهمة: بحث استخباراتي دقيق.
توجيهات المستخدم: "${directive}"
الوقت الحالي: ${now}

المطلوب:
1. استخدم أداة البحث للعثور على أحدث الروابط (أخبار حية).
2. ركز تماماً على الجوانب المطلوبة (مثلاً: العسكرية، السياسية).
3. استبعد تماماً ما طلب المستخدم تجنبه (مثلاً: أخبار محلية، رياضة).
4. رجع قائمة JSON تحتوي على روابط (URLs) فقط للأخبار التي تطابق هذه المعايير بنسبة 100%.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const links = JSON.parse(response.text || "[]");
    return Array.isArray(links) ? links : [];
  } catch (error) {
    console.error("Strategic Search Failed:", error);
    return [];
  }
}

/**
 * معالجة وتحليل محتوى الخبر بذكاء
 */
export async function processArticleIntelligence(url: string, apiKey: string, modelName: string, customDirective?: string): Promise<Partial<ArticleData> & { isToday: boolean }> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = customDirective 
    ? `أنت محلل استخبارات متخصص. مهمتك الحالية: ${customDirective}. حلل الخبر من هذا المنظور حصراً.`
    : `بصفتك محلل استخبارات رقمي، حلل الخبر بأسلوب عسكري استراتيجي قوي يحاكي RT Arabic.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `حلل الرابط التالي: ${url}
التاريخ المرجعي: ${todayStr}
المطلوب استخراجه بصيغة JSON:
- عنوان عاجل (rewrittenTitle)
- ملخص مركز (rewrittenContent)
- التحقق من تاريخ النشر (isToday)
- تصنيف الخبر (category)`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rewrittenTitle: { type: Type.STRING },
            rewrittenContent: { type: Type.STRING },
            isToday: { type: Type.BOOLEAN },
            category: { type: Type.STRING }
          },
          required: ["rewrittenTitle", "rewrittenContent", "isToday", "category"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    if (error.message?.includes("429")) throw new Error("QUOTA_EXHAUSTED");
    throw error;
  }
}

/**
 * توليد صورة تعبيرية للخبر باستخدام موديل الصور
 */
export async function generateNewsImage(summary: string, apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `A highly professional, cinematic, photojournalistic news image for: ${summary}. Dramatic lighting, 8k resolution, intelligence/military aesthetics.` }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * استخراج الروابط من تصنيفات RT الثابتة
 */
export async function fetchCategoryLinks(categoryUrl: string, apiKey: string, modelName: string): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `استخرج فقط روابط الأخبار الفردية من هذه الصفحة: ${categoryUrl}. رجعها كقائمة JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch {
    return [];
  }
}
