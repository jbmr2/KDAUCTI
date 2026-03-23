import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gavel, Clock, TrendingUp, Users, User } from 'lucide-react';
import { rtdb, auth } from '../firebase';
import { ref, onValue, update, push, query, orderByChild, limitToLast, serverTimestamp, get } from 'firebase/database';
import { Player, Team, Bid, AuctionState, OperationType } from '../types';
import { handleDatabaseError } from '../services/errorService';
import { useAuthState } from 'react-firebase-hooks/auth';

export const AuctionRoom = () => {
  const [user] = useAuthState(auth);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [showBidConfirm, setShowBidConfirm] = useState(false);
  const [tournamentId, setTournamentId] = useState<string | null>(null);

  const formatPoints = (amount: number) => {
    return `${amount.toLocaleString()} Points`;
  };

  // 1. Get user's tournament assignment
  useEffect(() => {
    if (user) {
      const userRef = ref(rtdb, `users/${user.uid}`);
      onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data?.tournamentId) {
          setTournamentId(data.tournamentId);
        }
      });
    }
  }, [user]);

  // 2. Data listeners for the specific tournament
  useEffect(() => {
    if (!tournamentId) {
      // If no tournament assigned, try to find an active one
      const unsubAll = onValue(ref(rtdb, 'tournaments'), (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const active = Object.entries(data).find(([_, t]: [string, any]) => t.auctionState?.status === 'active');
          if (active) setTournamentId(active[0]);
        }
      });
      return () => unsubAll();
    }

    const tRef = ref(rtdb, `tournaments/${tournamentId}`);
    const unsub = onValue(tRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAuctionState(data.auctionState as AuctionState);
        
        const teamsList = data.teams ? Object.entries(data.teams).map(([id, val]) => ({ id, tournamentId, ...(val as any) } as Team)) : [];
        setTeams(teamsList);

        if (user) {
          const myTeam = teamsList.find(t => t.ownerId === user.uid || t.ownerId === `AD${user.uid.substring(0,2)}`); // Fallback for owner login
          // Actually, we use AD01 IDs now. We need to match user.uid if that's what was used, or match the AD ID stored in users/{uid}
          // The AdminDashboard saves tournamentId and teamId in users/{AD_ID}. 
          // Wait, App.tsx saves to users/{user.uid}.
          // AdminDashboard saves to users/{nextId} where nextId is AD01...
          // This is a bit inconsistent. 
          // Let's check users/{user.uid} in App.tsx.
        }

        if (data.auctionState?.currentPlayerId && data.players?.[data.auctionState.currentPlayerId]) {
          setCurrentPlayer({ id: data.auctionState.currentPlayerId, tournamentId, ...data.players[data.auctionState.currentPlayerId] } as Player);
        } else {
          setCurrentPlayer(null);
        }

        if (data.bids) {
          const bidsList = Object.entries(data.bids)
            .map(([id, val]) => ({ id, ...(val as any) } as Bid))
            .filter(b => b.playerId === data.auctionState?.currentPlayerId)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            .slice(0, 10);
          setBids(bidsList);
        } else {
          setBids([]);
        }
      }
    });

    // Also need to get userTeam separately if it's not matched in the teams list
    if (user) {
      onValue(ref(rtdb, `users/${user.uid}`), (snapshot) => {
        const userData = snapshot.val();
        if (userData?.teamId) {
          onValue(ref(rtdb, `tournaments/${tournamentId}/teams/${userData.teamId}`), (snap) => {
            const teamData = snap.val();
            if (teamData) setUserTeam({ id: userData.teamId, tournamentId, ...teamData } as Team);
          });
        }
      });
    }

    return () => unsub();
  }, [tournamentId, user]);

  const placeBid = () => {
    if (!user || !userTeam || !currentPlayer || !auctionState || !tournamentId) return;
    
    let bidAmount: number;
    if (!currentPlayer.currentBidderId) {
      bidAmount = currentPlayer.basePrice;
    } else {
      bidAmount = currentPlayer.currentBid + 100000;
    }

    if (bidAmount > userTeam.budget) {
      alert("Insufficient budget!");
      return;
    }
    setShowBidConfirm(true);
  };

  const handleConfirmBid = async () => {
    if (!user || !userTeam || !currentPlayer || !auctionState || !tournamentId) return;

    let bidAmount: number;
    if (!currentPlayer.currentBidderId) {
      bidAmount = currentPlayer.basePrice;
    } else {
      bidAmount = currentPlayer.currentBid + 100000;
    }

    // 1. Check Purse Value (Budget)
    if (bidAmount > userTeam.budget) {
      alert(`Insufficient budget! You have ${formatPoints(userTeam.budget)} left.`);
      setShowBidConfirm(false);
      return;
    }

    // 2. Check Next Bid Value (Against current bid in database to prevent race conditions)
    // We'll fetch the latest player data just before updating to be safe
    const latestPlayerSnap = await get(ref(rtdb, `tournaments/${tournamentId}/players/${currentPlayer.id}`));
    const latestPlayer = latestPlayerSnap.val();
    
    if (latestPlayer) {
      if (latestPlayer.currentBidderId && bidAmount <= latestPlayer.currentBid) {
        alert("A higher bid was just placed! Please refresh and try again.");
        setShowBidConfirm(false);
        return;
      }
    }

    setShowBidConfirm(false);

    try {
      const bidRef = push(ref(rtdb, `tournaments/${tournamentId}/bids`));
      const bidId = bidRef.key;
      
      const updates: any = {};
      updates[`tournaments/${tournamentId}/players/${currentPlayer.id}/currentBid`] = bidAmount;
      updates[`tournaments/${tournamentId}/players/${currentPlayer.id}/currentBidderId`] = userTeam.id;
      updates[`tournaments/${tournamentId}/bids/${bidId}`] = {
        playerId: currentPlayer.id,
        teamId: userTeam.id,
        amount: bidAmount,
        timestamp: serverTimestamp(),
      };

      await update(ref(rtdb), updates);
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${tournamentId}/players/${currentPlayer.id}`);
    }
  };

  if (!auctionState || auctionState.status === 'idle') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-4">
        <div className="text-center">
          <Clock className="w-16 h-16 text-emerald-500 mx-auto mb-6 animate-pulse" />
          <h2 className="text-3xl font-bold mb-2">Auction is not active</h2>
          <p className="text-zinc-400">Please wait for the administrator to start the auction.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Player Info */}
        <div className="lg:col-span-8 space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="relative h-64 bg-gradient-to-br from-emerald-600/20 to-zinc-900 flex items-center justify-center overflow-hidden">
              <div className="absolute top-4 left-4 flex gap-2 z-10">
                <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">CATEGORY {currentPlayer?.category}</span>
                <span className="px-3 py-1 bg-zinc-800 text-zinc-300 text-xs font-bold rounded-full uppercase">{currentPlayer?.position}</span>
              </div>
              {currentPlayer?.image ? (
                <img src={currentPlayer.image} alt={currentPlayer.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-32 h-32 text-emerald-500/50" />
              )}
            </div>
            
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">{currentPlayer?.name || "Loading..."}</h2>
                  <div className="flex gap-6 text-zinc-400">
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-zinc-500 uppercase font-bold mb-1">Current Bid</div>
                  <div className="text-4xl font-black text-emerald-500">{formatPoints(currentPlayer?.currentBid || currentPlayer?.basePrice || 0)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-2xl">
                  <div className="text-sm text-zinc-500 uppercase font-bold mb-2">Base Price</div>
                  <div className="text-2xl font-bold">{formatPoints(currentPlayer?.basePrice || 0)}</div>
                </div>
                <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-2xl">
                  <div className="text-sm text-zinc-500 uppercase font-bold mb-2">Current Bidder</div>
                  <div className="text-2xl font-bold text-emerald-500 flex items-center gap-2">
                    {(() => {
                      const team = teams.find(t => t.id === currentPlayer?.currentBidderId);
                      return (
                        <>
                          {team?.logo && <img src={team.logo} alt={team.name} className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />}
                          {team?.name || "No Bids Yet"}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {userTeam && (
                <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
                  <button
                    onClick={placeBid}
                    className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white text-2xl font-black italic rounded-2xl transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-4"
                  >
                    <Gavel className="w-8 h-8" />
                    PLACE BID (+1,00,000 Points)
                  </button>
                  <div className="w-full sm:w-auto p-4 bg-zinc-950 border border-zinc-800 rounded-2xl text-center">
                    <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Your Budget</div>
                    <div className="text-xl font-bold text-emerald-500">{formatPoints(userTeam.budget)}</div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Bid History */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              LIVE BID HISTORY
            </h3>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {bids.map((bid, i) => (
                  <motion.div
                    key={bid.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center justify-between p-4 rounded-xl border ${i === 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-zinc-950 border-zinc-800'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${i === 0 ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                        {bids.length - i}
                      </div>
                      {(() => {
                        const team = teams.find(t => t.id === bid.teamId);
                        return (
                          <div className="flex items-center gap-2">
                            {team?.logo && <img src={team.logo} alt={team.name} className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />}
                            <span className="font-bold">{team?.name}</span>
                          </div>
                        );
                      })()}
                    </div>
                    <span className={`font-black ${i === 0 ? 'text-emerald-500 text-xl' : 'text-zinc-400'}`}>{formatPoints(bid.amount)}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {bids.length === 0 && (
                <div className="text-center py-12 text-zinc-500">No bids placed yet. Be the first!</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Team Standings */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" />
              TEAM STANDINGS
            </h3>
            <div className="space-y-4">
              {teams.sort((a, b) => b.budget - a.budget).map(team => (
                <div key={team.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      {team.logo && <img src={team.logo} alt={team.name} className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />}
                      <span className="font-bold">{team.name}</span>
                    </div>
                    <span className="text-emerald-500 font-bold">{formatPoints(team.budget)}</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-500" 
                      style={{ width: `${(team.budget / 50000000) * 100}%` }} 
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-zinc-500">
                    <span>{team.totalPlayers} / 12 Players</span>
                    <span>Budget Left</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bid Confirmation Modal */}
      <AnimatePresence>
        {showBidConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBidConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
              
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                  <Gavel className="w-10 h-10 text-emerald-500" />
                </div>
                
                <div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Confirm Your Bid</h3>
                  <p className="text-zinc-400">
                    You are about to place a bid of <span className="text-emerald-500 font-bold">{((currentPlayer?.currentBid || currentPlayer?.basePrice || 0) + 100000).toLocaleString()} Points</span> for <span className="text-white font-bold">{currentPlayer?.name}</span>.
                  </p>
                </div>

                <div className="w-full grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setShowBidConfirm(false)}
                    className="py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleConfirmBid}
                    className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
                  >
                    CONFIRM BID
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
