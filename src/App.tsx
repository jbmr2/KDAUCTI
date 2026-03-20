/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, rtdb } from './firebase';
import { ref, onValue, set, get } from 'firebase/database';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { AuctionRoom } from './components/AuctionRoom';
import { AdminDashboard } from './components/AdminDashboard';
import { TeamDashboard } from './components/TeamDashboard';
import { LiveAuction } from './components/LiveAuction';
import { AuctionTicker } from './components/AuctionTicker';
import { PoolController } from './components/PoolController';
import { LEDDisplay } from './components/LEDDisplay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Gavel, Users, ShieldCheck, Play, Tv, Key, Monitor } from 'lucide-react';

type View = 'auction' | 'admin' | 'team' | 'live-auction' | 'ticker' | 'pool-controller' | 'led';

export default function App() {
  const [user, loading] = useAuthState(auth);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentView, setCurrentView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'ticker') return 'ticker';
    if (view === 'pool') return 'pool-controller';
    if (view === 'led') return 'led';
    return 'auction';
  });

  useEffect(() => {
    if (user) {
      // Initialize/Update user record
      const userRef = ref(rtdb, `users/${user.uid}`);
      get(userRef).then((snapshot) => {
        if (!snapshot.exists()) {
          const isInitialAdmin = user.email === 'jbmrsports@gmail.com';
          set(userRef, {
            email: user.email,
            name: user.displayName || 'User',
            role: isInitialAdmin ? 'admin' : 'viewer',
            createdAt: new Date().toISOString()
          });
        }
      });

      // Check if user is admin from Realtime Database
      const roleRef = ref(rtdb, `users/${user.uid}/role`);
      const unsub = onValue(roleRef, (snapshot) => {
        const role = snapshot.val();
        setIsAdmin(role === 'admin' || user.email === 'jbmrsports@gmail.com');
      });
      return () => unsub();
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && !['ticker', 'pool-controller', 'led'].includes(currentView)) {
    return <LandingPage />;
  }

  return (
    <ErrorBoundary>
      <div className={`min-h-screen ${['ticker', 'led', 'pool-controller'].includes(currentView) ? 'bg-transparent' : 'bg-zinc-950'} text-zinc-100 font-sans selection:bg-emerald-500/30`}>
        {!['ticker', 'led', 'pool-controller'].includes(currentView) && <Navbar isAdmin={isAdmin} />}
        
        <main>
          {currentView === 'auction' && <AuctionRoom />}
          {currentView === 'admin' && isAdmin && <AdminDashboard />}
          {currentView === 'team' && <TeamDashboard />}
          {currentView === 'live-auction' && isAdmin && <LiveAuction />}
          {currentView === 'pool-controller' && <PoolController />}
          {currentView === 'led' && <LEDDisplay />}
          {currentView === 'ticker' && <div className="fixed bottom-0 left-0 right-0"><AuctionTicker /></div>}
        </main>

        {/* Bottom Navigation */}
        {!['ticker', 'led', 'pool-controller'].includes(currentView) && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-2 p-2 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl overflow-x-auto max-w-[90vw] no-scrollbar">
              <button
                onClick={() => setCurrentView('auction')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all flex-shrink-0 ${
                  currentView === 'auction' 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Gavel className="w-5 h-5" />
                <span className="hidden sm:inline">AUCTION</span>
              </button>
              <button
                onClick={() => setCurrentView('team')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all flex-shrink-0 ${
                  currentView === 'team' 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="hidden sm:inline">MY TEAM</span>
              </button>
              <button
                onClick={() => setCurrentView('pool-controller')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all flex-shrink-0 ${
                  currentView === 'pool-controller' 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Key className="w-5 h-5" />
                <span className="hidden sm:inline">POOL ACCESS</span>
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => setCurrentView('live-auction')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all flex-shrink-0 ${
                      currentView === 'live-auction' 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <Play className="w-5 h-5" />
                    <span className="hidden sm:inline">LIVE</span>
                  </button>
                  <button
                    onClick={() => setCurrentView('led')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all flex-shrink-0 ${
                      currentView === 'led' 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <Monitor className="w-5 h-5" />
                    <span className="hidden sm:inline">LED</span>
                  </button>
                  <button
                    onClick={() => setCurrentView('admin')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all flex-shrink-0 ${
                      currentView === 'admin' 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5" />
                    <span className="hidden sm:inline">ADMIN</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
