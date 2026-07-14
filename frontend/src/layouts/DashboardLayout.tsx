import { useEffect, useState, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useUser, useClerk, useAuth } from '@clerk/clerk-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTeamStore } from '../store/store';
import { api } from '../lib/api';
import { getInitials, getAvatarColor } from '../lib/utils';
import { 
  LayoutDashboard, 
  Video, 
  CheckSquare, 
  Users, 
  BarChart2, 
  Settings, 
  LogOut,
  MoreHorizontal,
  Bell,
  PlayCircle
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', path: '/dashboard' },
  { icon: Video, label: 'Meetings', path: '/dashboard?tab=meetings' },
  { icon: PlayCircle, label: 'Recordings', path: '/dashboard?tab=recordings' },
  { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
  { icon: Users, label: 'Team', path: '/dashboard?tab=team' },
  { icon: BarChart2, label: 'Analytics', path: '/dashboard?tab=analytics' },
  { icon: Settings, label: 'Settings', path: '/dashboard?tab=settings' },
];

export default function DashboardLayout() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tab = searchParams.get('tab');
  const navigate = useNavigate();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const { teams, setTeams } = useTeamStore();

  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  const fetchTeams = async () => {
    try {
      const token = await getToken();
      if (token) {
        const data = await api.getTeams(token);
        setTeams(data);
      }
    } catch (error) {
      console.error("Failed to fetch teams", error);
    } finally {
      setTeamsLoaded(true);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [getToken, setTeams]);

  const { data: myInvites = [] } = useQuery({
    queryKey: ['myInvites'],
    queryFn: async () => api.getMyInvites(await getToken() || ''),
    refetchInterval: 15000
  });

  const { mutate: respondToInvite, isPending: isResponding } = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'accept' | 'decline' }) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await api.respondToInvite(id, action, token);
      return action;
    },
    onSuccess: (action) => {
      queryClient.invalidateQueries({ queryKey: ['myInvites'] });
      if (action === 'accept') {
        fetchTeams();
      }
    },
    onError: (error: any) => {
      window.alert(error.message || 'Failed to respond to invite. Please try again.');
    }
  });

  const { data: myMeetingInvites = [] } = useQuery({
    queryKey: ['myMeetingInvites'],
    queryFn: async () => api.getMyMeetingInvites(await getToken() || ''),
    refetchInterval: 15000
  });

  const { mutate: respondToMeetingInvite, isPending: isRespondingToMeeting } = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'accept' | 'decline' }) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await api.respondToMeetingInvite(id, action, token);
      return action;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myMeetingInvites'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingMeetings'] });
    },
    onError: (error: any) => {
      window.alert(error.message || 'Failed to respond to invite. Please try again.');
    }
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isNotifOpen && notifPanelRef.current && !notifPanelRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotifOpen]);

  useEffect(() => {
    if (teamsLoaded && teams.length === 0) {
      navigate('/onboarding');
    }
  }, [teamsLoaded, teams.length, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const activeInvites = tab === 'team' ? myInvites : myMeetingInvites;

  return (
    <div className="flex h-screen bg-[#FAFAFA] font-sans overflow-hidden">
      {(tab === 'team' || tab === 'meetings') && (
        <div ref={notifPanelRef} className="absolute top-8 right-8 z-40">
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative w-10 h-10 rounded-full bg-white border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center text-[#374151] hover:bg-[#F3F4F6] transition-colors"
          >
            <Bell size={18} />
            {activeInvites.length > 0 && (
              <span className="absolute -top-1 -right-1 w-[18px] h-[18px] bg-[#EF4444] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {activeInvites.length > 9 ? '9+' : activeInvites.length}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E5E7EB] rounded-[12px] shadow-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#F3F4F6]">
                <h3 className="text-[14px] font-[600] text-[#111827]">{tab === 'team' ? 'Team Invites' : 'Meeting Invites'}</h3>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {activeInvites.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[#9CA3AF] text-[13px]">No pending invites</div>
                ) : activeInvites.map((invite: any) => (
                  <div key={invite._id} className="px-4 py-3 border-b border-[#F3F4F6] last:border-b-0">
                    <p className="text-[13px] text-[#374151] mb-2.5 leading-relaxed">
                      {tab === 'team' ? (
                        <>
                          <span className="font-[600] text-[#111827]">{invite.invitedByName}</span> invited you to their team <span className="font-[600] text-[#111827]">{invite.teamName}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-[600] text-[#111827]">{invite.invitedByName}</span> invited you to their meeting titled <span className="font-[600] text-[#111827]">{invite.sessionTopic}</span> at {new Date(invite.startTime).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => tab === 'team' ? respondToInvite({ id: invite._id, action: 'accept' }) : respondToMeetingInvite({ id: invite._id, action: 'accept' })}
                        disabled={isResponding || isRespondingToMeeting}
                        className="flex-1 px-3 py-1.5 bg-[#4F46E5] text-white text-[12px] font-[500] rounded-md hover:bg-[#4338CA] transition-colors disabled:opacity-60"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => tab === 'team' ? respondToInvite({ id: invite._id, action: 'decline' }) : respondToMeetingInvite({ id: invite._id, action: 'decline' })}
                        disabled={isResponding || isRespondingToMeeting}
                        className="flex-1 px-3 py-1.5 bg-[#F3F4F6] text-[#374151] text-[12px] font-[500] rounded-md hover:bg-[#E5E7EB] transition-colors disabled:opacity-60"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-[#E5E7EB] flex flex-col flex-shrink-0">
        <div className="h-14 border-b border-[#E5E7EB] flex items-center px-5">
          <span className="text-[#4F46E5] text-[17px] font-bold tracking-[-0.02em]">IntellMeet</span>
        </div>
        
        
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.path === '/dashboard'
              ? location.pathname === '/dashboard' && !tab
              : item.path.includes('?tab=')
                ? location.pathname + location.search === item.path
                : location.pathname === item.path;
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
                {item.label === 'Team' && myInvites.length > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6] ml-auto flex-shrink-0" />
                )}
                {item.label === 'Meetings' && myMeetingInvites.length > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6] ml-auto flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="border-t border-[#E5E7EB] p-4 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="Profile" className="w-8 h-8 rounded-full flex-shrink-0 object-cover" />
            ) : (
              <div 
                className="rounded-full flex items-center justify-center text-white flex-shrink-0"
                style={{ width: 32, height: 32, background: getAvatarColor(user?.id || 'default'), fontSize: 11, fontWeight: 600 }}
              >
                {getInitials(user?.fullName)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[#111827] text-[13px] font-medium truncate">{user?.fullName || 'User'}</div>
              <div className="text-[#9CA3AF] text-[12px] truncate">{user?.primaryEmailAddress?.emailAddress || 'user@example.com'}</div>
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
