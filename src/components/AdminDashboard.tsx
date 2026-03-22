import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Play, Square, UserPlus, Users, Trash2, Edit2, Trophy, Tv, Copy, Key, FileUp } from 'lucide-react';
import { rtdb } from '../firebase';
import { ref, onValue, update, push, remove, set, get, serverTimestamp } from 'firebase/database';
import { Player, Team, AuctionState, OperationType, Tournament } from '../types';
import { handleDatabaseError } from '../services/errorService';

export const AdminDashboard = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    category: 'None' as any,
    position: 'Raider',
    basePrice: '' as any,
    tournamentId: '',
    stats: { matches: 0, raidPoints: 0, tacklePoints: 0 }
  });

  const [newTeam, setNewTeam] = useState({
    name: '',
    ownerId: '',
    budget: '' as any,
    logo: '',
    tournamentId: ''
  });

  const [newTournament, setNewTournament] = useState({
    name: '',
    initialPurse: 50000000 as any,
    password: ''
  });

  const [filterTournament, setFilterTournament] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  useEffect(() => {
    const unsubTournaments = onValue(ref(rtdb, 'tournaments'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tournamentList: Tournament[] = [];
        const allPlayers: Player[] = [];
        const allTeams: Team[] = [];

        Object.entries(data).forEach(([tId, tVal]: [string, any]) => {
          tournamentList.push({ id: tId, ...tVal } as Tournament);
          
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

        setTournaments(tournamentList);
        setPlayers(allPlayers);
        setTeams(allTeams);
      } else {
        setTournaments([]);
        setPlayers([]);
        setTeams([]);
      }
    }, (err) => handleDatabaseError(err, OperationType.LIST, 'tournaments'));

    return () => {
      unsubTournaments();
    };
  }, []);

  const addPlayer = async () => {
    if (!newPlayer.tournamentId) {
      alert("Please select an auction pool first");
      return;
    }
    try {
      const newPlayerRef = push(ref(rtdb, `tournaments/${newPlayer.tournamentId}/players`));
      await set(newPlayerRef, {
        ...newPlayer,
        basePrice: parseInt(newPlayer.basePrice) || 0,
        currentBid: 0,
        currentBidderId: null,
        status: 'unsold',
        teamId: null
      });
      setNewPlayer({ name: '', category: 'None' as any, position: 'Raider', basePrice: '' as any, tournamentId: '', stats: { matches: 0, raidPoints: 0, tacklePoints: 0 } });
    } catch (err) {
      handleDatabaseError(err, OperationType.CREATE, `tournaments/${newPlayer.tournamentId}/players`);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!newPlayer.tournamentId) {
      alert("Please select an auction pool first");
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const playersToAdd: any[] = [];

      function getPosition(role: string) {
        if (!role) return 'Raider';
        const r = role.toLowerCase();
        if (r.includes('raider') || r.includes('redar') || r.includes('reider') || r.includes('raundar')) return 'Raider';
        if (r.includes('corner') || r.includes('cover') || r.includes('defender')) return 'Defender';
        if (r.includes('all rounder') || r.includes('all-rounder') || r.includes('allrounder')) return 'All-rounder';
        return 'Raider';
      }

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length < 3 || !row[1] || !row[1].trim()) continue;

        playersToAdd.push({
          name: row[1].trim(),
          category: 'C',
          position: getPosition(row[2]),
          basePrice: 0,
          currentBid: 0,
          currentBidderId: null,
          status: 'unsold',
          teamId: null,
          stats: { matches: 0, raidPoints: 0, tacklePoints: 0 }
        });
      }

      if (playersToAdd.length === 0) {
        alert("No valid players found in CSV");
        return;
      }

      if (!confirm(`Found ${playersToAdd.length} players. Add them to the pool?`)) return;

      try {
        const updates: any = {};
        playersToAdd.forEach(player => {
          const newPlayerId = push(ref(rtdb, `tournaments/${newPlayer.tournamentId}/players`)).key;
          updates[`tournaments/${newPlayer.tournamentId}/players/${newPlayerId}`] = player;
        });
        await update(ref(rtdb), updates);
        alert(`Successfully added ${playersToAdd.length} players!`);
      } catch (err) {
        handleDatabaseError(err, OperationType.CREATE, `tournaments/${newPlayer.tournamentId}/players`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const addTeam = async () => {
    if (!newTeam.tournamentId) {
      alert("Please select an auction pool first");
      return;
    }
    try {
      // Generate AD01, AD02... ID across all teams in this pool
      const poolTeams = teams.filter(t => t.tournamentId === newTeam.tournamentId);
      const adTeams = poolTeams.filter(t => t.ownerId && t.ownerId.startsWith('AD'));
      let nextId = 'AD01';
      
      if (adTeams.length > 0) {
        const ids = adTeams.map(t => parseInt(t.ownerId.substring(2))).filter(n => !isNaN(n));
        if (ids.length > 0) {
          const maxId = Math.max(...ids);
          nextId = `AD${(maxId + 1).toString().padStart(2, '0')}`;
        }
      }

      const newTeamRef = push(ref(rtdb, `tournaments/${newTeam.tournamentId}/teams`));
      const teamId = newTeamRef.key;
      
      const updates: any = {};
      updates[`tournaments/${newTeam.tournamentId}/teams/${teamId}`] = {
        ...newTeam,
        budget: parseInt(newTeam.budget) || tournaments.find(t => t.id === newTeam.tournamentId)?.initialPurse || 0,
        ownerId: nextId,
        totalPlayers: 0
      };
      
      // Also create a user record for this owner ID (global for login)
      updates[`users/${nextId}`] = {
        name: `Owner ${nextId}`,
        email: `owner${nextId.toLowerCase()}@example.com`,
        role: 'viewer',
        tournamentId: newTeam.tournamentId,
        teamId: teamId,
        createdAt: serverTimestamp()
      };

      await update(ref(rtdb), updates);
      setNewTeam({ name: '', ownerId: '', budget: '' as any, logo: '', tournamentId: '' });
    } catch (err) {
      handleDatabaseError(err, OperationType.CREATE, `tournaments/${newTeam.tournamentId}/teams`);
    }
  };

  const addTournament = async () => {
    try {
      const newTournamentRef = push(ref(rtdb, 'tournaments'));
      await set(newTournamentRef, {
        ...newTournament,
        status: 'upcoming',
        winnerTeamId: null,
        createdAt: serverTimestamp(),
        auctionState: {
          status: 'idle',
          currentPlayerId: null,
          timer: 60
        }
      });
      setNewTournament({ name: '', initialPurse: 50000000, password: '' });
    } catch (err) {
      handleDatabaseError(err, OperationType.CREATE, 'tournaments');
    }
  };

  const startAuction = async (player: Player) => {
    if (!player.tournamentId) return;
    try {
      const updates: any = {};
      updates[`tournaments/${player.tournamentId}/auctionState/status`] = 'active';
      updates[`tournaments/${player.tournamentId}/auctionState/currentPlayerId`] = player.id;
      updates[`tournaments/${player.tournamentId}/auctionState/timer`] = 60;
      updates[`tournaments/${player.tournamentId}/players/${player.id}/status`] = 'current';
      await update(ref(rtdb), updates);
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${player.tournamentId}/auctionState`);
    }
  };

  const stopAuction = async (tournamentId: string) => {
    try {
      const updates: any = {};
      updates[`tournaments/${tournamentId}/auctionState/status`] = 'idle';
      updates[`tournaments/${tournamentId}/auctionState/currentPlayerId`] = null;
      await update(ref(rtdb), updates);
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${tournamentId}/auctionState`);
    }
  };

  const markAsSold = async (player: Player) => {
    if (!player.currentBidderId || !player.tournamentId) return;
    try {
      const updates: any = {};
      updates[`tournaments/${player.tournamentId}/players/${player.id}/status`] = 'sold';
      updates[`tournaments/${player.tournamentId}/players/${player.id}/teamId`] = player.currentBidderId;

      const team = teams.find(t => t.id === player.currentBidderId && t.tournamentId === player.tournamentId);
      if (team) {
        updates[`tournaments/${player.tournamentId}/teams/${team.id}/budget`] = team.budget - player.currentBid;
        updates[`tournaments/${player.tournamentId}/teams/${team.id}/totalPlayers`] = team.totalPlayers + 1;
      }

      updates[`tournaments/${player.tournamentId}/auctionState/status`] = 'idle';
      updates[`tournaments/${player.tournamentId}/auctionState/currentPlayerId`] = null;

      await update(ref(rtdb), updates);
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${player.tournamentId}/players/${player.id}`);
    }
  };

  const resetPool = async (tournamentId: string) => {
    if (!confirm("Are you sure you want to reset all players and team budgets for this pool?")) return;
    try {
      const tournament = tournaments.find(t => t.id === tournamentId);
      const initialPurse = tournament?.initialPurse || 50000000;
      const updates: any = {};

      // Reset players
      const playersSnap = await get(ref(rtdb, `tournaments/${tournamentId}/players`));
      const playersData = playersSnap.val();
      if (playersData) {
        Object.keys(playersData).forEach((id) => {
          updates[`tournaments/${tournamentId}/players/${id}/status`] = 'unsold';
          updates[`tournaments/${tournamentId}/players/${id}/teamId`] = null;
          updates[`tournaments/${tournamentId}/players/${id}/currentBid`] = 0;
          updates[`tournaments/${tournamentId}/players/${id}/currentBidderId`] = null;
        });
      }

      // Reset teams budget
      const teamsSnap = await get(ref(rtdb, `tournaments/${tournamentId}/teams`));
      const teamsData = teamsSnap.val();
      if (teamsData) {
        Object.keys(teamsData).forEach((id) => {
          updates[`tournaments/${tournamentId}/teams/${id}/budget`] = initialPurse;
          updates[`tournaments/${tournamentId}/teams/${id}/totalPlayers`] = 0;
        });
      }

      updates[`tournaments/${tournamentId}/status`] = 'upcoming';
      updates[`tournaments/${tournamentId}/auctionState/status`] = 'idle';
      updates[`tournaments/${tournamentId}/auctionState/currentPlayerId`] = null;
      
      await update(ref(rtdb), updates);

      alert("Pool auction has been reset!");
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, `tournaments/${tournamentId}`);
    }
  };

  const deletePlayer = async (playerId: string, tournamentId: string) => {
    try {
      await remove(ref(rtdb, `tournaments/${tournamentId}/players/${playerId}`));
    } catch (err) {
      handleDatabaseError(err, OperationType.DELETE, `tournaments/${tournamentId}/players/${playerId}`);
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
      console.error('Fallback: Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        <div className="flex justify-between items-center">
          <h2 className="text-4xl font-black italic tracking-tighter uppercase">ADMIN DASHBOARD</h2>
          <div className="flex gap-4">
            <button 
              onClick={() => {
                const url = window.location.origin + '?view=ticker';
                copyToClipboard(url, "Ticker link copied to clipboard!\nUse this as a Browser Source in OBS.");
              }}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 font-bold rounded-2xl transition-all border border-zinc-800"
            >
              <Tv className="w-5 h-5 text-emerald-500" />
              COPY TICKER LINK
            </button>
            {tournaments.map(t => {
              const isActive = t.auctionState?.status === 'active';
              if (!isActive) return null;
              return (
                <button 
                  key={t.id}
                  onClick={() => stopAuction(t.id)}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all"
                >
                  <Square className="w-5 h-5" /> STOP {t.name}
                </button>
              );
            })}
            {tournaments.every(t => t.auctionState?.status !== 'active') && (
              <div className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Auction Idle</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Tournament Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-emerald-500" />
              CREATE AUCTION POOL
            </h3>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Pool Name (e.g. Pro Kabaddi S10)" 
                value={newTournament.name}
                onChange={e => setNewTournament({...newTournament, name: e.target.value})}
                className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-emerald-500 outline-none transition-all"
              />
              <input 
                type="password" 
                placeholder="Pool Password (Optional)" 
                value={newTournament.password}
                onChange={e => setNewTournament({...newTournament, password: e.target.value})}
                className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-emerald-500 outline-none transition-all"
              />
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase px-1">Team Purse Value (Default)</label>
                <input 
                  type="number" 
                  placeholder="Initial Purse (e.g. 50000000)" 
                  value={isNaN(newTournament.initialPurse) ? '' : newTournament.initialPurse}
                  onChange={e => setNewTournament({...newTournament, initialPurse: e.target.value === '' ? '' : parseInt(e.target.value)})}
                  className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <button 
                onClick={addTournament}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all"
              >
                CREATE POOL
              </button>
            </div>
          </div>

          {/* Add Team Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" />
              ADD NEW TEAM
            </h3>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Team Name" 
                value={newTeam.name}
                onChange={e => setNewTeam({...newTeam, name: e.target.value})}
                className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-emerald-500 outline-none transition-all"
              />
              <select 
                value={newTeam.tournamentId}
                onChange={e => {
                  const tId = e.target.value;
                  const tournament = tournaments.find(t => t.id === tId);
                  setNewTeam({
                    ...newTeam, 
                    tournamentId: tId,
                    budget: tournament ? tournament.initialPurse : 50000000
                  });
                }}
                className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-emerald-500 outline-none transition-all"
              >
                <option value="">Select Auction Pool</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="number" 
                  placeholder="Budget" 
                  value={isNaN(newTeam.budget) ? '' : newTeam.budget}
                  onChange={e => setNewTeam({...newTeam, budget: e.target.value === '' ? '' : parseInt(e.target.value)})}
                  className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-emerald-500 outline-none transition-all"
                />
                <input 
                  type="text" 
                  placeholder="Logo URL" 
                  value={newTeam.logo}
                  onChange={e => setNewTeam({...newTeam, logo: e.target.value})}
                  className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <button 
                onClick={addTeam}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all"
              >
                ADD TEAM
              </button>
            </div>
          </div>

          {/* Add Player Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-500" />
              ADD NEW PLAYER
            </h3>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Player Name" 
                value={newPlayer.name}
                onChange={e => setNewPlayer({...newPlayer, name: e.target.value})}
                className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-emerald-500 outline-none transition-all"
              />
              <div className="grid grid-cols-2 gap-4">
                <select 
                  value={newPlayer.category}
                  onChange={e => setNewPlayer({...newPlayer, category: e.target.value as any})}
                  className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-emerald-500 outline-none transition-all"
                >
                  <option value="None">None</option>
                  <option value="A">Category A</option>
                  <option value="B">Category B</option>
                  <option value="C">Category C</option>
                </select>
                <select 
                  value={newPlayer.tournamentId}
                  onChange={e => setNewPlayer({...newPlayer, tournamentId: e.target.value})}
                  className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-emerald-500 outline-none transition-all"
                >
                  <option value="">Select Auction Pool</option>
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select 
                  value={newPlayer.position}
                  onChange={e => setNewPlayer({...newPlayer, position: e.target.value as any})}
                  className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-emerald-500 outline-none transition-all"
                >
                  <option value="Raider">Raider</option>
                  <option value="Defender">Defender</option>
                  <option value="All-rounder">All-rounder</option>
                </select>
              </div>
              <input 
                type="number" 
                placeholder="Base Price" 
                value={isNaN(newPlayer.basePrice) ? '' : newPlayer.basePrice}
                onChange={e => setNewPlayer({...newPlayer, basePrice: e.target.value === '' ? '' : parseInt(e.target.value)})}
                className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:border-emerald-500 outline-none transition-all"
              />
              <button 
                onClick={addPlayer}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all"
              >
                ADD PLAYER
              </button>

              <div className="pt-6 border-t border-zinc-800">
                <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed border-zinc-800 rounded-2xl hover:border-emerald-500/50 transition-all group relative overflow-hidden">
                  <FileUp className="w-8 h-8 text-zinc-500 group-hover:text-emerald-500 transition-colors" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-zinc-300">Bulk Upload CSV</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Player Name, Role (e.g. Raider)</p>
                  </div>
                  <input 
                    type="file" 
                    accept=".csv"
                    onChange={handleBulkUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Auction Pools */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
          <h3 className="text-xl font-bold mb-6">AUCTION POOLS</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map(tournament => (
              <div key={tournament.id} className="p-6 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">{tournament.name}</h4>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => copyToClipboard(tournament.id, "Full Pool ID copied to clipboard!")}
                        className="text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded bg-zinc-800 text-zinc-500 hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 w-full"
                        title="Click to copy full ID"
                      >
                        <Copy className="w-3 h-3" />
                        ID: {tournament.id.substring(0, 8)}
                      </button>
                      <button 
                        onClick={() => copyToClipboard(`${window.location.origin}${window.location.pathname}?view=led&pool=${tournament.id}`, "LED Display link copied!")}
                        className="text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-600/20 transition-all flex items-center justify-center gap-2 w-full"
                      >
                        <Tv className="w-3 h-3" />
                        LED DISPLAY LINK
                      </button>
                      <button 
                        onClick={() => copyToClipboard(`${window.location.origin}${window.location.pathname}?view=pool&pool=${tournament.id}`, "Pool Controller link copied!")}
                        className="text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded bg-blue-600/10 text-blue-500 border border-blue-500/20 hover:bg-blue-600/20 transition-all flex items-center justify-center gap-2 w-full"
                      >
                        <Key className="w-3 h-3" />
                        CONTROLLER LINK
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      if(confirm("Delete this pool and all associated data?")) {
                        await remove(ref(rtdb, `tournaments/${tournament.id}`));
                      }
                    }}
                    className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button 
                  onClick={() => resetPool(tournament.id)}
                  className="w-full py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 text-xs font-bold rounded-lg transition-all"
                >
                  RESET POOL AUCTION
                </button>
              </div>
            ))}
            {tournaments.length === 0 && (
              <div className="col-span-full py-12 text-center text-zinc-500 italic border border-dashed border-zinc-800 rounded-2xl">
                No tournament pools created yet.
              </div>
            )}
          </div>
        </div>

        {/* Player Management List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h3 className="text-xl font-bold">PLAYER MANAGEMENT</h3>
            <div className="flex flex-wrap gap-4 w-full md:w-auto">
              <select 
                value={filterTournament}
                onChange={e => setFilterTournament(e.target.value)}
                className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs outline-none focus:border-emerald-500 transition-all"
              >
                <option value="">All Pools</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <select 
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs outline-none focus:border-emerald-500 transition-all"
              >
                <option value="">All Categories</option>
                <option value="None">Category None</option>
                <option value="A">Category A</option>
                <option value="B">Category B</option>
                <option value="C">Category C</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-zinc-500 text-sm uppercase font-bold border-b border-zinc-800">
                  <th className="pb-4">Name</th>
                  <th className="pb-4">Pool</th>
                  <th className="pb-4">Category</th>
                  <th className="pb-4">Position</th>
                  <th className="pb-4">Base Price</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {players
                  .filter(p => !filterTournament || p.tournamentId === filterTournament)
                  .filter(p => !filterCategory || p.category === filterCategory)
                  .map(player => (
                  <tr key={player.id} className="group hover:bg-zinc-950/50 transition-all">
                    <td className="py-4 font-bold">{player.name}</td>
                    <td className="py-4 text-xs text-zinc-500">
                      {tournaments.find(t => t.id === player.tournamentId)?.name || 'No Pool'}
                    </td>
                    <td className="py-4">
                      <span className="px-2 py-1 bg-zinc-800 rounded text-xs">{player.category}</span>
                    </td>
                    <td className="py-4 text-zinc-400">{player.position}</td>
                    <td className="py-4 font-mono">₹{player.basePrice.toLocaleString()}</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${
                        player.status === 'sold' ? 'bg-emerald-500/10 text-emerald-500' :
                        player.status === 'current' ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {player.status}
                      </span>
                    </td>
                    <td className="py-4 text-right space-x-2">
                      {player.status === 'unsold' && (
                        <button 
                          onClick={() => startAuction(player)}
                          className="p-2 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white rounded-lg transition-all"
                          title="Start Auction"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {player.status === 'current' && (
                        <button 
                          onClick={() => markAsSold(player)}
                          className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition-all"
                        >
                          MARK AS SOLD
                        </button>
                      )}
                      <button 
                        onClick={() => deletePlayer(player.id, player.tournamentId)}
                        className="p-2 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
