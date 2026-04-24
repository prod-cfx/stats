import React from 'react';

const MockupComparison = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-3xl font-bold mb-4">视觉优化方案对比 (Mockup)</h1>
          <p className="text-gray-400">左侧：当前风格 | 右侧：优化后的 VergeX 现代风格 (保留原配色)</p>
        </header>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Current Style */}
          <div className="space-y-8 opacity-80 grayscale-[0.3]">
            <div className="p-6 border border-gray-800 rounded-xl bg-[#111]">
              <div className="text-xs text-purple-500 font-bold mb-2 uppercase tracking-widest">Current Hero</div>
              <h2 className="text-4xl font-bold mb-4">小白也能用的 AI 量化交易工具</h2>
              <p className="text-gray-400 mb-6 text-lg">描述你的交易想法，AI 自动生成策略，完成回测并帮你执行交易</p>
              <button className="bg-gradient-to-r from-purple-600 to-cyan-500 px-8 py-3 rounded-xl font-bold">立即体验</button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-4 border border-gray-800 rounded-xl bg-[#111]">
                  <div className="text-purple-500 font-bold mb-2">0{i}</div>
                  <div className="font-bold text-sm">流程步骤名称</div>
                  <div className="text-xs text-gray-500 mt-1">这里是步骤的描述文案...</div>
                </div>
              ))}
            </div>
          </div>

          {/* Optimized Style */}
          <div className="space-y-8 relative">
            {/* Grid Background Effect */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none -z-10"></div>
            
            <div className="p-8 border border-white/10 rounded-[2rem] bg-white/[0.02] backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-600/20 blur-[100px]"></div>
              <div className="text-xs text-purple-400 font-bold mb-3 uppercase tracking-[0.3em]">Optimized Hero</div>
              <h2 className="text-5xl font-bold mb-6 leading-tight tracking-tight">
                小白也能用的 <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">AI 量化</span> 交易工具
              </h2>
              <p className="text-gray-400 mb-8 text-xl leading-relaxed">描述你的交易想法，AI 自动生成策略，完成回测并帮你执行交易</p>
              <button className="relative group overflow-hidden bg-gradient-to-r from-purple-600 to-cyan-500 px-10 py-4 rounded-2xl font-bold shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)] transition-all active:scale-95">
                <span className="relative z-10">立即体验</span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-6 border border-white/5 rounded-[1.5rem] bg-white/[0.03] hover:bg-white/[0.06] transition-all hover:-translate-y-1 group cursor-default">
                  <div className="text-xs font-black text-purple-500/50 group-hover:text-purple-500 transition-colors mb-4 tracking-tighter">STEP 0{i}</div>
                  <div className="font-bold text-lg mb-2">流程步骤名称</div>
                  <div className="text-sm text-gray-500 leading-relaxed">这里是步骤的描述文案，采用更舒适的行高和字重。</div>
                </div>
              ))}
            </div>

            {/* Floating 3D Component Preview */}
            <div className="absolute -right-12 top-1/4 w-64 p-4 border border-white/10 rounded-2xl bg-[#0f0f0f]/80 backdrop-blur-md shadow-2xl rotate-3 hidden lg:block">
              <div className="flex items-center justify-between mb-3">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                <div className="text-[10px] text-gray-500">LIVE EXECUTION</div>
              </div>
              <div className="h-24 bg-white/5 rounded-lg mb-3 flex items-end p-2 gap-1">
                {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                  <div key={i} style={{height: `${h}%`}} className="flex-1 bg-gradient-to-t from-cyan-500/20 to-cyan-400 rounded-t-sm"></div>
                ))}
              </div>
              <div className="text-xs font-bold text-green-400">+18.4% ROI</div>
            </div>
          </div>
        </div>

        <footer className="mt-20 text-center text-gray-500 text-sm">
          <p>设计要点：大圆角、微发光边框、网格背景、层级分明的文字排版</p>
        </footer>
      </div>
    </div>
  );
};

export default MockupComparison;
