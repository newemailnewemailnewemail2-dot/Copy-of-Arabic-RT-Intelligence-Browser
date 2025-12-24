/**
 * خدمة استخراج الأخبار الذكية (Frontend Service)
 * تتواصل مع الـ Backend لاستخراج الصور والنصوص من صفحات الأخبار
 */

// رابط الـ Backend - يمكن تغييره حسب البيئة
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export interface ScrapeResult {
  success: boolean;
  url?: string;
  originalTitle?: string;
  originalContent?: string;
  rewrittenTitle?: string;
  rewrittenContent?: string;
  category?: string;
  threatLevel?: string;
  imageBase64?: string;
  originalImageUrl?: string;
  error?: string;
}

/**
 * استخراج ومعالجة مقال كامل (صورة + نص + إعادة صياغة)
 */
export async function processArticle(url: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(`${BACKEND_URL}/process-article`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to process article');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Process article error:', error);
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * استخراج المحتوى فقط (بدون إعادة صياغة)
 */
export async function scrapeArticle(url: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(`${BACKEND_URL}/scrape-article`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to scrape article');
    }

    const data = await response.json();
    return {
      success: true,
      originalTitle: data.title,
      originalContent: data.content,
      imageBase64: data.imageBase64,
      originalImageUrl: data.originalImageUrl
    };
  } catch (error: any) {
    console.error('Scrape article error:', error);
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * إعادة صياغة نص موجود
 */
export async function rewriteArticle(title: string, content: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(`${BACKEND_URL}/rewrite-article`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to rewrite article');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Rewrite article error:', error);
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * تحويل صورة من رابط إلى Base64
 */
export async function fetchImageAsBase64(imageUrl: string, pageUrl?: string): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
  try {
    const response = await fetch(`${BACKEND_URL}/fetch-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, pageUrl })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch image');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Fetch image error:', error);
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * التحقق من حالة الـ Backend
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
