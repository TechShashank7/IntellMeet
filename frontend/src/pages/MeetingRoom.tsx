import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUser, useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { getInitials, getAvatarColor } from '../lib/utils';
import { 
  StreamVideo, 
  StreamCall, 
  StreamVideoClient, 
  SpeakerLayout, 
  CallControls, 
  StreamTheme, 
  Call 
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';

import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  MonitorUp, 
  PhoneOff, 
  MessageSquare, 
  FileText,
  Send,
  MoreVertical
} from 'lucide-react';

export default function MeetingRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();
  
  // Controls state
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [activeTab, setActiveTab] = useState<'transcript' | 'chat'>('transcript');
  
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);

  const clientRef = useRef<StreamVideoClient | null>(null);
  const callRef = useRef<Call | null>(null);

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

  useEffect(() => {
    if (!callId || !userId) return;
    
    let isMounted = true;
    let _client: StreamVideoClient | null = null;
    let _call: Call | null = null;

    const initCall = async () => {
      try {
        const token = await getToken();
        if (!token || !isMounted) return;

        const isHost = userId === hostClerkId;
        
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
        });

        _call = _client.call('default', callId);
        
        // Enable camera and microphone BEFORE joining and await them
        await _call.camera.enable();
        await _call.microphone.enable();
        
        await _call.join({ create: false });

        if (isMounted) {
          clientRef.current = _client;
          callRef.current = _call;
          setClient(_client);
          setCall(_call);
        } else {
          _call.leave().catch(console.error);
          _client.disconnectUser().catch(console.error);
        }
      } catch (error) {
        console.error("Failed to initialize Stream call", error);
      }
    };

    initCall();

    return () => {
      isMounted = false;
      
      // Cleanup using refs immediately to prevent double initialization issues in Strict Mode
      if (callRef.current) {
        callRef.current.leave().catch(console.error);
        callRef.current = null;
      }
      if (clientRef.current) {
        clientRef.current.disconnectUser().catch(console.error);
        clientRef.current = null;
      }
      setClient(null);
      setCall(null);
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
        await call?.leave();
      }
    } catch (err) {
      console.error("Error during end call", err);
    }
    
    navigate(`/summary/${id || 'm1'}`);
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-[#0F172A] flex flex-col font-sans items-center justify-center">
        <div className="text-[#94A3B8]">Loading meeting room...</div>
      </div>
    );
  }

  const transcript = meeting?.transcript || [];
  const chat = meeting?.chat || [];

  return (
    <div className="h-screen bg-[#0F172A] flex flex-col font-sans overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 flex items-center justify-between px-4 text-white border-b border-[#1E293B]">
        <div className="flex items-center gap-3">
          <div className="bg-[#EF4444] w-2 h-2 rounded-full animate-pulse" />
          <span className="font-medium text-[14px]">{meeting?.title || 'Meeting Room'}</span>
          <span className="text-[#94A3B8] bg-[#1E293B] px-2 py-0.5 rounded text-[12px]">48:12</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4 flex flex-col">
          {client && call ? (
            <StreamVideo client={client}>
              <StreamCall call={call}>
                <StreamTheme className="flex-1 rounded-xl overflow-hidden shadow-lg border-2 border-[#4F46E5] relative h-full">
                  <SpeakerLayout />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                    <CallControls />
                  </div>
                </StreamTheme>
              </StreamCall>
            </StreamVideo>
          ) : (
            <div className="flex-1 bg-[#1E293B] rounded-xl flex items-center justify-center border-2 border-[#4F46E5] shadow-lg">
              <span className="text-[#94A3B8]">Loading meeting room...</span>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-[340px] bg-white flex flex-col border-l border-[#E5E7EB]">
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
            {activeTab === 'transcript' && transcript.map((entry, idx) => (
              <div key={idx} className="flex gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-1"
                  style={{ background: entry.color || '#4F46E5' }}
                >
                  {entry.initials}
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-semibold text-[#111827] text-[13px]">{entry.speaker}</span>
                    <span className="text-[#9CA3AF] text-[11px]">{entry.time}</span>
                  </div>
                  <p className="text-[#374151] text-[13px] leading-relaxed">
                    {entry.text}
                  </p>
                </div>
              </div>
            ))}

            {activeTab === 'chat' && chat.map((entry, idx) => (
              <div key={idx} className="flex gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ background: entry.color || '#10B981' }}
                >
                  {entry.initials}
                </div>
                <div className="bg-[#F3F4F6] p-3 rounded-xl rounded-tl-none">
                  <div className="flex justify-between items-center mb-1 gap-4">
                    <span className="font-semibold text-[#111827] text-[12px]">{entry.sender}</span>
                    <span className="text-[#9CA3AF] text-[10px]">{entry.time}</span>
                  </div>
                  <p className="text-[#374151] text-[13px]">
                    {entry.text}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          {activeTab === 'chat' && (
            <div className="p-3 border-t border-[#E5E7EB]">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Send a message..." 
                  className="w-full bg-[#F3F4F6] border-transparent rounded-full pl-4 pr-10 py-2 text-[13px] focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#4F46E5] hover:bg-[#EEF2FF] rounded-full transition-colors">
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div className="h-[80px] bg-[#0F172A] border-t border-[#1E293B] flex items-center justify-center gap-4 px-6 relative">
         <button 
          onClick={() => setMicOn(!micOn)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${micOn ? 'bg-[#334155] text-white hover:bg-[#475569]' : 'bg-[#EF4444] text-white hover:bg-[#DC2626]'}`}
         >
           {micOn ? <Mic size={20} /> : <MicOff size={20} />}
         </button>
         <button 
          onClick={() => setVideoOn(!videoOn)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${videoOn ? 'bg-[#334155] text-white hover:bg-[#475569]' : 'bg-[#EF4444] text-white hover:bg-[#DC2626]'}`}
         >
           {videoOn ? <Video size={20} /> : <VideoOff size={20} />}
         </button>
         <button className="w-12 h-12 rounded-full flex items-center justify-center bg-[#334155] text-white hover:bg-[#475569] transition-colors">
           <MonitorUp size={20} />
         </button>
         <button className="w-12 h-12 rounded-full flex items-center justify-center bg-[#334155] text-white hover:bg-[#475569] transition-colors">
           <MoreVertical size={20} />
         </button>

         <button 
          onClick={handleEndCall}
          className="ml-4 px-6 h-12 rounded-full flex items-center gap-2 bg-[#EF4444] text-white hover:bg-[#DC2626] transition-colors font-medium text-[14px]"
         >
           <PhoneOff size={18} />
           End Call
         </button>
      </div>
    </div>
  );
}
