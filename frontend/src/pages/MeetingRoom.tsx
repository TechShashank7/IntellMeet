import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUser, useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { 
  StreamVideo, 
  StreamCall, 
  StreamVideoClient, 
  CallControls,
  StreamTheme, 
  Call,
  CallingState
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { StreamChat, Channel as StreamChannel } from 'stream-chat';
import { getInitials, getAvatarColor } from '../lib/utils';
import { format } from 'date-fns';
import AdaptiveMeetingLayout from '../components/AdaptiveMeetingLayout';
import ParticipantListPanel from '../components/ParticipantListPanel';
import { useCallStateHooks } from '@stream-io/video-react-sdk';

const ParticipantPill = ({ onClick, userImageUrl, initials, color }: { onClick: () => void, userImageUrl?: string, initials: string, color: string }) => {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-2 bg-[#1E293B] hover:bg-[#334155] transition-colors rounded-full p-1 pr-3 border border-[#334155]"
    >
      {userImageUrl ? (
        <img src={userImageUrl} alt="User" className="w-7 h-7 rounded-full object-cover" />
      ) : (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: color }}>
          {initials}
        </div>
      )}
      <span className="text-[13px] font-medium">{participants.length}</span>
    </button>
  );
};

import { 
  MessageSquare, 
  FileText,
  Send,
  ChevronRight,
  ChevronLeft,
  X,
  Copy,
  Check,
  Info
} from 'lucide-react';

// Global timeout to prevent Stream SDK from tearing down during React Strict Mode double-invocations
let strictModeCleanupTimeout: NodeJS.Timeout | null = null;

