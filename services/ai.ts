
import { GoogleGenAI, Type } from "@google/genai";
import { ArticleData } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

/**
 * محرك البحث والتحليل الاستخباراتي (RT-CORE)
 * تم تحديثه لضمان جودة الصور وقابليتها للنشر المباشر
 */
export async function discoverySearch(query: string, timeframe: string, existingUrls: string[] = []): Promise<Partial<ArticleData>[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const lastUrls = existingUrls.slice(-30);

  const prompt = `مهمة استخباراتية عاجلة: ابحث في الويب المفتوح عن أحدث 15 خبراً متعلقاً بـ "${query}" خلال ${timeframe}.
المطلوب من كل خبر:
1. استخراج الرابط المباشر (URL) للخبر.
2. تجنب تكرار هذه الروابط: [${lastUrls.join(', ')}].
3. صياغة العنوان بأسلوب RT المثير (قوي، مباشر، عاجل).
4. صياغة المحتوى بتقرير استخباراتي مركز (70 كلمة كحد أقصى).
5. هام جداً (الصور): ابحث عن رابط صورة مباشر (Direct Image URL) ينتهي بامتداد (jpg, jpeg, png). 
   - يفضل أن تكون الصور من وكالات أنباء عالمية أو CDNs تسمح بالربط المباشر.
   - تأكد أن الرابط هو للصورة نفسها وليس لصفحة الويب التي تحتوي الصورة.
6. تحديد مستوى التهديد والتصنيف.

رجع النتيجة بدقة كـ JSON Array:
[{
  "url": "string",
  "rewrittenTitle": "string",
  "rewrittenContent": "string",
  "imageUrl": "string",
  "category": "string",
  "threatLevel": "string"
}]`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              url: { type: Type.STRING },
              rewrittenTitle: { type: Type.STRING },
              rewrittenContent: { type: Type.STRING },
              imageUrl: { type: Type.STRING },
              category: { type: Type.STRING },
              threatLevel: { type: Type.STRING }
            },
            required: ["url", "rewrittenTitle", "rewrittenContent", "imageUrl", "category", "threatLevel"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Discovery Engine Failure:", error);
    return [];
  }
}
