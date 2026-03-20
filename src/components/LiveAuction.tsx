import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gavel, Users, User, ArrowLeft, ArrowRight, Play, CheckCircle, XCircle, TrendingUp, RefreshCw, Undo2 } from 'lucide-react';
import { rtdb } from '../firebase';
import { ref, onValue, update, push, serverTimestamp } from 'firebase/database';
import { Player, Team, Bid, AuctionState, OperationType, Tournament } from '../types';
import { handleDatabaseError } from '../services/errorService';

export const LiveAuction = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [multiplierUnit, setMultiplierUnit] = useState(1000); // 1X = 1000
  const [activeMultiplier, setActiveMultiplier] = useState(1); // Default 1X
  const [customBidAmount, setCustomBidAmount] = useState<string>('');

  const bidIncrement = multiplierUnit * activeMultiplier;

  // 1. Fetch Basic Data
  useEffect(() => {
    const unsubPools = onValue(ref(rtdb, 'tournaments'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const pools: Tournament[] = [];
        const allPlayers: Player[] = [];
        const allTeams: Team[] = [];

        Object.entries(data).forEach(([tId, tVal]: [string, any]) => {
          pools.push({ id: tId, ...tVal } as Tournament);
          
          if (tVal.players) {
            Object.entries(tVal.players).forEach(([pId, pVal]: [string, any]) => {
              allPlayers.push({ id: pId, tournamentId: tId, ...pVal } as Player);
            });
          }

          if (tVal.teams) {
            Object.entries(tVal.teams).forEach(([tmId, tmVal]: [string, any]) => {
              allTeams.push({ id: tmId, tournamentId: tId, ...tmVal } as Team);
            });
          }
        });

        setTournaments(pools);
        setPlayers(allPlayers);
        setTeams(allTeams);
        
        if (pools.length > 0 && !selectedPoolId) {
          setSelectedPoolId(pools[0].id);
        }
      } else {
        setTournaments([]);
        setPlayers([]);
        setTeams([]);
      }
    });

    return () => unsubPools();
  }, [selectedPoolId]);

  // 2. Listen to Auction State and Bids for Selected Pool
  useEffect(() => {
    if (!selectedPoolId) return;
    const unsubState = onValue(ref(rtdb, `tournaments/${selectedPoolId}/auctionState`), (snapshot) => {
      setAuctionState(snapshot.val() as AuctionState);
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
      unsubBids();
    };
  }, [selectedPoolId]);

  // Filtered Players by Pool (Only show Unsold or currently being auctioned)
  const poolPlayers = players
    .filter(p => p.tournamentId === selectedPoolId)
    .filter(p => p.status === 'unsold' || p.status === 'current');

  const currentPlayer = poolPlayers[currentIndex];
  const poolTeams = teams.filter(t => t.tournamentId === selectedPoolId);

  // Filtered Bids for current player (Latest 20 for scrolling)
  const currentBids = bids
    .filter(b => b.playerId === currentPlayer?.id)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 20);

  // Sync Multiplier Unit to Base Price
  useEffect(() => {
    if (currentPlayer?.basePrice) {
      setMultiplierUnit(currentPlayer.basePrice);
    }
  }, [currentPlayer?.id, currentPlayer?.basePrice]);

  // 3. Methods
  const startAuction = async () => {
    if (!currentPlayer || !selectedPoolId) return;
    try {
      const updates: any = {};
      updates[`tournaments/${selectedPoolId}/auctionState/status`] = 'active';
      updates[`tournaments/${selectedPoolId}/auctionState/currentPlayerId`] = currentPlayer.id;
      updates[`tournaments/${selectedPoolId}/auctionState/timer`] = 60;
      updates[`tournaments/${selectedPoolId}/players/${currentPlayer.id}/status`] = 'current';
      await update(ref(rtdb), updates);
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${selectedPoolId}/auctionState`);
    }
  };

  const updateBasePrice = async (newPrice: number) => {
    if (!selectedPoolId || !currentPlayer) return;
    try {
      await update(ref(rtdb, `tournaments/${selectedPoolId}/players/${currentPlayer.id}`), {
        basePrice: newPrice
      });
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, 'basePrice');
    }
  };

  const manualBid = async (teamId: string) => {
    if (!currentPlayer || !auctionState || !selectedPoolId) return;
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    let nextBid: number;
    const custom = parseInt(customBidAmount);
    if (!isNaN(custom) && custom > 0) {
      nextBid = custom;
    } else {
      nextBid = !currentPlayer.currentBidderId ? currentPlayer.basePrice : (currentPlayer.currentBid || currentPlayer.basePrice) + bidIncrement;
    }

    // 1. Check Purse Value (Budget)
    if (nextBid > team.budget) {
      alert(`Insufficient budget! Team ${team.name} has only ₹${team.budget.toLocaleString()} left.`);
      return;
    }

    // 2. Check Next Bid Value
    if (!currentPlayer.currentBidderId) {
      if (nextBid < currentPlayer.basePrice) {
        alert(`First bid must be at least the Base Price (₹${currentPlayer.basePrice.toLocaleString()})!`);
        return;
      }
    } else {
      if (nextBid <= currentPlayer.currentBid) {
        alert(`Next bid must be higher than current bid (₹${currentPlayer.currentBid.toLocaleString()})!`);
        return;
      }
    }

    try {
      const bidRef = push(ref(rtdb, `tournaments/${selectedPoolId}/bids`));
      const updates: any = {};
      updates[`tournaments/${selectedPoolId}/players/${currentPlayer.id}/currentBid`] = nextBid;
      updates[`tournaments/${selectedPoolId}/players/${currentPlayer.id}/currentBidderId`] = teamId;
      updates[`tournaments/${selectedPoolId}/bids/${bidRef.key}`] = {
        playerId: currentPlayer.id,
        teamId: teamId,
        amount: nextBid,
        timestamp: serverTimestamp()
      };
      await update(ref(rtdb), updates);
      setCustomBidAmount('');
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${selectedPoolId}/bids`);
    }
  };

  const undoLastBid = async () => {
    if (!selectedPoolId || !currentPlayer?.id) return;
    
    const playerBids = bids
      .filter(b => b.playerId === currentPlayer.id)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (playerBids.length === 0) {
      alert("No bids to undo!");
      return;
    }

    try {
      const lastBid = playerBids[0];
      const previousBid = playerBids[1];

      const updates: any = {};
      updates[`tournaments/${selectedPoolId}/bids/${lastBid.id}`] = null;

      if (previousBid) {
        updates[`tournaments/${selectedPoolId}/players/${currentPlayer.id}/currentBid`] = previousBid.amount;
        updates[`tournaments/${selectedPoolId}/players/${currentPlayer.id}/currentBidderId`] = previousBid.teamId;
      } else {
        updates[`tournaments/${selectedPoolId}/players/${currentPlayer.id}/currentBid`] = 0;
        updates[`tournaments/${selectedPoolId}/players/${currentPlayer.id}/currentBidderId`] = null;
      }

      await update(ref(rtdb), updates);
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${selectedPoolId}/bids`);
    }
  };


  const markSold = async () => {
    if (!currentPlayer || !currentPlayer.currentBidderId || !selectedPoolId) {
      alert("No bidder yet!");
      return;
    }
    try {
      const team = teams.find(t => t.id === currentPlayer.currentBidderId);
      if (!team) return;

      const updates: any = {};
      updates[`tournaments/${selectedPoolId}/players/${currentPlayer.id}/status`] = 'sold';
      updates[`tournaments/${selectedPoolId}/players/${currentPlayer.id}/teamId`] = team.id;
      updates[`tournaments/${selectedPoolId}/teams/${team.id}/budget`] = team.budget - currentPlayer.currentBid;
      updates[`tournaments/${selectedPoolId}/teams/${team.id}/totalPlayers`] = team.totalPlayers + 1;
      
      updates[`tournaments/${selectedPoolId}/auctionState/status`] = 'idle';
      updates[`tournaments/${selectedPoolId}/auctionState/currentPlayerId`] = null;
      
      await update(ref(rtdb), updates);
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${selectedPoolId}/players`);
    }
  };

  const markUnsold = async () => {
    if (!currentPlayer || !selectedPoolId) return;
    try {
      const updates: any = {};
      updates[`tournaments/${selectedPoolId}/players/${currentPlayer.id}/status`] = 'unsold';
      updates[`tournaments/${selectedPoolId}/players/${currentPlayer.id}/currentBid`] = 0;
      updates[`tournaments/${selectedPoolId}/players/${currentPlayer.id}/currentBidderId`] = null;
      
      updates[`tournaments/${selectedPoolId}/auctionState/status`] = 'idle';
      updates[`tournaments/${selectedPoolId}/auctionState/currentPlayerId`] = null;
      
      await update(ref(rtdb), updates);
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${selectedPoolId}/players`);
    }
  };

  const nextPlayer = () => {
    if (currentIndex < poolPlayers.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevPlayer = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pt-24 pb-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Pool Selector & Navigation */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-black italic tracking-tighter uppercase text-emerald-500">Live Auction Controller</h2>
            <select 
              value={selectedPoolId}
              onChange={(e) => {
                setSelectedPoolId(e.target.value);
                setCurrentIndex(0);
              }}
              className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl outline-none focus:border-emerald-500 transition-all font-bold"
            >
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 bg-zinc-950 p-2 rounded-2xl border border-zinc-800">
            <button 
              onClick={prevPlayer}
              disabled={currentIndex === 0}
              className="p-4 hover:bg-zinc-900 rounded-xl transition-all disabled:opacity-20"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="px-6 text-center">
              <div className="text-[10px] text-zinc-500 font-bold uppercase">Player</div>
              <div className="text-xl font-black italic">{currentIndex + 1} / {poolPlayers.length}</div>
            </div>
            <button 
              onClick={nextPlayer}
              disabled={currentIndex === poolPlayers.length - 1}
              className="p-4 hover:bg-zinc-900 rounded-xl transition-all disabled:opacity-20"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        {currentPlayer ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Current Player Card */}
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="relative h-48 bg-gradient-to-br from-emerald-600/10 to-zinc-900 flex items-center justify-center">
                  <span className="absolute top-6 left-6 px-4 py-2 bg-emerald-500 text-white text-xs font-black rounded-full uppercase tracking-widest shadow-lg">
                    CATEGORY {currentPlayer.category}
                  </span>
                  <div className={`absolute top-6 right-6 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest ${
                    currentPlayer.status === 'sold' ? 'bg-emerald-500/20 text-emerald-500' : 
                    currentPlayer.status === 'unsold' ? 'bg-zinc-800 text-zinc-400' :
                    'bg-yellow-500/20 text-yellow-500'
                  }`}>
                    {currentPlayer.status}
                  </div>
                  <User className="w-24 h-24 text-emerald-500/30" />
                </div>

                <div className="p-10">
                  <div className="flex justify-between items-end mb-10">
                    <div>
                      <h1 className="text-6xl font-black italic tracking-tighter uppercase mb-4 leading-none">{currentPlayer.name}</h1>
                      <p className="text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        {currentPlayer.position}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">Base Price</p>
                      <input 
                        type="number" 
                        value={isNaN(currentPlayer.basePrice) ? '' : currentPlayer.basePrice} 
                        onChange={e => updateBasePrice(e.target.value === '' ? '' as any : parseInt(e.target.value))}
                        className="w-32 p-2 bg-zinc-950 border border-zinc-800 rounded-xl text-3xl font-black italic text-white text-right focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <button 
                      onClick={startAuction}
                      disabled={auctionState?.status === 'active' || currentPlayer.status === 'sold'}
                      className="p-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 text-white rounded-2xl transition-all flex flex-col items-center gap-3"
                    >
                      <Play className="w-8 h-8" />
                      <span className="font-black italic uppercase text-xs">Start</span>
                    </button>
                    <button 
                      onClick={markSold}
                      disabled={!currentPlayer.currentBidderId || currentPlayer.status === 'sold'}
                      className="p-6 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-2xl border border-emerald-500/20 transition-all flex flex-col items-center gap-3"
                    >
                      <CheckCircle className="w-8 h-8" />
                      <span className="font-black italic uppercase text-xs">Sold</span>
                    </button>
                    <button 
                      onClick={markUnsold}
                      disabled={currentPlayer.status === 'sold'}
                      className="p-6 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-2xl transition-all flex flex-col items-center gap-3"
                    >
                      <XCircle className="w-8 h-8" />
                      <span className="font-black italic uppercase text-xs">Unsold</span>
                    </button>
                    <button 
                      onClick={undoLastBid}
                      disabled={currentBids.length === 0}
                      className="p-6 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-500 rounded-2xl border border-yellow-500/20 transition-all flex flex-col items-center gap-3 disabled:opacity-20"
                    >
                      <Undo2 className="w-8 h-8" />
                      <span className="font-black italic uppercase text-xs">Undo</span>
                    </button>
                  </div>

                  {/* Multiplier Settings */}
                  <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-3xl space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="flex flex-col gap-2 w-full md:w-auto">
                        <label className="text-[10px] font-black text-zinc-500 uppercase">Multiplier Unit (₹):</label>
                        <input 
                          type="number" 
                          value={isNaN(multiplierUnit) ? '' : multiplierUnit}
                          onChange={e => setMultiplierUnit(e.target.value === '' ? '' as any : parseInt(e.target.value))}
                          className="w-full md:w-32 p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-black text-emerald-500 focus:border-emerald-500 outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-2 w-full md:w-auto">
                        <label className="text-[10px] font-black text-zinc-500 uppercase">Multiplier:</label>
                        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                          {[1, 2, 5, 10, 20].map(x => (
                            <button
                              key={x}
                              onClick={() => { setActiveMultiplier(x); setCustomBidAmount(''); }}
                              className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${
                                activeMultiplier === x && !customBidAmount ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              {x}X
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 w-full md:w-auto">
                        <label className="text-[10px] font-black text-zinc-500 uppercase">Custom Amount / Override:</label>
                        <input 
                          type="number" 
                          placeholder="Enter exact bid..."
                          value={customBidAmount}
                          onChange={e => setCustomBidAmount(e.target.value)}
                          className="w-full md:w-64 p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-bold text-emerald-500 focus:border-emerald-500 outline-none"
                        />
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-zinc-500 font-black uppercase mb-1">Current Increment</div>
                        <div className="text-2xl font-black text-emerald-500">₹{bidIncrement.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manual Bidding Grid */}
              {auctionState?.status === 'active' && auctionState.currentPlayerId === currentPlayer.id && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
                  <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-emerald-500" />
                    Bidding Teams
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {poolTeams.map(team => {
                      const nextBid = customBidAmount 
                        ? parseInt(customBidAmount) 
                        : (!currentPlayer.currentBidderId ? currentPlayer.basePrice : (currentPlayer.currentBid || currentPlayer.basePrice) + bidIncrement);
                      
                      return (
                        <button 
                          key={team.id}
                          onClick={() => manualBid(team.id)}
                          className="p-4 bg-zinc-950 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl transition-all text-left group"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {team.logo ? <img src={team.logo} className="w-5 h-5 rounded-full" /> : <Users className="w-5 h-5 text-zinc-700" />}
                              <span className="font-bold text-[10px] uppercase truncate">{team.name}</span>
                            </div>
                            <span className={`text-[8px] font-black px-1 rounded ${!currentPlayer.currentBidderId ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-500'}`}>
                              {!currentPlayer.currentBidderId ? 'BASE' : '+INC'}
                            </span>
                          </div>
                          <div className="text-white font-black text-xs mb-1">₹{nextBid.toLocaleString()}</div>
                          <div className="text-zinc-500 font-black text-[10px]">PURSE: ₹{(team.budget / 10000000).toFixed(2)} Cr</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Live Bid History */}
            <div className="lg:col-span-4 space-y-8">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 sticky top-24">
                <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 mb-8">
                  <RefreshCw className="w-6 h-6 text-emerald-500" />
                  Live Bids
                </h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <AnimatePresence mode="popLayout">
                    {currentBids.map((bid, i) => {
                      const team = teams.find(t => t.id === bid.teamId);
                      return (
                        <motion.div
                          key={bid.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`p-4 rounded-2xl border ${i === 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-zinc-950 border-zinc-800'}`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              {team?.logo && <img src={team.logo} className="w-6 h-6 rounded-full" />}
                              <span className="font-bold text-sm uppercase">{team?.name}</span>
                            </div>
                            <span className={`font-black ${i === 0 ? 'text-emerald-500' : 'text-zinc-500'}`}>₹{bid.amount.toLocaleString()}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {currentBids.length === 0 && (
                    <div className="text-center py-10 text-zinc-700 font-bold uppercase tracking-widest border border-dashed border-zinc-800 rounded-2xl">
                      No Bids Yet
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="text-center py-24 bg-zinc-900/50 border border-zinc-800 border-dashed rounded-3xl">
            <Users className="w-16 h-16 text-zinc-800 mx-auto mb-6" />
            <h3 className="text-2xl font-black italic tracking-tighter uppercase text-zinc-500">No Players in this Pool</h3>
            <p className="text-zinc-600 mt-2">Add players to the selected tournament pool from the Admin Dashboard.</p>
          </div>
        )}

      </div>
    </div>
  );
};
