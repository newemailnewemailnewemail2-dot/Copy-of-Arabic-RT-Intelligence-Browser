
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  LayoutDashboard, Zap, FileCode, Search, Trash2, Plus, Clock, ExternalLink, 
  Calendar, Infinity, Waves, Send, RefreshCw, MessageSquare, FileUp, Signal,
  History, Database, Radio, ShieldAlert, Import, Globe, Cpu, Activity, CheckCircle2, AlertTriangle, FileText,
  Image, Link, Eye, Download, Loader2, Camera
} from 'lucide-react';
import { ViewMode, ArticleData, NewsSource } from './types';
import { discoverySearch } from './services/ai';
import { processArticle, scrapeArticle, checkBackendHealth, ScrapeResult } from './services/scraper';
import { PythonCodeViewer } from './components/PythonCodeViewer';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeframe, setTimeframe] = useState("24 ساعة");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Telegram States
  const [tgToken, setTgToken] = useState(() => localStorage.getItem('rt_tg_token') || "");
  const [tgChatId, setTgChatId] = useState(() => localStorage.getItem('rt_tg_chatid') || "");
  const [tgConnectionStatus, setTgConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>(
    () => (localStorage.getItem('rt_tg_status') as any) || 'idle'
  );
  const [botName, setBotName] = useState(() => localStorage.getItem('rt_bot_name') || "");

  // Sources State
  const [sources, setSources] = useState<NewsSource[]>(() => {
    const saved = localStorage.getItem('rt_sources_v5');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'RT World', url: 'https://arabic.rt.com/world/', isActive: true },
      { id: '2', name: 'RT Middle East', url: 'https://arabic.rt.com/middle_east/', isActive: true }
    ];
  });
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceName, setNewSourceName] = useState("");

  // History / Intel State
  const [history, setHistory] = useState<ArticleData[]>(() => {
    const saved = localStorage.getItem('rt_intel_history_v5');
    return saved ? JSON.parse(saved) : [];
  });

  // Smart Scraper States
  const [scraperUrl, setScraperUrl] = useState("");
  const [scraperResult, setScraperResult] = useState<ScrapeResult | null>(null);
  const [isScraperProcessing, setIsScraperProcessing] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const formatTime = (date: Date) => {
    return date.getHours().toString().padStart(2, '0') + ":" + 
           date.getMinutes().toString().padStart(2, '0');
  };

  const applyAutoShifting = useCallback((articles: ArticleData[]) => {
    const scheduled = articles
      .filter(a => a.status === 'scheduled')
      .sort((a, b) => a.timestamp - b.timestamp);
    if (scheduled.length === 0) return articles;
    const baseTime = new Date();
    baseTime.setMinutes(baseTime.getMinutes() + 1);
    const shifted = scheduled.map((item, index) => {
      const scheduledDate = new Date(baseTime.getTime() + index * 15 * 60 * 1000);
      return { ...item, scheduledTime: scheduledDate.getHours().toString().padStart(2, '0') + ":" + scheduledDate.getMinutes().toString().padStart(2, '0') };
    });
    return articles.map(item => {
      const match = shifted.find(s => s.id === item.id);
      return match ? match : item;
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('rt_intel_history_v5', JSON.stringify(history));
    localStorage.setItem('rt_sources_v5', JSON.stringify(sources));
    localStorage.setItem('rt_tg_token', tgToken);
    localStorage.setItem('rt_tg_chatid', tgChatId);
    localStorage.setItem('rt_tg_status', tgConnectionStatus);
    localStorage.setItem('rt_bot_name', botName);
  }, [history, sources, tgToken, tgChatId, tgConnectionStatus, botName]);

  // التحقق من حالة الـ Backend عند التحميل
  useEffect(() => {
    const checkBackend = async () => {
      const isOnline = await checkBackendHealth();
      setBackendStatus(isOnline ? 'online' : 'offline');
    };
    checkBackend();
    const interval = setInterval(checkBackend, 30000); // فحص كل 30 ثانية
    return () => clearInterval(interval);
  }, []);

  // معالجة استخراج الخبر الذكي
  const handleSmartScrape = async () => {
    if (!scraperUrl) return;
    setIsScraperProcessing(true);
    setScraperResult(null);
    
    try {
      const result = await processArticle(scraperUrl);
      setScraperResult(result);
    } catch (error: any) {
      setScraperResult({ success: false, error: error.message });
    }
    
    setIsScraperProcessing(false);
  };

  // إضافة الخبر المستخرج إلى جدول النشر
  const addScrapedToScheduler = () => {
    if (!scraperResult || !scraperResult.success) return;
    
    const newArticle: ArticleData = {
      id: Math.random().toString(36).substr(2, 9),
      url: scraperUrl,
      originalTitle: scraperResult.originalTitle,
      rewrittenTitle: scraperResult.rewrittenTitle || scraperResult.originalTitle || 'بدون عنوان',
      rewrittenContent: scraperResult.rewrittenContent || scraperResult.originalContent || '',
      category: scraperResult.category || 'عام',
      threatLevel: scraperResult.threatLevel || 'عادي',
      imageUrl: scraperResult.originalImageUrl || '',
      imageBase64: scraperResult.imageBase64,
      timestamp: Date.now(),
      status: 'scheduled'
    };
    
    setHistory(prev => applyAutoShifting([...prev, newArticle]));
    setScraperResult(null);
    setScraperUrl("");
    setView(ViewMode.SCHEDULER);
  };

  const performTelegramPublish = async (article: ArticleData): Promise<boolean> => {
    if (!tgToken || !tgChatId) return false;
    const token = tgToken.trim();
    const chat = tgChatId.trim();
    const caption = `<b>${article.rewrittenTitle}</b>\n\n${article.rewrittenContent}\n\n<a href="${article.url}">المصدر الأصلي</a>\n\n#RT_Intelligence #عاجل`;

    try {
      // الخطوة 0: إذا كانت الصورة Base64 (من Smart Scraper)، نرسلها مباشرة
      if (article.imageBase64 && article.imageBase64.startsWith('data:')) {
        try {
          const base64Data = article.imageBase64.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/jpeg' });
          
          const formData = new FormData();
          formData.append('chat_id', chat);
          formData.append('photo', blob, 'news_image.jpg');
          formData.append('caption', caption);
          formData.append('parse_mode', 'HTML');
          
          const base64Resp = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { 
            method: 'POST', 
            body: formData 
          });
          const base64Data2 = await base64Resp.json();
          if (base64Data2.ok) return true;
        } catch (err) {
          console.warn("Base64 upload failed, trying URL...");
        }
      }

      if (article.imageUrl && article.imageUrl.startsWith('http')) {
        // الخطوة 1: محاولة إرسال الصورة عبر الرابط المباشر (الأسرع)
        const linkResp = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chat, photo: article.imageUrl, caption, parse_mode: 'HTML' })
        });
        const linkData = await linkResp.json();
        if (linkData.ok) return true;
        
        // الخطوة 2: إذا فشل تلجرام (بسبب الحماية)، نحاول سحب الصورة في "الفرونت إند" ورفعها كـ Binary
        // نستخدم حيلة الـ Blob لتجاوز بعض قيود الحماية
        try {
          const imgFetch = await fetch(article.imageUrl, { referrerPolicy: "no-referrer" });
          if (imgFetch.ok) {
            const blob = await imgFetch.blob();
            const formData = new FormData();
            formData.append('chat_id', chat);
            formData.append('photo', blob, 'news_image.jpg');
            formData.append('caption', caption);
            formData.append('parse_mode', 'HTML');
            
            const binaryResp = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { 
              method: 'POST', 
              body: formData 
            });
            const binaryData = await binaryResp.json();
            if (binaryData.ok) return true;
          }
        } catch (err) {
          console.warn("Direct binary upload failed, falling back to text...");
        }
      }
      
      // الخطوة 3: الملاذ الأخير - إرسال النص فقط لضمان عدم ضياع الخبر
      const textResp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text: caption, parse_mode: 'HTML' })
      });
      const textData = await textResp.json();
      return textData.ok;
    } catch (e) { 
      console.error("Publishing failure:", e);
      return false; 
    }
  };

  useEffect(() => {
    const autoPilot = setInterval(async () => {
      if (tgConnectionStatus !== 'success') return;
      const now = new Date();
      const nowStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
      const nextArticle = history
        .filter(h => h.status === 'scheduled')
        .sort((a, b) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""))[0];
      
      if (nextArticle && nextArticle.scheduledTime === nowStr) {
        const success = await performTelegramPublish(nextArticle);
        if (success) {
          setHistory(prev => applyAutoShifting(prev.map(h => h.id === nextArticle.id ? { ...h, status: 'published' } : h)));
        }
      }
    }, 20000);
    return () => clearInterval(autoPilot);
  }, [history, tgConnectionStatus, applyAutoShifting, tgToken, tgChatId]);

  const handleDiscovery = async () => {
    if (!searchQuery) return;
    setIsProcessing(true);
    try {
      const items = await discoverySearch(searchQuery, timeframe);
      const formatted: ArticleData[] = items
        .filter(item => item.url && item.rewrittenTitle && item.rewrittenContent && item.imageUrl)
        .map(item => ({
          id: Math.random().toString(36).substr(2, 9),
          url: item.url as string,
          rewrittenTitle: item.rewrittenTitle as string,
          rewrittenContent: item.rewrittenContent as string,
          imageUrl: item.imageUrl as string,
          category: (item.category as string) || "عام",
          threatLevel: (item.threatLevel as string) || "متوسط",
          timestamp: Date.now(),
          status: 'scheduled' as const
        }));
      setHistory(prev => applyAutoShifting([...prev, ...formatted]));
      setView(ViewMode.SCHEDULER);
    } catch (e) { alert("فشل الرصد الاستخباري"); }
    setIsProcessing(false);
  };

  const testTelegram = async () => {
    if (!tgToken || !tgChatId) return;
    setTgConnectionStatus('testing');
    try {
      const r = await fetch(`https://api.telegram.org/bot${tgToken.trim()}/getMe`);
      const d = await r.json();
      if (d.ok) { 
        setBotName(d.result.first_name); 
        setTgConnectionStatus('success'); 
      }
      else setTgConnectionStatus('error');
    } catch { setTgConnectionStatus('error'); }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string).trim();
      const tokenMatch = content.match(/(\d{8,15}:[a-zA-Z0-9_-]{35,50})/);
      const chatIdMatch = content.match(/(@[a-zA-Z0-9_]{4,})|(-100\d{10,13})|(-\d{8,13})/);

      if (tokenMatch && chatIdMatch) {
        setTgToken(tokenMatch[0].trim());
        setTgChatId(chatIdMatch[0].trim());
        setTgConnectionStatus('idle');
        alert("ذكاء الاستيراد: تم توزيع البيانات في الحقول بدقة.");
      } else {
        alert("لم يتم التعرف على الصيغة. تأكد من وجود التوكن ومعرف القناة.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const addSource = () => {
    if (newSourceUrl && newSourceName) {
      setSources([...sources, { id: Date.now().toString(), name: newSourceName, url: newSourceUrl, isActive: true }]);
      setNewSourceUrl(""); setNewSourceName("");
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row font-['IBM_Plex_Sans_Arabic']" dir="rtl">
      
      <aside className="w-full md:w-72 bg-[#05080f] border-l border-emerald-500/10 flex flex-col shrink-0 overflow-y-auto z-20">
        <div className="p-8 border-b border-emerald-500/10 text-center">
            <div className="flex items-center gap-3 justify-center mb-2">
                <Infinity className="w-10 h-10 text-emerald-400" />
                <h1 className="text-xl font-black text-white uppercase tracking-tighter">RT-ULTIMATE</h1>
            </div>
            <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-[0.3em]">Intelligence Browser</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5">
          {[
            { id: ViewMode.DASHBOARD, label: 'لوحة التحكم', icon: LayoutDashboard },
            { id: ViewMode.SMART_SCRAPER, label: 'استخراج ذكي', icon: Camera },
            { id: ViewMode.DISCOVERY, label: 'رصد الأخبار الحية', icon: Globe },
            { id: ViewMode.INTEL_FEED, label: 'الأرشيف العام', icon: History },
            { id: ViewMode.SOURCES, label: 'إدارة المصادر', icon: Database },
            { id: ViewMode.SCHEDULER, label: 'مجدول النشر', icon: Calendar },
            { id: ViewMode.TELEGRAM, label: 'اتصال تلجرام', icon: MessageSquare },
            { id: ViewMode.CODE, label: 'أكواد المصدر', icon: FileCode },
          ].map(item => (
            <button key={item.id} onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 ${view === item.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'hover:bg-white/5 text-slate-400 hover:text-white'}`}>
              <item.icon className={`w-5 h-5 ${view === item.id ? 'text-white' : 'text-emerald-500/60'}`} />
              <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 bg-black/20">
           <div className={`p-4 rounded-xl border transition-all ${tgConnectionStatus === 'success' ? 'bg-emerald-500/5 border-emerald-500/20 shadow-emerald-500/5' : 'bg-rose-500/5 border-rose-500/20 shadow-rose-500/5'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-widest ${tgConnectionStatus === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tgConnectionStatus === 'success' ? `BOT: ${botName}` : 'OFFLINE'}
                </span>
                <Signal className={`w-3 h-3 ${tgConnectionStatus === 'success' ? 'text-emerald-500 animate-pulse' : 'text-rose-500'}`} />
              </div>
           </div>
        </div>
      </aside>

      <main className="flex-1 h-screen overflow-hidden flex flex-col bg-[#020617] relative">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 bg-[#05080f]/90 backdrop-blur-md shrink-0 z-10">
           <div className="flex items-center gap-4">
              <Waves className="w-5 h-5 text-emerald-500 animate-pulse" />
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em]">Operational Area / {view}</h2>
           </div>
           {isProcessing && (
             <div className="flex items-center gap-3 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest animate-pulse">Scanning Waves...</span>
             </div>
           )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar animate-fadeIn">
          
          {view === ViewMode.DASHBOARD && (
            <div className="max-w-6xl mx-auto space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { val: history.length, label: 'إجمالي الرصد', color: 'text-white' },
                  { val: history.filter(h => h.status === 'scheduled').length, label: 'بانتظار الإطلاق', color: 'text-emerald-500' },
                  { val: history.filter(h => h.status === 'published').length, label: 'عمليات ناجحة', color: 'text-purple-400' }
                ].map((stat, i) => (
                  <div key={i} className="bg-[#0d1321]/80 backdrop-blur-sm p-10 rounded-[2.5rem] border border-white/5 text-center shadow-2xl transition-all hover:border-emerald-500/30 hover:-translate-y-1">
                    <div className={`text-5xl font-black ${stat.color} tracking-tighter`}>{stat.val}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase mt-3 tracking-[0.2em]">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === ViewMode.SMART_SCRAPER && (
            <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn">
              {/* حالة الـ Backend */}
              <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl w-fit ${
                backendStatus === 'online' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                backendStatus === 'offline' ? 'bg-rose-500/10 border border-rose-500/20' :
                'bg-yellow-500/10 border border-yellow-500/20'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  backendStatus === 'online' ? 'bg-emerald-500 animate-pulse' :
                  backendStatus === 'offline' ? 'bg-rose-500' :
                  'bg-yellow-500 animate-pulse'
                }`} />
                <span className={`text-xs font-bold ${
                  backendStatus === 'online' ? 'text-emerald-400' :
                  backendStatus === 'offline' ? 'text-rose-400' :
                  'text-yellow-400'
                }`}>
                  {backendStatus === 'online' ? 'خدمة الاستخراج الذكي متصلة' :
                   backendStatus === 'offline' ? 'خدمة الاستخراج غير متصلة' :
                   'جاري التحقق...'}
                </span>
              </div>

              {/* واجهة الإدخال */}
              <div className="bg-[#0d1321]/90 backdrop-blur-2xl p-10 md:p-14 rounded-[4rem] border border-cyan-500/20 shadow-[0_0_100px_rgba(6,182,212,0.05)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/5 blur-[150px] rounded-full -ml-48 -mt-48"></div>
                
                <div className="relative z-10 text-center mb-10">
                  <Camera className={`w-16 h-16 text-cyan-400 mx-auto mb-6 ${isScraperProcessing ? 'animate-bounce' : ''}`} />
                  <h3 className="text-4xl font-black text-white mb-4">استخراج الأخبار الذكي</h3>
                  <p className="text-slate-400 text-sm max-w-xl mx-auto">
                    أدخل رابط أي خبر وسيقوم النظام باستخراج الصورة الرئيسية والنص تلقائياً باستخدام متصفح حقيقي
                  </p>
                </div>

                <div className="relative z-10 max-w-3xl mx-auto">
                  <div className="flex gap-4 mb-6">
                    <input 
                      type="url" 
                      value={scraperUrl} 
                      onChange={(e) => setScraperUrl(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && handleSmartScrape()}
                      className="flex-1 bg-black/40 border border-white/10 rounded-2xl p-6 text-lg text-white outline-none focus:border-cyan-500/50 shadow-inner placeholder:text-slate-600" 
                      placeholder="https://example.com/news/article..." 
                      disabled={isScraperProcessing || backendStatus !== 'online'}
                    />
                    <button 
                      onClick={handleSmartScrape} 
                      disabled={isScraperProcessing || !scraperUrl || backendStatus !== 'online'} 
                      className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl font-black text-white transition-all shadow-lg active:scale-95 flex items-center gap-3"
                    >
                      {isScraperProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>جاري الاستخراج...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          <span>استخراج</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* شريط التقدم */}
                  {isScraperProcessing && (
                    <div className="bg-black/40 rounded-2xl p-6 border border-cyan-500/20">
                      <div className="flex items-center gap-4 mb-4">
                        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                        <span className="text-cyan-400 font-bold">جاري فتح الصفحة بالمتصفح الذكي...</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full rounded-full animate-pulse" style={{ width: '60%' }}></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* نتيجة الاستخراج */}
              {scraperResult && (
                <div className={`bg-[#0d1321]/90 backdrop-blur-2xl p-10 rounded-[3rem] border ${
                  scraperResult.success ? 'border-emerald-500/20' : 'border-rose-500/20'
                } shadow-2xl`}>
                  {scraperResult.success ? (
                    <div className="space-y-8">
                      {/* العنوان والحالة */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                          <div>
                            <h4 className="text-2xl font-black text-white">تم الاستخراج بنجاح!</h4>
                            <p className="text-slate-500 text-sm">الصورة والنص جاهزان للنشر</p>
                          </div>
                        </div>
                        <span className={`px-4 py-2 rounded-xl text-xs font-black ${
                          scraperResult.threatLevel === 'عاجل' ? 'bg-rose-500/20 text-rose-400' :
                          scraperResult.threatLevel === 'مهم' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {scraperResult.threatLevel || 'عادي'}
                        </span>
                      </div>

                      {/* المحتوى */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* الصورة */}
                        <div className="space-y-4">
                          <h5 className="text-sm font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                            <Image className="w-4 h-4" /> الصورة المستخرجة
                          </h5>
                          <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                            {scraperResult.imageBase64 ? (
                              <img 
                                src={scraperResult.imageBase64} 
                                alt="Extracted" 
                                className="w-full h-64 object-cover"
                              />
                            ) : (
                              <div className="w-full h-64 flex items-center justify-center text-slate-600">
                                <Image className="w-16 h-16" />
                              </div>
                            )}
                            {scraperResult.imageBase64 && (
                              <div className="absolute bottom-3 right-3 bg-emerald-500/90 px-3 py-1 rounded-lg text-xs font-bold text-white">
                                Base64 ✓
                              </div>
                            )}
                          </div>
                        </div>

                        {/* النص */}
                        <div className="space-y-4">
                          <h5 className="text-sm font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                            <FileText className="w-4 h-4" /> المحتوى المعاد صياغته
                          </h5>
                          <div className="bg-black/40 rounded-2xl p-6 border border-white/10 space-y-4">
                            <div>
                              <span className="text-[10px] text-slate-500 uppercase tracking-widest">العنوان</span>
                              <h6 className="text-lg font-black text-white mt-1">{scraperResult.rewrittenTitle || scraperResult.originalTitle}</h6>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 uppercase tracking-widest">المحتوى</span>
                              <p className="text-sm text-slate-300 mt-1 line-clamp-6">{scraperResult.rewrittenContent || scraperResult.originalContent}</p>
                            </div>
                            <div className="flex gap-2">
                              <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-bold">
                                {scraperResult.category || 'عام'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* أزرار الإجراءات */}
                      <div className="flex gap-4 justify-center pt-4">
                        <button 
                          onClick={addScrapedToScheduler}
                          className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black text-white transition-all shadow-lg active:scale-95 flex items-center gap-3"
                        >
                          <Calendar className="w-5 h-5" />
                          إضافة لجدول النشر
                        </button>
                        <button 
                          onClick={() => setScraperResult(null)}
                          className="px-8 py-4 bg-slate-700 hover:bg-slate-600 rounded-2xl font-bold text-white transition-all"
                        >
                          استخراج آخر
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
                      <h4 className="text-2xl font-black text-white mb-2">فشل الاستخراج</h4>
                      <p className="text-rose-400">{scraperResult.error || 'حدث خطأ غير متوقع'}</p>
                      <button 
                        onClick={() => setScraperResult(null)}
                        className="mt-6 px-8 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-white transition-all"
                      >
                        حاول مرة أخرى
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {view === ViewMode.DISCOVERY && (
            <div className="max-w-5xl mx-auto space-y-12 animate-fadeIn relative">
               <div className="bg-[#0d1321]/90 backdrop-blur-2xl p-10 md:p-14 rounded-[4rem] border border-emerald-500/20 shadow-[0_0_100px_rgba(16,185,129,0.05)] relative overflow-hidden text-center">
                    <Radio className={`w-12 h-12 text-emerald-400 mx-auto mb-6 ${isProcessing ? 'animate-bounce' : ''}`} />
                    <h3 className="text-4xl font-black text-white mb-8">مركز القيادة والرصد</h3>
                    <div className="relative group max-w-2xl mx-auto mb-8">
                      <input 
                        type="text" 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && handleDiscovery()}
                        className="w-full bg-black/40 border border-white/10 rounded-[2.5rem] p-8 text-2xl font-black text-white outline-none focus:border-emerald-500/50 shadow-inner" 
                        placeholder="أدخل الكلمات المفتاحية لمسح الويب..." 
                      />
                    </div>
                    <button 
                      onClick={handleDiscovery} 
                      disabled={isProcessing || !searchQuery} 
                      className="px-12 py-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 rounded-3xl font-black text-white transition-all shadow-lg active:scale-95"
                    >
                      {isProcessing ? <RefreshCw className="w-6 h-6 animate-spin" /> : 'إطلاق الرادار الرقمي'}
                    </button>
               </div>
            </div>
          )}

          {view === ViewMode.INTEL_FEED && (
            <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
               {history.sort((a,b) => b.timestamp - a.timestamp).map(item => (
                 <div key={item.id} className="bg-[#0d1321]/90 rounded-[2.5rem] border border-white/5 overflow-hidden flex flex-col md:flex-row shadow-2xl group transition-all hover:border-emerald-500/20">
                    <div className="w-full md:w-72 h-48 md:h-auto overflow-hidden shrink-0 relative">
                      <img 
                        src={item.imageBase64 || item.imageUrl} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/800x450?text=RT+Intelligence';
                        }}
                      />
                      {item.imageBase64 && (
                        <div className="absolute top-2 right-2 bg-cyan-500/90 px-2 py-1 rounded text-[9px] font-bold text-white">
                          Smart ✓
                        </div>
                      )}
                    </div>
                    <div className="p-8 flex-1">
                       <h4 className="text-xl font-black text-white mb-2">{item.rewrittenTitle}</h4>
                       <p className="text-sm text-slate-400 line-clamp-2 mb-4 italic">{item.rewrittenContent}</p>
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">{item.category}</span>
                          <button onClick={() => setHistory(history.filter(h => h.id !== item.id))} className="text-rose-500/40 hover:text-rose-500 p-2 transition-colors"><Trash2 className="w-5 h-5" /></button>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          )}

          {view === ViewMode.SOURCES && (
            <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
               <div className="bg-[#0d1321] p-10 rounded-[3rem] border border-blue-500/10 shadow-2xl">
                  <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-4"><Database className="w-8 h-8 text-blue-400" /> المصادر الاستراتيجية</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <input type="text" value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} placeholder="اسم الوكالة" className="bg-black/40 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-blue-500" />
                     <input type="text" value={newSourceUrl} onChange={(e) => setNewSourceUrl(e.target.value)} placeholder="الرابط" className="bg-black/40 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-blue-500" />
                  </div>
                  <button onClick={addSource} className="w-full py-5 bg-blue-600 mt-6 rounded-2xl font-black text-white shadow-lg active:scale-95">إضافة المصدر</button>
               </div>
            </div>
          )}

          {view === ViewMode.SCHEDULER && (
            <div className="max-w-6xl mx-auto animate-fadeIn grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {history.filter(i => i.status === 'scheduled').map(item => (
                 <div key={item.id} className="bg-[#0d1321] rounded-[3rem] border border-purple-500/20 overflow-hidden shadow-2xl group">
                    <div className="h-40 overflow-hidden relative">
                      <img 
                        src={item.imageBase64 || item.imageUrl} 
                        referrerPolicy="no-referrer" 
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/800x450?text=RT+Intelligence';
                        }}
                      />
                      {item.imageBase64 && (
                        <div className="absolute top-2 right-2 bg-cyan-500/90 px-2 py-1 rounded text-[9px] font-bold text-white">
                          Smart ✓
                        </div>
                      )}
                    </div>
                    <div className="p-8 space-y-4">
                       <div className="flex items-center gap-3 text-purple-400">
                          <Clock className="w-4 h-4" />
                          <span className="text-xs font-black uppercase tracking-widest">موعد الإطلاق: {item.scheduledTime}</span>
                       </div>
                       <h4 className="text-lg font-black text-white line-clamp-2">{item.rewrittenTitle}</h4>
                       <button onClick={() => performTelegramPublish(item).then(ok => ok && setHistory(prev => prev.map(h => h.id === item.id ? {...h, status:'published'}:h)))} className="w-full py-4 bg-emerald-600 rounded-2xl text-[11px] font-black text-white flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-emerald-600/20">
                          <Send className="w-4 h-4" /> إطلاق العملية فوراً
                       </button>
                    </div>
                 </div>
               ))}
            </div>
          )}

          {view === ViewMode.TELEGRAM && (
            <div className="max-w-4xl mx-auto animate-fadeIn space-y-8">
               <div className="bg-[#0d1321]/90 backdrop-blur-2xl p-10 md:p-14 rounded-[4rem] border border-emerald-500/20 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[120px] rounded-full -mr-20 -mt-20"></div>
                  
                  <div className="relative z-10 flex flex-col items-center text-center mb-10">
                     <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mb-6 border border-emerald-500/20 shadow-lg">
                        <MessageSquare className="w-10 h-10 text-emerald-400" />
                     </div>
                     <h3 className="text-3xl font-black text-white tracking-tight">بوابة اتصال تلجرام</h3>
                     <p className="text-slate-500 text-sm mt-2 italic font-medium">الربط الذكي لنشر المحتوى الاستخباري</p>
                  </div>

                  <div className="relative z-10 space-y-10">
                    <div 
                      className="group relative border-2 border-dashed border-white/10 rounded-[2.5rem] p-10 text-center hover:border-emerald-500/50 transition-all bg-black/40 cursor-pointer shadow-inner" 
                      onClick={() => fileInputRef.current?.click()}
                    >
                       <FileText className="w-14 h-14 text-slate-600 mx-auto mb-4 group-hover:text-emerald-400 group-hover:scale-110 transition-all duration-500" />
                       <div className="text-lg font-black text-slate-300 group-hover:text-white transition-colors">استيراد من ملف نصي (.txt)</div>
                       <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-[0.3em]">سيتم التعرف على البيانات تلقائياً وتوزيعها</p>
                       <input type="file" accept=".txt" ref={fileInputRef} onChange={handleFileImport} className="hidden" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                         <div className="flex items-center gap-2 px-4">
                           <ShieldAlert className="w-3 h-3 text-emerald-500/50" />
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Bot API Token</label>
                         </div>
                         <input 
                           type="password" 
                           value={tgToken} 
                           onChange={(e) => {setTgToken(e.target.value); setTgConnectionStatus('idle');}} 
                           placeholder="أدخل توكن البوت..."
                           className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-white outline-none focus:border-emerald-500/50 shadow-inner font-mono text-sm transition-all" 
                         />
                      </div>
                      <div className="space-y-3">
                         <div className="flex items-center gap-2 px-4">
                           <Globe className="w-3 h-3 text-emerald-500/50" />
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Channel ID</label>
                         </div>
                         <input 
                           type="text" 
                           value={tgChatId} 
                           onChange={(e) => {setTgChatId(e.target.value); setTgConnectionStatus('idle');}} 
                           placeholder="@اسم_القناة أو المعرف الرقمي"
                           className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-white outline-none focus:border-emerald-500/50 shadow-inner font-mono text-sm transition-all" 
                         />
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 pt-4">
                       <button 
                         onClick={testTelegram} 
                         disabled={tgConnectionStatus === 'testing' || !tgToken || !tgChatId}
                         className={`flex-1 py-6 rounded-3xl font-black text-white flex items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl border ${
                           tgConnectionStatus === 'success' 
                           ? 'bg-emerald-600 border-emerald-500' 
                           : tgConnectionStatus === 'error'
                           ? 'bg-rose-600 border-rose-500 shadow-rose-500/20'
                           : 'bg-blue-600 border-blue-500 hover:bg-blue-500 shadow-blue-600/20'
                         }`}
                       >
                          {tgConnectionStatus === 'testing' ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Signal className="w-6 h-6" />}
                          <span className="text-lg">اختبار وتثبيت الاتصال بالخادم</span>
                       </button>

                       {tgConnectionStatus === 'success' && (
                         <div className="flex items-center gap-4 bg-emerald-500/10 px-6 py-4 rounded-3xl border border-emerald-500/20 text-emerald-400 font-black animate-fadeIn shadow-lg">
                            <CheckCircle2 className="w-6 h-6" />
                            <div className="text-right">
                               <div className="text-[9px] uppercase opacity-60 tracking-tighter">نشط: {botName}</div>
                               <div className="text-xs">البوابة جاهزة للإرسال</div>
                            </div>
                         </div>
                       )}
                    </div>
                  </div>
               </div>
            </div>
          )}

          {view === ViewMode.CODE && <PythonCodeViewer />}

        </div>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.2); border-radius: 10px; }
        .animate-fadeIn { animation: fadeIn 0.5s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default App;
