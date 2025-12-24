
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

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
    intelligence: "Reasoning-Enabled (DeepSeek-R1)" 
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RT-FIRE Intelligence (DeepSeek-R1) online on port ${PORT}`));
