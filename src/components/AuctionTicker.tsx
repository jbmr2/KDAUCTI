import React, { useState, useEffect } from 'react';
import { rtdb } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { Player, Team, AuctionState } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Shield, Zap, Trophy, PartyPopper, Gavel, XCircle, CheckCircle2 } from 'lucide-react';

export const AuctionTicker = () => {
  const [poolId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('pool');
  });
  const [tournamentName, setTournamentName] = useState<string>('Live Auction');
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [soldPlayer, setSoldPlayer] = useState<Player | null>(null);
  const [recentBids, setRecentBids] = useState<any[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    if (soldPlayer) {
      setShowFlash(true);
      const timer = setTimeout(() => setShowFlash(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [soldPlayer?.id, soldPlayer?.status]);

  useEffect(() => {
    if (poolId) {
      const unsubPool = onValue(ref(rtdb, `tournaments/${poolId}`), (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setTournamentName(data.name || 'Live Auction');
          setAuctionState(data.auctionState as AuctionState);
          
          if (data.teams) {
            setTeams(Object.entries(data.teams).map(([id, val]) => ({ id, ...(val as any) } as Team)));
          }

          const pid = data.auctionState?.currentPlayerId;
          const status = data.auctionState?.status;

          if (status === 'active' && pid && data.players?.[pid]) {
            setCurrentPlayer({ 
              id: pid, 
              ...data.players[pid] 
            } as Player);
            setSoldPlayer(null);

            // Handle Recent Bids
            if (data.bids) {
              const pBids = Object.entries(data.bids)
                .map(([bidId, b]: [string, any]) => ({ id: bidId, ...b }))
                .filter(b => b.playerId === pid)
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, 5);
              setRecentBids(pBids);
            } else {
              setRecentBids([]);
            }
          } else if (currentPlayer && status === 'idle') {
            const lastPid = currentPlayer.id;
            const lastPlayerData = data.players?.[lastPid];
            if (lastPlayerData && (lastPlayerData.status === 'sold' || lastPlayerData.status === 'unsold')) {
              setSoldPlayer({ id: lastPid, ...lastPlayerData } as Player);
              setCurrentPlayer(null);
              setRecentBids([]);
              // EXTENDED TO 10 SECONDS
              setTimeout(() => setSoldPlayer(null), 10000);
            } else {
              setCurrentPlayer(null);
              setRecentBids([]);
            }
          } else if (!pid && status === 'idle') {
             setCurrentPlayer(null);
          }
        }
      });
      return () => unsubPool();
    } else {
      const unsubAll = onValue(ref(rtdb, 'tournaments'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const activePool = Object.entries(data).find(([id, val]: [string, any]) => val.auctionState?.status === 'active');
          if (activePool) {
            const [id, val] = activePool as [string, any];
            setTournamentName(val.name || 'Live Auction');
            setAuctionState(val.auctionState as AuctionState);
            if (val.teams) {
              setTeams(Object.entries(val.teams).map(([tid, tval]) => ({ id: tid, ...(tval as any) } as Team)));
            }
            if (val.auctionState?.currentPlayerId && val.players?.[val.auctionState.currentPlayerId]) {
              const pid = val.auctionState.currentPlayerId;
              setCurrentPlayer({ 
                id: pid, 
                ...val.players[pid] 
              } as Player);

              if (val.bids) {
                const pBids = Object.entries(val.bids)
                  .map(([bidId, b]: [string, any]) => ({ id: bidId, ...b }))
                  .filter(b => b.playerId === pid)
                  .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                  .slice(0, 5);
                setRecentBids(pBids);
              } else {
                setRecentBids([]);
              }
            }
          } else {
            setCurrentPlayer(null);
            setAuctionState(null);
          }
        }
      });
      return () => unsubAll();
    }
  }, [poolId, currentPlayer?.id]);

  const isSold = soldPlayer?.status === 'sold';
  const isUnsold = soldPlayer?.status === 'unsold';

  return (
    <>
      {/* 1. STATUS FLASH EFFECT */}
      <AnimatePresence>
        {showFlash && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[100] pointer-events-none ${soldPlayer?.status === 'sold' ? 'bg-white' : 'bg-red-500/50'}`}
          />
        )}
      </AnimatePresence>

      {/* 2. CELEBRATORY STATUS OVERLAY (CENTER) */}
      <AnimatePresence>
        {soldPlayer && (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none"
          >
            <div className={`px-16 py-8 shadow-[0_0_100px_rgba(0,0,0,0.5)] border-8 skew-x-[-15deg] flex flex-col items-center ${
              soldPlayer.status === 'sold' 
                ? 'bg-emerald-600 border-white text-white' 
                : 'bg-red-600 border-white text-white'
            }`}>
              <div className="skew-x-[15deg] flex flex-col items-center gap-4">
                {soldPlayer.status === 'sold' ? (
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-4 mb-2">
                      <PartyPopper className="w-16 h-16 animate-bounce" />
                      <span className="text-8xl font-black italic uppercase tracking-tighter text-white drop-shadow-lg">SOLD</span>
                      <PartyPopper className="w-16 h-16 animate-bounce" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <Gavel className="w-16 h-16" />
                    <span className="text-8xl font-black italic uppercase tracking-tighter text-white drop-shadow-lg">UNSOLD</span>
                  </div>
                )}
                
                <div className="text-5xl font-black uppercase tracking-widest bg-black/20 px-8 py-3 rounded-sm border border-white/10">
                  {soldPlayer.name}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. SEPARATE LIVE BID CARD - ABOVE BOTTOM TICKER */}
      {auctionState?.status === 'active' && currentPlayer && recentBids.length > 0 && (
        <div className="fixed bottom-28 right-8 w-80 z-50">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-950/90 backdrop-blur-2xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden"
          >
            {/* Card Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-4 py-2 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Live Bidding</span>
              </div>
              <TrendingUp className="w-3 h-3 text-white/70" />
            </div>

            {/* Bids List */}
            <div className="p-1 flex flex-col">
              <AnimatePresence mode="popLayout">
                {recentBids.map((bid, index) => {
                  const team = teams.find(t => t.id === bid.teamId);
                  return (
                    <motion.div
                      key={bid.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: index === 0 ? 1 : 0.6, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`flex items-center gap-3 p-2.5 transition-colors ${
                        index === 0 
                          ? 'bg-emerald-500/10 border-l-4 border-emerald-500' 
                          : 'border-l-4 border-transparent hover:bg-white/5'
                      }`}
                    >
                      {/* Team Logo */}
                      <div className={`w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border ${
                        index === 0 ? 'border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'border-zinc-800'
                      }`}>
                        {team?.logo ? (
                          <img src={team.logo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-zinc-700" />
                          </div>
                        )}
                      </div>

                      {/* Team Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-black text-white truncate uppercase italic">
                          {team?.name || 'Unknown Team'}
                        </div>
                        {index === 0 && (
                          <div className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest leading-none">
                            Current High Bidder
                          </div>
                        )}
                      </div>

                      {/* Bid Amount */}
                      <div className={`text-base font-black tabular-nums ${
                        index === 0 ? 'text-white' : 'text-zinc-400'
                      }`}>
                        ₹{bid.amount.toLocaleString()}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Card Footer Indicator */}
          <div className="mt-2 flex justify-end px-2">
            <div className="bg-zinc-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 shadow-lg">
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Showing Last 5 Bids</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. DEDICATED SOLD RESULT BANNER (BOTTOM) - 10 SECONDS */}
      {isSold && soldPlayer && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          className="fixed bottom-0 left-0 right-0 h-[15vh] bg-black flex items-center overflow-hidden border-t-4 border-emerald-500 z-50 shadow-[0_-20px_60px_rgba(0,0,0,0.8)]"
        >
          {/* Progress bar for 10s timer */}
          <motion.div 
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 10, ease: "linear" }}
            className="absolute bottom-0 left-0 h-1 bg-emerald-500 z-20"
          />

          <div className="flex w-full items-center px-[4vw] gap-[4vw] relative z-10">
            {soldPlayer.image && (
              <div className="w-[12vh] h-[12vh] bg-zinc-900 rounded-2xl border-2 border-emerald-500/50 overflow-hidden flex-shrink-0 shadow-2xl">
                <img src={soldPlayer.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
            <div className="bg-emerald-600 px-[3vw] py-[2vh] skew-x-[-15deg] -ml-[2vw] pr-[5vw] flex items-center justify-center">
              <span className="text-[6vh] font-black italic uppercase text-white skew-x-[15deg]">SOLD</span>
            </div>
            
            <div className="flex-1 flex flex-col min-w-0">
              <div className="text-[6vh] font-black italic uppercase text-white tracking-tighter truncate drop-shadow-xl leading-none">
                {soldPlayer.name}
              </div>
              <div className="text-emerald-500 font-black uppercase text-[2vh] tracking-widest mt-1">
                {soldPlayer.position} • {soldPlayer.category}
              </div>
            </div>

            <div className="flex items-center gap-[2vw] border-l border-white/10 pl-[3vw] h-[10vh]">
              {(() => {
                const team = teams.find(t => t.id === soldPlayer.teamId);
                return (
                  <>
                    <div className="w-[8vh] h-[8vh] bg-white rounded-xl p-1 shadow-2xl flex-shrink-0 overflow-hidden">
                      {team?.logo ? (
                        <img src={team.logo} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-emerald-100 flex items-center justify-center">
                          <Trophy className="w-[4vh] h-[4vh] text-emerald-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-zinc-500 text-[1.2vh] font-black uppercase tracking-[0.2em]">Bought By</span>
                      <span className="text-[3.5vh] font-black italic uppercase text-white tracking-tighter whitespace-nowrap truncate max-w-[15vw]">
                        {team?.name || 'New Team'}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="bg-emerald-500/10 px-[3vw] py-[1.5vh] border border-emerald-500/30 rounded-2xl flex flex-col items-center justify-center min-w-[15vw]">
              <span className="text-emerald-500 text-[1.2vh] font-black uppercase tracking-widest mb-1">Price</span>
              <span className="text-[6vh] font-black tabular-nums text-white leading-none">
                ₹{(soldPlayer.currentBid || soldPlayer.basePrice).toLocaleString()}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* 5. UNSOLD BANNER (BOTTOM) - 10 SECONDS */}
      {isUnsold && soldPlayer && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          className="fixed bottom-0 left-0 right-0 h-[15vh] bg-black flex items-center justify-center overflow-hidden border-t-4 border-red-500 z-50 shadow-[0_-20px_60px_rgba(0,0,0,0.8)]"
        >
          <motion.div 
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 10, ease: "linear" }}
            className="absolute bottom-0 left-0 h-1 bg-red-500 z-20"
          />

          <div className="flex items-center gap-[4vw] w-full px-[4vw]">
            {soldPlayer.image && (
              <div className="w-[12vh] h-[12vh] bg-zinc-900 rounded-2xl border-2 border-red-500/50 overflow-hidden flex-shrink-0 shadow-2xl">
                <img src={soldPlayer.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
            <div className="bg-red-600 px-[3vw] py-[2vh] skew-x-[-15deg] -ml-[2vw] pr-[5vw] flex items-center justify-center">
              <span className="text-[6vh] font-black italic uppercase text-white skew-x-[15deg]">UNSOLD</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <span className="text-[6vh] font-black italic uppercase text-white tracking-tighter truncate block leading-none">
                {soldPlayer.name}
              </span>
              <span className="text-zinc-500 text-[2.5vh] font-black uppercase italic tracking-widest mt-1 block">
                {soldPlayer.position} • {soldPlayer.category}
              </span>
            </div>

            <div className="bg-red-500/10 px-[4vw] py-[2vh] border border-red-500/30 rounded-2xl flex flex-col items-center justify-center min-w-[15vw]">
              <span className="text-red-500 text-[1.2vh] font-black uppercase tracking-widest mb-1">Base Price</span>
              <span className="text-[6vh] font-black tabular-nums text-white leading-none">
                ₹{soldPlayer.basePrice.toLocaleString()}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* 6. BOTTOM TICKER BAR - ONLY SHOW WHEN ACTIVE */}
      {auctionState?.status === 'active' && currentPlayer && (
        <div className="fixed bottom-0 left-0 right-0 h-24 w-full backdrop-blur-2xl flex items-center overflow-hidden border-t shadow-[0_-10px_50px_rgba(0,0,0,0.6)] transition-all duration-700 relative bg-zinc-950/95 border-emerald-500/50">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shine_4s_infinite] pointer-events-none" />

          {/* 1. Tournament Brand Section */}
          <div className="bg-zinc-900/80 px-10 h-full flex flex-col justify-center border-r border-zinc-800/50 min-w-fit">
            <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Tournament</div>
            <div className="text-xl font-black italic uppercase tracking-tighter text-white whitespace-nowrap">
              {tournamentName}
            </div>
          </div>

          {/* 2. LIVE Badge & Category */}
          <div className="relative h-full flex items-center pl-6 pr-12 skew-x-[-15deg] -ml-4 z-20 shadow-[10px_0_30px_rgba(0,0,0,0.4)] bg-gradient-to-r from-emerald-600 to-emerald-700">
            <div className="skew-x-[15deg] flex flex-col items-center">
              <div className={`px-2 py-0.5 text-[10px] font-black rounded-sm ${currentPlayer.category !== 'None' ? 'mb-1' : ''} bg-white text-emerald-700 animate-pulse`}>
                LIVE
              </div>
              {currentPlayer.category !== 'None' && (
                <>
                  <div className="text-3xl font-black text-white leading-none tracking-tighter">{currentPlayer.category}</div>
                  <div className="text-[10px] font-bold text-white/70 uppercase">CAT</div>
                </>
              )}
            </div>
          </div>

          {/* 3. Player Image & Info Section */}
          <div className="flex-1 min-w-0 px-8 flex items-center gap-6 z-10">
            {currentPlayer.image && (
              <div className="w-20 h-20 bg-zinc-900 rounded-xl border border-white/10 overflow-hidden flex-shrink-0">
                <img src={currentPlayer.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
            <motion.div 
              key={currentPlayer.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 border text-[10px] font-black uppercase tracking-wider rounded bg-emerald-500/20 border-emerald-500/30 text-emerald-400`}>
                  {currentPlayer.position}
                </span>
              </div>
              <div className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none truncate drop-shadow-2xl">
                {currentPlayer.name}
              </div>
            </motion.div>
          </div>

          {/* 4. Stats Section */}
          <div className="flex items-center gap-6 px-10 border-r border-zinc-800/50">
            <div className="text-center">
              <div className="text-[9px] font-black text-zinc-500 uppercase mb-0.5">Matches</div>
              <div className="text-xl font-black text-zinc-300 leading-none">{currentPlayer.stats?.matches || 0}</div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-base font-black text-zinc-400 leading-none">{currentPlayer.stats?.raidPoints || 0}</span>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-blue-500" />
                <span className="text-base font-black text-zinc-400 leading-none">{currentPlayer.stats?.tacklePoints || 0}</span>
              </div>
            </div>
          </div>

          {/* 5. Price Container */}
          <div className="flex h-full items-center gap-10 px-12 bg-zinc-900/50 skew-x-[-15deg] border-r border-zinc-800/50">
            <div className="skew-x-[15deg] text-center">
              <div className="text-[10px] font-black uppercase text-zinc-500 mb-1">Base</div>
              <div className="text-xl font-black text-zinc-400">₹{currentPlayer.basePrice.toLocaleString()}</div>
            </div>

            <div className="skew-x-[15deg] text-center min-w-[160px]">
              <div className={`text-[10px] font-black uppercase mb-1 flex items-center justify-center gap-1 text-emerald-500`}>
                <TrendingUp className="w-4 h-4" />
                Current Bid
              </div>
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentPlayer.currentBid || currentPlayer.basePrice}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.1, opacity: 1 }}
                  className="text-5xl font-black tabular-nums drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] text-white"
                >
                  ₹{(currentPlayer.currentBid || currentPlayer.basePrice).toLocaleString()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* 6. Bidding Team Section */}
          <div className="h-full pl-12 pr-16 flex items-center skew-x-[-15deg] -mr-8 border-l transition-all duration-700 bg-zinc-800/80 border-emerald-500/30">
            <div className="skew-x-[15deg] flex items-center gap-6">
              <div className="text-right">
                <div className="text-[10px] font-black uppercase text-zinc-500 mb-1">
                  Current Bidder
                </div>
                {(() => {
                  const currentBidder = teams.find(t => t.id === currentPlayer.currentBidderId);
                  return (
                    <AnimatePresence mode="wait">
                      <motion.div 
                        key={currentBidder?.id || 'none'}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`text-2xl font-black uppercase italic truncate max-w-[200px] leading-tight ${currentBidder ? 'text-emerald-400' : 'text-zinc-600'}`}
                      >
                        {currentBidder?.name || "Awaiting Bids"}
                      </motion.div>
                    </AnimatePresence>
                  );
                })()}
              </div>
              {(() => {
                const currentBidder = teams.find(t => t.id === currentPlayer.currentBidderId);
                return (
                  <div className="relative">
                    <div className={`w-16 h-16 rounded-xl border-2 overflow-hidden flex items-center justify-center transition-all duration-300 shadow-lg ${
                      currentBidder ? 'border-emerald-500/50 bg-zinc-900' : 'border-zinc-700 bg-zinc-800'
                    }`}>
                      {currentBidder?.logo ? (
                        <img 
                          src={currentBidder.logo} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                          alt={currentBidder.name}
                        />
                      ) : (
                        <Trophy className="w-10 h-10 text-zinc-700" />
                      )}
                    </div>
                    {currentBidder && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-zinc-800 shadow-lg bg-emerald-500`}
                      />
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <style>{`
            @keyframes shine {
              0% { transform: translateX(-100%) skewX(-15deg); }
              40%, 100% { transform: translateX(300%) skewX(-15deg); }
            }
          `}</style>
        </div>
      )}
    </>
  );
};
