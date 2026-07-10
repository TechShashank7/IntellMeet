import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUser, useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { 
  StreamVideo, 
  StreamCall, 
  StreamVideoClient, 
  StreamTheme, 
  Call,
  CallingState,
  RecordCallButton,
  ReactionsButton
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { StreamChat, Channel as StreamChannel } from 'stream-chat';
import { getInitials, getAvatarColor, formatElapsedTime } from '../lib/utils';
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
  Info,
  Mail,
  Globe,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  ChevronUp
} from 'lucide-react';

// Global timeout to prevent Stream SDK from tearing down during React Strict Mode double-invocations
let strictModeCleanupTimeout: NodeJS.Timeout | null = null;

export default function MeetingRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();
  
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);

  const { data: meeting, isLoading } = useQuery({
    queryKey: ['meeting', id],
    queryFn: async () => api.getMeeting(id || 'm1', await getToken() || null)
  });

  const clientRef = useRef<StreamVideoClient | null>(null);
  const callRef = useRef<Call | null>(null);

  const callId = meeting?.callId;
  const meetingId = meeting?.id;
  const hostClerkId = meeting?.hostClerkId;
  const userId = user?.id;
  const userFullName = user?.fullName;
  const userImageUrl = user?.imageUrl;
  const isHost = userId === hostClerkId;

  useEffect(() => {
    if (!callId || !userId) return;
    
    let isMounted = true;
    let _client: StreamVideoClient | null = null;
    let _call: Call | null = null;

    const initCall = async () => {
      // Cancel any pending teardown if we remounted instantly
      if (strictModeCleanupTimeout) {
        clearTimeout(strictModeCleanupTimeout);
        strictModeCleanupTimeout = null;
      }

      if (clientRef.current && callRef.current) {
        setClient(clientRef.current);
        setCall(callRef.current);
        return;
      }

      try {
        const token = await getToken();
        if (!token || !isMounted) return;

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
              timeout: 15000,
            }
          }
        });

        _call = _client.call('default', callId);
        await _call.join({ create: false });
        try {
          await _call.microphone.disable();
        } catch (err) {
          console.warn("Failed to disable microphone on join", err);
        }
        try {
          await _call.camera.disable();
        } catch (err) {
          console.warn("Failed to disable camera on join", err);
        }

        if (isMounted) {
          clientRef.current = _client;
          callRef.current = _call;
          setClient(_client);
          setCall(_call);
        }
      } catch (error) {
        console.error("Failed to initialize Stream call", error);
      }
    };

    initCall();

    return () => {
      isMounted = false;
      
      // Delay cleanup to allow Strict Mode to remount
      strictModeCleanupTimeout = setTimeout(() => {
        if (callRef.current) {
          const callingState = callRef.current.state.callingState;
          if (callingState !== CallingState.LEFT) {
            try {
              callRef.current.leave().catch(() => {});
            } catch (err) {}
          }
          callRef.current = null;
        }
        if (clientRef.current) {
          try {
            clientRef.current.disconnectUser().catch(() => {});
          } catch (err) {}
          clientRef.current = null;
        }
        setClient(null);
        setCall(null);
      }, 500);
    };
  }, [callId, meetingId, hostClerkId, userId, userFullName, userImageUrl, getToken]);

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
            <MeetingRoomContent
              meeting={meeting}
              client={client}
              call={call}
              getToken={getToken}
              id={id}
              navigate={navigate}
              userId={userId}
              userFullName={userFullName}
              userImageUrl={userImageUrl}
              isHost={isHost}
              hostClerkId={hostClerkId}
              meetingId={meetingId}
              callId={callId}
            />
          </StreamCall>
        </StreamVideo>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Top Bar (Loading State) */}
          <div className="h-14 flex items-center justify-between px-4 text-white border-b border-[#1E293B] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-[#EF4444] w-2 h-2 rounded-full animate-pulse" />
              <span className="font-medium text-[14px]">{meeting?.title || 'Meeting Room'}</span>
              <span className="text-[#94A3B8] bg-[#1E293B] px-2 py-0.5 rounded text-[12px]">00:00</span>
            </div>
          </div>
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 p-4 flex flex-col">
              <div className="flex-1 bg-[#1E293B] rounded-xl flex items-center justify-center border-2 border-[#4F46E5] shadow-lg">
                <span className="text-[#94A3B8]">Loading meeting room...</span>
              </div>
            </div>
          </div>
          <div className="h-[80px] bg-[#0F172A] border-t border-[#1E293B] flex items-center justify-center gap-4 px-6 relative flex-shrink-0">
          </div>
        </div>
      )}
    </div>
  );
}

