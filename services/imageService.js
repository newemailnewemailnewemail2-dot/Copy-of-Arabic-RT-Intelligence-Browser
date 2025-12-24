/**
 * خدمة استخراج الصور الذكية (Smart Image Scraper)
 * 
 * تقوم هذه الخدمة بـ:
 * 1. فتح صفحة الخبر بمتصفح حقيقي (Playwright)
 * 2. تحديد الصورة الرئيسية بذكاء مكاني (أقرب صورة للعنوان H1)
 * 3. التقاط Screenshot للصورة أو تحميلها مباشرة
 * 4. استخراج نص الخبر من الصفحة
 * 5. إرجاع الصورة كـ Base64 لتجاوز مشاكل الحماية
 */

const { chromium } = require('playwright');

/**
 * استخراج الصورة الرئيسية والنص من صفحة الخبر
 * @param {string} url - رابط صفحة الخبر
 * @returns {Promise<{imageBase64: string, title: string, content: string, originalImageUrl: string}>}
 */
async function scrapeNewsArticle(url) {
  let browser = null;
  
  try {
    // فتح المتصفح بإعدادات مضادة للكشف
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'ar-SA',
      timezoneId: 'Asia/Riyadh',
      extraHTTPHeaders: {
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    const page = await context.newPage();
    
    // تجاوز اكتشاف الأتمتة
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['ar', 'en-US', 'en'] });
      window.chrome = { runtime: {} };
    });

    // فتح الصفحة - استخدام domcontentloaded بدلاً من networkidle للسرعة
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 45000 
    });

    // انتظار تحميل المحتوى والصور
    await page.waitForTimeout(3000);
    
    // محاولة انتظار الصور
    try {
      await page.waitForSelector('img[src]', { timeout: 5000 });
    } catch (e) {
      // تجاهل إذا لم توجد صور
    }

    // استخراج البيانات باستخدام الذكاء المكاني
    const result = await page.evaluate(() => {
      // البحث عن العنوان الرئيسي
      const h1 = document.querySelector('h1');
      const title = h1 ? h1.innerText.trim() : '';
      
      let h1Rect = null;
      if (h1) {
        h1Rect = h1.getBoundingClientRect();
      }

      // جمع كل الصور المرئية
      const images = Array.from(document.querySelectorAll('img'));
      const validImages = [];

      for (const img of images) {
        const rect = img.getBoundingClientRect();
        const src = img.src || img.dataset.src || img.dataset.lazySrc || '';
        
        // استبعاد الصور الصغيرة والأيقونات
        if (rect.width < 200 || rect.height < 150) continue;
        if (!src || src.includes('avatar') || src.includes('icon') || src.includes('logo')) continue;
        if (src.includes('author') || src.includes('profile') || src.includes('user')) continue;
        
        // حساب المسافة من العنوان
        let distance = Infinity;
        if (h1Rect) {
          const imgCenterY = rect.top + rect.height / 2;
          const h1CenterY = h1Rect.top + h1Rect.height / 2;
          distance = Math.abs(imgCenterY - h1CenterY);
        }

        validImages.push({
          src,
          width: rect.width,
          height: rect.height,
          distance,
          area: rect.width * rect.height,
          top: rect.top,
          selector: getUniqueSelector(img)
        });
      }

      // ترتيب الصور: الأقرب للعنوان أولاً، ثم الأكبر مساحة
      validImages.sort((a, b) => {
        // إذا كانت المسافة قريبة جداً (أقل من 800px)، نفضل الأقرب
        if (a.distance < 800 && b.distance < 800) {
          return a.distance - b.distance;
        }
        // وإلا نفضل الأكبر مساحة
        return b.area - a.area;
      });

      const bestImage = validImages[0] || null;

      // استخراج نص الخبر
      const articleSelectors = [
        'article',
        '[class*="article-body"]',
        '[class*="article-content"]',
        '[class*="post-content"]',
        '[class*="entry-content"]',
        '[class*="story-body"]',
        '[class*="news-content"]',
        '.content',
        'main'
      ];

      let contentElement = null;
      for (const selector of articleSelectors) {
        contentElement = document.querySelector(selector);
        if (contentElement) break;
      }

      let content = '';
      if (contentElement) {
        const paragraphs = contentElement.querySelectorAll('p');
        const texts = [];
        for (const p of paragraphs) {
          const text = p.innerText.trim();
          if (text.length > 30 && !text.includes('©') && !text.includes('جميع الحقوق')) {
            texts.push(text);
          }
        }
        content = texts.join('\n\n');
      }

      // دالة مساعدة للحصول على selector فريد
      function getUniqueSelector(el) {
        if (el.id) return `#${el.id}`;
        if (el.className) {
          const classes = el.className.split(' ').filter(c => c).slice(0, 2).join('.');
          if (classes) return `img.${classes}`;
        }
        return 'img';
      }

      return {
        title,
        content: content.substring(0, 3000),
        bestImage: bestImage ? {
          src: bestImage.src,
          selector: bestImage.selector,
          width: bestImage.width,
          height: bestImage.height
        } : null
      };
    });

    let imageBase64 = '';
    let originalImageUrl = '';

    if (result.bestImage) {
      originalImageUrl = result.bestImage.src;
      
      try {
        // محاولة التقاط screenshot للصورة
        const imgElement = await page.$(result.bestImage.selector);
        if (imgElement) {
          const screenshot = await imgElement.screenshot({ type: 'jpeg', quality: 90 });
          imageBase64 = `data:image/jpeg;base64,${screenshot.toString('base64')}`;
        }
      } catch (screenshotError) {
        console.warn('Screenshot failed, trying direct download...');
        
        // محاولة تحميل الصورة مباشرة
        try {
          const imageResponse = await page.evaluate(async (imgUrl) => {
            const response = await fetch(imgUrl, { credentials: 'include' });
            const blob = await response.blob();
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
          }, originalImageUrl);
          
          if (imageResponse && imageResponse.startsWith('data:')) {
            imageBase64 = imageResponse;
          }
        } catch (downloadError) {
          console.warn('Direct download also failed');
        }
      }
    }

    await browser.close();

    return {
      success: true,
      title: result.title,
      content: result.content,
      imageBase64,
      originalImageUrl
    };

  } catch (error) {
    if (browser) await browser.close();
    console.error('Scraping error:', error);
    return {
      success: false,
      error: error.message,
      title: '',
      content: '',
      imageBase64: '',
      originalImageUrl: ''
    };
  }
}

/**
 * استخراج الصورة فقط من رابط معين
 * @param {string} imageUrl - رابط الصورة
 * @param {string} pageUrl - رابط الصفحة (للحصول على cookies)
 * @returns {Promise<{imageBase64: string}>}
 */
async function fetchImageAsBase64(imageUrl, pageUrl) {
  let browser = null;
  
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // زيارة الصفحة أولاً للحصول على cookies
    if (pageUrl) {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    }
    
    // تحميل الصورة
    const imageBase64 = await page.evaluate(async (url) => {
      const response = await fetch(url, { credentials: 'include' });
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }, imageUrl);
    
    await browser.close();
    
    return { success: true, imageBase64 };
  } catch (error) {
    if (browser) await browser.close();
    return { success: false, error: error.message, imageBase64: '' };
  }
}

module.exports = {
  scrapeNewsArticle,
  fetchImageAsBase64
};
