import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, Activity, PenTool, Menu, X } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/analysis', label: 'Analysis', icon: Activity },
    { path: '/input', label: 'Data Input', icon: PenTool },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-50">
          <div className="flex items-center">
            <Activity className="w-6 h-6 text-accent-500" />
            <span className="ml-2 font-bold text-lg tracking-tight text-white">ProFormance</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:w-20 lg:w-64
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Desktop Logo */}
        <div className="hidden md:flex h-16 items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800">
          <Activity className="w-8 h-8 text-accent-500" />
          <span className="hidden lg:block ml-3 font-bold text-xl tracking-tight text-white">ProFormance</span>
        </div>

        {/* Mobile Menu Header (inside drawer) */}
        <div className="md:hidden h-16 flex items-center px-6 border-b border-slate-800">
          <span className="font-bold text-xl tracking-tight text-white">Menu</span>
        </div>

        <nav className="flex-1 py-6 space-y-2 px-3 lg:px-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 lg:px-4 py-3 rounded-lg transition-colors group ${
                  isActive
                    ? 'bg-primary-500/10 text-primary-500'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <Icon className={`w-6 h-6 min-w-[24px] ${isActive ? 'text-primary-500' : 'group-hover:text-white'}`} />
                <span className="ml-3 font-medium md:hidden lg:block">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 text-xs text-slate-600 md:hidden lg:block">
          <p>v1.1.0 Mobile Ready</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950 pt-16 md:pt-0">
        <div className="flex-1 overflow-auto p-4 md:p-8 scroll-smooth">
            <div className="max-w-7xl mx-auto w-full">
                {children}
            </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;