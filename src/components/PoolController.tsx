import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Key, LogIn, Users, UserPlus, Trophy, Gavel, Play, CheckCircle, 
  XCircle, TrendingUp, RefreshCw, ArrowLeft, ArrowRight, User as UserIcon, Trash2, Undo2,
  Tv, Copy
} from 'lucide-react';
import { rtdb } from '../firebase';
import { ref, onValue, update, push, set, get, serverTimestamp } from 'firebase/database';
import { Player, Team, Bid, AuctionState, OperationType, Tournament } from '../types';
import { handleDatabaseError } from '../services/errorService';

export const PoolController = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activePool, setActivePool] = useState<Tournament | null>(null);
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [multiplierUnit, setMultiplierUnit] = useState(1000); // 1X = 1000
  const [activeMultiplier, setActiveMultiplier] = useState(1); // Default 1X
  const [customBidAmount, setCustomBidAmount] = useState<string>('');

  // Computed values
  const poolPlayers = players.filter(p => p.status === 'unsold' || p.status === 'current');
  const activePlayer = poolPlayers[currentIndex];
  const currentBids = bids.filter(b => b.playerId === activePlayer?.id).sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);

  const bidIncrement = multiplierUnit * activeMultiplier;

  const [newPlayer, setNewPlayer] = useState({
    name: '',
    category: 'None' as any,
    position: 'Raider',
    basePrice: '' as any,
    stats: { matches: 0, raidPoints: 0, tacklePoints: 0 }
  });

  const [newTeam, setNewTeam] = useState({
    name: '',
    logo: '',
    budget: '' as any
  });

  // Pre-fill pool ID from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pool = params.get('pool');
    if (pool) setLoginId(pool);
  }, []);

  // 1. Authorization Check
  const handleLogin = async () => {
    // Try direct lookup first
    const poolRef = ref(rtdb, `tournaments/${loginId}`);
    const snapshot = await get(poolRef);
    const pool = snapshot.val() as Tournament;

    if (pool && String(pool.password) === password) {
      setActivePool({ id: loginId, ...pool });
      setNewTeam(prev => ({ ...prev, budget: pool.initialPurse }));
      setIsAuthorized(true);
      return;
    }

    // If direct lookup fails, search for matching ID prefix (for short IDs shown in UI)
    const allPoolsRef = ref(rtdb, 'tournaments');
    const allPoolsSnap = await get(allPoolsRef);
    const allPools = allPoolsSnap.val();

    if (allPools) {
      const match = Object.entries(allPools).find(([id, val]: [string, any]) => 
        (id === loginId || id.startsWith(loginId)) && String(val.password) === password
      );

      if (match) {
        const p = match[1] as Tournament;
        setActivePool({ id: match[0], ...p });
        setNewTeam(prev => ({ ...prev, budget: p.initialPurse }));
        setIsAuthorized(true);
        return;
      }
    }

    alert("Invalid Pool ID or Password");
  };

  // 2. Data Listeners (only if authorized)
  useEffect(() => {
    if (!isAuthorized || !activePool) return;

    const unsubPlayers = onValue(ref(rtdb, `tournaments/${activePool.id}/players`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPlayers(Object.entries(data).map(([id, val]) => ({ id, ...(val as any) } as Player)));
      } else {
        setPlayers([]);
      }
    });

    const unsubTeams = onValue(ref(rtdb, `tournaments/${activePool.id}/teams`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTeams(Object.entries(data).map(([id, val]) => ({ id, ...(val as any) } as Team)));
      } else {
        setTeams([]);
      }
    });

    const unsubState = onValue(ref(rtdb, `tournaments/${activePool.id}/auctionState`), (snapshot) => {
      setAuctionState(snapshot.val() as AuctionState);
    });

    const unsubBids = onValue(ref(rtdb, `tournaments/${activePool.id}/bids`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBids(Object.entries(data).map(([id, val]) => ({ id, ...(val as any) } as Bid)));
      } else {
        setBids([]);
      }
    });

    return () => {
      unsubPlayers();
      unsubTeams();
      unsubState();
      unsubBids();
    };
  }, [isAuthorized, activePool]);

  // Sync Multiplier Unit to Base Price
  useEffect(() => {
    if (activePlayer?.basePrice) {
      setMultiplierUnit(activePlayer.basePrice);
    }
  }, [activePlayer?.id, activePlayer?.basePrice]);

  // 3. Actions
  const addPlayer = async () => {
    if (!activePool) return;
    try {
      const newPlayerRef = push(ref(rtdb, `tournaments/${activePool.id}/players`));
      await set(newPlayerRef, {
        ...newPlayer,
        basePrice: parseInt(newPlayer.basePrice) || 0,
        tournamentId: activePool.id,
        currentBid: 0,
        currentBidderId: null,
        status: 'unsold',
        teamId: null
      });
      setNewPlayer({ name: '', category: 'None' as any, position: 'Raider', basePrice: '' as any, stats: { matches: 0, raidPoints: 0, tacklePoints: 0 } });
    } catch (err) {
      handleDatabaseError(err, OperationType.CREATE, `tournaments/${activePool.id}/players`);
    }
  };

  const addTeam = async () => {
    if (!activePool) return;
    try {
      const adTeams = teams.filter(t => t.ownerId && t.ownerId.startsWith('AD'));
      let nextId = 'AD01';
      if (adTeams.length > 0) {
        const ids = adTeams.map(t => parseInt(t.ownerId.substring(2))).filter(n => !isNaN(n));
        if (ids.length > 0) {
          nextId = `AD${(Math.max(...ids) + 1).toString().padStart(2, '0')}`;
        }
      }

      const newTeamRef = push(ref(rtdb, `tournaments/${activePool.id}/teams`));
      const teamId = newTeamRef.key;
      const updates: any = {};
      updates[`tournaments/${activePool.id}/teams/${teamId}`] = {
        ...newTeam,
        budget: parseInt(newTeam.budget) || activePool.initialPurse || 0,
        tournamentId: activePool.id,
        ownerId: nextId,
        totalPlayers: 0
      };
      updates[`users/${nextId}`] = {
        name: `Owner ${nextId}`,
        email: `owner${nextId.toLowerCase()}@example.com`,
        role: 'viewer',
        tournamentId: activePool.id,
        teamId: teamId,
        createdAt: serverTimestamp()
      };
      await update(ref(rtdb), updates);
      setNewTeam({ name: '', logo: '', budget: '' as any });
    } catch (err) {
      handleDatabaseError(err, OperationType.CREATE, `tournaments/${activePool.id}/teams`);
    }
  };

  const startAuction = async (player: Player) => {
    if (!activePool) return;
    try {
      const updates: any = {};
      updates[`tournaments/${activePool.id}/auctionState/status`] = 'active';
      updates[`tournaments/${activePool.id}/auctionState/currentPlayerId`] = player.id;
      updates[`tournaments/${activePool.id}/auctionState/timer`] = 60;
      updates[`tournaments/${activePool.id}/players/${player.id}/status`] = 'current';
      await update(ref(rtdb), updates);
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${activePool.id}/auctionState`);
    }
  };

  const updateBasePrice = async (newPrice: number) => {
    if (!activePool || !activePlayer) return;
    try {
      await update(ref(rtdb, `tournaments/${activePool.id}/players/${activePlayer.id}`), {
        basePrice: newPrice
      });
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, 'basePrice');
    }
  };

  const manualBid = async (teamId: string, player: Player) => {
    if (!activePool) return;
    const team = teams.find(t => t.id === teamId);
    if (!team || !player) return;

    let nextBid: number;
    const custom = parseInt(customBidAmount);
    if (!isNaN(custom) && custom > 0) {
      nextBid = custom;
    } else {
      nextBid = !player.currentBidderId ? player.basePrice : (player.currentBid || player.basePrice) + bidIncrement;
    }

    // 1. Check Purse Value (Budget)
    if (nextBid > team.budget) {
      alert(`Insufficient budget! Team ${team.name} has only ₹${team.budget.toLocaleString()} left.`);
      return;
    }

    // 2. Check Next Bid Value
    if (!player.currentBidderId) {
      // First bid must be at least base price
      if (nextBid < player.basePrice) {
        alert(`First bid must be at least the Base Price (₹${player.basePrice.toLocaleString()})!`);
        return;
      }
    } else {
      // Next bid must be strictly higher than current bid
      if (nextBid <= player.currentBid) {
        alert(`Next bid must be higher than current bid (₹${player.currentBid.toLocaleString()})!`);
        return;
      }
    }

    try {
      const bidRef = push(ref(rtdb, `tournaments/${activePool.id}/bids`));
      const updates: any = {};
      updates[`tournaments/${activePool.id}/players/${player.id}/currentBid`] = nextBid;
      updates[`tournaments/${activePool.id}/players/${player.id}/currentBidderId`] = teamId;
      updates[`tournaments/${activePool.id}/bids/${bidRef.key}`] = {
        playerId: player.id,
        teamId,
        amount: nextBid,
        timestamp: serverTimestamp()
      };
      await update(ref(rtdb), updates);
      setCustomBidAmount(''); // Reset after success
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${activePool.id}/bids`);
    }
  };

  const markSold = async (player: Player) => {
    if (!player.currentBidderId || !activePool) return;
    try {
      const team = teams.find(t => t.id === player.currentBidderId);
      if (!team) return;
      const updates: any = {};
      updates[`tournaments/${activePool.id}/players/${player.id}/status`] = 'sold';
      updates[`tournaments/${activePool.id}/players/${player.id}/teamId`] = team.id;
      updates[`tournaments/${activePool.id}/teams/${team.id}/budget`] = team.budget - player.currentBid;
      updates[`tournaments/${activePool.id}/teams/${team.id}/totalPlayers`] = team.totalPlayers + 1;
      updates[`tournaments/${activePool.id}/auctionState/status`] = 'idle';
      updates[`tournaments/${activePool.id}/auctionState/currentPlayerId`] = null;
      await update(ref(rtdb), updates);
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${activePool.id}/players`);
    }
  };

  const markUnsold = async (player: Player) => {
    if (!activePool) return;
    try {
      const updates: any = {};
      updates[`tournaments/${activePool.id}/players/${player.id}/status`] = 'unsold';
      updates[`tournaments/${activePool.id}/players/${player.id}/currentBid`] = 0;
      updates[`tournaments/${activePool.id}/players/${player.id}/currentBidderId`] = null;
      updates[`tournaments/${activePool.id}/auctionState/status`] = 'idle';
      updates[`tournaments/${activePool.id}/auctionState/currentPlayerId`] = null;
      await update(ref(rtdb), updates);
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${activePool.id}/players`);
    }
  };

  const undoLastBid = async (player: Player) => {
    if (!activePool || !player.id) return;
    
    // Get all bids for this player
    const playerBids = bids
      .filter(b => b.playerId === player.id)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (playerBids.length === 0) {
      alert("No bids to undo!");
      return;
    }

    try {
      const lastBid = playerBids[0];
      const previousBid = playerBids[1]; // Might be undefined if only one bid exists

      const updates: any = {};
      
      // Remove the last bid
      updates[`tournaments/${activePool.id}/bids/${lastBid.id}`] = null;

      // Revert player state
      if (previousBid) {
        updates[`tournaments/${activePool.id}/players/${player.id}/currentBid`] = previousBid.amount;
        updates[`tournaments/${activePool.id}/players/${player.id}/currentBidderId`] = previousBid.teamId;
      } else {
        updates[`tournaments/${activePool.id}/players/${player.id}/currentBid`] = 0;
        updates[`tournaments/${activePool.id}/players/${player.id}/currentBidderId`] = null;
      }

      await update(ref(rtdb), updates);
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${activePool.id}/bids`);
    }
  };

  const copyToClipboard = (text: string, message: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert(message);
      }).catch(() => {
        fallbackCopy(text, message);
      });
    } else {
      fallbackCopy(text, message);
    }
  };

  const fallbackCopy = (text: string, message: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      alert(message);
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  // Login View
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-8"
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
              <Key className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">Pool Access</h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Enter credentials for your auction pool</p>
          </div>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Pool ID (e.g. -OoAEJWR)" 
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-emerald-500 outline-none transition-all text-white font-bold"
            />
            <input 
              type="password" 
              placeholder="Pool Password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-emerald-500 outline-none transition-all text-white font-bold"
            />
            <button 
              onClick={handleLogin}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black italic rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" /> ACCESS POOL
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Authorized Dashboard
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pt-24 pb-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase text-emerald-500">{activePool?.name}</h2>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Pool Controller ID: {activePool?.id}</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => copyToClipboard(`${window.location.origin}${window.location.pathname}?view=led&pool=${activePool?.id}`, "LED Display link copied!")}
                    className="flex items-center gap-1.5 px-2 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded text-[10px] font-black transition-all border border-emerald-500/20"
                  >
                    <Tv className="w-3 h-3" /> COPY LED LINK
                  </button>
                  <button 
                    onClick={() => copyToClipboard(`${window.location.origin}${window.location.pathname}?view=pool&pool=${activePool?.id}`, "Pool Controller link copied!")}
                    className="flex items-center gap-1.5 px-2 py-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 rounded text-[10px] font-black transition-all border border-blue-500/20"
                  >
                    <Key className="w-3 h-3" /> COPY POOL LINK
                  </button>
                </div>
              </div>
          </div>
          <button onClick={() => setIsAuthorized(false)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold">LOGOUT</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 1. Controller Section */}
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black italic uppercase flex items-center gap-2"><Gavel className="text-emerald-500" /> Auction Controller</h3>
                <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                  <button onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)} className="p-2 hover:bg-zinc-900 rounded-md disabled:opacity-20" disabled={currentIndex === 0}><ArrowLeft className="w-4 h-4" /></button>
                  <span className="text-xs font-bold px-2">{currentIndex + 1} / {poolPlayers.length}</span>
                  <button onClick={() => currentIndex < poolPlayers.length - 1 && setCurrentIndex(currentIndex + 1)} className="p-2 hover:bg-zinc-900 rounded-md disabled:opacity-20" disabled={currentIndex === poolPlayers.length - 1}><ArrowRight className="w-4 h-4" /></button>
                </div>
              </div>

              {activePlayer ? (
                <div className="space-y-6">
                  <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-2xl">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-3xl font-black italic tracking-tighter uppercase text-white">{activePlayer.name}</h4>
                        <p className="text-[10px] font-black text-emerald-500 uppercase">{activePlayer.category} • {activePlayer.position}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Base Price</p>
                        <input 
                          type="number" 
                          value={activePlayer.basePrice} 
                          onChange={e => updateBasePrice(parseInt(e.target.value) || 0)}
                          className="w-24 p-2 bg-zinc-950 border border-zinc-800 rounded text-xl font-black text-white text-right focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <button onClick={() => startAuction(activePlayer)} disabled={auctionState?.status === 'active'} className="py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"><Play className="w-4 h-4" /> START</button>
                      <button onClick={() => markSold(activePlayer)} disabled={!activePlayer.currentBidderId} className="py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-emerald-500/20"><CheckCircle className="w-4 h-4" /> SOLD</button>
                      <button onClick={() => markUnsold(activePlayer)} className="py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"><XCircle className="w-4 h-4" /> UNSOLD</button>
                      <button 
                        onClick={() => undoLastBid(activePlayer)} 
                        disabled={bids.filter(b => b.playerId === activePlayer.id).length === 0}
                        className="py-3 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-500 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-yellow-500/20 disabled:opacity-20"
                      >
                        <Undo2 className="w-4 h-4" /> UNDO BID
                      </button>
                    </div>

                    <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col gap-1">
                          <p className="text-[10px] text-zinc-500 font-bold uppercase">Multiplier Unit (₹)</p>
                          <input 
                            type="number" 
                            value={multiplierUnit}
                            onChange={e => setMultiplierUnit(parseInt(e.target.value) || 0)}
                            className="w-24 p-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] font-black text-emerald-500 outline-none focus:border-emerald-500"
                          />
                        </div>
                        <p className="text-[10px] text-emerald-500 font-black italic">Current Increment: ₹{bidIncrement.toLocaleString()}</p>
                      </div>
                      
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 flex flex-col gap-1">
                            <label className="text-[8px] font-black text-zinc-500 uppercase">Multipliers:</label>
                            <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 h-[38px]">
                              {[1, 2, 5, 10, 20].map(x => (
                                <button 
                                  key={x} 
                                  onClick={() => { setActiveMultiplier(x); setCustomBidAmount(''); }} 
                                  className={`flex-1 rounded text-[10px] font-black transition-all ${activeMultiplier === x && !customBidAmount ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                  {x}X
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                          <label className="text-[8px] font-black text-zinc-500 uppercase">Custom Bid / Override:</label>
                          <input 
                            type="number" 
                            placeholder="Enter exact bid amount to bypass increments"
                            value={customBidAmount}
                            onChange={e => setCustomBidAmount(e.target.value)}
                            className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-emerald-500 focus:border-emerald-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {auctionState?.status === 'active' && auctionState.currentPlayerId === activePlayer.id && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {teams.map(t => {
                        const nextBid = customBidAmount 
                          ? parseInt(customBidAmount) 
                          : (!activePlayer.currentBidderId ? activePlayer.basePrice : activePlayer.currentBid + bidIncrement);
                        
                        return (
                          <button 
                            key={t.id} 
                            onClick={() => manualBid(t.id, activePlayer)} 
                            className="p-3 bg-zinc-950 border border-zinc-800 hover:border-emerald-500/50 rounded-xl transition-all text-left group"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-[10px] font-bold uppercase truncate max-w-[80px]">{t.name}</p>
                              <p className={`text-[8px] font-black px-1 rounded ${!activePlayer.currentBidderId ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                {!activePlayer.currentBidderId ? 'BASE' : '+INC'} ₹{nextBid.toLocaleString()}
                              </p>
                            </div>
                            <p className="text-zinc-500 font-black text-[10px]">PURSE: ₹{(t.budget/10000000).toFixed(2)}Cr</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-20 text-center text-zinc-500 uppercase font-black tracking-widest text-xs border border-dashed border-zinc-800 rounded-2xl">All players auctioned</div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <h3 className="text-lg font-black italic uppercase flex items-center gap-2 mb-6"><TrendingUp className="text-emerald-500" /> Recent Bids</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {currentBids.map((bid, i) => (
                  <div key={bid.id} className={`flex justify-between p-3 rounded-xl border ${i === 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-zinc-950 border-zinc-800'}`}>
                    <span className="font-bold text-xs uppercase">{teams.find(t => t.id === bid.teamId)?.name}</span>
                    <span className="font-black text-emerald-500 text-xs">₹{bid.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Management Section */}
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <h3 className="text-lg font-black italic uppercase flex items-center gap-2 mb-6"><UserPlus className="text-emerald-500" /> Add Player</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Name" value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs" />
                <div className="grid grid-cols-2 gap-4">
                  <select value={newPlayer.category} onChange={e => setNewPlayer({...newPlayer, category: e.target.value as any})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs">
                    <option value="None">Category None</option>
                    <option value="A">A</option><option value="B">B</option><option value="C">C</option>
                  </select>
                  <select value={newPlayer.position} onChange={e => setNewPlayer({...newPlayer, position: e.target.value as any})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs">
                    <option value="Raider">Raider</option><option value="Defender">Defender</option><option value="All-rounder">All-rounder</option>
                  </select>
                </div>
                <input type="number" placeholder="Base Price" value={newPlayer.basePrice} onChange={e => setNewPlayer({...newPlayer, basePrice: parseInt(e.target.value)})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs" />
                <button onClick={addPlayer} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs">ADD PLAYER</button>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <h3 className="text-lg font-black italic uppercase flex items-center gap-2 mb-6"><Users className="text-emerald-500" /> Add Team</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Team Name" value={newTeam.name} onChange={e => setNewTeam({...newTeam, name: e.target.value})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Team Purse Value" value={newTeam.budget} onChange={e => setNewTeam({...newTeam, budget: e.target.value})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs" />
                  <input type="text" placeholder="Logo URL" value={newTeam.logo} onChange={e => setNewTeam({...newTeam, logo: e.target.value})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs" />
                </div>
                <button onClick={addTeam} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs">ADD TEAM</button>
              </div>
            </div>
          </div>
        </div>

        {/* Player List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <h3 className="text-lg font-black italic uppercase mb-6">Pool Player List</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {players.map(p => (
              <div key={p.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex justify-between items-center">
                <div>
                  <p className="font-bold text-xs uppercase">{p.name}</p>
                  <p className="text-[8px] text-zinc-500 font-bold uppercase">{p.status} • ₹{p.basePrice.toLocaleString()}</p>
                </div>
                <button onClick={async () => window.confirm('Delete?') && set(ref(rtdb, `players/${p.id}`), null)} className="p-2 text-zinc-800 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
