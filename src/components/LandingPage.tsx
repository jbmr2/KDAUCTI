import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Users, Zap, TrendingUp } from 'lucide-react';
import { login } from '../firebase';

export const LandingPage = () => {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl z-10"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-sm font-semibold mb-8 border border-emerald-500/20">
          <Zap className="w-4 h-4" />
          LIVE AUCTION PLATFORM
        </div>
        
        <h1 className="text-6xl sm:text-8xl font-black tracking-tighter mb-6 leading-none italic">
          KABADDI <span className="text-emerald-500">AUCTION</span> PRO
        </h1>
        
        <p className="text-xl text-zinc-400 mb-12 max-w-xl mx-auto">
          The ultimate real-time bidding platform for Kabaddi leagues. Manage teams, bid on star players, and build your dream squad.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={login}
            className="w-full sm:w-auto px-12 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold rounded-2xl transition-all shadow-2xl shadow-emerald-600/30 hover:scale-105 active:scale-95"
          >
            GET STARTED
          </button>
          <button className="w-full sm:w-auto px-12 py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 text-lg font-bold rounded-2xl transition-all border border-zinc-800">
            VIEW STATS
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-24 w-full max-w-5xl z-10">
        {[
          { icon: Trophy, title: "Real-time Bidding", desc: "Experience the thrill of live auctions with zero latency." },
          { icon: Users, title: "Team Management", desc: "Manage your budget and squad with precision." },
          { icon: TrendingUp, title: "Player Stats", desc: "Detailed analytics for every raider and defender." }
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="p-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl backdrop-blur-sm"
          >
            <feature.icon className="w-10 h-10 text-emerald-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
            <p className="text-zinc-400 leading-relaxed">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
