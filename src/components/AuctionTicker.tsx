import React, { useState, useEffect } from 'react';
import { rtdb } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { Player, Team, AuctionState } from '../types';

export const AuctionTicker = () => {
  const [poolId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('pool');
  });
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    if (poolId) {
      // 1. Listen to specific pool
      const unsubPool = onValue(ref(rtdb, `tournaments/${poolId}`), (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setAuctionState(data.auctionState as AuctionState);
          
          if (data.teams) {
            setTeams(Object.entries(data.teams).map(([id, val]) => ({ id, ...(val as any) } as Team)));
          }

          if (data.auctionState?.currentPlayerId && data.players?.[data.auctionState.currentPlayerId]) {
            setCurrentPlayer({ 
              id: data.auctionState.currentPlayerId, 
              ...data.players[data.auctionState.currentPlayerId] 
            } as Player);
          } else {
            setCurrentPlayer(null);
          }
        }
      });
      return () => unsubPool();
    } else {
      // Search for any active pool if none specified
      const unsubAll = onValue(ref(rtdb, 'tournaments'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const activePool = Object.entries(data).find(([id, val]: [string, any]) => val.auctionState?.status === 'active');
          if (activePool) {
            const [id, val] = activePool as [string, any];
            setAuctionState(val.auctionState as AuctionState);
            if (val.teams) {
              setTeams(Object.entries(val.teams).map(([tid, tval]) => ({ id: tid, ...(tval as any) } as Team)));
            }
            if (val.auctionState?.currentPlayerId && val.players?.[val.auctionState.currentPlayerId]) {
              setCurrentPlayer({ 
                id: val.auctionState.currentPlayerId, 
                ...val.players[val.auctionState.currentPlayerId] 
              } as Player);
            }
          }
        }
      });
      return () => unsubAll();
    }
  }, [poolId]);

  if (!auctionState || auctionState.status === 'idle' || !currentPlayer) {
    return (
      <div className="h-20 w-full bg-black/80 backdrop-blur-md flex items-center justify-center border-t-4 border-emerald-500">
        <span className="text-zinc-500 font-black italic uppercase tracking-widest text-xl animate-pulse">
          Waiting for next player...
        </span>
      </div>
    );
  }

  const currentBidder = teams.find(t => t.id === currentPlayer.currentBidderId);

  return (
    <div className="h-20 w-full bg-zinc-950 flex items-center overflow-hidden border-t-4 border-emerald-500 shadow-2xl">
      {/* Category & Position Tag */}
      <div className="bg-emerald-600 h-full px-6 flex flex-col justify-center items-center skew-x-[-15deg] ml-[-10px] pr-8 shadow-[10px_0_20px_rgba(0,0,0,0.3)]">
        <div className="skew-x-[15deg]">
          <div className="text-[10px] font-black uppercase text-white/70 leading-none">Category</div>
          <div className="text-2xl font-black text-white leading-none">{currentPlayer.category}</div>
        </div>
      </div>

      {/* Player Name */}
      <div className="flex-1 px-8 flex flex-col justify-center">
        <div className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.3em] leading-none mb-1">{currentPlayer.position}</div>
        <div className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none truncate">
          {currentPlayer.name}
        </div>
      </div>

      {/* Prices Container */}
      <div className="flex h-full items-center gap-12 px-12 bg-zinc-900 skew-x-[-15deg]">
        <div className="skew-x-[15deg] text-center">
          <div className="text-[10px] font-black uppercase text-zinc-500 leading-none mb-1">Base</div>
          <div className="text-xl font-black text-zinc-300 leading-none">₹{currentPlayer.basePrice.toLocaleString()}</div>
        </div>

        <div className="w-px h-10 bg-zinc-800 skew-x-0" />

        <div className="skew-x-[15deg] text-center">
          <div className="text-[10px] font-black uppercase text-emerald-500 leading-none mb-1">Current Bid</div>
          <div className="text-3xl font-black text-emerald-400 leading-none animate-bounce-short">
            ₹{(currentPlayer.currentBid || currentPlayer.basePrice).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Bidding Team */}
      <div className="bg-zinc-800 h-full px-12 flex items-center gap-4 skew-x-[-15deg] mr-[-10px]">
        <div className="skew-x-[15deg] flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] font-black uppercase text-zinc-500 leading-none mb-1">Bidding Team</div>
            <div className="text-xl font-black text-white leading-none uppercase italic truncate max-w-[150px]">
              {currentBidder?.name || "No Bids"}
            </div>
          </div>
          {currentBidder?.logo && (
            <img src={currentBidder.logo} className="w-10 h-10 rounded-lg border-2 border-zinc-700 object-cover" referrerPolicy="no-referrer" />
          )}
        </div>
      </div>

      <style>{`
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .animate-bounce-short {
          animation: bounce-short 0.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
