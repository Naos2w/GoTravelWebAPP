import React, { useState } from 'react';
import { generateTravelImage } from '../services/geminiService';
import { Image as ImageIcon, Loader2, Download, AlertCircle } from 'lucide-react';

export const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setNeedsApiKey(false);

    try {
      const result = await generateTravelImage(prompt, size);
      if (result) {
        setImageUrl(result);
      } else {
        setError("Could not generate image. Please try a different prompt.");
      }
    } catch (err: any) {
      if (err.message === "API_KEY_REQUIRED") {
        setNeedsApiKey(true);
      } else {
        setError("Failed to generate image. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAuth = async () => {
    if (window.aistudio) {
        try {
            await window.aistudio.openSelectKey();
            // Retry automatically or ask user to click generate again
            setNeedsApiKey(false);
        } catch (e) {
            console.error(e);
        }
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
          <ImageIcon className="text-secondary" />
          AI Scene Generator
        </h2>
        <span className="text-xs font-medium px-2 py-1 bg-secondary/10 text-secondary rounded-full">Gemini 3 Pro</span>
      </div>
      
      <div className="p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <input 
            type="text" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe a dream travel scene (e.g., 'Mount Fuji at sunset with cherry blossoms')..." 
            className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none"
          />
          <select 
            value={size} 
            onChange={(e) => setSize(e.target.value as any)}
            className="px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-secondary/20 focus:outline-none"
          >
            <option value="1K">1K</option>
            <option value="2K">2K</option>
            <option value="4K">4K</option>
          </select>
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !prompt}
            className="bg-secondary text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-600 disabled:opacity-50 transition-colors flex items-center gap-2 justify-center"
          >
            {isGenerating ? <Loader2 className="animate-spin" /> : 'Generate'}
          </button>
        </div>

        {needsApiKey && (
             <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl flex flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                    <AlertCircle size={18} />
                    <p className="font-medium">Paid API Key Required</p>
                </div>
                <p className="text-sm">High-quality image generation requires a specific API key selection.</p>
                <div className="flex items-center gap-3 mt-1">
                    <button 
                        onClick={handleAuth}
                        className="text-sm bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
                    >
                        Select API Key
                    </button>
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-sm underline">
                        Billing Docs
                    </a>
                </div>
             </div>
        )}

        {error && !needsApiKey && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {imageUrl && (
          <div className="mt-4 group relative rounded-2xl overflow-hidden shadow-lg border border-gray-100">
            <img src={imageUrl} alt="Generated" className="w-full h-auto object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <a href={imageUrl} download="go-travel-ai-scene.png" className="bg-white/90 text-slate-900 px-4 py-2 rounded-full font-medium flex items-center gap-2 hover:bg-white">
                <Download size={16} />
                Download
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
