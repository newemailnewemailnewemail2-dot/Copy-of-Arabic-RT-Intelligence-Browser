import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { scrapeNewsArticle, fetchImageAsBase64 } from './services/imageService.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

/**
 * RT-FIRE Intelligence Engine (DeepSeek-R1 Powered)
 * المحرك: deepseek-r1-distill-llama-70b
 * يتميز هذا النموذج بقدرته على "التفكير" (Reasoning) قبل الإجابة.
 */
const GROQ_API_KEY = process.env.GROQ_API_KEY; 
const MODEL = "deepseek-r1-distill-llama-70b"; 

app.post('/ai', async (req, res) => {
    const { text } = req.body;

    if (!text) return res.status(400).json({ error: "Input text required" });
    if (!GROQ_API_KEY) return res.status(500).json({ error: "GROQ_API_KEY not configured" });

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { 
                        role: "system", 
                        content: `أنت المحلل الاستخباراتي الأكثر ذكاءً (DeepSeek-R1). 
مهمتك تحليل الروابط والأخبار بأسلوب عسكري رصين.
ملاحظة هامة: بما أنك نموذج تفكير (Reasoning Model)، قد تظهر فترات تفكير بين وسمي <think> و </think>. 
عند طلب JSON، تأكد أن النتيجة النهائية صالحة للاستخدام البرمجي.` 
                    },
                    { role: "user", content: text }
                ],
                temperature: 0.6, // DeepSeek-R1 يعمل بشكل أفضل مع درجة حرارة معتدلة للتفكير
                max_tokens: 4096
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "DeepSeek/Groq API Error");
        }

        const data = await response.json();
        const resultText = data.choices[0]?.message?.content || "";

        res.json({ result: resultText });
    } catch (error) {
        console.error("DeepSeek Engine Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => res.json({ 
    status: "active", 
    model: MODEL, 
    intelligence: "Reasoning-Enabled (DeepSeek-R1)",
    imageService: "Smart Scraper Active"
}));

/**
 * خدمة استخراج الصور والنص الذكية
 * تستخدم Playwright لفتح الصفحة واستخراج الصورة الرئيسية بذكاء مكاني
 */
app.post('/scrape-article', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    console.log(`[Smart Scraper] Processing: ${url}`);
    
    try {
        const result = await scrapeNewsArticle(url);
        
        if (result.success) {
            console.log(`[Smart Scraper] Success - Title: ${result.title?.substring(0, 50)}...`);
            res.json({
                success: true,
                title: result.title,
                content: result.content,
                imageBase64: result.imageBase64,
                originalImageUrl: result.originalImageUrl
            });
        } else {
            console.error(`[Smart Scraper] Failed: ${result.error}`);
            res.status(500).json({ 
                success: false, 
                error: result.error || "Failed to scrape article" 
            });
        }
    } catch (error) {
        console.error("[Smart Scraper] Error:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * خدمة تحويل صورة من رابط إلى Base64
 * تستخدم عندما يكون لدينا رابط صورة ونريد تحويله لتجاوز الحماية
 */
app.post('/fetch-image', async (req, res) => {
    const { imageUrl, pageUrl } = req.body;
    
    if (!imageUrl) {
        return res.status(400).json({ error: "imageUrl is required" });
    }

    console.log(`[Image Fetcher] Processing: ${imageUrl}`);
    
    try {
        const result = await fetchImageAsBase64(imageUrl, pageUrl);
        
        if (result.success) {
            res.json({
                success: true,
                imageBase64: result.imageBase64
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: result.error || "Failed to fetch image" 
            });
        }
    } catch (error) {
        console.error("[Image Fetcher] Error:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * خدمة إعادة صياغة النص باستخدام DeepSeek
 * تأخذ النص الأصلي وتعيد صياغته بأسلوب RT
 */
app.post('/rewrite-article', async (req, res) => {
    const { title, content } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({ error: "title and content are required" });
    }

    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: "GROQ_API_KEY not configured" });
    }

    console.log(`[Rewriter] Processing: ${title.substring(0, 50)}...`);

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { 
                        role: "system", 
                        content: `أنت محرر أخبار محترف في قناة RT Arabic. مهمتك إعادة صياغة الأخبار بأسلوب:
- عناوين قوية ومثيرة وعاجلة
- محتوى مركز ومختصر (50-80 كلمة)
- لغة عربية فصحى سليمة
- أسلوب إخباري رصين

أعد صياغة الخبر التالي وأرجع النتيجة بصيغة JSON:
{
  "rewrittenTitle": "العنوان المعاد صياغته",
  "rewrittenContent": "المحتوى المعاد صياغته",
  "category": "تصنيف الخبر (سياسة/اقتصاد/عسكري/تقنية/رياضة/منوعات)",
  "threatLevel": "مستوى الأهمية (عاجل/مهم/عادي)"
}`
                    },
                    { 
                        role: "user", 
                        content: `العنوان الأصلي: ${title}\n\nالمحتوى الأصلي:\n${content}` 
                    }
                ],
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Rewrite API Error");
        }

        const data = await response.json();
        let resultText = data.choices[0]?.message?.content || "";
        
        // تنظيف النص من علامات التفكير
        resultText = resultText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        
        // محاولة استخراج JSON
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            res.json({
                success: true,
                ...parsed
            });
        } else {
            res.json({
                success: true,
                rewrittenTitle: title,
                rewrittenContent: resultText,
                category: "عام",
                threatLevel: "عادي"
            });
        }
    } catch (error) {
        console.error("[Rewriter] Error:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * خدمة شاملة: استخراج + إعادة صياغة
 * تجمع بين استخراج المحتوى وإعادة صياغته في طلب واحد
 */
app.post('/process-article', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    console.log(`[Full Processor] Starting: ${url}`);

    try {
        // الخطوة 1: استخراج المحتوى
        const scrapeResult = await scrapeNewsArticle(url);
        
        if (!scrapeResult.success || !scrapeResult.title) {
            return res.status(500).json({ 
                success: false, 
                error: "Failed to scrape article content" 
            });
        }

        console.log(`[Full Processor] Scraped: ${scrapeResult.title.substring(0, 50)}...`);

        // الخطوة 2: إعادة الصياغة (إذا كان GROQ متاحاً)
        let rewriteResult = {
            rewrittenTitle: scrapeResult.title,
            rewrittenContent: scrapeResult.content.substring(0, 500),
            category: "عام",
            threatLevel: "عادي"
        };

        if (GROQ_API_KEY) {
            try {
                const rewriteResponse = await fetch(`http://localhost:${PORT}/rewrite-article`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: scrapeResult.title,
                        content: scrapeResult.content
                    })
                });
                
                if (rewriteResponse.ok) {
                    const rewriteData = await rewriteResponse.json();
                    if (rewriteData.success) {
                        rewriteResult = rewriteData;
                    }
                }
            } catch (rewriteError) {
                console.warn("[Full Processor] Rewrite failed, using original:", rewriteError.message);
            }
        }

        res.json({
            success: true,
            url: url,
            originalTitle: scrapeResult.title,
            originalContent: scrapeResult.content,
            rewrittenTitle: rewriteResult.rewrittenTitle,
            rewrittenContent: rewriteResult.rewrittenContent,
            category: rewriteResult.category,
            threatLevel: rewriteResult.threatLevel,
            imageBase64: scrapeResult.imageBase64,
            originalImageUrl: scrapeResult.originalImageUrl
        });

    } catch (error) {
        console.error("[Full Processor] Error:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`RT-FIRE Intelligence (DeepSeek-R1 + Smart Scraper) online on port ${PORT}`));
