import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gavel, Users, User, Trophy, Zap, XCircle } from 'lucide-react';
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

  const UnsoldListView = () => {
    const unsoldPlayers = players.filter(p => p.status === 'unsold');

    return (
      <div className="h-screen w-screen bg-black p-[3vw] flex flex-col gap-[2vh] overflow-hidden">
        <div className="flex justify-between items-center mb-[2vh]">
          <h1 className="text-[6vh] font-black italic uppercase text-red-500 tracking-tighter flex items-center gap-4">
            <XCircle className="w-[6vh] h-[6vh]" /> UNSOLD PLAYERS
          </h1>
          <div className="bg-red-500/10 px-6 py-2 border border-red-500/30 rounded-xl">
            <p className="text-red-500 text-[1.2vh] font-black uppercase tracking-widest mb-1">Total Unsold</p>
            <p className="text-[3.5vh] font-black text-white">{unsoldPlayers.length} Players</p>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-4 gap-[2vh] h-full auto-rows-max overflow-y-auto pr-2 custom-scrollbar">
            {unsoldPlayers.length > 0 ? (
              unsoldPlayers.map((p, idx) => (
                <motion.div 
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-zinc-900/50 border-2 border-zinc-800 rounded-[2vh] p-[2vh] flex items-center gap-[2vh] group hover:border-red-500/50 transition-all duration-300"
                >
                  {p.image ? (
                    <div className="w-[10vh] h-[10vh] rounded-[1.5vh] border-2 border-zinc-800 group-hover:border-red-500/30 overflow-hidden bg-zinc-950 flex-shrink-0">
                      <img src={p.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <div className="w-[10vh] h-[10vh] rounded-[1.5vh] border-2 border-zinc-800 flex items-center justify-center bg-zinc-950 flex-shrink-0">
                      <User className="w-[5vh] h-[5vh] text-zinc-800" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-red-500 text-[1vh] font-black uppercase tracking-widest mb-1">{p.position}</div>
                    <div className="text-[2.5vh] font-black text-white uppercase tracking-tighter truncate leading-none mb-2">{p.name}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 text-[1vh] font-black uppercase tracking-widest">Base Price</span>
                      <span className="text-[1.8vh] font-black text-zinc-300">{p.basePrice.toLocaleString()}</span>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-4 h-full flex flex-col items-center justify-center text-zinc-700 gap-4">
                <Gavel className="w-20 h-20 opacity-20" />
                <p className="text-2xl font-black uppercase italic tracking-widest">No Unsold Players Yet</p>
              </div>
            )}
          </div>
        </div>

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 8px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
        `}</style>
      </div>
    );
  };

  const TeamListView = () => {
    const tournament = tournaments.find(t => t.id === selectedPoolId);
    const initialPurse = tournament?.initialPurse || 50000000;

    return (
      <div className="h-screen w-screen bg-black p-[3vw] flex flex-col gap-[1vh] overflow-hidden">
        <div className="flex justify-between items-center mb-[2vh]">
          <h1 className="text-[6vh] font-black italic uppercase text-emerald-500 tracking-tighter">TEAM STANDINGS</h1>
          <div className="text-right">
            <p className="text-zinc-500 text-[1.2vh] font-black uppercase tracking-widest mb-1">Initial Purse</p>
            <p className="text-[3.5vh] font-black text-white">{initialPurse.toLocaleString()} Points</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 border-t-4 border-emerald-500">
          {/* List Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-zinc-900/80 text-[1.5vh] font-black uppercase tracking-widest text-zinc-500 sticky top-0 z-10 border-b border-zinc-800">
            <div className="col-span-1">Logo</div>
            <div className="col-span-4">Team Name</div>
            <div className="col-span-2 text-center">Players</div>
            <div className="col-span-2 text-right">Spent</div>
            <div className="col-span-3 text-right text-emerald-500">Remaining Purse</div>
          </div>

          {/* List Rows - Distributed to fit screen */}
          <div className="flex-1 flex flex-col min-h-0">
            {teams.sort((a,b) => b.budget - a.budget).map((team, index) => {
              const squad = players.filter(p => p.teamId === team.id);
              const spent = squad.reduce((sum, p) => sum + (p.currentBid || 0), 0);
              
              return (
                <motion.div 
                  key={team.id}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex-1 grid grid-cols-12 gap-4 items-center px-6 border-b border-zinc-800/50 bg-zinc-900/20 hover:bg-emerald-500/5 transition-colors min-h-0"
                >
                  <div className="col-span-1">
                    <div className="w-[6vh] h-[6vh] bg-white rounded-lg p-1 flex-shrink-0 shadow-xl">
                      {team.logo ? (
                        <img src={team.logo} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <Trophy className="w-full h-full text-emerald-500" />
                      )}
                    </div>
                  </div>
                  <div className="col-span-4">
                    <h2 className="text-[3.8vh] font-black text-white uppercase italic leading-none truncate">{team.name}</h2>
                  </div>
                  <div className="col-span-2 text-center">
                    <div className="text-[2.8vh] font-black text-zinc-400 italic">
                      {squad.length} <span className="text-[1.2vh] text-zinc-600 not-italic ml-1">PLAYERS</span>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="text-[3vh] font-black text-red-500 tabular-nums">{spent.toLocaleString()}</div>
                  </div>
                  <div className="col-span-3 text-right">
                    <div className="text-[4.5vh] font-black text-emerald-500 tabular-nums leading-none drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                      {team.budget.toLocaleString()}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const TeamSquadView = () => {
    const team = teams.find(t => t.id === auctionState?.selectedTeamId);
    if (!team) return null;

    const tournament = tournaments.find(t => t.id === selectedPoolId);
    const initialPurse = tournament?.initialPurse || 50000000;
    const squad = players.filter(p => p.teamId === team.id);
    const maxPlayers = 12;
    const remainingPlayers = maxPlayers - squad.length;

    return (
      <div className="h-screen w-screen bg-black p-[4vw] flex flex-col gap-[4vh] overflow-hidden bg-gradient-to-br from-emerald-950/20 to-black">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-[3vw]">
            <div className="w-[15vh] h-[15vh] bg-white rounded-[2vh] p-2 shadow-2xl overflow-hidden flex-shrink-0 border-4 border-emerald-500">
              {team.logo ? (
                <img src={team.logo} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <Trophy className="w-full h-full text-emerald-500 p-4" />
              )}
            </div>
            <div>
              <p className="text-emerald-500 text-[2vh] font-black uppercase tracking-[0.5em] mb-1 italic">Squad List</p>
              <h1 className="text-[10vh] font-black text-white uppercase italic leading-none tracking-tighter drop-shadow-2xl">
                {team.name}
              </h1>
            </div>
          </div>

          <div className="flex gap-[2vw]">
            <div className="bg-zinc-900/80 px-[3vw] py-[2vh] rounded-[3vh] border-2 border-zinc-800 text-center">
              <p className="text-zinc-500 text-[1.2vh] font-black uppercase tracking-widest mb-1">Players</p>
              <p className="text-[4vh] font-black text-white leading-none italic">{squad.length} / {maxPlayers}</p>
              <p className="text-[1.2vh] text-emerald-500 font-bold uppercase mt-1">Remaining: {remainingPlayers}</p>
            </div>
            <div className="bg-zinc-900/80 px-[3vw] py-[2vh] rounded-[3vh] border-2 border-zinc-800 text-center">
              <p className="text-zinc-500 text-[1.2vh] font-black uppercase tracking-widest mb-1">Purse Left</p>
              <p className="text-[4vh] font-black text-emerald-500 leading-none tabular-nums italic">{team.budget.toLocaleString()}</p>
              <p className="text-[1.2vh] text-zinc-600 font-bold uppercase mt-1">Initial: {initialPurse.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[2vw] overflow-y-auto pr-4 custom-scrollbar">
          {squad.map((player, idx) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-zinc-900/40 border-2 border-zinc-800/50 rounded-[2.5vh] p-[2vh] flex items-center gap-[1.5vw] relative overflow-hidden group hover:border-emerald-500/50 transition-all"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <div className="w-[8vh] h-[8vh] bg-zinc-950 rounded-full border-2 border-zinc-800 overflow-hidden flex-shrink-0">
                {player.image ? (
                  <img src={player.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-full h-full text-zinc-700 p-3" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[2.2vh] font-black text-white uppercase truncate leading-tight italic">{player.name}</p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[1.2vh] font-black text-zinc-500 uppercase tracking-widest">{player.category} • {player.position}</span>
                  <span className="text-[1.8vh] font-black text-emerald-500 italic">{(player.currentBid || 0).toLocaleString()}</span>
                </div>
              </div>
            </motion.div>
          ))}
          
          {/* Empty slots placeholders */}
          {[...Array(remainingPlayers > 0 ? remainingPlayers : 0)].map((_, i) => (
            <div key={`empty-${i}`} className="border-2 border-dashed border-zinc-900 rounded-[2.5vh] p-[2vh] flex items-center justify-center opacity-30">
              <span className="text-[1.5vh] font-black text-zinc-800 uppercase tracking-widest">Available Slot {squad.length + i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

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

  // TEAM LIST VIEW
  if (auctionState?.viewMode === 'teams') {
    return <TeamListView />;
  }

  // TEAM SQUAD VIEW
  if (auctionState?.viewMode === 'team-squad') {
    return <TeamSquadView />;
  }

  // UNSOLD LIST VIEW
  if (auctionState?.viewMode === 'unsold') {
    return <UnsoldListView />;
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
          {/* Left Side: Player Image & Name & Details */}
          <motion.div 
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex flex-col justify-center gap-[4vh] border-r border-white/10 pr-[4vw]"
          >
            <div className="flex items-center gap-8">
              {lastCompletedPlayer.image && (
                <div className="w-[30vh] h-[30vh] bg-zinc-900 rounded-[4vh] border-4 border-white/10 overflow-hidden flex-shrink-0">
                  <img src={lastCompletedPlayer.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              )}
              <div className="space-y-[2vh]">
                <p className="text-[4vh] text-zinc-500 font-black uppercase tracking-[0.5em] italic">
                  {lastCompletedPlayer.position} • {lastCompletedPlayer.category}
                </p>
                <h1 className="text-[12vh] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-2xl italic">
                  {lastCompletedPlayer.name}
                </h1>
              </div>
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
                    {lastCompletedPlayer.currentBid?.toLocaleString()} Points
                  </div>
                </div>
              </div>
            )}

            {!isSold && (
              <div className="bg-zinc-900/60 px-[8vw] py-[6vh] rounded-[4vh] border-4 border-red-500/20 backdrop-blur-3xl w-full">
                <p className="text-red-500/40 text-[5vh] font-black uppercase tracking-[0.8em] italic">NO BIDS</p>
                <div className="mt-4 text-zinc-500 text-2xl font-black uppercase tracking-widest">
                  Base Price: {lastCompletedPlayer.basePrice?.toLocaleString()} Points
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white p-[2vw] flex flex-col overflow-hidden relative">
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

      <div className="flex-1 flex flex-col justify-center w-full max-w-full mx-auto">
        {currentPlayer ? (
          <div className="grid grid-cols-12 gap-[4vw] h-full items-center">
            
            {/* Player Info (Left) */}
            <div className="col-span-7 flex flex-col justify-center space-y-[4vh]">
              <motion.div 
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-[4vh]"
              >
                <div className="flex items-center gap-[4vw]">
                  {currentPlayer.image && (
                    <div className="w-[45vh] h-[45vh] bg-zinc-900 rounded-[4vh] border-8 border-white/10 overflow-hidden flex-shrink-0 shadow-[0_0_80px_rgba(0,0,0,0.8)]">
                      <img src={currentPlayer.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div className="flex-1 space-y-[2vh]">
                    <div className="flex items-center gap-[2vw]">
                      <span className="px-[3vw] py-[1.5vh] bg-emerald-600 text-white text-[4vh] font-black rounded-full uppercase italic shadow-[0_0_40px_rgba(16,185,129,0.4)]">
                        CATEGORY {currentPlayer.category}
                      </span>
                      <span className="px-[3vw] py-[1.5vh] bg-zinc-900 text-zinc-400 text-[4vh] font-black rounded-full uppercase italic border-2 border-zinc-800">
                        {currentPlayer.position}
                      </span>
                    </div>
                    
                    <h1 className="text-[14vh] font-black italic tracking-tighter uppercase leading-[0.8] text-white drop-shadow-2xl">
                      {currentPlayer.name}
                    </h1>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Bid Info (Right) */}
            <div className="col-span-5 flex flex-col gap-[4vh] justify-center h-full">
              {/* Status Header */}
              <div className="text-center">
                <div className={`inline-block px-[4vw] py-[2vh] rounded-full text-[4vh] font-black uppercase tracking-[0.3em] mb-[2vh] border-4 ${
                  currentPlayer.status === 'sold' ? 'bg-emerald-600 border-emerald-400 shadow-[0_0_60px_rgba(16,185,129,0.6)]' : 
                  currentPlayer.status === 'unsold' ? 'bg-zinc-800 border-zinc-700 text-zinc-500' :
                  'bg-yellow-500 border-yellow-400 text-black shadow-[0_0_60px_rgba(234,179,8,0.6)]'
                }`}>
                  {currentPlayer.status === 'current' ? 'BIDDING LIVE' : currentPlayer.status.toUpperCase()}
                </div>
              </div>

              {/* Price Display */}
              <motion.div 
                key={currentPlayer.currentBid || currentPlayer.basePrice}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-zinc-900/80 backdrop-blur-3xl rounded-[6vh] p-[6vh] border-8 border-emerald-500/50 flex flex-col items-center justify-center shadow-[0_40px_100px_rgba(0,0,0,0.8),inset_0_0_80px_rgba(0,0,0,0.6)]"
              >
                <p className="text-zinc-500 text-[3vh] font-black uppercase mb-[1vh] tracking-[0.5em] italic">
                  {currentPlayer.currentBidderId ? 'CURRENT BID' : 'BASE PRICE'}
                </p>
                <div className="text-[16vh] font-black italic text-emerald-500 leading-none drop-shadow-[0_0_60px_rgba(16,185,129,0.6)] tracking-tighter">
                  {(currentPlayer.currentBid || currentPlayer.basePrice).toLocaleString()}
                </div>
                <p className="text-emerald-500/50 text-[4vh] font-black uppercase tracking-[0.2em] mt-[1vh]">POINTS</p>
              </motion.div>

              {/* Current Bidder */}
              <AnimatePresence mode="wait">
                {currentBidder ? (
                  <motion.div 
                    key={currentBidder.id}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    className="flex items-center justify-center gap-[3vw] bg-zinc-900/60 backdrop-blur-2xl p-[3vh] rounded-[4vh] border-4 border-emerald-500/30 shadow-2xl"
                  >
                    <div className="w-[15vh] h-[15vh] bg-white rounded-[3vh] p-[1vh] shadow-2xl overflow-hidden flex-shrink-0 border-4 border-emerald-500">
                      {currentBidder.logo ? (
                        <img src={currentBidder.logo} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <Users className="w-full h-full text-emerald-500 p-[2vh]" />
                      )}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-emerald-500 text-[2vh] font-black uppercase tracking-[0.5em] mb-[0.5vh] opacity-60">LEADING BIDDER</p>
                      <h2 className="text-[7vh] font-black text-white uppercase italic leading-none truncate tracking-tighter">
                        {currentBidder.name}
                      </h2>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex items-center justify-center h-[20vh] border-4 border-dashed border-zinc-800 rounded-[4vh]">
                    <p className="text-zinc-700 text-[4vh] font-black uppercase tracking-[1em] italic">Awaiting Bids</p>
                  </div>
                )}
              </AnimatePresence>

              {/* Recent Bids Ticker for LED */}
              <div className="bg-zinc-900/50 rounded-[4vh] p-[3vh] border-4 border-zinc-800/50 flex-1 min-h-0 overflow-hidden">
                <p className="text-zinc-500 text-[2vh] font-black uppercase tracking-[0.5em] mb-[2vh] italic">LATEST BIDS</p>
                <div className="space-y-[1vh] overflow-hidden h-full">
                  <AnimatePresence mode="popLayout">
                    {bids
                      .filter(b => b.playerId === currentPlayer.id)
                      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                      .slice(0, 5)
                      .map((bid, i) => {
                        const bidder = teams.find(t => t.id === bid.teamId);
                        return (
                          <motion.div
                            key={bid.id}
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className={`flex justify-between items-center px-[2vw] py-[1.5vh] rounded-[2vh] border-2 ${
                              i === 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-950/50 border-zinc-800/50'
                            }`}
                          >
                            <span className={`text-[3.5vh] font-black uppercase italic tracking-tighter truncate ${
                              i === 0 ? 'text-white' : 'text-zinc-400'
                            }`}>
                              {bidder?.name || 'Unknown'}
                            </span>
                            <span className={`text-[4vh] font-black tabular-nums ${
                              i === 0 ? 'text-emerald-500' : 'text-zinc-500'
                            }`}>
                              {bid.amount.toLocaleString()}
                            </span>
                          </motion.div>
                        );
                      })}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-[4vh]">
              <div className="inline-block p-[4vh] rounded-full bg-emerald-500/10 border-4 border-emerald-500/20 mb-8">
                <Gavel className="w-[20vh] h-[20vh] text-emerald-500 animate-pulse" />
              </div>
              <h2 className="text-[8vh] font-black italic uppercase text-zinc-500 tracking-tighter">Ready for Next Player</h2>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
