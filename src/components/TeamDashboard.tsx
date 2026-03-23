import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Wallet, Trophy, User, ChevronDown, ChevronUp } from 'lucide-react';
import { rtdb, auth } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { Player, Team, Tournament, OperationType } from '../types';
import { handleDatabaseError } from '../services/errorService';
import { useAuthState } from 'react-firebase-hooks/auth';

export const TeamDashboard = () => {
  const [user] = useAuthState(auth);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Listen to all tournaments and collect nested data
    const unsubTournaments = onValue(ref(rtdb, 'tournaments'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tournamentList: Tournament[] = [];
        const allTeams: Team[] = [];
        const allPlayers: Player[] = [];

        Object.entries(data).forEach(([tId, tVal]: [string, any]) => {
          tournamentList.push({ id: tId, ...tVal } as Tournament);
          
          if (tVal.teams) {
            Object.entries(tVal.teams).forEach(([tmId, tmVal]: [string, any]) => {
              allTeams.push({ id: tmId, tournamentId: tId, ...tmVal } as Team);
            });
          }

          if (tVal.players) {
            Object.entries(tVal.players).forEach(([pId, pVal]: [string, any]) => {
              allPlayers.push({ id: pId, tournamentId: tId, ...pVal } as Player);
            });
          }
        });

        setTournaments(tournamentList);
        setTeams(allTeams);
        setPlayers(allPlayers);
      } else {
        setTournaments([]);
        setTeams([]);
        setPlayers([]);
      }
    });

    return () => {
      unsubTournaments();
    };
  }, []);

  const getTeamSquad = (teamId: string) => players.filter(p => p.teamId === teamId);

  const formatPoints = (amount: number) => {
    return `${amount.toLocaleString()} Points`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pt-24 pb-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        <div className="flex flex-col gap-2">
          <h2 className="text-4xl font-black italic tracking-tighter uppercase text-white">Auction Pool Teams</h2>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">View squads grouped by auction pools</p>
        </div>

        {tournaments.map(tournament => {
          const tournamentTeams = teams.filter(t => t.tournamentId === tournament.id);
          if (tournamentTeams.length === 0) return null;

          return (
            <div key={tournament.id} className="space-y-6">
              {/* Tournament Header */}
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-zinc-800" />
                <h3 className="px-6 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full font-black uppercase tracking-widest text-xs">
                  {tournament.name}
                </h3>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>

              {/* Teams Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tournamentTeams.map(team => {
                  const isMyTeam = team.ownerId === user?.uid;
                  const squad = getTeamSquad(team.id);
                  const isExpanded = expandedTeamId === team.id;

                  return (
                    <div 
                      key={team.id}
                      className={`group transition-all ${isExpanded ? 'lg:col-span-3' : ''}`}
                    >
                      <motion.div 
                        layout
                        className={`bg-zinc-900 border ${isMyTeam ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-zinc-800'} rounded-3xl overflow-hidden hover:border-zinc-700 transition-all`}
                      >
                        <div 
                          className="p-6 cursor-pointer"
                          onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-6">
                              <div className="w-16 h-16 bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-800 overflow-hidden">
                                {team.logo ? (
                                  <img src={team.logo} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <Trophy className="w-8 h-8 text-zinc-800" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-2xl font-black italic uppercase tracking-tighter">{team.name}</h4>
                                  {isMyTeam && (
                                    <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-black rounded uppercase">My Team</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 mt-1">
                                  <div className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {squad.length} Players
                                  </div>
                                  <div className="text-[10px] text-emerald-500 font-bold uppercase flex items-center gap-1">
                                    <Wallet className="w-3 h-3" />
                                    {formatPoints(team.budget)}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="text-zinc-500 group-hover:text-zinc-100 transition-colors">
                              {isExpanded ? <ChevronUp /> : <ChevronDown />}
                            </div>
                          </div>
                        </div>

                        {/* Squad Details (Expanded) */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-zinc-800 bg-zinc-950/50"
                            >
                              <div className="p-8">
                                <h5 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-6">Squad Members</h5>
                                {squad.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {squad.map(player => (
                                      <div key={player.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center gap-4">
                                        <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                                          <User className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div>
                                          <div className="font-bold text-sm uppercase truncate">{player.name}</div>
                                          <div className="text-[10px] text-zinc-500 font-bold uppercase">{player.category} • {player.position}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-8 text-zinc-700 font-bold uppercase tracking-widest text-sm border border-dashed border-zinc-800 rounded-2xl">
                                    No players bought yet
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {tournaments.length === 0 && (
          <div className="text-center py-24 bg-zinc-900/50 border border-zinc-800 border-dashed rounded-3xl">
            <Trophy className="w-16 h-16 text-zinc-800 mx-auto mb-6" />
            <h3 className="text-2xl font-black italic tracking-tighter uppercase text-zinc-500">No Tournaments found</h3>
          </div>
        )}

      </div>
    </div>
  );
};
