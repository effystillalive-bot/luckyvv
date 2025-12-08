import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, Activity, PenTool } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/analysis', label: 'Analysis', icon: Activity },
    { path: '/input', label: 'Data Input', icon: PenTool },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 bg-slate-900 border-r border-slate-800 flex-shrink-0 flex flex-col transition-all duration-300">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800">
          <Activity className="w-8 h-8 text-accent-500" />
          <span className="hidden lg:block ml-3 font-bold text-xl tracking-tight text-white">ProFormance</span>
        </div>

        <nav className="flex-1 py-6 space-y-2 px-2 lg:px-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-2 lg:px-4 py-3 rounded-lg transition-colors group ${
                  isActive
                    ? 'bg-primary-500/10 text-primary-500'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'text-primary-500' : 'group-hover:text-white'}`} />
                <span className="hidden lg:block ml-3 font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 text-xs text-slate-600 hidden lg:block">
          <p>v1.1.0 Local</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        <div className="flex-1 overflow-auto p-4 md:p-8">
            <div className="max-w-7xl mx-auto w-full">
                {children}
            </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;