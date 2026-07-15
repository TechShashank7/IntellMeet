import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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
import { getInitials, getAvatarColor, formatElapsedTime, formatCountdown } from '../lib/utils';
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
  ChevronUp,
  Settings,
  Users
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

  const [hasClickedJoin, setHasClickedJoin] = useState(false);
  const [timeHasPassed, setTimeHasPassed] = useState(false);
  const [msRemaining, setMsRemaining] = useState(0);

  const meetingStartTime = meeting?.startTime ? new Date(meeting.startTime) : null;

  useEffect(() => {
    if (!meetingStartTime || isHost || meeting?.status !== 'scheduled') return;
    const tick = () => {
      const diff = meetingStartTime.getTime() - Date.now();
      setMsRemaining(diff);
      setTimeHasPassed(diff <= 0);
    };
    tick();
    const interval = setInterval(tick, 1000); // local clock only, no network calls
    return () => clearInterval(interval);
  }, [meetingStartTime, isHost, meeting?.status]);

  const mustWait = !isHost && meeting?.status === 'scheduled' && meetingStartTime && meetingStartTime > new Date() && !hasClickedJoin;

  const [waitingRoomStatus, setWaitingRoomStatus] = useState<'checking' | 'waiting' | 'admitted' | 'denied'>('checking');

  useEffect(() => {
    if (mustWait) return;
    if (!meetingId || !userId) return;
    if (isHost) {
      setWaitingRoomStatus('admitted');
      return;
    }
    // If the API already reports us as a resolved attendee, skip the waiting room 
    // entirely (covers rejoin-after-leave and already-admitted cases).
    const alreadyParticipant = meeting?.attendees?.some((a: any) => a.clerkId === userId);
    if (alreadyParticipant) {
      setWaitingRoomStatus('admitted');
      return;
    }

    let isMounted = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const start = async () => {
      try {
        const token = await getToken();
        if (!token || !isMounted) return;
        const result = await api.requestToJoinMeeting(meetingId, token);
        if (!isMounted) return;
        setWaitingRoomStatus(result.status);
        if (result.status === 'waiting') {
          pollTimer = setInterval(async () => {
            try {
              const pollToken = await getToken();
              if (!pollToken) return;
              const pollResult = await api.getWaitingRoomStatus(meetingId, pollToken);
              if (!isMounted) return;
              setWaitingRoomStatus(pollResult.status);
              if (pollResult.status !== 'waiting' && pollTimer) {
                clearInterval(pollTimer);
              }
            } catch (err) {
              console.warn('Failed to poll waiting room status', err);
            }
          }, 2500);
        }
      } catch (err) {
        console.warn('Failed to request to join meeting', err);
        if (isMounted) setWaitingRoomStatus('admitted'); // fail-open so a network hiccup doesn't hard-block joining
      }
    };

    start();

    return () => {
      isMounted = false;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [mustWait, meetingId, userId, isHost, getToken, meeting?.attendees]);

  useEffect(() => {
    if (!callId || !userId) return;
    if (mustWait) return;
    if (waitingRoomStatus !== 'admitted') return;

    
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

        if (meetingId) {
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
  }, [callId, meetingId, hostClerkId, userId, userFullName, userImageUrl, getToken, mustWait, waitingRoomStatus]);

  if (isLoading) {
    return (
      <div className="h-screen bg-[#0F172A] flex flex-col font-sans items-center justify-center">
        <div className="text-[#94A3B8]">Loading meeting room...</div>
      </div>
    );
  }

  if (mustWait) {
    return (
      <div className="h-screen bg-[#0F172A] flex flex-col items-center justify-center font-sans text-center px-6 relative">
        <button 
          onClick={() => navigate('/dashboard')}
          className="absolute top-6 left-6 flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors text-[14px] font-medium"
        >
          <ChevronLeft size={18} />
          Back to Dashboard
        </button>
        {!timeHasPassed ? (
          <>
            <div className="text-[#94A3B8] text-[15px] mb-3">Meeting starts in</div>
            <div className="text-white text-[40px] font-bold tabular-nums mb-3 tracking-tight">
              {formatCountdown(msRemaining)}
            </div>
            <div className="text-[#64748B] text-[14px]">
              {format(meetingStartTime!, "MMMM d, yyyy 'at' h:mm a")}
            </div>
          </>
        ) : (
          <>
            <div className="text-[#10B981] text-[16px] font-medium mb-4">You can join the meeting now</div>
            <button
              onClick={() => setHasClickedJoin(true)}
              className="px-6 py-3 bg-[#4F46E5] text-white rounded-md font-medium hover:bg-[#4338CA] transition-colors"
            >
              Click here to join
            </button>
          </>
        )}
      </div>
    );
  }

  if (waitingRoomStatus === 'checking' || waitingRoomStatus === 'waiting') {
    return (
      <div className="h-screen bg-[#0F172A] flex flex-col items-center justify-center font-sans text-center px-6 relative">
        <button 
          onClick={() => navigate('/dashboard')}
          className="absolute top-6 left-6 flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors text-[14px] font-medium"
        >
          <ChevronLeft size={18} />
          Back to Dashboard
        </button>
        <div className="w-10 h-10 rounded-full border-2 border-[#4F46E5] border-t-transparent animate-spin mb-6" />
        <div className="text-white text-[18px] font-medium mb-2">Waiting to be let in</div>
        <div className="text-[#94A3B8] text-[14px]">You'll join automatically once the host admits you</div>
      </div>
    );
  }

  if (waitingRoomStatus === 'denied') {
    return (
      <div className="h-screen bg-[#0F172A] flex flex-col items-center justify-center font-sans text-center px-6 relative">
        <div className="text-[#EF4444] text-[18px] font-medium mb-2">The host didn't admit you to this meeting</div>
        <div className="text-[#94A3B8] text-[14px] mb-6">You can try again or head back to your dashboard</div>
        <div className="flex gap-3">
          <button
            onClick={() => setWaitingRoomStatus('checking')}
            className="px-5 py-2.5 bg-[#4F46E5] text-white rounded-md font-medium hover:bg-[#4338CA] transition-colors text-[14px]"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 bg-[#1E293B] text-white rounded-md font-medium hover:bg-[#334155] transition-colors text-[14px]"
          >
            Back to Dashboard
          </button>
        </div>
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
  const { useIsCallCaptioningInProgress, useMicrophoneState, useCameraState, useScreenShareState, useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const captionsEnabled = useIsCallCaptioningInProgress();
  const { microphone, isMute: isMicMuted, devices: micDevices, selectedDevice: selectedMic } = useMicrophoneState();
  const { camera, isMute: isCamMuted, devices: camDevices, selectedDevice: selectedCam } = useCameraState();
  const { screenShare, isMute: isScreenShared } = useScreenShareState();

  const { data: waitingRoomList = [] } = useQuery({
    queryKey: ['waitingRoom', meetingId],
    queryFn: async () => api.getWaitingRoom(meetingId || '', await getToken() || ''),
    enabled: isHost && !!meetingId,
    refetchInterval: 3000,
  });

  const queryClient = useQueryClient();

  const { mutate: admitGuest } = useMutation({
    mutationFn: async (clerkId: string) => {
      const token = await getToken();
      if (!token || !meetingId) return;
      await api.admitParticipant(meetingId, clerkId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitingRoom', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
    }
  });

  const { mutate: denyGuest } = useMutation({
    mutationFn: async (clerkId: string) => {
      const token = await getToken();
      if (!token || !meetingId) return;
      await api.denyParticipant(meetingId, clerkId, token);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['waitingRoom', meetingId] })
  });

  const { mutate: admitAllGuests } = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token || !meetingId) return;
      await api.admitAllParticipants(meetingId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitingRoom', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
    }
  });

  const { mutate: toggleOpenForAll } = useMutation({
    mutationFn: async (nextValue: boolean) => {
      const token = await getToken();
      if (!token || !meetingId) return;
      await api.updateOpenForAll(meetingId, token, nextValue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
      queryClient.invalidateQueries({ queryKey: ['waitingRoom', meetingId] });
    }
  });

  // Controls state
  const [showCaptionsPanel, setShowCaptionsPanel] = useState(false);
  const [showMicDevices, setShowMicDevices] = useState(false);
  const [showCamDevices, setShowCamDevices] = useState(false);
  
  const [showAdmitPopup, setShowAdmitPopup] = useState(false);
  const admitPopupRef = useRef<HTMLDivElement | null>(null);

  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  const settingsPopupRef = useRef<HTMLDivElement | null>(null);

  const [showEndCallPopup, setShowEndCallPopup] = useState(false);
  const endCallPopupRef = useRef<HTMLDivElement | null>(null);
  const hasNavigatedAwayRef = useRef(false);

  useEffect(() => {
    if (callingState === CallingState.LEFT && !hasNavigatedAwayRef.current) {
      hasNavigatedAwayRef.current = true;
      navigate(`/summary/${id || 'm1'}`);
    }
  }, [callingState, navigate, id]);
  
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

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isMobile) return;

    const hasOpenPopups = showCaptionsPanel || showMicDevices || showCamDevices || showAdmitPopup || showSettingsPopup || showEndCallPopup || isSidebarOpen;

    const resetControlsTimeout = () => {
      setControlsVisible(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      
      if (hasOpenPopups) return;
      
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 5000);
    };

    resetControlsTimeout();

    const handleTouch = () => resetControlsTimeout();
    document.addEventListener('touchstart', handleTouch);
    document.addEventListener('mousemove', handleTouch);
    
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      document.removeEventListener('touchstart', handleTouch);
      document.removeEventListener('mousemove', handleTouch);
    };
  }, [isMobile, showCaptionsPanel, showMicDevices, showCamDevices, showAdmitPopup, showSettingsPopup, showEndCallPopup, isSidebarOpen]);

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
      if (showEndCallPopup && endCallPopupRef.current && !endCallPopupRef.current.contains(event.target as Node)) {
        setShowEndCallPopup(false);
      }
      if (showAdmitPopup && admitPopupRef.current && !admitPopupRef.current.contains(event.target as Node)) {
        setShowAdmitPopup(false);
      }
      if (showSettingsPopup && settingsPopupRef.current && !settingsPopupRef.current.contains(event.target as Node)) {
        setShowSettingsPopup(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCaptionsPanel, showMicDevices, showCamDevices, showEndCallPopup, showAdmitPopup, showSettingsPopup]);

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

  const handleEndCallButtonClick = () => {
    if (isHost) {
      setShowEndCallPopup(prev => !prev);
    } else {
      handleLeaveMeeting();
    }
  };

  const handleLeaveMeeting = async () => {
    setShowEndCallPopup(false);
    try {
      if (call && call.state.callingState !== CallingState.LEFT) {
        await call.leave();
      }
    } catch (err: any) {
      if (!err.message?.includes('already been left')) {
        console.error("Error leaving call", err);
      }
    }
    // Navigation is handled by the callingState effect above — do not navigate here.
  };

  const handleEndForAll = async () => {
    setShowEndCallPopup(false);
    try {
      if (meetingId) {
        const token = await getToken();
        if (token) {
          await api.endMeeting(meetingId, token);
        }
      }
    } catch (err) {
      console.error("Failed to end meeting on backend", err);
    }
    try {
      if (call) {
        await call.endCall();
      }
    } catch (err) {
      console.error("Failed to end call on Stream", err);
    }
    try {
      if (call && call.state.callingState !== CallingState.LEFT) {
        await call.leave();
      }
    } catch (err: any) {
      if (!err.message?.includes('already been left')) {
        console.error("Error leaving call after endCall", err);
      }
    }
    // Navigation is handled by the callingState effect above — do not navigate here.
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
      <div className={`h-14 flex items-center justify-between px-4 text-white border-b border-[#1E293B] flex-shrink-0 bg-[#0F172A] md:relative absolute top-0 w-full z-20 transition-transform duration-300 ${!isMobile || controlsVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div className="bg-[#EF4444] w-2 h-2 rounded-full animate-pulse flex-shrink-0" />
          <span className="font-medium text-[14px] truncate">{meeting?.title || 'Meeting Room'}</span>
          {isHost && (
            <button
              onClick={() => {
                setShowMeetingReadyCard(true);
                if (meetingReadyTimeoutRef.current) clearTimeout(meetingReadyTimeoutRef.current);
                meetingReadyTimeoutRef.current = setTimeout(() => setShowMeetingReadyCard(false), 10000);
              }}
              className="text-[#94A3B8] hover:text-white transition-colors flex-shrink-0"
              title="Meeting info"
            >
              <Info size={16} />
            </button>
          )}
          <span className="text-[#94A3B8] bg-[#1E293B] px-2 py-0.5 rounded text-[12px] flex-shrink-0">{formatElapsedTime(elapsedSeconds)}</span>
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          {isHost && waitingRoomList.length > 0 && (
            <div ref={admitPopupRef} className="relative">
              <button
                onClick={() => setShowAdmitPopup(prev => !prev)}
                className="flex items-center gap-2 bg-[#10B981] hover:bg-[#059669] transition-colors rounded-full px-3 md:px-4 py-2 text-white text-[13px] font-semibold"
              >
                <span className="md:hidden flex items-center gap-1.5">
                  <Users size={16} />
                  <span className="bg-white text-[#10B981] px-1.5 rounded-full text-[11px] leading-tight font-bold">{waitingRoomList.length}</span>
                </span>
                <span className="hidden md:inline">
                  {waitingRoomList.length === 1 ? 'Admit one guest' : `Admit ${waitingRoomList.length} guests`}
                </span>
              </button>

              {showAdmitPopup && (
                <div className="fixed top-16 left-1/2 -translate-x-1/2 md:absolute md:top-full md:right-0 md:left-auto md:translate-x-0 mt-0 md:mt-2 w-[calc(100vw-2rem)] max-w-sm md:w-72 bg-[#1E293B] border border-[#334155] rounded-xl shadow-xl p-4 z-50 text-left">
                  <div className="text-[13px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">In waiting room</div>

                  {waitingRoomList.length === 1 ? (
                    <>
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <button
                          onClick={() => admitGuest(waitingRoomList[0].clerkId)}
                          className="flex-1 px-3 py-2 bg-[#4F46E5] text-white rounded-md text-[13px] font-medium hover:bg-[#4338CA] transition-colors"
                        >
                          Admit
                        </button>
                        <button
                          onClick={() => denyGuest(waitingRoomList[0].clerkId)}
                          className="flex-1 px-3 py-2 bg-[#334155] text-white rounded-md text-[13px] font-medium hover:bg-[#475569] transition-colors"
                        >
                          Deny
                        </button>
                      </div>
                      <div className="flex flex-col items-center gap-2 mb-4">
                        {waitingRoomList[0].profileImage ? (
                          <img src={waitingRoomList[0].profileImage} alt={waitingRoomList[0].name} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[15px] font-bold" style={{ background: getAvatarColor(waitingRoomList[0].clerkId) }}>
                            {getInitials(waitingRoomList[0].name)}
                          </div>
                        )}
                        <span className="text-[13px] font-medium text-white">{waitingRoomList[0].name}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-[#0F172A] rounded-lg p-3 mb-3">
                        <div className="text-[13px] text-white font-medium mb-2">{waitingRoomList.length} people waiting</div>
                        <div className="text-[12px] text-[#94A3B8] mb-3 leading-relaxed">
                          {waitingRoomList.slice(0, 3).map((w: any) => w.name).join(', ')}
                          {waitingRoomList.length > 3 ? ` and ${waitingRoomList.length - 3} others` : ''}
                        </div>
                        <div className="flex -space-x-2">
                          {waitingRoomList.slice(0, 6).map((w: any) => (
                            w.profileImage ? (
                              <img key={w.clerkId} src={w.profileImage} alt={w.name} className="w-8 h-8 rounded-full object-cover border-2 border-[#0F172A]" />
                            ) : (
                              <div key={w.clerkId} className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-[#0F172A]" style={{ background: getAvatarColor(w.clerkId) }}>
                                {getInitials(w.name)}
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => admitAllGuests()}
                        className="w-full px-3 py-2 bg-[#4F46E5] text-white rounded-md text-[13px] font-medium hover:bg-[#4338CA] transition-colors mb-2"
                      >
                        Admit all
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => { setShowAdmitPopup(false); setIsSidebarOpen(true); setShowParticipantPanel(true); }}
                    className="w-full text-center text-[13px] text-[#4F46E5] font-medium hover:underline py-1"
                  >
                    View All ({waitingRoomList.length}) &rarr;
                  </button>
                </div>
              )}
            </div>
          )}
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
      <div className={`flex-1 h-full min-h-0 min-w-0 flex overflow-hidden relative transition-all duration-300 ${isMobile && controlsVisible ? 'pt-[56px] pb-[80px]' : 'pt-0 pb-0'} md:pt-0 md:pb-0`}>
        {/* Video Grid */}
        <div className="flex-1 h-full min-h-0 min-w-0 p-4 flex flex-col">
          <div className="flex-1 h-full min-h-0 rounded-xl shadow-lg relative">
            <AdaptiveMeetingLayout isSidebarOpen={isSidebarOpen} onShowParticipants={() => setShowParticipantPanel(true)} />
          </div>
        </div>

        {/* Sidebar */}
        <div 
          className={`h-full overflow-hidden transition-all duration-300 ease-in-out flex-shrink-0 ${
            isSidebarOpen 
              ? 'absolute inset-0 z-40 w-full min-w-full md:relative md:inset-auto md:w-[340px] md:min-w-[340px]' 
              : 'w-0 min-w-0'
          }`}
        >
          <div className="w-full md:w-[340px] h-full bg-[#0F172A] flex flex-col border-l border-[#1E293B]">
            {showParticipantPanel ? (
              <ParticipantListPanel 
                onClose={() => setShowParticipantPanel(false)} 
                hostClerkId={hostClerkId}
                waitingRoom={waitingRoomList}
                isHost={isHost}
                onAdmit={admitGuest}
                onDeny={denyGuest}
                onAdmitAll={admitAllGuests}
              />
            ) : (
              <>
                {/* Tabs */}
                <div className="flex border-b border-[#1E293B]">
                  <div className="flex flex-1">
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
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="md:hidden flex items-center justify-center px-4 border-l border-[#1E293B] text-[#94A3B8] hover:bg-[#1E293B] transition-colors"
                  >
                    <X size={18} />
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
      <div className={`h-[80px] bg-[#0F172A] border-t border-[#1E293B] flex items-center justify-between md:justify-center px-2 md:px-6 md:relative absolute bottom-0 w-full z-20 transition-transform duration-300 flex-shrink-0 ${!isMobile || controlsVisible ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex-1 md:flex-initial relative md:static overflow-hidden md:overflow-visible mr-2 md:mr-0">
          <div className="w-full h-full flex items-center justify-start md:justify-center gap-2 md:gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pr-8 md:pr-0">
            {/* Mic Group */}
            <div ref={micPanelRef} className={`relative flex items-center rounded-full transition-colors flex-shrink-0 ${isMicMuted ? 'bg-[#EF4444]' : 'bg-[#334155]'}`}>
              <button 
                onClick={handleToggleMic}
                className={`w-11 md:w-12 h-11 md:h-12 rounded-l-full flex items-center justify-center transition-colors ${
                  isMicMuted ? 'hover:bg-[#DC2626]' : 'hover:bg-[#475569]'
                }`}
          >
            {isMicMuted ? <MicOff size={20} className="text-white" /> : <Mic size={20} className="text-white" />}
          </button>
          
          <div className={`w-px h-6 ${isMicMuted ? 'bg-[#B91C1C]' : 'bg-[#475569]'}`}></div>
          
          <button 
            onClick={() => { setShowMicDevices(!showMicDevices); setShowCamDevices(false); }}
            className={`w-6 md:w-7 h-11 md:h-12 rounded-r-full flex items-center justify-center transition-colors ${
              isMicMuted ? 'hover:bg-[#DC2626]' : 'hover:bg-[#475569]'
            } text-white`}
          >
            <ChevronUp size={16} />
          </button>

          {/* Popup */}
          {showMicDevices && (
            <div className="fixed md:absolute bottom-[90px] md:bottom-[110%] left-4 md:left-0 w-56 bg-[#1E293B] border border-[#334155] rounded-xl shadow-xl p-2 z-30">
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
            <div ref={camPanelRef} className={`relative flex items-center rounded-full transition-colors flex-shrink-0 ${isCamMuted ? 'bg-[#EF4444]' : 'bg-[#334155]'}`}>
              <button 
                onClick={handleToggleCamera}
                className={`w-11 md:w-12 h-11 md:h-12 rounded-l-full flex items-center justify-center transition-colors ${
                  isCamMuted ? 'hover:bg-[#DC2626]' : 'hover:bg-[#475569]'
                }`}
              >
                {isCamMuted ? <VideoOff size={20} className="text-white" /> : <Video size={20} className="text-white" />}
              </button>
              
              <div className={`w-px h-6 ${isCamMuted ? 'bg-[#B91C1C]' : 'bg-[#475569]'}`}></div>
              
              <button 
                onClick={() => { setShowCamDevices(!showCamDevices); setShowMicDevices(false); }}
                className={`w-6 md:w-7 h-11 md:h-12 rounded-r-full flex items-center justify-center transition-colors ${
                  isCamMuted ? 'hover:bg-[#DC2626]' : 'hover:bg-[#475569]'
                } text-white`}
              >
                <ChevronUp size={16} />
              </button>

              {/* Popup */}
              {showCamDevices && (
                <div className="fixed md:absolute bottom-[90px] md:bottom-[110%] left-4 md:left-0 w-56 bg-[#1E293B] border border-[#334155] rounded-xl shadow-xl p-2 z-30">
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
            {!isMobile && (
              <button 
                onClick={handleToggleScreenShare}
                className={`w-11 md:w-12 h-11 md:h-12 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                  !isScreenShared ? 'bg-[#4F46E5] hover:bg-[#4338CA]' : 'bg-[#334155] hover:bg-[#475569]'
                }`}
              >
                <MonitorUp size={20} className="text-white" />
              </button>
            )}

        {/* Record & Emoji Buttons from Stream SDK */}
        {!isMobile && <RecordCallButton />}
        <ReactionsButton />

            {/* Settings Toggle Button */}
            {isHost && (
              <div ref={settingsPopupRef} className="relative md:absolute md:right-[72px] md:top-1/2 md:-translate-y-1/2 z-20 flex-shrink-0">
                <button
                  onClick={() => setShowSettingsPopup(prev => !prev)}
                  className="w-11 h-11 md:w-10 md:h-10 rounded-full bg-[#1E293B] border border-[#334155] text-white shadow-md flex items-center justify-center hover:bg-[#2D3748] transition-colors"
                  title="Meeting settings"
                >
                  <Settings size={18} />
                </button>

                {showSettingsPopup && (
                  <div className="fixed bottom-[90px] right-4 md:absolute md:bottom-full md:right-0 md:mb-2 w-[calc(100vw-2rem)] md:w-72 bg-[#1E293B] border border-[#334155] rounded-xl shadow-xl p-4 z-30 text-left">
                    <div className="text-[13px] font-semibold text-white mb-3">Meeting Settings</div>
                    <div className="flex items-center justify-between">
                      <div className="pr-3">
                        <div className="text-[13px] font-medium text-white">Make this meeting open for all</div>
                        <div className="text-[11px] text-[#94A3B8] mt-0.5">Anyone with the link or code joins instantly, without waiting for admission</div>
                      </div>
                      <button
                        onClick={() => toggleOpenForAll(!meeting?.openForAll)}
                        className={`w-10 h-[22px] rounded-full relative transition-colors flex-shrink-0 ${meeting?.openForAll ? 'bg-[#4F46E5]' : 'bg-[#475569]'}`}
                      >
                        <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform duration-200 ${meeting?.openForAll ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sidebar Toggle Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="relative md:absolute md:right-6 md:top-1/2 md:-translate-y-1/2 z-20 w-11 h-11 md:w-10 md:h-10 rounded-full bg-[#1E293B] border border-[#334155] text-white shadow-md flex items-center justify-center hover:bg-[#2D3748] transition-colors flex-shrink-0"
              title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            >
              {isSidebarOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>

          </div>
          {/* Gradient fade to indicate scrollability on mobile */}
          <div className="md:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0F172A] to-transparent pointer-events-none" />
        </div>

        {/* End Call Button */}
        <div ref={endCallPopupRef} className="relative flex-shrink-0 md:ml-4">
          <button 
            onClick={handleEndCallButtonClick}
            className="w-14 md:w-16 h-11 md:h-12 rounded-full bg-[#EF4444] hover:bg-[#DC2626] flex items-center justify-center transition-colors"
          >
            <PhoneOff size={20} className="text-white" />
          </button>

          {showEndCallPopup && isHost && (
            <div className="fixed md:absolute bottom-[90px] md:bottom-[110%] right-4 md:left-1/2 md:-translate-x-1/2 md:right-auto w-56 bg-[#1E293B] border border-[#334155] rounded-xl shadow-xl p-2 z-30">
              <button
                onClick={handleEndForAll}
                className="w-full text-left px-3 py-2.5 text-[13px] font-medium text-white bg-[#EF4444] hover:bg-[#DC2626] rounded-lg transition-colors mb-1.5"
              >
                End meeting for all
              </button>
              <button
                onClick={handleLeaveMeeting}
                className="w-full text-left px-3 py-2.5 text-[13px] font-medium text-[#E2E8F0] hover:bg-[#334155] rounded-lg transition-colors"
              >
                Leave meeting
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Meeting Ready Card */}
      {showMeetingReadyCard && isHost && (
        <div className="fixed bottom-[96px] left-4 z-30 w-[calc(100vw-2rem)] max-w-[380px] md:w-[380px] bg-white rounded-xl shadow-xl p-5">
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
