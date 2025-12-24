
import React, { useState } from 'react';
import { PYTHON_FILES, REQUIREMENTS } from '../constants';
import { Copy, Check, FileCode, Terminal } from 'lucide-react';

export const PythonCodeViewer: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-emerald-400">
          <Terminal className="w-6 h-6" />
          بيئة التشغيل (Requirements)
        </h2>
        <div className="bg-black/40 rounded-lg p-4 font-mono text-sm relative group">
          <pre>{REQUIREMENTS}</pre>
          <button 
            onClick={() => handleCopy(REQUIREMENTS, 99)}
            className="absolute top-4 left-4 p-2 bg-slate-700 hover:bg-slate-600 rounded-md transition-all opacity-0 group-hover:opacity-100"
          >
            {copiedIndex === 99 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {PYTHON_FILES.map((file, idx) => (
          <div key={file.name} className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
            <div className="bg-slate-800 px-6 py-4 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-3">
                <FileCode className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-slate-100">{file.name}</h3>
                  <p className="text-xs text-slate-400">{file.description}</p>
                </div>
              </div>
              <button 
                onClick={() => handleCopy(file.content, idx)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
              >
                {copiedIndex === idx ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>نسخ الكود</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-4 bg-slate-950 font-mono text-sm overflow-x-auto max-h-[400px]">
              <pre className="text-blue-100/90 leading-relaxed whitespace-pre">
                {file.content}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
