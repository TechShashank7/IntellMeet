import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/store';
import { api } from '../lib/api';
import { 
  Plus, 
  Calendar, 
  Clock, 
  ArrowRight,
  MoreVertical,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: meetings = [], isLoading: loadingMeetings } = useQuery({
    queryKey: ['meetings'],
    queryFn: api.getMeetings,
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: api.getTasks,
  });

  const upcomingMeetings = meetings.filter(m => m.status === 'scheduled');
  const pastMeetings = meetings.filter(m => m.status === 'completed');
  const openTasksCount = tasks.filter(t => t.status !== 'done').length;

  const handleJoinMeeting = (id: string) => {
    navigate(`/meeting/${id}`);
  };

  const handleViewSummary = (id: string) => {
    navigate(`/summary/${id}`);
  };

  const isLoading = loadingMeetings || loadingTasks;

  return (
    <div className="p-8 max-w-[1200px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-[#111827] tracking-tight">
            Good morning, {user?.name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-[#6B7280] text-[14px] mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] rounded-md text-[14px] font-medium transition-colors shadow-sm">
            Join with Code
          </button>
          <button className="px-4 py-2 bg-[#4F46E5] text-white hover:bg-[#4338CA] rounded-md text-[14px] font-medium transition-colors shadow-sm flex items-center gap-2">
            <Plus size={16} />
            New Meeting
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-[#6B7280]">
          Loading dashboard data...
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[#6B7280] text-[13px] font-medium">Meetings This Week</h3>
                <Calendar size={16} className="text-[#9CA3AF]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-bold text-[#111827]">{upcomingMeetings.length + pastMeetings.length}</span>
                <span className="text-[#10B981] text-[12px] font-medium bg-[#D1FAE5] px-2 py-0.5 rounded-full flex items-center gap-1">
                  +2 from last week
                </span>
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[#6B7280] text-[13px] font-medium">Open Action Items</h3>
                <div className="w-4 h-4 rounded-full bg-[#F59E0B] flex items-center justify-center text-white text-[10px] font-bold">!</div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-bold text-[#111827]">{openTasksCount}</span>
                <button onClick={() => navigate('/tasks')} className="text-[#4F46E5] text-[12px] font-medium hover:underline ml-auto">
                  View board →
                </button>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[#6B7280] text-[13px] font-medium">Hours Saved (Est.)</h3>
                <Clock size={16} className="text-[#9CA3AF]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-bold text-[#111827]">4.2h</span>
                <span className="text-[#6B7280] text-[12px]">via AI summaries</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Upcoming Meetings */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-semibold text-[#111827]">Upcoming Meetings</h2>
                <button className="text-[#4F46E5] text-[13px] font-medium hover:underline">View Calendar</button>
              </div>
              <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                {upcomingMeetings.length === 0 ? (
                  <div className="p-8 text-center text-[#6B7280] text-[14px]">No upcoming meetings.</div>
                ) : (
                  <div className="divide-y divide-[#F3F4F6]">
                    {upcomingMeetings.map((meeting) => (
                      <div key={meeting.id} className="p-5 hover:bg-[#F9FAFB] transition-colors flex items-start justify-between group">
                        <div className="flex-1 min-w-0 pr-4">
                          <h4 className="text-[15px] font-semibold text-[#111827] truncate mb-1">{meeting.title}</h4>
                          <div className="flex items-center gap-3 text-[13px] text-[#6B7280]">
                            <span className="flex items-center gap-1.5"><Calendar size={14} /> {meeting.date}</span>
                            <span className="flex items-center gap-1.5"><Clock size={14} /> {meeting.duration}</span>
                          </div>
                          <div className="flex -space-x-2 mt-3">
                            {meeting.attendees.map((attendee, i) => (
                              <div 
                                key={i} 
                                className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                                style={{ background: attendee.color }}
                                title={attendee.name}
                              >
                                {attendee.initials}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleJoinMeeting(meeting.id)}
                            className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-[#EEF2FF] text-[#4F46E5] rounded hover:bg-[#E0E7FF] text-[13px] font-medium transition-all"
                          >
                            Join Room
                          </button>
                          <button className="p-1.5 text-[#9CA3AF] hover:text-[#374151] rounded hover:bg-[#F3F4F6] transition-colors">
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent AI Summaries */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-semibold text-[#111827]">Recent AI Summaries</h2>
                <button className="text-[#4F46E5] text-[13px] font-medium hover:underline">View All</button>
              </div>
              <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-[0_2px_4px_rgba(0,0,0,0.02)] flex flex-col gap-px bg-[#F3F4F6]">
                {pastMeetings.length === 0 ? (
                  <div className="p-8 bg-white text-center text-[#6B7280] text-[14px]">No recent summaries.</div>
                ) : (
                  pastMeetings.map((meeting) => (
                    <div key={meeting.id} className="p-5 bg-white hover:bg-[#F9FAFB] transition-colors cursor-pointer" onClick={() => handleViewSummary(meeting.id)}>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
                          <FileText size={20} className="text-[#4F46E5]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-[15px] font-semibold text-[#111827] truncate">{meeting.title}</h4>
                            <span className="text-[12px] text-[#6B7280] flex-shrink-0 bg-[#F3F4F6] px-2 py-0.5 rounded">{meeting.date.split(',')[0]}</span>
                          </div>
                          <p className="text-[13px] text-[#6B7280] line-clamp-2 leading-relaxed mb-3">
                            {meeting.summary || "Summary generation in progress..."}
                          </p>
                          <div className="flex items-center gap-4 text-[12px] text-[#4F46E5] font-medium">
                            <span className="flex items-center gap-1">
                              {meeting.actionItems.length} Action Items <ArrowRight size={12} />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