export default function MeetingRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();
  
  // Controls state
  const [activeTab, setActiveTab] = useState<'transcript' | 'chat'>('transcript');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showParticipantPanel, setShowParticipantPanel] = useState(false);
  
  const [, setChatClient] = useState<StreamChat | null>(null);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [captions, setCaptions] = useState<{ id: string; speakerId: string; text: string; time: string }[]>([]);

  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);

  const [showMeetingReadyCard, setShowMeetingReadyCard] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const meetingReadyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clientRef = useRef<StreamVideoClient | null>(null);
  const callRef = useRef<Call | null>(null);
  const chatClientRef = useRef<StreamChat | null>(null);
  const channelRef = useRef<StreamChannel | null>(null);
  const closedCaptionHandlerRef = useRef<any>(null);
  const messageHandlerRef = useRef<any>(null);

  const { data: meeting, isLoading } = useQuery({
    queryKey: ['meeting', id],
    queryFn: async () => api.getMeeting(id || 'm1', await getToken() || null)
  });

  const callId = meeting?.callId;
  const meetingId = meeting?.id;
  const hostClerkId = meeting?.hostClerkId;
  const userId = user?.id;
  const userFullName = user?.fullName;
  const userImageUrl = user?.imageUrl;

  const isHost = userId === hostClerkId;

  useEffect(() => {
    return () => {
      if (meetingReadyTimeoutRef.current) clearTimeout(meetingReadyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!callId || !userId) return;
    
    let isMounted = true;
    let _client: StreamVideoClient | null = null;
    let _call: Call | null = null;
    let _chatClient: StreamChat | null = null;
    let _channel: StreamChannel | null = null;

    const initCall = async () => {
      // Cancel any pending teardown if we remounted instantly
      if (strictModeCleanupTimeout) {
        clearTimeout(strictModeCleanupTimeout);
        strictModeCleanupTimeout = null;
      }

      // If already initialized and we survived strict mode, just sync state
      if (clientRef.current && callRef.current) {
        setClient(clientRef.current);
        setCall(callRef.current);
        if (chatClientRef.current) setChatClient(chatClientRef.current);
        if (channelRef.current) setChannel(channelRef.current);
        return;
      }

      try {
        const token = await getToken();
        if (!token || !isMounted) return;

        // isHost is defined at component level
        if (!isHost && meetingId) {
          await api.joinMeeting(meetingId, token);
          if (!isMounted) return;
        }

        const streamData = await api.getStreamToken(token);
        if (!isMounted) return;
        
        _client = new StreamVideoClient({
          apiKey: import.meta.env.VITE_STREAM_API_KEY,
          user: {
            id: userId,
            name: userFullName || userId,
            image: userImageUrl,
          },
          token: streamData.token,
          options: {
            axiosRequestConfig: {
              timeout: 15000, // Increase API timeout to 15 seconds to prevent Axios timeouts on slow networks
            }
          }
        });

        _call = _client.call('default', callId);
        
        await _call.join({ create: false });

        if (isMounted) {
          if (userId === hostClerkId) {
            try {
              await _call.startClosedCaptions({ language: 'en' });
            } catch (err) {
              console.warn("Failed to start closed captions", err);
            }
          }

          const closedCaptionHandler = (event: any) => {
            console.log('RAW CAPTION EVENT:', JSON.stringify(event));
            const text = event.closed_caption?.text ?? event.text;
            const speakerId = event.closed_caption?.speaker_id ?? event.user?.id ?? event.speaker_id;
            
            if (text) {
              setCaptions(prev => [...prev, {
                id: `${Date.now()}-${Math.random()}`,
                speakerId,
                text,
                time: new Date().toISOString()
              }]);
            }
          };
          closedCaptionHandlerRef.current = closedCaptionHandler;
          _call.on('call.closed_caption', closedCaptionHandler);
        }

        // Initialize Stream Chat after video joins successfully
        if (isMounted) {
          try {
            _chatClient = StreamChat.getInstance(import.meta.env.VITE_STREAM_API_KEY);
            await _chatClient.connectUser(
              { id: userId, name: userFullName || userId, image: userImageUrl },
              streamData.token
            );
            _channel = _chatClient.channel('messaging', callId);
            await _channel.watch();
            
            setChatMessages(_channel.state.messages.map(msg => ({
              id: msg.id,
              sender: msg.user?.name || msg.user?.id,
              senderId: msg.user?.id,
              text: msg.text,
              time: msg.created_at
            })));

            const messageHandler = (event: any) => {
              if (event.message) {
                setChatMessages(prev => {
                  if (prev.some(m => m.id === event.message!.id)) return prev;
                  return [...prev, {
                    id: event.message!.id,
                    sender: event.message!.user?.name || event.message!.user?.id,
                    senderId: event.message!.user?.id,
                    text: event.message!.text,
                    time: event.message!.created_at
                  }];
                });
              }
            };
            messageHandlerRef.current = messageHandler;
            _channel.on('message.new', messageHandler);

            chatClientRef.current = _chatClient;
            channelRef.current = _channel;
            setChatClient(_chatClient);
            setChannel(_channel);
          } catch (chatErr) {
            console.error("Failed to initialize Stream Chat", chatErr);
          }
        }

        if (isMounted) {
          clientRef.current = _client;
          callRef.current = _call;
          setClient(_client);
          setCall(_call);

          if (isHost) {
            setShowMeetingReadyCard(true);
            if (meetingReadyTimeoutRef.current) clearTimeout(meetingReadyTimeoutRef.current);
            meetingReadyTimeoutRef.current = setTimeout(() => setShowMeetingReadyCard(false), 10000);
          }
        } else {
          if (_call.state.callingState !== CallingState.LEFT) {
            _call.leave().catch(() => {});
          }
          _client.disconnectUser().catch(() => {});
        }
      } catch (error) {
        console.error("Failed to initialize Stream call", error);
      }
    };

    initCall();

    return () => {
      isMounted = false;
      
      // Delay cleanup to allow Strict Mode to remount without dropping WebRTC tracks and locking the camera hardware
      strictModeCleanupTimeout = setTimeout(() => {
        if (callRef.current) {
          try {
            if (closedCaptionHandlerRef.current) {
              callRef.current.off('call.closed_caption', closedCaptionHandlerRef.current);
            }
            if (userId === hostClerkId) {
              callRef.current.stopClosedCaptions().catch(() => {});
            }
          } catch (err) {}

          const callingState = callRef.current.state.callingState;
          if (callingState !== CallingState.LEFT) {
            try {
              callRef.current.leave().catch((err: any) => {
                if (!err.message?.includes('already been left')) console.error("Failed to leave call:", err);
              });
            } catch (err: any) {}
          }
          callRef.current = null;
        }
        if (channelRef.current) {
          try {
            if (messageHandlerRef.current) {
              channelRef.current.off('message.new', messageHandlerRef.current);
            }
            channelRef.current.stopWatching().catch(() => {});
          } catch (err) {}
          channelRef.current = null;
        }

        if (chatClientRef.current) {
          try {
            chatClientRef.current.disconnectUser().catch(() => {});
          } catch (err) {}
          chatClientRef.current = null;
        }

        if (clientRef.current) {
          try {
            clientRef.current.disconnectUser().catch(() => {});
          } catch (err) {}
          clientRef.current = null;
        }

        setClient(null);
        setCall(null);
        setChatClient(null);
        setChannel(null);
      }, 500);
    };
  }, [callId, meetingId, hostClerkId, userId, userFullName, userImageUrl, getToken]);

  const handleEndCall = async () => {
    const isHost = user?.id === meeting?.hostClerkId;
    
    try {
      if (isHost && meeting?.id) {
        const token = await getToken();
        if (token) {
          await api.endMeeting(meeting.id, token);
        }
      } else {
        if (call && call.state.callingState !== CallingState.LEFT) {
          await call.leave();
        }
      }
    } catch (err: any) {
      if (!err.message?.includes('already been left')) {
        console.error("Error during end call", err);
      }
    }
    
    navigate(`/summary/${id || 'm1'}`);
  };

  const attendeeMap = useMemo(() => {
    const map: Record<string, {name: string, initials: string, color: string, profileImage?: string}> = {};
    if (meeting?.attendees) {
      meeting.attendees.forEach((a: any) => {
        map[a.clerkId] = {
          name: a.name,
          initials: getInitials(a.name),
          color: getAvatarColor(a.clerkId),
          profileImage: a.profileImage
        };
      });
    }
    return map;
  }, [meeting?.attendees]);

  if (isLoading) {
    return (
      <div className="h-screen bg-[#0F172A] flex flex-col font-sans items-center justify-center">
        <div className="text-[#94A3B8]">Loading meeting room...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0F172A] flex flex-col font-sans overflow-hidden">
      {client && call ? (
        <StreamVideo client={client}>
          <StreamCall call={call}>
            <StreamTheme className="flex-1 h-full min-h-0 flex flex-col overflow-hidden">
              {/* Top Bar */}
              <div className="h-14 flex items-center justify-between px-4 text-white border-b border-[#1E293B] flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-[#EF4444] w-2 h-2 rounded-full animate-pulse" />
                  <span className="font-medium text-[14px]">{meeting?.title || 'Meeting Room'}</span>
                  {isHost && (
                    <button
                      onClick={() => {
                        setShowMeetingReadyCard(true);
                        if (meetingReadyTimeoutRef.current) clearTimeout(meetingReadyTimeoutRef.current);
                        meetingReadyTimeoutRef.current = setTimeout(() => setShowMeetingReadyCard(false), 10000);
                      }}
                      className="text-[#94A3B8] hover:text-white transition-colors"
                      title="Meeting info"
                    >
                      <Info size={16} />
                    </button>
                  )}
                  <span className="text-[#94A3B8] bg-[#1E293B] px-2 py-0.5 rounded text-[12px]">48:12</span>
                </div>
                <ParticipantPill 
                  onClick={() => {
                    if (isSidebarOpen && showParticipantPanel) {
                      setIsSidebarOpen(false);
                      setShowParticipantPanel(false);
                    } else {
                      setIsSidebarOpen(true);
                      setShowParticipantPanel(true);
                    }
                  }}
                  userImageUrl={userImageUrl}
                  initials={getInitials(userFullName || userId || '')}
                  color={getAvatarColor(userId || '')}
                />
              </div>
              {/* Main Content */}
              <div className="flex-1 h-full min-h-0 min-w-0 flex overflow-hidden relative">
                {/* Video Grid */}
                <div className="flex-1 h-full min-h-0 min-w-0 p-4 flex flex-col">
                  <div className="flex-1 h-full min-h-0 rounded-xl shadow-lg relative">
                    <AdaptiveMeetingLayout isSidebarOpen={isSidebarOpen} onShowParticipants={() => setShowParticipantPanel(true)} />
                  </div>
                </div>

                {/* Sidebar */}
                <div 
                  className="h-full overflow-hidden transition-[width] duration-300 ease-in-out flex-shrink-0 min-w-0"
                  style={{ width: isSidebarOpen ? '340px' : '0px' }}
                >
                  <div className="w-[340px] h-full bg-white flex flex-col border-l border-[#E5E7EB]">
          {showParticipantPanel ? (
            <ParticipantListPanel onClose={() => setShowParticipantPanel(false)} hostClerkId={hostClerkId} />
          ) : (
            <>
          {/* Tabs */}
          <div className="flex border-b border-[#E5E7EB]">
            <button 
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-medium transition-colors ${activeTab === 'transcript' ? 'border-b-2 border-[#4F46E5] text-[#4F46E5]' : 'text-[#6B7280] hover:bg-[#F9FAFB]'}`}
              onClick={() => setActiveTab('transcript')}
            >
              <FileText size={16} /> Transcript
            </button>
            <button 
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-medium transition-colors ${activeTab === 'chat' ? 'border-b-2 border-[#4F46E5] text-[#4F46E5]' : 'text-[#6B7280] hover:bg-[#F9FAFB]'}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare size={16} /> Chat
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {activeTab === 'transcript' && (
              captions.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-[#9CA3AF] text-[13px] italic">
                  Waiting for live captions...
                </div>
              ) : (
                captions.map((caption, idx) => {
                  const attendee = caption.speakerId ? attendeeMap[caption.speakerId] : null;
                  const initials = attendee?.initials || getInitials(caption.speakerId);
                  const color = attendee?.color || getAvatarColor(caption.speakerId || '');
                  const senderName = attendee?.name || caption.speakerId;
                  const timeFormatted = caption.time ? format(new Date(caption.time), 'h:mm a') : '';
                  
                  let profileImage = attendee?.profileImage;
                  if (caption.speakerId === userId && userImageUrl) {
                    profileImage = userImageUrl;
                  }

                  return (
                    <div key={caption.id || idx} className="flex gap-3">
                      {profileImage ? (
                        <img src={profileImage} alt={senderName} className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1" />
                      ) : (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-1"
                          style={{ background: color }}
                        >
                          {initials}
                        </div>
                      )}
                      <div>
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="font-semibold text-[#111827] text-[13px]">{senderName}</span>
                          <span className="text-[#9CA3AF] text-[11px]">{timeFormatted}</span>
                        </div>
                        <p className="text-[#374151] text-[13px] leading-relaxed">
                          {caption.text}
                        </p>
                      </div>
                    </div>
                  );
                })
              )
            )}

            {activeTab === 'chat' && chatMessages.map((msg, idx) => {
              const attendee = msg.senderId ? attendeeMap[msg.senderId] : null;
              const initials = attendee?.initials || getInitials(msg.sender);
              const color = attendee?.color || getAvatarColor(msg.senderId || msg.sender || '');
              const senderName = attendee?.name || msg.sender;
              const timeFormatted = msg.time ? format(new Date(msg.time), 'h:mm a') : '';
              
              let profileImage = attendee?.profileImage;
              if (msg.senderId === userId && userImageUrl) {
                profileImage = userImageUrl;
              }
              
              return (
                <div key={msg.id || idx} className="flex gap-3">
                  {profileImage ? (
                    <img src={profileImage} alt={senderName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ background: color }}
                    >
                      {initials}
                    </div>
                  )}
                  <div className="bg-[#F3F4F6] p-3 rounded-xl rounded-tl-none">
                    <div className="flex justify-between items-center mb-1 gap-4">
                      <span className="font-semibold text-[#111827] text-[12px]">{senderName}</span>
                      <span className="text-[#9CA3AF] text-[10px]">{timeFormatted}</span>
                    </div>
                    <p className="text-[#374151] text-[13px] whitespace-pre-wrap">
                      {msg.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chat Input */}
          {activeTab === 'chat' && (
            <div className="p-3 border-t border-[#E5E7EB]">
              <form 
                className="relative"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (chatInput.trim() && channel) {
                    const text = chatInput.trim();
                    setChatInput('');
                    await channel.sendMessage({ text });
                  }
                }}
              >
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Send a message..." 
                  className="w-full bg-[#F3F4F6] border-transparent rounded-full pl-4 pr-10 py-2 text-[13px] focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all"
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#4F46E5] hover:bg-[#EEF2FF] rounded-full transition-colors">
                  <Send size={14} />
                </button>
              </form>
            </div>
          )}
            </>
          )}
        </div>
        </div>

      </div>

              {/* Control Bar */}
              <div className="h-[80px] bg-[#0F172A] border-t border-[#1E293B] flex items-center justify-center relative flex-shrink-0 [&>div]:!static [&>div]:!transform-none [&>div]:!shadow-none">
                 <CallControls onLeave={handleEndCall} />
                 
                 {/* Sidebar Toggle Button */}
                 <button
                   onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                   className="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#1E293B] border border-[#334155] text-white shadow-md flex items-center justify-center hover:bg-[#2D3748] transition-colors"
                   title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
                 >
                   {isSidebarOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                 </button>
              </div>

              {/* Meeting Ready Card */}
              {showMeetingReadyCard && isHost && (
                <div className="fixed bottom-[96px] left-4 z-30 w-[380px] bg-white rounded-xl shadow-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[16px] font-semibold text-[#111827]">Your meeting's ready</h3>
                    <button 
                      onClick={() => {
                        setShowMeetingReadyCard(false);
                        if (meetingReadyTimeoutRef.current) clearTimeout(meetingReadyTimeoutRef.current);
                      }}
                      className="text-[#6B7280] hover:text-[#111827] transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <p className="text-[13px] text-[#6B7280] mb-4">
                    Share this link with people you want in the meeting
                  </p>
                  <div className="bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg px-3 py-2 flex items-center justify-between gap-2 mb-2">
                    <span className="text-[13px] text-[#374151] truncate">
                      {`${window.location.origin}/meeting/${meeting?.joinCode}`}
                    </span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/meeting/${meeting?.joinCode}`);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                      className="text-[#6B7280] hover:text-[#111827] transition-colors flex-shrink-0"
                    >
                      {linkCopied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Anyone with this link can ask to join
                  </p>
                </div>
              )}
            </StreamTheme>
          </StreamCall>
        </StreamVideo>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Top Bar (Loading State) */}
          <div className="h-14 flex items-center justify-between px-4 text-white border-b border-[#1E293B] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-[#EF4444] w-2 h-2 rounded-full animate-pulse" />
              <span className="font-medium text-[14px]">{meeting?.title || 'Meeting Room'}</span>
              <span className="text-[#94A3B8] bg-[#1E293B] px-2 py-0.5 rounded text-[12px]">48:12</span>
            </div>
          </div>
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 p-4 flex flex-col">
              <div className="flex-1 bg-[#1E293B] rounded-xl flex items-center justify-center border-2 border-[#4F46E5] shadow-lg">
                <span className="text-[#94A3B8]">Loading meeting room...</span>
              </div>
            </div>
            <div className="w-[340px] bg-white flex flex-col border-l border-[#E5E7EB]">
            </div>
          </div>
          <div className="h-[80px] bg-[#0F172A] border-t border-[#1E293B] flex items-center justify-center gap-4 px-6 relative flex-shrink-0">
          </div>
        </div>
      )}
    </div>
  );
}