function MeetingRoomContent({
  meeting,
  call,
  getToken,
  id,
  navigate,
  userId,
  userFullName,
  userImageUrl,
  isHost,
  hostClerkId,
  meetingId,
  callId
}: {
  meeting: any;
  client: StreamVideoClient;
  call: Call;
  getToken: any;
  id: string | undefined;
  navigate: any;
  userId: string | undefined;
  userFullName: string | null | undefined;
  userImageUrl: string | undefined;
  isHost: boolean;
  hostClerkId: string | undefined;
  meetingId: string | undefined;
  callId: string | undefined;
}) {
  const { useIsCallCaptioningInProgress, useMicrophoneState, useCameraState, useScreenShareState } = useCallStateHooks();
  const captionsEnabled = useIsCallCaptioningInProgress();
  const { microphone, isMute: isMicMuted, devices: micDevices, selectedDevice: selectedMic } = useMicrophoneState();
  const { camera, isMute: isCamMuted, devices: camDevices, selectedDevice: selectedCam } = useCameraState();
  const { screenShare, isMute: isScreenShared } = useScreenShareState();

  // Controls state
  const [showCaptionsPanel, setShowCaptionsPanel] = useState(false);
  const [showMicDevices, setShowMicDevices] = useState(false);
  const [showCamDevices, setShowCamDevices] = useState(false);
  
  const [captionsToast, setCaptionsToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const captionsToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const captionsPanelRef = useRef<HTMLDivElement | null>(null);
  const micPanelRef = useRef<HTMLDivElement | null>(null);
  const camPanelRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<'transcript' | 'chat'>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showParticipantPanel, setShowParticipantPanel] = useState(false);

  const [, setChatClient] = useState<StreamChat | null>(null);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [captions, setCaptions] = useState<{ id: string; speakerId: string; text: string; time: string }[]>([]);

  const [showMeetingReadyCard, setShowMeetingReadyCard] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const meetingReadyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!meeting?.startTime) return;
    const startMs = new Date(meeting.startTime).getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [meeting?.startTime]);

  const chatClientRef = useRef<StreamChat | null>(null);
  const channelRef = useRef<StreamChannel | null>(null);
  const closedCaptionHandlerRef = useRef<any>(null);
  const messageHandlerRef = useRef<any>(null);

  // click outside effect
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showCaptionsPanel && captionsPanelRef.current && !captionsPanelRef.current.contains(event.target as Node)) {
        setShowCaptionsPanel(false);
      }
      if (showMicDevices && micPanelRef.current && !micPanelRef.current.contains(event.target as Node)) {
        setShowMicDevices(false);
      }
      if (showCamDevices && camPanelRef.current && !camPanelRef.current.contains(event.target as Node)) {
        setShowCamDevices(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCaptionsPanel, showMicDevices, showCamDevices]);

  // tab sync effect
  useEffect(() => {
    if (!captionsEnabled && activeTab === 'transcript') {
      setActiveTab('chat');
    }
  }, [captionsEnabled, activeTab]);

  // toast notification effect
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setCaptionsToast({
      visible: true,
      message: captionsEnabled ? 'Live transcription turned on' : 'Live transcription turned off'
    });
    if (captionsToastTimeoutRef.current) clearTimeout(captionsToastTimeoutRef.current);
    captionsToastTimeoutRef.current = setTimeout(() => setCaptionsToast(prev => ({ ...prev, visible: false })), 2500);
  }, [captionsEnabled]);

  useEffect(() => {
    return () => {
      if (meetingReadyTimeoutRef.current) clearTimeout(meetingReadyTimeoutRef.current);
      if (captionsToastTimeoutRef.current) clearTimeout(captionsToastTimeoutRef.current);
    };
  }, []);

  // Initialize Chat & Closed Captions Text handler
  useEffect(() => {
    let isMounted = true;
    let _chatClient: StreamChat | null = null;
    let _channel: StreamChannel | null = null;

    const initRoomFeatures = async () => {
      // 1. Subscribe to closed caption text stream
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
      call.on('call.closed_caption', closedCaptionHandler);

      // 2. Initialize Stream Chat
      try {
        const token = await getToken();
        if (!token || !isMounted) return;

        const streamData = await api.getStreamToken(token);
        if (!isMounted) return;

        _chatClient = StreamChat.getInstance(import.meta.env.VITE_STREAM_API_KEY);
        chatClientRef.current = _chatClient;

        if (_chatClient.userID && _chatClient.userID !== userId) {
          await _chatClient.disconnectUser();
        }
        if (!_chatClient.userID) {
          await _chatClient.connectUser(
            { id: userId || 'anonymous', name: userFullName || userId || 'Anonymous', image: userImageUrl },
            streamData.token
          );
        }

        _channel = _chatClient.channel('messaging', callId);
        await _channel.watch();

        if (isMounted) {
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

          channelRef.current = _channel;
          setChatClient(_chatClient);
          setChannel(_channel);
        }
      } catch (err) {
        console.error("Failed to initialize Stream Chat", err);
      }

      // 3. Show ready card
      if (isHost && isMounted) {
        setShowMeetingReadyCard(true);
        meetingReadyTimeoutRef.current = setTimeout(() => setShowMeetingReadyCard(false), 10000);
      }
    };

    initRoomFeatures();

    return () => {
      isMounted = false;
      try {
        if (closedCaptionHandlerRef.current) {
          call.off('call.closed_caption', closedCaptionHandlerRef.current);
        }
      } catch (err) {}

      try {
        if (_channel && messageHandlerRef.current) {
          _channel.off('message.new', messageHandlerRef.current);
        }
        if (_channel) {
          _channel.stopWatching().catch(() => {});
        }
      } catch (err) {}

      try {
        if (_chatClient) {
          _chatClient.disconnectUser().catch(() => {});
        }
      } catch (err) {}

      channelRef.current = null;
      chatClientRef.current = null;
    };
  }, [call, callId, userId, userFullName, userImageUrl, getToken, isHost]);

  const handleToggleMic = async () => {
    try {
      await microphone.toggle();
    } catch (err) {
      console.warn("Failed to toggle microphone", err);
    }
  };

  const handleToggleCamera = async () => {
    try {
      await camera.toggle();
    } catch (err) {
      console.warn("Failed to toggle camera", err);
    }
  };

  const handleToggleScreenShare = async () => {
    try {
      await screenShare.toggle();
    } catch (err) {
      console.warn("Failed to toggle screen share", err);
    }
  };

  const handleToggleCaptions = async () => {
    if (!call || !isHost) return;
    try {
      if (captionsEnabled) {
        await call.stopClosedCaptions();
      } else {
        await call.startClosedCaptions({ language: 'en' });
      }
    } catch (err) {
      console.warn('Failed to toggle captions', err);
    }
  };

  const handleEndCall = async () => {
    try {
      if (isHost && meetingId) {
        const token = await getToken();
        if (token) {
          await api.endMeeting(meetingId, token);
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

  return (
    <StreamTheme className="flex-1 h-full min-h-0 flex flex-col overflow-hidden">
      {captionsToast.visible && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 px-5 py-3 rounded-xl text-white text-[14px] font-medium backdrop-blur-md bg-white/10 border border-white/20 shadow-lg pointer-events-none"
          style={{ top: '60%' }}
        >
          {captionsToast.message}
        </div>
      )}
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
          <span className="text-[#94A3B8] bg-[#1E293B] px-2 py-0.5 rounded text-[12px]">{formatElapsedTime(elapsedSeconds)}</span>
        </div>
        <div className="flex items-center gap-4">
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

          <div
            ref={captionsPanelRef}
            className="relative"
          >
            <button
              onClick={() => {
                if (isHost) {
                  setShowCaptionsPanel(prev => !prev);
                }
              }}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                captionsEnabled ? 'bg-[#4F46E5] text-white animate-captions-glow' : 'bg-[#1E293B] text-[#94A3B8]'
              } ${isHost ? 'hover:bg-[#334155] cursor-pointer' : 'cursor-default'}`}
              title={isHost ? "Live transcription" : undefined}
            >
              <FileText size={16} />
            </button>

            {showCaptionsPanel && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-[#1E293B] border border-[#334155] rounded-xl shadow-xl p-4 z-30 text-left">
                <div className="flex items-start gap-2.5 text-[13px] text-[#CBD5E1] mb-3">
                  <Mail size={16} className="text-[#94A3B8] flex-shrink-0 mt-0.5" />
                  <span>Transcript will be sent to you after the meeting</span>
                </div>
                <div className="flex items-center gap-2.5 text-[13px] text-[#CBD5E1] mb-4">
                  <Globe size={16} className="text-[#94A3B8] flex-shrink-0" />
                  <span>Meeting language: English</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-white">Enable transcript</span>
                  {isHost ? (
                    <button
                      onClick={handleToggleCaptions}
                      className={`w-10 h-[22px] rounded-full relative transition-colors ${captionsEnabled ? 'bg-[#4F46E5]' : 'bg-[#475569]'}`}
                    >
                      <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform duration-200 ${captionsEnabled ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                    </button>
                  ) : (
                    <span className="text-[12px] text-[#94A3B8]">{captionsEnabled ? 'On' : 'Off'} (host controls this)</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
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
          className="h-full overflow-hidden transition-all duration-300 ease-in-out flex-shrink-0"
          style={{ width: isSidebarOpen ? '340px' : '0px', minWidth: isSidebarOpen ? '340px' : '0px' }}
        >
          <div className="w-[340px] h-full bg-[#0F172A] flex flex-col border-l border-[#1E293B]">
            {showParticipantPanel ? (
              <ParticipantListPanel onClose={() => setShowParticipantPanel(false)} hostClerkId={hostClerkId} />
            ) : (
              <>
                {/* Tabs */}
                <div className="flex border-b border-[#1E293B]">
                  {captionsEnabled && (
                    <button 
                      className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-medium transition-colors ${activeTab === 'transcript' ? 'border-b-2 border-[#4F46E5] text-[#4F46E5]' : 'text-[#94A3B8] hover:bg-[#1E293B]'}`}
                      onClick={() => setActiveTab('transcript')}
                    >
                      <FileText size={16} /> Transcript
                    </button>
                  )}
                  <button 
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-medium transition-colors ${activeTab === 'chat' ? 'border-b-2 border-[#4F46E5] text-[#4F46E5]' : 'text-[#94A3B8] hover:bg-[#1E293B]'}`}
                    onClick={() => setActiveTab('chat')}
                  >
                    <MessageSquare size={16} /> Chat
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                  {activeTab === 'transcript' && (
                    captions.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-[#64748B] text-[13px] italic">
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
                                <span className="font-semibold text-white text-[13px]">{senderName}</span>
                                <span className="text-[#64748B] text-[11px]">{timeFormatted}</span>
                              </div>
                              <p className="text-[#CBD5E1] text-[13px] leading-relaxed">
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
                        <div className="bg-[#1E293B] p-3 rounded-xl rounded-tl-none border border-[#334155]">
                          <div className="flex justify-between items-center mb-1 gap-4">
                            <span className="font-semibold text-[#F1F5F9] text-[12px]">{senderName}</span>
                            <span className="text-[#64748B] text-[10px]">{timeFormatted}</span>
                          </div>
                          <p className="text-[#E2E8F0] text-[13px] whitespace-pre-wrap">
                            {msg.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Chat Input */}
                {activeTab === 'chat' && (
                  <div className="p-3 border-t border-[#1E293B] bg-[#0F172A]">
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
                        className="w-full bg-[#1E293B] border border-[#334155] text-white placeholder-[#64748B] rounded-full pl-4 pr-10 py-2 text-[13px] focus:bg-[#0F172A] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all"
                      />
                      <button type="submit" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#4F46E5] hover:bg-[#1E293B] rounded-full transition-colors">
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
      <div className="h-[80px] bg-[#0F172A] border-t border-[#1E293B] flex items-center justify-center gap-4 px-6 relative flex-shrink-0">
        
        {/* Mic Group */}
        <div ref={micPanelRef} className={`relative flex items-center rounded-full transition-colors ${isMicMuted ? 'bg-[#EF4444]' : 'bg-[#334155]'}`}>
          <button 
            onClick={handleToggleMic}
            className={`w-12 h-12 rounded-l-full flex items-center justify-center transition-colors ${
              isMicMuted ? 'hover:bg-[#DC2626]' : 'hover:bg-[#475569]'
            }`}
          >
            {isMicMuted ? <MicOff size={20} className="text-white" /> : <Mic size={20} className="text-white" />}
          </button>
          
          <div className={`w-px h-6 ${isMicMuted ? 'bg-[#B91C1C]' : 'bg-[#475569]'}`}></div>
          
          <button 
            onClick={() => { setShowMicDevices(!showMicDevices); setShowCamDevices(false); }}
            className={`w-7 h-12 rounded-r-full flex items-center justify-center transition-colors ${
              isMicMuted ? 'hover:bg-[#DC2626]' : 'hover:bg-[#475569]'
            } text-white`}
          >
            <ChevronUp size={16} />
          </button>

          {/* Popup */}
          {showMicDevices && (
            <div className="absolute bottom-[110%] left-0 w-56 bg-[#1E293B] border border-[#334155] rounded-xl shadow-xl p-2 z-30">
              <div className="text-[11px] font-semibold text-[#94A3B8] mb-1.5 px-2 uppercase tracking-wider">Microphone</div>
              {micDevices?.length > 0 ? micDevices.map(device => (
                <button
                  key={device.deviceId}
                  onClick={() => { microphone.select(device.deviceId); setShowMicDevices(false); }}
                  className={`w-full text-left px-2 py-1.5 text-[13px] rounded-lg transition-colors flex items-center gap-2 ${selectedMic === device.deviceId ? 'bg-[#4F46E5] text-white' : 'text-[#E2E8F0] hover:bg-[#334155]'}`}
                >
                  <div className="truncate">{device.label || 'Default Device'}</div>
                  {selectedMic === device.deviceId && <Check size={14} className="ml-auto flex-shrink-0" />}
                </button>
              )) : (
                <div className="px-2 py-1.5 text-[13px] text-[#64748B]">No devices found</div>
              )}
            </div>
          )}
        </div>

        {/* Camera Group */}
        <div ref={camPanelRef} className={`relative flex items-center rounded-full transition-colors ${isCamMuted ? 'bg-[#EF4444]' : 'bg-[#334155]'}`}>
          <button 
            onClick={handleToggleCamera}
            className={`w-12 h-12 rounded-l-full flex items-center justify-center transition-colors ${
              isCamMuted ? 'hover:bg-[#DC2626]' : 'hover:bg-[#475569]'
            }`}
          >
            {isCamMuted ? <VideoOff size={20} className="text-white" /> : <Video size={20} className="text-white" />}
          </button>
          
          <div className={`w-px h-6 ${isCamMuted ? 'bg-[#B91C1C]' : 'bg-[#475569]'}`}></div>
          
          <button 
            onClick={() => { setShowCamDevices(!showCamDevices); setShowMicDevices(false); }}
            className={`w-7 h-12 rounded-r-full flex items-center justify-center transition-colors ${
              isCamMuted ? 'hover:bg-[#DC2626]' : 'hover:bg-[#475569]'
            } text-white`}
          >
            <ChevronUp size={16} />
          </button>

          {/* Popup */}
          {showCamDevices && (
            <div className="absolute bottom-[110%] left-0 w-56 bg-[#1E293B] border border-[#334155] rounded-xl shadow-xl p-2 z-30">
              <div className="text-[11px] font-semibold text-[#94A3B8] mb-1.5 px-2 uppercase tracking-wider">Camera</div>
              {camDevices?.length > 0 ? camDevices.map(device => (
                <button
                  key={device.deviceId}
                  onClick={() => { camera.select(device.deviceId); setShowCamDevices(false); }}
                  className={`w-full text-left px-2 py-1.5 text-[13px] rounded-lg transition-colors flex items-center gap-2 ${selectedCam === device.deviceId ? 'bg-[#4F46E5] text-white' : 'text-[#E2E8F0] hover:bg-[#334155]'}`}
                >
                  <div className="truncate">{device.label || 'Default Camera'}</div>
                  {selectedCam === device.deviceId && <Check size={14} className="ml-auto flex-shrink-0" />}
                </button>
              )) : (
                <div className="px-2 py-1.5 text-[13px] text-[#64748B]">No devices found</div>
              )}
            </div>
          )}
        </div>
        
        {/* Screen Share Button */}
        <button 
          onClick={handleToggleScreenShare}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
            !isScreenShared ? 'bg-[#4F46E5] hover:bg-[#4338CA]' : 'bg-[#334155] hover:bg-[#475569]'
          }`}
        >
          <MonitorUp size={20} className="text-white" />
        </button>

        {/* Record & Emoji Buttons from Stream SDK */}
        <RecordCallButton />
        <ReactionsButton />

        {/* End Call Button */}
        <button 
          onClick={handleEndCall}
          className="w-16 h-12 rounded-full bg-[#EF4444] hover:bg-[#DC2626] flex items-center justify-center transition-colors ml-4 flex-shrink-0"
        >
          <PhoneOff size={20} className="text-white" />
        </button>

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
  );
}
