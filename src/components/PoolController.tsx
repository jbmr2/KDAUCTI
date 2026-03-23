import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Key, LogIn, Users, Trophy, Gavel, Play, CheckCircle, 
  XCircle, TrendingUp, RefreshCw, ArrowLeft, ArrowRight, User as UserIcon, Trash2, Undo2,
  Tv, Copy, FileUp, UserPlus, ChevronDown, ChevronUp
} from 'lucide-react';
import { rtdb } from '../firebase';
import { ref, onValue, update, push, set, get, serverTimestamp } from 'firebase/database';
import { Player, Team, Bid, AuctionState, OperationType, Tournament, PlayerStatus } from '../types';
import { handleDatabaseError } from '../services/errorService';

export const PoolController = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(() => {
    return sessionStorage.getItem('pool_authorized') === 'true';
  });
  const [activePool, setActivePool] = useState<Tournament | null>(() => {
    const saved = sessionStorage.getItem('active_pool');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [multiplierUnit, setMultiplierUnit] = useState(() => {
    const saved = localStorage.getItem('multiplier_unit');
    return saved ? parseInt(saved) : 1000;
  }); 
  const [activeMultiplier, setActiveMultiplier] = useState(1); // Default 1X
  const [showSquadButtons, setShowSquadButtons] = useState(false); // Collapsed by default

  // Sync multiplier unit to localStorage
  useEffect(() => {
    localStorage.setItem('multiplier_unit', multiplierUnit.toString());
  }, [multiplierUnit]);
  const [customBidAmount, setCustomBidAmount] = useState<string>('');
  const [playerFilter, setPlayerFilter] = useState<PlayerStatus | 'all'>('all');

  // Computed values
  const poolPlayers = players.filter(p => {
    if (playerFilter === 'all') return p.status === 'available' || p.status === 'unsold' || p.status === 'current';
    return p.status === playerFilter;
  });
  const activePlayer = poolPlayers[currentIndex];
  const currentBids = bids.filter(b => b.playerId === activePlayer?.id).sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);

  const bidIncrement = multiplierUnit * activeMultiplier;

  const formatPoints = (amount: number) => {
    return `${amount.toLocaleString()} Points`;
  };

  const [newPlayer, setNewPlayer] = useState({
    name: '',
    image: '',
    category: 'None' as any,
    position: 'Raider',
    basePrice: '' as any,
  });

  const [newTeam, setNewTeam] = useState({
    name: '',
    logo: '',
    budget: '' as any
  });

  // Sync Team Budget to Pool Initial Purse
  useEffect(() => {
    if (activePool && (newTeam.budget === '' || !newTeam.budget)) {
      setNewTeam(prev => ({ ...prev, budget: activePool.initialPurse || 50000000 }));
    }
  }, [activePool?.id]);

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
      const pData = { id: loginId, ...pool };
      setActivePool(pData);
      setNewTeam({ name: '', logo: '', budget: pool.initialPurse || 50000000 });
      setIsAuthorized(true);
      sessionStorage.setItem('pool_authorized', 'true');
      sessionStorage.setItem('active_pool', JSON.stringify(pData));
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
        const pData = { id: match[0], ...p };
        setActivePool(pData);
        setNewTeam({ name: '', logo: '', budget: p.initialPurse || 50000000 });
        setIsAuthorized(true);
        sessionStorage.setItem('pool_authorized', 'true');
        sessionStorage.setItem('active_pool', JSON.stringify(pData));
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
        status: 'available',
        teamId: null
      });
      setNewPlayer({ name: '', image: '', category: 'None' as any, position: 'Raider', basePrice: '' as any });
    } catch (err) {
      handleDatabaseError(err, OperationType.CREATE, `tournaments/${activePool.id}/players`);
    }
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePool) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
      
      const updates: any = {};
      let importCount = 0;
      const now = Date.now();

      // Start from 1 to skip header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Detect separator (Tab or Comma)
        const separator = line.includes('\t') ? '\t' : ',';
        const parts = line.split(separator).map(p => p.trim().replace(/^"|"$/g, ''));
        
        // Dynamic mapping based on columns
        // We expect: [0] ID, [1] Name, [2] Role, [3] Base Price, [4] Image (Optional)
        const name = parts[1];
        const role = parts[2];
        const rawPrice = parts[3];
        const image = parts[4] || '';

        if (!name || name.toLowerCase() === 'player name' || name.toLowerCase().includes('akl player')) continue;

        // AGGRESSIVE PRICE PARSING
        // Remove everything except numbers (handles ₹, symbols, spaces)
        const digitsOnly = (rawPrice || '').replace(/[^\d]/g, '');
        let price = parseInt(digitsOnly);
        
        // If parsing failed or result is 0, check if there's any value in parts[3]
        // If it's truly missing or 0, use 500 as default since that's your sheet's minimum
        if (isNaN(price) || price <= 0) {
          price = 500;
        }

        // Map Role to Position
        let position: any = 'Raider';
        const roleLower = (role || '').toLowerCase();
        if (roleLower.includes('corner') || roleLower.includes('cover') || roleLower.includes('defender')) {
          position = 'Defender';
        } else if (roleLower.includes('rounder') || roleLower.includes('raundar')) {
          position = 'All-rounder';
        }

        const newPlayerRef = push(ref(rtdb, `tournaments/${activePool.id}/players`));
        updates[`tournaments/${activePool.id}/players/${newPlayerRef.key}`] = {
          name,
          image,
          category: 'None',
          position,
          basePrice: price, // This will now be 500
          tournamentId: activePool.id,
          currentBid: 0,
          currentBidderId: null,
          status: 'available',
          teamId: null,
          updatedAt: now
        };
        importCount++;
      }

      if (importCount > 0) {
        try {
          await update(ref(rtdb), updates);
          alert(`✅ SUCCESS!\n\nImported ${importCount} players.\nBase Price set to: 500 Points (as per your file).`);
        } catch (err) {
          handleDatabaseError(err, OperationType.UPDATE, 'bulk-import');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const clearAllPlayers = async () => {
    if (!activePool || !window.confirm("WARNING: This will delete ALL players in this pool. Continue?")) return;
    try {
      await set(ref(rtdb, `tournaments/${activePool.id}/players`), null);
      alert("All players deleted. You can now re-import the CSV.");
    } catch (err) {
      handleDatabaseError(err, OperationType.DELETE, 'clear-players');
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

  const handlePlayerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, player: Player) => {
    const file = e.target.files?.[0];
    if (!file || !activePool) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', `player_${player.id}_${Date.now()}.${file.name.split('.').pop()}`);

    const uploadUrl = localStorage.getItem('hostinger_upload_url') || 'upload.php';

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const imageUrl = data.url; 
        
        const updates: any = {};
        updates[`tournaments/${activePool.id}/players/${player.id}/image`] = imageUrl;
        await update(ref(rtdb), updates);
        alert("Image uploaded successfully!");
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error("Upload failed:", response.status, errorText);
        alert(`Failed to upload image (Status: ${response.status}).\n\n1. Ensure 'upload.php' is uploaded to your Hostinger server.\n2. Ensure the 'images/' folder exists and is writable (777).`);
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert(`Error connecting to upload script.\n\nURL: ${uploadUrl}\n\nMake sure the URL is correct and CORS is enabled in upload.php.`);
    }
    e.target.value = '';
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

  const toggleViewMode = async (mode: 'auction' | 'teams' | 'team-squad' | 'unsold', teamId: string | null = null) => {
    if (!activePool) return;
    try {
      await update(ref(rtdb, `tournaments/${activePool.id}/auctionState`), {
        viewMode: mode,
        selectedTeamId: teamId
      });
    } catch (err) {
      handleDatabaseError(err, OperationType.UPDATE, 'viewMode');
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
      alert(`Insufficient budget! Team ${team.name} has only ${formatPoints(team.budget)} left.`);
      return;
    }

    // 2. Check Next Bid Value
    if (!player.currentBidderId) {
      // First bid must be at least base price
      if (nextBid < player.basePrice) {
        alert(`First bid must be at least the Base Price (${formatPoints(player.basePrice)})!`);
        return;
      }
    } else {
      // Next bid must be strictly higher than current bid
      if (nextBid <= player.currentBid) {
        alert(`Next bid must be higher than current bid (${formatPoints(player.currentBid)})!`);
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
      updates[`tournaments/${activePool.id}/players/${player.id}/updatedAt`] = serverTimestamp();
      updates[`tournaments/${activePool.id}/teams/${team.id}/budget`] = team.budget - player.currentBid;
      updates[`tournaments/${activePool.id}/teams/${team.id}/totalPlayers`] = team.totalPlayers + 1;
      updates[`tournaments/${activePool.id}/auctionState/status`] = 'idle';
      updates[`tournaments/${activePool.id}/auctionState/currentPlayerId`] = null;
      await update(ref(rtdb), updates);

      // Advance to next player
      if (currentIndex < poolPlayers.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
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
      updates[`tournaments/${activePool.id}/players/${player.id}/updatedAt`] = serverTimestamp();
      updates[`tournaments/${activePool.id}/auctionState/status`] = 'idle';
      updates[`tournaments/${activePool.id}/auctionState/currentPlayerId`] = null;
      await update(ref(rtdb), updates);

      // Advance to next player
      if (currentIndex < poolPlayers.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
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
                  <button 
                    onClick={() => copyToClipboard(`${window.location.origin}${window.location.pathname}?view=ticker&pool=${activePool?.id}`, "Ticker link copied!")}
                    className="flex items-center gap-1.5 px-2 py-1 bg-orange-600/10 hover:bg-orange-600/20 text-orange-500 rounded text-[10px] font-black transition-all border border-orange-500/20"
                  >
                    <TrendingUp className="w-3 h-3" /> COPY TICKER LINK
                  </button>
                </div>
              </div>
          </div>
          <button onClick={() => {
            setIsAuthorized(false);
            sessionStorage.removeItem('pool_authorized');
            sessionStorage.removeItem('active_pool');
          }} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold">LOGOUT</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 1. Controller Section */}
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black italic uppercase flex items-center gap-2"><Gavel className="text-emerald-500" /> Auction Controller</h3>
                <div className="flex items-center gap-3">
                  <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    <button 
                      onClick={() => toggleViewMode('auction')} 
                      className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${auctionState?.viewMode !== 'teams' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      AUCTION
                    </button>
                    <button 
                      onClick={() => toggleViewMode('teams')} 
                      className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${auctionState?.viewMode === 'teams' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      TEAMS
                    </button>
                    <button 
                      onClick={() => toggleViewMode('unsold')} 
                      className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${auctionState?.viewMode === 'unsold' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      UNSOLD
                    </button>
                  </div>
                  <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    <button onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)} className="p-2 hover:bg-zinc-900 rounded-md disabled:opacity-20" disabled={currentIndex === 0}><ArrowLeft className="w-4 h-4" /></button>
                    <span className="text-xs font-bold px-2">{currentIndex + 1} / {poolPlayers.length}</span>
                    <button onClick={() => currentIndex < poolPlayers.length - 1 && setCurrentIndex(currentIndex + 1)} className="p-2 hover:bg-zinc-900 rounded-md disabled:opacity-20" disabled={currentIndex === poolPlayers.length - 1}><ArrowRight className="w-4 h-4" /></button>
                  </div>
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
                          value={activePlayer ? (isNaN(activePlayer.basePrice) ? '' : activePlayer.basePrice) : ''} 
                          onChange={e => updateBasePrice(e.target.value === '' ? 0 : parseInt(e.target.value))}
                          className="w-24 p-2 bg-zinc-950 border border-zinc-800 rounded text-xl font-black text-white text-right focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <button onClick={() => startAuction(activePlayer)} disabled={auctionState?.status === 'active'} className="py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"><Play className="w-4 h-4" /> START</button>
                      <button onClick={() => markSold(activePlayer)} disabled={auctionState?.status !== 'active' || !activePlayer.currentBidderId} className="py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-emerald-500/20 disabled:opacity-20"><CheckCircle className="w-4 h-4" /> SOLD</button>
                      <button onClick={() => markUnsold(activePlayer)} disabled={auctionState?.status !== 'active'} className="py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-20"><XCircle className="w-4 h-4" /> UNSOLD</button>
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
                          <p className="text-[10px] text-zinc-500 font-bold uppercase">Multiplier Unit (Points)</p>
                          <input 
                            type="number" 
                            value={isNaN(multiplierUnit) ? '' : multiplierUnit}
                            onChange={e => setMultiplierUnit(e.target.value === '' ? '' as any : parseInt(e.target.value))}
                            className="w-24 p-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] font-black text-emerald-500 outline-none focus:border-emerald-500"
                          />
                        </div>
                        <p className="text-[10px] text-emerald-500 font-black italic">Current Increment: {formatPoints(bidIncrement)}</p>
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
                                {!activePlayer.currentBidderId ? 'BASE' : '+INC'} {nextBid.toLocaleString()} Points
                              </p>
                            </div>
                            <p className="text-zinc-500 font-black text-[10px]">PURSE: {formatPoints(t.budget)}</p>
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
                    <span className="font-black text-emerald-500 text-xs">{formatPoints(bid.amount)}</span>
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
                <input type="text" placeholder="Image URL (Optional)" value={newPlayer.image} onChange={e => setNewPlayer({...newPlayer, image: e.target.value})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs" />
                <div className="grid grid-cols-2 gap-4">
                  <select value={newPlayer.category} onChange={e => setNewPlayer({...newPlayer, category: e.target.value as any})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs">
                    <option value="None">Category None</option>
                    <option value="A">A</option><option value="B">B</option><option value="C">C</option>
                  </select>
                  <select value={newPlayer.position} onChange={e => setNewPlayer({...newPlayer, position: e.target.value as any})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs">
                    <option value="Raider">Raider</option><option value="Defender">Defender</option><option value="All-rounder">All-rounder</option>
                  </select>
                </div>
                <input type="number" placeholder="Base Price" value={isNaN(newPlayer.basePrice) ? '' : newPlayer.basePrice} onChange={e => setNewPlayer({...newPlayer, basePrice: e.target.value === '' ? '' : parseInt(e.target.value)})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs" />
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={addPlayer} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs">ADD PLAYER</button>
                  <label className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs text-center cursor-pointer flex items-center justify-center gap-2">
                    <UserPlus className="w-4 h-4" /> BULK IMPORT (CSV)
                    <input type="file" accept=".csv" onChange={handleBulkImport} className="hidden" />
                  </label>
                </div>
                <button onClick={clearAllPlayers} className="w-full py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 font-bold rounded-xl text-[10px] transition-all border border-red-500/20 mt-2">
                  <Trash2 className="w-3 h-3 inline mr-1" /> CLEAR ALL PLAYERS (RESET POOL)
                </button>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <h3 className="text-lg font-black italic uppercase flex items-center gap-2 mb-6"><Users className="text-emerald-500" /> Add Team</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Team Name" value={newTeam.name} onChange={e => setNewTeam({...newTeam, name: e.target.value})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase px-1">Team Purse Value (Points)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 50000" 
                      value={newTeam.budget === '' ? '' : newTeam.budget} 
                      onChange={e => setNewTeam({...newTeam, budget: e.target.value === '' ? '' : parseInt(e.target.value)})} 
                      className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase px-1">Logo URL</label>
                    <input type="text" placeholder="https://..." value={newTeam.logo} onChange={e => setNewTeam({...newTeam, logo: e.target.value})} className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs" />
                  </div>
                </div>
                <button onClick={addTeam} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-xs">ADD TEAM</button>
              </div>

              {/* Show Squad on LED Buttons */}
              <div className="mt-8 pt-6 border-t border-zinc-800">
                <button 
                  onClick={() => setShowSquadButtons(!showSquadButtons)}
                  className="w-full flex items-center justify-between text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 hover:text-zinc-300 transition-colors"
                >
                  <span>Show Team Squad on LED</span>
                  {showSquadButtons ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                
                <AnimatePresence>
                  {showSquadButtons && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-2 pb-2">
                        {teams.map(t => (
                          <button
                            key={t.id}
                            onClick={() => toggleViewMode('team-squad', t.id)}
                            className={`p-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${auctionState?.viewMode === 'team-squad' && auctionState?.selectedTeamId === t.id ? 'bg-emerald-600 text-white' : 'bg-zinc-950 text-zinc-500 hover:text-zinc-300 border border-zinc-800'}`}
                          >
                            {t.logo && <img src={t.logo} className="w-4 h-4 rounded-full object-cover" />}
                            <span className="truncate">{t.name}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Player List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h3 className="text-lg font-black italic uppercase">Pool Player List</h3>
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 overflow-x-auto max-w-full">
              {(['all', 'available', 'sold', 'unsold'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setPlayerFilter(filter)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${
                    playerFilter === filter 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {filter} ({filter === 'all' ? players.length : players.filter(p => p.status === filter).length})
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {players
              .filter(p => playerFilter === 'all' || p.status === playerFilter)
              .map(p => (
                <div key={p.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center gap-4 relative">
                  {p.status === 'unsold' && (
                    <button 
                      onClick={async () => {
                        if(window.confirm(`Mark ${p.name} as available again?`)) {
                          await update(ref(rtdb, `tournaments/${activePool?.id}/players/${p.id}`), {
                            status: 'available',
                            currentBid: 0,
                            currentBidderId: null
                          });
                        }
                      }}
                      className="absolute -top-2 -right-2 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg z-10 transition-all border border-blue-400/20"
                      title="Re-auction Player"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                  <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden flex-shrink-0 relative group">
                  {p.image ? (
                    <img src={p.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                      <UserIcon className="w-6 h-6" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <FileUp className="w-4 h-4 text-white" />
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handlePlayerImageUpload(e, p)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs uppercase">{p.name}</p>
                  <p className="text-[8px] text-zinc-500 font-bold uppercase">{p.status} • {formatPoints(p.basePrice)}</p>
                </div>
                <button onClick={async () => window.confirm('Delete?') && set(ref(rtdb, `tournaments/${activePool?.id}/players/${p.id}`), null)} className="p-2 text-zinc-800 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
