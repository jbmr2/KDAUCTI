import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gavel, Users, User, Trophy, Shield, Zap } from 'lucide-react';
import { rtdb } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { Player, Team, Bid, AuctionState, Tournament } from '../types';

export const LEDDisplay = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);

  // 1. Fetch Pools
  useEffect(() => {
    const unsubPools = onValue(ref(rtdb, 'tournaments'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const pools: Tournament[] = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
        setTournaments(pools);
        
        // Handle direct pool link from URL parameter
        const params = new URLSearchParams(window.location.search);
        const poolParam = params.get('pool');
        
        if (poolParam && pools.some(p => p.id === poolParam)) {
          setSelectedPoolId(poolParam);
        } else if (pools.length > 0 && !selectedPoolId) {
          setSelectedPoolId(pools[0].id);
        }
      }
    });
    return () => unsubPools();
  }, []);

  // 2. Fetch Pool Data
  useEffect(() => {
    if (!selectedPoolId) return;

    const unsubState = onValue(ref(rtdb, `tournaments/${selectedPoolId}/auctionState`), (snapshot) => {
      setAuctionState(snapshot.val() as AuctionState);
    });

    const unsubPlayers = onValue(ref(rtdb, `tournaments/${selectedPoolId}/players`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPlayers(Object.entries(data).map(([id, val]) => ({ id, ...(val as any) } as Player)));
      } else {
        setPlayers([]);
      }
    });

    const unsubTeams = onValue(ref(rtdb, `tournaments/${selectedPoolId}/teams`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTeams(Object.entries(data).map(([id, val]) => ({ id, ...(val as any) } as Team)));
      } else {
        setTeams([]);
      }
    });

    const unsubBids = onValue(ref(rtdb, `tournaments/${selectedPoolId}/bids`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBids(Object.entries(data).map(([id, val]) => ({ id, ...(val as any) } as Bid)));
      } else {
        setBids([]);
      }
    });

    return () => {
      unsubState();
      unsubPlayers();
      unsubTeams();
      unsubBids();
    };
  }, [selectedPoolId]);

  const currentPlayer = players.find(p => p.id === auctionState?.currentPlayerId);
  const currentBidder = teams.find(t => t.id === currentPlayer?.currentBidderId);

  // New logic for showing last completed player (Sold/Unsold)
  const [lastCompletedPlayer, setLastCompletedPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (auctionState?.status === 'idle' && !currentPlayer) {
      const soldOrUnsold = players.find(p => p.status === 'sold' || p.status === 'unsold');
      // We need a more reliable way to find the MOST RECENTLY completed player
      // For now, let's look at all players and find the one that was recently updated
      const recentlyCompleted = [...players]
        .filter(p => p.status === 'sold' || p.status === 'unsold')
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
      
      if (recentlyCompleted) {
        setLastCompletedPlayer(recentlyCompleted);
      }
    } else {
      setLastCompletedPlayer(null);
    }
  }, [auctionState?.status, currentPlayer, players]);

  if (!selectedPoolId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-pulse text-emerald-500 font-black text-4xl uppercase italic">Waiting for Pool...</div>
      </div>
    );
  }

  // Full Screen Sold/Unsold View
  if (lastCompletedPlayer) {
    const isSold = lastCompletedPlayer.status === 'sold';
    const purchaser = teams.find(t => t.id === lastCompletedPlayer.currentBidderId);

    return (
      <div className={`h-screen w-screen flex flex-col items-center justify-center overflow-hidden transition-all duration-1000 ${
        isSold ? 'bg-black bg-gradient-to-br from-emerald-950/40 to-black' : 'bg-black bg-gradient-to-br from-red-950/40 to-black'
      }`}>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full h-full grid grid-cols-2 p-[4vw] gap-[4vw] items-center"
        >
          {/* Left Side: Player Name & Details */}
          <motion.div 
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex flex-col justify-center gap-[4vh] border-r border-white/10 pr-[4vw]"
          >
            <div className="space-y-[2vh]">
              <p className="text-[4vh] text-zinc-500 font-black uppercase tracking-[0.5em] italic">
                {lastCompletedPlayer.position} • {lastCompletedPlayer.category}
              </p>
              <h1 className="text-[15vh] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-2xl italic">
                {lastCompletedPlayer.name}
              </h1>
            </div>

            <div className="flex items-center gap-6 mt-[4vh]">
              <div className="h-2 w-24 bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
              <span className="text-zinc-500 text-2xl font-black uppercase tracking-[0.3em]">Player Details</span>
            </div>
          </motion.div>

          {/* Right Side: Final Data (Status, Team, Price) */}
          <motion.div 
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex flex-col items-center justify-center gap-[6vh] text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`text-[20vh] font-black italic uppercase tracking-tighter leading-none ${
                isSold ? 'text-emerald-500 drop-shadow-[0_0_80px_rgba(16,185,129,0.8)]' : 'text-red-500 drop-shadow-[0_0_80px_rgba(239,68,68,0.8)]'
              }`}
            >
              {isSold ? 'SOLD' : 'UNSOLD'}
            </motion.div>

            {isSold && purchaser && (
              <div className="flex flex-col items-center gap-[4vh] w-full">
                <div className="flex items-center gap-[3vw] bg-zinc-900/60 p-[3vh] rounded-[4vh] border-2 border-emerald-500/20 backdrop-blur-3xl shadow-2xl w-full justify-center">
                  <div className="w-[18vh] h-[18vh] bg-white rounded-[2vh] p-1 shadow-2xl overflow-hidden flex-shrink-0">
                    {purchaser.logo ? (
                      <img src={purchaser.logo} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <Users className="w-full h-full text-emerald-500 p-4" />
                    )}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-emerald-500 text-[2.5vh] font-black uppercase tracking-widest mb-1 opacity-60">Purchased By</p>
                    <h2 className="text-[7vh] font-black text-white uppercase italic leading-none truncate">
                      {purchaser.name}
                    </h2>
                  </div>
                </div>

                <div className="bg-emerald-500/10 px-[6vw] py-[2vh] rounded-[3vh] border-2 border-emerald-500/30 backdrop-blur-xl w-full">
                  <p className="text-zinc-500 text-[2vh] font-black uppercase tracking-[0.3em] mb-1">Final Bid Amount</p>
                  <div className="text-[12vh] font-black text-emerald-400 leading-none drop-shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                    ₹{lastCompletedPlayer.currentBid?.toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {!isSold && (
              <div className="bg-zinc-900/60 px-[8vw] py-[6vh] rounded-[4vh] border-4 border-red-500/20 backdrop-blur-3xl w-full">
                <p className="text-red-500/40 text-[5vh] font-black uppercase tracking-[0.8em] italic">NO BIDS</p>
                <div className="mt-4 text-zinc-500 text-2xl font-black uppercase tracking-widest">
                  Base Price: ₹{lastCompletedPlayer.basePrice?.toLocaleString()}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white p-8 flex flex-col overflow-hidden">
      {/* Pool Selector (Auto-hidden in LED mode) */}
      {!new URLSearchParams(window.location.search).get('pool') && (
        <div className="absolute top-4 right-4 opacity-0 hover:opacity-100 transition-opacity z-50">
          <select 
            value={selectedPoolId}
            onChange={(e) => setSelectedPoolId(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 p-2 rounded text-xs text-zinc-500 outline-none"
          >
            {tournaments.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-between max-w-[1920px] mx-auto w-full">
        {currentPlayer ? (
          <div className="grid grid-cols-12 gap-12 h-full items-center">
            
            {/* Player Info (Left) */}
            <div className="col-span-7 space-y-12">
              <motion.div 
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-6">
                  <span className="px-8 py-3 bg-emerald-600 text-white text-3xl font-black rounded-full uppercase italic shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                    CATEGORY {currentPlayer.category}
                  </span>
                  <span className="px-8 py-3 bg-zinc-900 text-zinc-400 text-3xl font-black rounded-full uppercase italic border border-zinc-800">
                    {currentPlayer.position}
                  </span>
                </div>
                
                <h1 className="text-[10rem] font-black italic tracking-tighter uppercase leading-[0.85] text-white">
                  {currentPlayer.name}
                </h1>

                <div className="grid grid-cols-3 gap-6 pt-8">
                  <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/50 backdrop-blur-xl">
                    <p className="text-zinc-500 text-xl font-black uppercase mb-1">Matches</p>
                    <p className="text-5xl font-black text-emerald-500">{currentPlayer.stats.matches}</p>
                  </div>
                  <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/50 backdrop-blur-xl">
                    <p className="text-zinc-500 text-xl font-black uppercase mb-1">Raid Pts</p>
                    <p className="text-5xl font-black text-emerald-500">{currentPlayer.stats.raidPoints}</p>
                  </div>
                  <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/50 backdrop-blur-xl">
                    <p className="text-zinc-500 text-xl font-black uppercase mb-1">Tackle Pts</p>
                    <p className="text-5xl font-black text-emerald-500">{currentPlayer.stats.tacklePoints}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Bid Info (Right) */}
            <div className="col-span-5 flex flex-col gap-6">
              {/* Status Header */}
              <div className="text-center">
                <div className={`inline-block px-10 py-3 rounded-full text-3xl font-black uppercase tracking-[0.2em] mb-4 ${
                  currentPlayer.status === 'sold' ? 'bg-emerald-600 shadow-[0_0_50px_rgba(16,185,129,0.5)]' : 
                  currentPlayer.status === 'unsold' ? 'bg-zinc-800 text-zinc-500' :
                  'bg-yellow-500 text-black shadow-[0_0_50px_rgba(234,179,8,0.5)]'
                }`}>
                  {currentPlayer.status === 'current' ? 'Bidding Live' : currentPlayer.status}
                </div>
              </div>

              {/* Price Display */}
              <motion.div 
                key={currentPlayer.currentBid}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-zinc-900 rounded-[3rem] p-10 border-4 border-emerald-500/50 flex flex-col items-center justify-center shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]"
              >
                <p className="text-zinc-500 text-2xl font-black uppercase mb-3 tracking-widest">
                  {currentPlayer.currentBidderId ? 'Current Bid' : 'Base Price'}
                </p>
                <div className="text-[8rem] font-black italic text-emerald-500 leading-none drop-shadow-[0_0_50px_rgba(16,185,129,0.5)]">
                  ₹{(currentPlayer.currentBid || currentPlayer.basePrice).toLocaleString()}
                </div>
              </motion.div>

              {/* Current Bidder */}
              <AnimatePresence mode="wait">
                {currentBidder ? (
                  <motion.div 
                    key={currentBidder.id}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    className="flex items-center justify-center gap-8 bg-emerald-600/10 p-6 rounded-[2.5rem] border-2 border-emerald-500/20"
                  >
                    {currentBidder.logo ? (
                      <img src={currentBidder.logo} className="w-24 h-24 rounded-full shadow-2xl border-4 border-emerald-500" />
                    ) : (
                      <Users className="w-24 h-24 text-emerald-500" />
                    )}
                    <div className="text-left">
                      <p className="text-emerald-500/60 text-xl font-black uppercase tracking-widest mb-1">Highest Bidder</p>
                      <h2 className="text-5xl font-black uppercase italic tracking-tighter">{currentBidder.name}</h2>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-24 flex items-center justify-center">
                    <p className="text-zinc-800 text-3xl font-black uppercase tracking-[0.5em] italic">Waiting for Bids</p>
                  </div>
                )}
              </AnimatePresence>

              {/* Recent Bids Ticker for LED */}
              <div className="bg-zinc-900/50 rounded-[2.5rem] p-6 border border-zinc-800/50">
                <p className="text-zinc-500 text-lg font-black uppercase tracking-widest mb-4">Recent Bids</p>
                <div className="space-y-2 max-h-[180px] overflow-hidden">
                  <AnimatePresence mode="popLayout">
                    {bids
                      .filter(b => b.playerId === currentPlayer.id)
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .slice(0, 5)
                      .map((bid, i) => {
                        const bidder = teams.find(t => t.id === bid.teamId);
                        return (
                          <motion.div
                            key={bid.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`flex justify-between items-center p-4 rounded-2xl ${i === 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-zinc-950/50'}`}
                          >
                            <span className="text-2xl font-black uppercase italic">{bidder?.name}</span>
                            <span className={`text-3xl font-black ${i === 0 ? 'text-emerald-500' : 'text-zinc-500'}`}>₹{bid.amount.toLocaleString()}</span>
                          </motion.div>
                        );
                      })}
                  </AnimatePresence>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-12">
             <Gavel className="w-64 h-64 text-zinc-900" />
             <h2 className="text-7xl font-black uppercase italic text-zinc-800 tracking-tighter">Auction Not Started</h2>
          </div>
        )}

        {/* Bottom Ticker/Info Bar */}
        <div className="mt-8 pt-6 border-t border-zinc-900 flex justify-between items-center">
           <div className="flex items-center gap-10">
              <div className="flex items-center gap-3">
                 <Zap className="text-emerald-500 w-8 h-8 fill-emerald-500" />
                 <span className="text-4xl font-black italic uppercase tracking-tighter">KABADDI AUCTION PRO</span>
              </div>
              <div className="h-10 w-px bg-zinc-900"></div>
              <div className="text-3xl font-black text-zinc-500 uppercase italic">
                {tournaments.find(t => t.id === selectedPoolId)?.name}
              </div>
           </div>
           
           <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-zinc-500 text-lg font-black uppercase tracking-widest">Total Teams</p>
                <p className="text-3xl font-black text-white">{teams.length}</p>
              </div>
              <div className="text-right">
                <p className="text-zinc-500 text-lg font-black uppercase tracking-widest">Remaining Players</p>
                <p className="text-3xl font-black text-white">{players.filter(p => p.status === 'unsold').length}</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
