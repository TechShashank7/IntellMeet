import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/store';
import { 
  LayoutDashboard, 
  Video, 
  CheckSquare, 
  Users, 
  BarChart2, 
  Settings, 
  LogOut,
  MoreHorizontal
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', path: '/dashboard' },
  { icon: Video, label: 'Meetings', path: '/dashboard?tab=meetings' },
  { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
  { icon: Users, label: 'Team', path: '/dashboard?tab=team' },
  { icon: BarChart2, label: 'Analytics', path: '/dashboard?tab=analytics' },
  { icon: Settings, label: 'Settings', path: '/dashboard?tab=settings' },
];

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#FAFAFA] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-[#E5E7EB] flex flex-col flex-shrink-0">
        <div className="h-14 border-b border-[#E5E7EB] flex items-center px-5">
          <span className="text-[#4F46E5] text-[17px] font-bold tracking-[-0.02em]">IntellMeet</span>
        </div>
        
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname + location.search === item.path;
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors text-[14px] ${
                  isActive 
                    ? 'bg-[#EEF2FF] text-[#4F46E5] font-medium' 
                    : 'text-[#374151] hover:bg-[#F3F4F6] font-normal'
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="border-t border-[#E5E7EB] p-4 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div 
              className="rounded-full flex items-center justify-center text-white flex-shrink-0"
              style={{ width: 32, height: 32, background: user?.color || '#4F46E5', fontSize: 11, fontWeight: 600 }}
            >
              {user?.initials || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[#111827] text-[13px] font-medium truncate">{user?.name || 'User'}</div>
              <div className="text-[#9CA3AF] text-[12px] truncate">{user?.email || 'user@example.com'}</div>
            </div>
            <button className="text-[#9CA3AF] hover:text-[#6B7280]">
              <MoreHorizontal size={15} />
            </button>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-[#EF4444] text-[12px] hover:bg-[#FEF2F2] px-2 py-1.5 rounded-md mt-1 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative">
        <Outlet />
      </main>
    </div>
  );
}
