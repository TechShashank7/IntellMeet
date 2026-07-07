import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatMeetingDuration, getInitials, getAvatarColor } from '../lib/utils';
import { useTeamStore } from '../store/store';
import { 
  Plus, 
  Calendar, 
  ArrowRight,
  FileText,
  Video,
  LogIn,
  MonitorUp,
  Sparkles
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';



const actionItemsMock = [
  {
    id: '1',
    title: 'Update Q3 financial projections based on Acme Corp deal',
    meeting: 'Client Discovery — Acme Corp',
    assignee: { name: 'Shashank Raj', initials: 'SR', color: '#4F46E5' },
    dueDate: 'Today',
    isOverdue: false
  },
  {
    id: '2',
    title: 'Review and approve mobile app wireframes',
    meeting: 'Design Review: Mobile App',
    assignee: { name: 'Julia Liu', initials: 'JL', color: '#10B981' },
    dueDate: 'Yesterday',
    isOverdue: true
  },
  {
    id: '3',
    title: 'Send database index report to engineering channel',
    meeting: 'Engineering Standup',
    assignee: { name: 'Marcus Kim', initials: 'MK', color: '#3B82F6' },
    dueDate: 'Tomorrow',
    isOverdue: false
  }
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const { user } = useUser();
  const { getToken } = useAuth();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  
  const queryClient = useQueryClient();
  const { currentTeamId } = useTeamStore();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState<{ success: boolean; text: string } | null>(null);

  const { data: teamMembers = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ['teamMembers', currentTeamId],
    queryFn: async () => api.getTeamMembers(currentTeamId || '', await getToken() || ''),
    enabled: !!currentTeamId && tab === 'team'
  });

  const { mutate: inviteMember, isPending: isInviting } = useMutation({
    mutationFn: async (email: string) => api.inviteTeamMember(currentTeamId || '', await getToken() || '', email),
    onSuccess: (res) => {
      setInviteMessage({ success: res.success, text: res.message });
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['teamMembers', currentTeamId] });
        setInviteEmail('');
      }
    }
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMember(inviteEmail.trim());
  };

  const { data: upcomingMeetings = [], isLoading: isLoadingUpcoming } = useQuery({
    queryKey: ['upcomingMeetings'],
    queryFn: async () => {
      const token = await getToken();
      return api.getUpcomingMeetings(token || '');
    }
  });

  const { data: recentMeetings = [], isLoading: isLoadingRecent } = useQuery({
    queryKey: ['recentMeetings'],
    queryFn: async () => {
      const token = await getToken();
      return api.getRecentMeetings(token || '');
    }
  });


  const handleNewMeeting = async () => {
    const topic = window.prompt('Meeting topic:', 'Quick Sync');
    if (!topic || topic.trim() === '') return;
    try {
      const token = await getToken();
      if (!token) return;
      const session = await api.createMeeting(token, topic);
      navigate(`/meeting/${session._id}`);
    } catch (error) {
      console.error('Error creating meeting:', error);
      window.alert('Failed to create meeting, please try again.');
    }
  };

  const handleJoinWithCode = () => {
    const id = window.prompt('Enter meeting ID:');
    if (!id || id.trim() === '') return;
    navigate(`/meeting/${id.trim()}`);
  };

  const handleJoinMeeting = (id: string) => {
    navigate(`/meeting/${id}`);
  };

  const handleViewSummary = (id: string) => {
    navigate(`/summary/${id}`);
  };

  const toggleItem = (id: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  if (tab === 'team') {
    const currentUserMember = teamMembers.find((m: any) => m.clerkId === user?.id);
    const isCurrentUserAdmin = currentUserMember?.isAdmin;

    return (
      <div className="bg-[#FAFAFA] min-h-screen w-full font-['Inter'] p-8">
        <h2 className="text-[24px] font-[600] text-[#111827] mb-6">Team Members</h2>
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-6 shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
          {isLoadingMembers ? (
            <p className="text-[#6B7280] text-[14px]">Loading members...</p>
          ) : (
            <div className="space-y-4">
              {teamMembers.length === 0 && (
                <div className="p-4 text-sm text-gray-500">
                  <p>Debug Info:</p>
                  <pre>
                    currentTeamId: {currentTeamId}
                    {'\n'}
                    isLoading: {isLoadingMembers ? 'true' : 'false'}
                  </pre>
                </div>
              )}
              {teamMembers.map((member: any) => (
                <div key={member.clerkId} className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-lg">
                  <div className="flex items-center gap-4">
                    {member.profileImage ? (
                      <img src={member.profileImage} alt={member.name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                    ) : (
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm"
                        style={{ background: getAvatarColor(member.clerkId) }}
                      >
                        {getInitials(member.name)}
                      </div>
                    )}
                    <div>
                      <div className="text-[14px] font-[600] text-[#111827] flex items-center gap-2">
                        {member.name}
                        {member.isAdmin && (
                          <span className="bg-[#EEF2FF] text-[#4F46E5] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border border-[#EEF2FF]">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] text-[#6B7280]">{member.email}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isCurrentUserAdmin && (
            <div className="mt-8 pt-6 border-t border-[#E5E7EB]">
              <h3 className="text-[15px] font-[600] text-[#111827] mb-4">Invite Team Member</h3>
              <form onSubmit={handleInvite} className="flex flex-col gap-3 max-w-md">
                <div className="flex items-center gap-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Email address"
                    className="flex-1 border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none"
                    required
                    disabled={isInviting}
                  />
                  <button
                    type="submit"
                    disabled={isInviting || !inviteEmail.trim()}
                    className="px-4 py-2 bg-[#4F46E5] text-white rounded-md text-[13px] font-medium hover:bg-[#4338CA] transition-colors disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isInviting ? 'Inviting...' : 'Invite'}
                  </button>
                </div>
                {inviteMessage && (
                  <div className={`text-[13px] p-2 rounded-md ${inviteMessage.success ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}>
                    {inviteMessage.text}
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FAFAFA] min-h-screen w-full font-['Inter']">
      <div className="max-w-[1200px] mx-auto w-full px-[32px] pb-[32px]">
        
        {/* Section 1 — Page Header */}
        <div className="flex items-center justify-between pt-[32px]">
          <div>
            <h1 className="text-[24px] font-[700] text-[#111827] leading-tight">
              Good morning, {user?.firstName || 'Shashank'}
            </h1>
            <p className="text-[#6B7280] text-[14px] mt-1 font-[400]">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleJoinWithCode} className="h-[36px] px-4 bg-transparent border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6] rounded-[8px] text-[14px] font-[500] transition-colors flex items-center justify-center">
              Join with Code
            </button>
            <button onClick={handleNewMeeting} className="h-[36px] px-4 bg-[#4F46E5] text-white hover:bg-[#4338CA] rounded-[8px] text-[14px] font-[500] transition-colors flex items-center justify-center gap-2">
              <Plus size={16} />
              New Meeting
            </button>
          </div>
        </div>

        {/* Section 2 — KPI Stats Row */}
        <div className="flex gap-[24px] mt-[24px]">
          {/* Card 1 */}
          <div className="flex-1 bg-[#FFFFFF] p-[20px] rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
            <h3 className="text-[#6B7280] text-[13px] font-[400] mb-2">Meetings This Week</h3>
            <div className="flex items-baseline gap-3">
              <span className="text-[28px] font-[700] text-[#111827] leading-none">12</span>
              <span className="bg-[#D1FAE5] text-[#065F46] text-[12px] font-[400] px-[8px] py-[2px] rounded-[6px]">
                +2 from last week
              </span>
            </div>
          </div>
          {/* Card 2 */}
          <div className="flex-1 bg-[#FFFFFF] p-[20px] rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.04)] relative">
            <h3 className="text-[#6B7280] text-[13px] font-[400] mb-2">Open Action Items</h3>
            <div className="flex items-baseline gap-3">
              <span className="text-[28px] font-[700] text-[#111827] leading-none">7</span>
              <span className="bg-[#FEF3C7] text-[#92400E] text-[12px] font-[400] px-[8px] py-[2px] rounded-[6px]">
                3 due today
              </span>
            </div>
            <button onClick={() => navigate('/tasks')} className="absolute top-[20px] right-[20px] text-[#4F46E5] text-[13px] font-[400] hover:underline">
              View board &rarr;
            </button>
          </div>
        </div>

        {/* Section 3 — Core Action Launcher (Compact Zoom-style) */}
        <div className="flex justify-evenly mt-[44px] w-full">
          {/* Action 1 */}
          <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={handleNewMeeting}>
            <button className="w-[80px] h-[80px] bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center justify-center group-hover:bg-[#F5F3FF] group-hover:border-[#C7D2FE] hover:bg-[#F5F3FF] hover:border-[#C7D2FE] transition-all">
              <Video size={24} className="text-[#4F46E5]" />
            </button>
            <span className="text-[12px] font-[500] text-[#374151] group-hover:text-[#4F46E5] transition-colors">New Meeting</span>
          </div>
          {/* Action 2 */}
          <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={handleJoinWithCode}>
            <button className="w-[80px] h-[80px] bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center justify-center group-hover:bg-[#F5F3FF] group-hover:border-[#C7D2FE] hover:bg-[#F5F3FF] hover:border-[#C7D2FE] transition-all">
              <LogIn size={24} className="text-[#4F46E5]" />
            </button>
            <span className="text-[12px] font-[500] text-[#374151] group-hover:text-[#4F46E5] transition-colors">Join</span>
          </div>
          {/* Action 3 */}
          <div className="flex flex-col items-center gap-2 cursor-pointer group">
            <button className="w-[80px] h-[80px] bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center justify-center group-hover:bg-[#F5F3FF] group-hover:border-[#C7D2FE] hover:bg-[#F5F3FF] hover:border-[#C7D2FE] transition-all">
              <Calendar size={24} className="text-[#4F46E5]" />
            </button>
            <span className="text-[12px] font-[500] text-[#374151] group-hover:text-[#4F46E5] transition-colors">Schedule</span>
          </div>
          {/* Action 4 */}
          <div className="flex flex-col items-center gap-2 cursor-pointer group text-center">
            <button className="w-[80px] h-[80px] bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center justify-center group-hover:bg-[#F5F3FF] group-hover:border-[#C7D2FE] hover:bg-[#F5F3FF] hover:border-[#C7D2FE] transition-all">
              <MonitorUp size={24} className="text-[#4F46E5]" />
            </button>
            <span className="text-[12px] font-[500] text-[#374151] group-hover:text-[#4F46E5] transition-colors leading-tight">Share Screen</span>
          </div>
        </div>

        {/* Section 4 — Two Column Content Area */}
        <div className="flex items-stretch gap-[24px] mt-[44px]">
          {/* Left Column — Upcoming Meetings */}
          <div className="w-[58%] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-[16px] font-[600] text-[#111827]">Upcoming Meetings</h2>
              <button className="text-[#4F46E5] text-[13px] font-[400] hover:underline">View Calendar &rarr;</button>
            </div>
            <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col flex-1">
              <div className="flex flex-col">
                {isLoadingUpcoming ? (
                  <div className="p-5 text-[#6B7280] text-[14px]">Loading upcoming meetings...</div>
                ) : upcomingMeetings.length === 0 ? (
                  <div className="p-5 text-[#6B7280] text-[14px]">No upcoming meetings</div>
                ) : upcomingMeetings.map((meeting: any, index: number) => {
                  const meetingDate = new Date(meeting.startTime || meeting.date);
                  const isMeetingToday = isToday(meetingDate);
                  const timeStr = format(meetingDate, 'h:mm a');
                  const durationStr = formatMeetingDuration(meeting.startTime || meeting.date, meeting.endTime, meeting.estimatedDuration);
                  
                  return (
                  <div 
                    key={meeting.id} 
                    className={`relative p-5 flex items-center justify-between group hover:bg-[#F9FAFB] transition-colors ${index !== upcomingMeetings.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}
                  >
                    {/* Left Border indicator */}
                    <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${isMeetingToday ? 'bg-[#4F46E5]' : 'bg-[#E5E7EB]'}`} />
                    
                    <div className="flex-1 pl-2">
                      <h4 className="text-[15px] font-[600] text-[#111827] mb-1">{meeting.title}</h4>
                      <div className="flex items-center text-[13px] text-[#6B7280] font-[400] gap-1.5">
                        <Calendar size={13} />
                        <span>{timeStr} • {durationStr}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {/* Avatars */}
                      <div className="flex -space-x-[8px]">
                        {meeting.attendees?.map((attendee: any, i: number) => (
                          <div 
                            key={i} 
                            className="w-[28px] h-[28px] rounded-full border-[2px] border-[#FFFFFF] flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                            style={{ background: attendee.color }}
                            title={attendee.name}
                          >
                            {attendee.initials}
                          </div>
                        ))}
                      </div>
                      
                      <button 
                        onClick={() => handleJoinMeeting(meeting.id)}
                        className="opacity-0 group-hover:opacity-100 h-[32px] px-3 bg-transparent border border-[#4F46E5] text-[#4F46E5] rounded-[6px] hover:bg-[#EEF2FF] text-[13px] font-[500] transition-all ml-2"
                      >
                        Join
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
              <div className="border-t border-[#F3F4F6] p-3 text-center mt-auto shrink-0">
                <button className="text-[#4F46E5] text-[13px] font-[400] hover:underline">See all meetings &rarr;</button>
              </div>
            </div>
          </div>

          {/* Right Column — Recent AI Summaries */}
          <div className="w-[42%] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-[16px] font-[600] text-[#111827]">Recent AI Summaries</h2>
              <button className="text-[#4F46E5] text-[13px] font-[400] hover:underline">View All &rarr;</button>
            </div>
            <div className="flex flex-col gap-[12px] flex-1">
              {isLoadingRecent ? (
                <div className="text-[#6B7280] text-[14px]">Loading recent meetings...</div>
              ) : recentMeetings.length === 0 ? (
                <div className="text-[#6B7280] text-[14px]">No recent meetings</div>
              ) : recentMeetings.map((summary: any) => {
                const meetingDate = new Date(summary.startTime || summary.date);
                let dateLabel = format(meetingDate, 'MMM d');
                if (isToday(meetingDate)) dateLabel = 'Today';
                else if (isYesterday(meetingDate)) dateLabel = 'Yesterday';
                
                const summaryText = summary.summary ? summary.summary : 'Summary pending';
                const actionItemsCount = summary.actionItems?.length || 0;

                return (
                <div 
                  key={summary.id} 
                  className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] p-[16px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] hover:border-[#D1D5DB] transition-colors cursor-pointer flex-1 flex flex-col justify-center"
                  onClick={() => handleViewSummary(summary.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-[28px] h-[28px] rounded-[6px] bg-[#EEF2FF] flex items-center justify-center flex-shrink-0 relative">
                        <FileText size={14} className="text-[#4F46E5]" />
                        <Sparkles size={8} className="text-[#4F46E5] absolute top-[4px] right-[4px]" />
                      </div>
                      <h4 className="text-[15px] font-[600] text-[#111827] truncate">{summary.title}</h4>
                    </div>
                    <span className="bg-[#F3F4F6] text-[#6B7280] text-[12px] font-[400] px-[8px] py-[2px] rounded-[6px] flex-shrink-0">
                      {dateLabel}
                    </span>
                  </div>
                  
                  <p className="text-[13px] text-[#6B7280] font-[400] line-clamp-2 leading-[1.5] mb-3">
                    {summaryText}
                  </p>
                  
                  {actionItemsCount > 0 ? (
                    <div className="flex items-center gap-1 text-[12px] font-[400] text-[#4F46E5]">
                      {actionItemsCount} action item{actionItemsCount !== 1 ? 's' : ''}
                      <ArrowRight size={12} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[12px] font-[400] text-[#6B7280]">
                      No action items
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 5 — My Action Items */}
        <div className="mt-[44px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-[600] text-[#111827]">My Action Items</h2>
            <button onClick={() => navigate('/tasks')} className="text-[#4F46E5] text-[13px] font-[400] hover:underline">Go to Task Board &rarr;</button>
          </div>
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex flex-col">
              {actionItemsMock.map((item, index) => (
                <div 
                  key={item.id} 
                  className={`p-[16px] flex items-center justify-between hover:bg-[#F9FAFB] transition-colors group ${index !== actionItemsMock.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}
                >
                  <div className="flex items-center gap-4 flex-1 overflow-hidden">
                    <input 
                      type="checkbox" 
                      checked={!!checkedItems[item.id]}
                      onChange={() => toggleItem(item.id)}
                      className="w-[16px] h-[16px] border border-[#D1D5DB] rounded-[4px] text-[#4F46E5] focus:ring-[#4F46E5] cursor-pointer appearance-none checked:bg-[#4F46E5] checked:border-transparent flex-shrink-0 relative checked:after:content-['✓'] checked:after:absolute checked:after:text-white checked:after:text-[10px] checked:after:left-[3px] checked:after:top-[0px]"
                    />
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[14px] font-[400] truncate transition-all ${checkedItems[item.id] ? 'line-through text-[#9CA3AF]' : 'text-[#111827]'}`}>
                        {item.title}
                      </span>
                      <span className="bg-[#F3F4F6] text-[#6B7280] text-[12px] font-[400] px-[8px] py-[2px] rounded-[6px] flex-shrink-0">
                        From: {item.meeting}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    {item.isOverdue && !checkedItems[item.id] && (
                      <span className="bg-[#FEF2F2] text-[#DC2626] text-[12px] font-[400] px-[8px] py-[2px] rounded-[6px]">
                        Overdue
                      </span>
                    )}
                    <span className="text-[12px] font-[400] text-[#9CA3AF]">{item.dueDate}</span>
                    <div 
                      className={`w-[24px] h-[24px] rounded-full border border-[#FFFFFF] flex items-center justify-center text-white text-[9px] font-bold shadow-sm transition-opacity ${checkedItems[item.id] ? 'opacity-50' : 'opacity-100'}`}
                      style={{ background: item.assignee.color }}
                      title={item.assignee.name}
                    >
                      {item.assignee.initials}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
