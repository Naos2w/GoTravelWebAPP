
import React, { useState } from 'react';
import { generateTravelImage } from '../services/geminiService';
import { Image as ImageIcon, Loader2, Download, AlertCircle } from 'lucide-react';
import { useTranslation } from '../App';

export const ImageGenerator: React.FC = () => {
  const { language } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);

  const labels = {
    title: language === 'zh' ? 'AI 意境生成器' : 'AI Scene Generator',
    placeholder: language === 'zh' ? '描述你夢想中的場景 (例如：富士山下的櫻花與日落)...' : 'Describe a dream travel scene (e.g., Mount Fuji at sunset)...',
    generate: language === 'zh' ? '生成圖片' : 'Generate',
    authTitle: language === 'zh' ? '需要付費 API Key' : 'Paid API Key Required',
    authDesc: language === 'zh' ? '高品質圖片生成需要選擇一個付費的 Google Cloud 專案。' : 'High-quality image generation requires a specific API key selection.',
    authBtn: language === 'zh' ? '選擇 API Key' : 'Select API Key',
    billing: language === 'zh' ? '計費說明' : 'Billing Docs',
    download: language === 'zh' ? '下載圖片' : 'Download',
    errFail: language === 'zh' ? '生成失敗，請重試。' : 'Failed to generate image. Please try again.',
    errEmpty: language === 'zh' ? '無法生成圖片，請換個描述。' : 'Could not generate image. Try a different prompt.'
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setNeedsApiKey(false);
    try {
      const result = await generateTravelImage(prompt, size);
      if (result) setImageUrl(result);
      else setError(labels.errEmpty);
    } catch (err: any) {
      if (err.message === "API_KEY_REQUIRED") setNeedsApiKey(true);
      else setError(labels.errFail);
    } finally { setIsGenerating(false); }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2"><ImageIcon className="text-secondary" />{labels.title}</h2>
        <span className="text-xs font-medium px-2 py-1 bg-secondary/10 text-secondary rounded-full">Gemini 3 Pro</span>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={labels.placeholder} className="flex-1 px-4 py-3 bg-gray-50 dark:bg-slate-900 dark:text-white rounded-xl border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none" />
          <select value={size} onChange={(e) => setSize(e.target.value as any)} className="px-4 py-3 bg-gray-50 dark:bg-slate-900 dark:text-white rounded-xl border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none">
            <option value="1K">1K</option><option value="2K">2K</option><option value="4K">4K</option>
          </select>
          <button onClick={handleGenerate} disabled={isGenerating || !prompt} className="bg-secondary text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 justify-center">
            {isGenerating ? <Loader2 className="animate-spin" /> : labels.generate}
          </button>
        </div>
        {needsApiKey && (
             <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 p-4 rounded-xl flex flex-col items-start gap-2">
                <div className="flex items-center gap-2"><AlertCircle size={18} /><p className="font-medium">{labels.authTitle}</p></div>
                <p className="text-sm">{labels.authDesc}</p>
                <div className="flex items-center gap-3 mt-1"><button onClick={async () => { if (window.aistudio) { await window.aistudio.openSelectKey(); setNeedsApiKey(false); } }} className="text-sm bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700">{labels.authBtn}</button><a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-sm underline">{labels.billing}</a></div>
             </div>
        )}
        {error && !needsApiKey && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm">{error}</div>}
        {imageUrl && (
          <div className="mt-4 group relative rounded-2xl overflow-hidden shadow-lg border border-gray-100 dark:border-slate-700">
            <img src={imageUrl} alt="Generated" className="w-full h-auto object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <a href={imageUrl} download="go-travel-ai-scene.png" className="bg-white/90 text-slate-900 px-4 py-2 rounded-full font-medium flex items-center gap-2 hover:bg-white"><Download size={16} />{labels.download}</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
