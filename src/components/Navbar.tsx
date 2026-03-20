import React from 'react';
import { Trophy, LogIn, LogOut, User, ShieldCheck } from 'lucide-react';
import { login, logout, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

export const Navbar = ({ isAdmin }: { isAdmin: boolean }) => {
  const [user] = useAuthState(auth);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Trophy className="w-8 h-8 text-emerald-500" />
            <span className="text-xl font-bold tracking-tight text-zinc-100">KABADDI AUCTION PRO</span>
          </div>
          
          <div className="flex items-center gap-4">
            {isAdmin && (
              <div className="flex items-center gap-1 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-semibold border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                ADMIN
              </div>
            )}
            
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2 text-zinc-400 text-sm">
                  <User className="w-4 h-4" />
                  {user.displayName || user.email}
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 rounded-xl transition-all border border-zinc-800"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
              >
                <LogIn className="w-4 h-4" />
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
