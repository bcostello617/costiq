import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, FolderOpen, BarChart3, GitCompareArrows,
  Brain, Upload, Settings, ChevronLeft, ChevronRight,
  Building2, Menu, X, Layers, FileText, Database, ChevronDown,
  Calculator, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const DIVISIONS = [
  { id: '01', label: 'General Conditions' },
  { id: '02', label: 'Site Work' },
  { id: '03', label: 'Concrete' },
  { id: '04', label: 'Masonry' },
  { id: '05', label: 'Metals' },
  { id: '06', label: 'Wood & Plastics' },
  { id: '07', label: 'Thermal & Moisture' },
  { id: '08', label: 'Doors & Windows' },
  { id: '09', label: 'Finishes' },
  { id: '10', label: 'Specialties' },
  { id: '11', label: 'Equipment' },
  { id: '12', label: 'Furnishings' },
  { id: '14', label: 'Conveying' },
  { id: '15', label: 'Mechanical' },
  { id: '16', label: 'Electrical' },
];

const navItems = [
  { path: '/',               label: 'Dashboard',   icon: LayoutDashboard },
  { path: '/projects',       label: 'Projects',    icon: FolderOpen },
  { path: '/analytics',      label: 'Analytics',   icon: BarChart3 },
  { path: '/compare',        label: 'Compare',     icon: GitCompareArrows },
  { path: '/benchmarks',     label: 'Benchmarks',  icon: Layers },
  { path: '/copilot',        label: 'AI Copilot',  icon: Brain },
  { path: '/import',         label: 'Import',      icon: Upload },
  { path: '/pdf-import',     label: 'PDF Import',  icon: FileText },
];

export default function AppLayout() {
  const [collapsed, setCollapsed]           = useState(false);
  const [mobileOpen, setMobileOpen]         = useState(false);
  const [warehouseOpen, setWarehouseOpen]   = useState(true);
  const [estimatorOpen, setEstimatorOpen]   = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const isWarehouseActive  = location.pathname === '/data-warehouse';
  const isEstimatorActive  = location.pathname.startsWith('/estimator') || location.pathname === '/estimates';
  const currentDiv = new URLSearchParams(location.search).get('div');

  function handleWarehouseClick() {
    if (collapsed) {
      // When sidebar is collapsed, just navigate to the overview
      navigate('/data-warehouse');
      setMobileOpen(false);
      return;
    }
    if (isWarehouseActive && !currentDiv) {
      // Already on overview — just toggle the sub-menu
      setWarehouseOpen(o => !o);
    } else {
      navigate('/data-warehouse');
      setWarehouseOpen(true);
      setMobileOpen(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen &&
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      }

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:relative z-50 h-full flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-60",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className={cn("flex items-center h-16 px-4 border-b border-sidebar-border", collapsed && "justify-center")}>
          <Building2 className="h-7 w-7 text-sidebar-primary shrink-0" />
          {!collapsed &&
            <div className="ml-3">
              <span className="text-lg font-bold tracking-tight text-sidebar-foreground">Cost</span>
              <span className="text-lg font-bold tracking-tight text-[hsl(var(--sidebar-background))]">IQ</span>
            </div>
          }
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}

          {/* ── Data Warehouse group ── */}
          <div>
            {/* Parent row */}
            <button
              onClick={handleWarehouseClick}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isWarehouseActive && !currentDiv
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Database className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Data Warehouse</span>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    warehouseOpen ? "rotate-0" : "-rotate-90"
                  )} />
                </>
              )}
            </button>

            {/* Division sub-items */}
            {!collapsed && warehouseOpen && (
              <div className="mt-0.5 ml-3 pl-4 border-l border-sidebar-border/50 space-y-0.5">
                {DIVISIONS.map(div => {
                  const isDiv = isWarehouseActive && currentDiv === div.id;
                  return (
                    <Link
                      key={div.id}
                      to={`/data-warehouse?div=${div.id}`}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-all",
                        isDiv
                          ? "bg-sidebar-primary/20 text-sidebar-primary"
                          : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                    >
                      <span className="font-mono text-[10px] w-5 shrink-0 opacity-60">{div.id}</span>
                      {div.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          {/* ── Estimator group ── */}
          <div>
            <button
              onClick={() => {
                if (collapsed) { navigate('/estimator/new'); setMobileOpen(false); return; }
                setEstimatorOpen(o => !o);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isEstimatorActive && location.pathname.startsWith('/estimator')
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Calculator className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Estimator</span>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    estimatorOpen ? "rotate-0" : "-rotate-90"
                  )} />
                </>
              )}
            </button>

            {!collapsed && estimatorOpen && (
              <div className="mt-0.5 ml-3 pl-4 border-l border-sidebar-border/50 space-y-0.5">
                <Link
                  to="/estimator/new"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-all",
                    location.pathname.startsWith('/estimator')
                      ? "bg-sidebar-primary/20 text-sidebar-primary"
                      : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <Calculator className="h-3.5 w-3.5 shrink-0" />
                  New Estimate
                </Link>
                <Link
                  to="/estimates"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-all",
                    location.pathname === '/estimates'
                      ? "bg-sidebar-primary/20 text-sidebar-primary"
                      : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                  Saved Estimates
                </Link>
              </div>
            )}
          </div>

        </nav>

        {/* Collapse toggle */}
        <div className="hidden lg:flex p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">v1.0 MVP</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
