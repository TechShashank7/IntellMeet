import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useUser } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { useTeamStore } from '../store/store';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Users, 
  FileText, 
  CheckSquare,
  Sparkles,
  Download,
  MessageCircle,
  ArrowRight,
  Star,
  X
} from 'lucide-react';

export default function AISummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const { user } = useUser();
  const { currentTeamId } = useTeamStore();
  const [syncedItems, setSyncedItems] = useState<Set<string>>(new Set());
  
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [hasViewedInsights, setHasViewedInsights] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  const [showLeftBanner, setShowLeftBanner] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [downloading, setDownloading] = useState(false);

  const [postingToSlack, setPostingToSlack] = useState(false);
  const [slackMessage, setSlackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [syncingToNotion, setSyncingToNotion] = useState(false);
  const [notionMessage, setNotionMessage] = useState<{ type: 'success' | 'error', text: string, url?: string } | null>(null);

  const dismissLeftBanner = () => setShowLeftBanner(false);

  const handleDownloadPdf = async () => {
    if (!meeting || !id) return;
    setDownloading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No token');
      const safeTitle = (meeting.title || "meeting").replace(/[^a-z0-9]/gi, "_").toLowerCase();
      await api.downloadMeetingSummaryPdf(id, token, safeTitle);
    } catch (err: any) {
      console.error('Failed to download PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePostToSlack = async () => {
    if (!id) return;
    setPostingToSlack(true);
    setSlackMessage(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('No token');
      await api.shareMeetingToSlack(id, token);
      setSlackMessage({ type: 'success', text: 'Posted!' });
      setTimeout(() => setSlackMessage(null), 2000);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to post';
      setSlackMessage({ type: 'error', text: errorMsg });
      window.alert(errorMsg);
      setTimeout(() => setSlackMessage(null), 5000);
    } finally {
      setPostingToSlack(false);
    }
  };

  const handleSyncToNotion = async () => {
    if (!id) return;
    setSyncingToNotion(true);
    setNotionMessage(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('No token');
      const res = await api.syncMeetingToNotion(id, token);
      setNotionMessage({ type: 'success', text: 'Synced!', url: res.url });
      setTimeout(() => setNotionMessage(null), 5000);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to sync';
      setNotionMessage({ type: 'error', text: errorMsg });
      window.alert(errorMsg);
      setTimeout(() => setNotionMessage(null), 5000);
    } finally {
      setSyncingToNotion(false);
    }
  };

  const { data: meeting, isLoading: loadingMeeting } = useQuery({
    queryKey: ['meeting', id],
    queryFn: async () => api.getMeeting(id || '', await getToken() || ''),
    enabled: !!id
  });

  useEffect(() => {
    if (meeting?.status === 'active') {
      setShowLeftBanner(true);
      setSecondsRemaining(30);
    }
  }, [meeting?.status, id]);

  useEffect(() => {
    if (!showLeftBanner) return;
    if (secondsRemaining <= 0) {
      setShowLeftBanner(false);
      return;
    }
    const timer = setTimeout(() => setSecondsRemaining(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [showLeftBanner, secondsRemaining]);

  const { data: aiData, isLoading: loadingSummary } = useQuery({
    queryKey: ['aiSummary', id],
    queryFn: async () => api.getAISummary(id || '', await getToken() || ''),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state?.data?.status;
      return (status === 'pending' || status === 'processing') ? 3000 : false;
    }
  });

  const { data: tasks } = useQuery({
    queryKey: ['tasks', currentTeamId],
    queryFn: async () => api.getTasks(currentTeamId || '', await getToken() || ''),
    enabled: !!currentTeamId
  });

  const { mutate: addTask } = useMutation({
    mutationFn: async (taskData: { title: string; assignee?: string | null; dueDate?: string; sourceActionItem?: string; sourceMeetingId?: string }) => 
      api.addTask(currentTeamId || '', await getToken() || '', taskData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', currentTeamId] });
    }
  });

  const alreadyRated = meeting?.ratings?.some((r: any) => r.clerkId === user?.id);

  const { mutate: rateCall } = useMutation({
    mutationFn: async (payload: { rating?: number; skipped?: boolean }) =>
      api.rateMeeting(id || '', await getToken() || '', payload),
    onSettled: () => {
      setRatingSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
    }
  });

  const handleSyncToTasks = (item: any) => {
    if (syncedItems.has(item.id) || tasks?.some(t => t.sourceActionItem === item.id) || !meeting) return;
    
    addTask({
      title: item.text,
      assignee: item.assignee?.clerkId || null,
      dueDate: item.dueDate,
      sourceActionItem: item.id,
      sourceMeetingId: id
    });
    
    setSyncedItems(prev => new Set(prev).add(item.id));
  };

  const mappedActionItems = aiData?.actionItems?.map((item: any) => {
    const attendee = meeting?.attendees?.find(a => a.clerkId === item.assignee);
    return {
      ...item,
      id: item._id || item.id,
      assignee: attendee || { name: 'Unassigned', initials: '?', color: '#9CA3AF', clerkId: null }
    };
  }) || [];

  const keyDecisions = aiData?.summary
    ? aiData.summary.split('\n').map((line: string) => line.replace(/^-?\s*/, '').trim()).filter((line: string) => line.length > 0)
    : [];

  const isLoading = loadingMeeting || loadingSummary;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center font-sans">
        <div className="text-[#6B7280]">Loading summary...</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center font-sans">
        <div className="text-[#EF4444]">Meeting not found.</div>
      </div>
    );
  }

  if (!alreadyRated && !ratingSubmitted) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center max-w-sm w-full">
          {showLeftBanner && (
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="relative w-9 h-9 mb-3">
                <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15" fill="none" stroke="#4F46E5" strokeWidth="3"
                    strokeDasharray={2 * Math.PI * 15}
                    strokeDashoffset={2 * Math.PI * 15 * (1 - secondsRemaining / 30)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-[#4F46E5]">
                  {secondsRemaining}
                </span>
              </div>
              <h2 className="text-[18px] font-semibold text-[#111827] mb-1">You left the meeting</h2>
              <p className="text-[13px] text-[#6B7280] mb-4">Want to go back?</p>
              <button
                onClick={() => navigate(`/meeting/${id}`)}
                className="px-5 py-2 bg-[#4F46E5] text-white rounded-md font-medium hover:bg-[#4338CA] transition-colors text-[13px]"
              >
                Rejoin Meeting
              </button>
            </div>
          )}

          <div className="bg-white p-8 rounded-xl border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.05)] relative w-full text-center">
            <button 
              onClick={() => { dismissLeftBanner(); rateCall({ skipped: true }); }}
              className="absolute top-4 right-4 text-[#9CA3AF] hover:text-[#4B5563] transition-colors"
            >
              <X size={20} />
            </button>
            <h2 className="text-[20px] font-semibold text-[#111827] mb-2">How was your call?</h2>
            <p className="text-[14px] text-[#6B7280] mb-8">Rate your meeting experience</p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(null)}
                  onClick={() => { dismissLeftBanner(); rateCall({ rating: star }); }}
                  className={`p-1 transition-colors ${
                    (hoveredStar !== null ? star <= hoveredStar : false) 
                      ? 'text-[#4F46E5]' 
                      : 'text-[#9CA3AF]'
                  }`}
                >
                  <Star 
                    size={36} 
                    className={(hoveredStar !== null ? star <= hoveredStar : false) ? 'fill-[#4F46E5]' : ''} 
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (ratingSubmitted && !hasViewedInsights) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center font-sans relative">
        <button 
          onClick={() => navigate('/dashboard')}
          className="absolute top-8 left-8 p-3 text-[#6B7280] hover:text-[#111827] hover:bg-white rounded-full transition-colors flex items-center gap-2 shadow-sm border border-transparent hover:border-[#E5E7EB]"
        >
          <ArrowLeft size={24} />
        </button>
        <button 
          onClick={() => setHasViewedInsights(true)}
          className="px-6 py-3 bg-[#4F46E5] text-white rounded-md font-medium shadow-sm hover:bg-[#4338CA] transition-colors"
        >
          Check the insights of this meeting
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10 px-8 py-4">
        <div className="max-w-none w-full px-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-2 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-full transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center flex-wrap gap-3">
                <h1 className="text-[20px] font-bold text-[#111827] flex-1 min-w-0">{meeting.title}</h1>
                <span className="bg-[#EEF2FF] text-[#4F46E5] text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 border border-[#4F46E5]/20 flex-shrink-0">
                  <Sparkles size={12} /> AI GENERATED
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-4 mt-1 text-[13px] text-[#6B7280]">
                <span className="flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"><Calendar size={14} /> {meeting.date}</span>
                <span className="flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"><Clock size={14} /> {meeting.duration}</span>
                <span className="flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"><Users size={14} /> {meeting.attendees?.length || 0} Attendees</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto w-full py-8 px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Executive Summary */}
          <section className="bg-white p-8 rounded-xl border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            <h2 className="text-[18px] font-semibold text-[#111827] mb-4 flex items-center gap-2">
              <FileText size={20} className="text-[#4F46E5]" />
              Executive Summary
            </h2>
            <div className="text-[15px] text-[#374151] leading-relaxed space-y-4">
              {(aiData?.status === 'pending' || aiData?.status === 'processing') ? (
                <div className="flex items-center gap-3 text-[#6B7280]">
                  <div className="w-4 h-4 rounded-full border-2 border-[#4F46E5] border-t-transparent animate-spin"></div>
                  Generating summary — this usually takes a minute or two...
                </div>
              ) : keyDecisions.length > 0 ? (
                keyDecisions.map((paragraph: string, idx: number) => (
                  <p key={idx}>{paragraph}</p>
                ))
              ) : (
                <p>No summary available.</p>
              )}
            </div>
          </section>

          {/* Action Items */}
          <section className="bg-white p-8 rounded-xl border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            <h2 className="text-[18px] font-semibold text-[#111827] mb-4 flex items-center gap-2">
              <CheckSquare size={20} className="text-[#F59E0B]" />
              Action Items
            </h2>
            <div className="space-y-3">
              {mappedActionItems.length ? mappedActionItems.map((item: any) => {
                const assigneeDateNode = (
                  <>
                    <div className="flex items-center gap-1.5">
                      {item.assignee.profileImage ? (
                        <img 
                          src={item.assignee.profileImage} 
                          alt={item.assignee.name}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                          style={{ background: item.assignee.color }}
                        >
                          {item.assignee.initials}
                        </div>
                      )}
                      {item.assignee.name}
                    </div>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> {item.dueDate ? format(new Date(item.dueDate), 'MMM d') : 'No due date'}
                    </span>
                  </>
                );

                const actionButtonNode = (
                  <button 
                    onClick={() => handleSyncToTasks(item)}
                    disabled={syncedItems.has(item.id) || tasks?.some(t => t.sourceActionItem === item.id)}
                    className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors flex-shrink-0 ${syncedItems.has(item.id) || tasks?.some(t => t.sourceActionItem === item.id) ? 'bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed' : 'bg-[#EEF2FF] text-[#4F46E5] hover:bg-[#E0E7FF]'}`}
                  >
                    {syncedItems.has(item.id) || tasks?.some(t => t.sourceActionItem === item.id) ? 'Synced' : 'Add to Tasks'}
                  </button>
                );

                return (
                  <div key={item.id} className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4 p-4 border border-[#E5E7EB] rounded-lg hover:border-[#D1D5DB] transition-colors">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="mt-1 flex-shrink-0">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-[#4F46E5] border-[#D1D5DB] rounded focus:ring-[#4F46E5]"
                          defaultChecked={item.done}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] text-[#111827] font-medium">{item.text}</p>
                        <div className="hidden md:flex items-center gap-3 mt-2 text-[12px] text-[#6B7280]">
                          {assigneeDateNode}
                        </div>
                      </div>
                    </div>
                    <div className="flex md:contents flex-wrap items-center justify-between gap-2 md:gap-0 pl-8 md:pl-0">
                      <div className="flex md:hidden items-center gap-3 text-[12px] text-[#6B7280]">
                        {assigneeDateNode}
                      </div>
                      {actionButtonNode}
                    </div>
                  </div>
                );
              }) : (
                <div className="text-[14px] text-[#6B7280] italic">No action items extracted.</div>
              )}
            </div>
          </section>

          {/* Key Decisions */}
          <section className="bg-white p-8 rounded-xl border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            <h2 className="text-[18px] font-semibold text-[#111827] mb-4">Key Decisions</h2>
            <ul className="space-y-4">
              {keyDecisions.length > 0 ? keyDecisions.map((decision: string, idx: number) => (
                <li key={idx} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#F3F4F6] text-[#6B7280] text-[12px] font-bold flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-[14px] text-[#374151] pt-0.5">{decision}</span>
                </li>
              )) : (
                <li className="text-[14px] text-[#6B7280] italic">No key points extracted yet.</li>
              )}
            </ul>
          </section>
        </div>

        {/* Sidebar / Exporters */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
            <h3 className="text-[14px] font-semibold text-[#111827] mb-3">Export & Sync</h3>
            <div className="space-y-2">
              <button 
                onClick={handlePostToSlack}
                disabled={postingToSlack}
                className="w-full flex items-center justify-between p-3 border border-[#E5E7EB] hover:bg-[#F9FAFB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#FDF2F8] flex items-center justify-center text-[#DB2777]">
                    <MessageCircle size={16} />
                  </div>
                  <span className="text-[14px] font-medium text-[#374151]">
                    {postingToSlack ? 'Posting...' : slackMessage?.type === 'success' ? slackMessage.text : 'Post to Slack'}
                  </span>
                </div>
                {(!slackMessage || slackMessage.type === 'success') && (
                  <ArrowRight size={16} className="text-[#9CA3AF]" />
                )}
              </button>
              {slackMessage?.type === 'error' && (
                <div className="text-xs text-red-500 mt-1 pl-1">{slackMessage.text}</div>
              )}
              <button 
                onClick={handleSyncToNotion}
                disabled={syncingToNotion}
                className="w-full flex items-center justify-between p-3 border border-[#E5E7EB] hover:bg-[#F9FAFB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-black flex items-center justify-center text-white">
                    <span className="font-serif font-bold text-[14px]">N</span>
                  </div>
                  <span className="text-[14px] font-medium text-[#374151]">
                    {syncingToNotion ? 'Syncing...' : notionMessage?.type === 'success' ? notionMessage.text : 'Sync to Notion'}
                  </span>
                </div>
                {(!notionMessage || notionMessage.type === 'success') && (
                  <ArrowRight size={16} className="text-[#9CA3AF]" />
                )}
              </button>
              {notionMessage?.type === 'error' && (
                <div className="text-xs text-red-500 mt-1 pl-1">{notionMessage.text}</div>
              )}
              {notionMessage?.url && (
                <a href={notionMessage.url} target="_blank" rel="noreferrer" className="block text-xs text-right text-[#4F46E5] hover:underline mt-1 mr-2">
                  View Page in Notion
                </a>
              )}
              <button 
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="w-full flex items-center justify-between p-3 border border-[#E5E7EB] hover:bg-[#F9FAFB] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#EEF2FF] flex items-center justify-center text-[#4F46E5]">
                    <Download size={16} />
                  </div>
                  <span className="text-[14px] font-medium text-[#374151]">
                    {downloading ? 'Downloading...' : 'Download PDF'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
             <h3 className="text-[14px] font-semibold text-[#111827] mb-3">Attendees</h3>
             <div className="space-y-3">
               {meeting.attendees?.map((attendee: any, idx: number) => (
                 <div key={idx} className="flex items-center gap-3">
                   {attendee.profileImage ? (
                     <img 
                       src={attendee.profileImage} 
                       alt={attendee.name}
                       className="w-8 h-8 rounded-full object-cover"
                     />
                   ) : (
                     <div 
                       className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                       style={{ background: attendee.color }}
                     >
                       {attendee.initials}
                     </div>
                   )}
                   <span className="text-[14px] text-[#374151]">{attendee.name}</span>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
