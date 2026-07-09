import { MicOff, VideoOff, ScreenShare, X } from 'lucide-react';
import { useCallStateHooks } from '@stream-io/video-react-sdk';
import { getInitials, getAvatarColor } from '../lib/utils';

interface ParticipantListPanelProps {
  onClose: () => void;
  hostClerkId?: string | null;
}

export default function ParticipantListPanel({ onClose, hostClerkId }: ParticipantListPanelProps) {
  const { useParticipants, useLocalParticipant } = useCallStateHooks();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();

  // Sorting Logic: 
  // We want strict ordering: Local User -> Host -> Everyone Else.
  
  // 1. Local User
  const localUser = localParticipant;
  
  // 2. Host (Exclude local user if they happen to be the host, to avoid duplicates)
  const hostUser = participants.find(
    (p) => p.userId === hostClerkId && p.sessionId !== localUser?.sessionId
  );
  
  // 3. Everyone Else (Exclude local user and host)
  const otherUsers = participants.filter(
    (p) => p.sessionId !== localUser?.sessionId && p.userId !== hostClerkId
  );

  // Compile final ordered list
  const orderedList = [localUser, hostUser, ...otherUsers].filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
        <h2 className="text-[15px] font-semibold text-[#111827]">Participants ({participants.length})</h2>
        <button 
          onClick={onClose}
          className="p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] rounded-full transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {orderedList.map((p) => {
          const isLocal = p?.sessionId === localUser?.sessionId;
          const isHost = p?.userId === hostClerkId;
          const name = p?.name || p?.userId || 'Unknown';
          const imageUrl = p?.image;
          
          // Check live status via Stream's publishedTracks arrays (or boolean fallbacks)
          // Stream uses 1/'audioTrack' for Mic, 2/'videoTrack' for Camera, 3/'SCREEN_SHARE' for sharing
          const isAudioOn = p?.publishedTracks.includes(1) || p?.publishedTracks.includes('audioTrack') || (p as any).hasAudio;
          const isMicMuted = !isAudioOn;
          
          const isVideoOn = p?.publishedTracks.includes(2) || p?.publishedTracks.includes('videoTrack') || (p as any).hasVideo;
          const isCameraOff = !isVideoOn;
          
          const isSharingScreen = p?.publishedTracks.includes(3) || 
                                  p?.publishedTracks.includes('SCREEN_SHARE') || 
                                  p?.publishedTracks.includes('screenShareTrack') || 
                                  (p as any).hasScreenShare;

          return (
            <div key={p?.sessionId} className="flex items-center justify-between p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors group">
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar */}
                {imageUrl ? (
                  <img src={imageUrl} alt={name} className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-200" />
                ) : (
                  <div 
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                    style={{ background: getAvatarColor(p?.userId || '') }}
                  >
                    {getInitials(name)}
                  </div>
                )}
                
                {/* Name & Role */}
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-medium text-[#374151] truncate">
                    {name} {isLocal && '(You)'}
                  </span>
                  {isHost && (
                    <span className="text-[11px] text-[#6B7280]">Meeting Host</span>
                  )}
                </div>
              </div>

              {/* Status Icons */}
              <div className="flex items-center gap-2 text-[#9CA3AF]">
                {isSharingScreen && <ScreenShare size={15} className="text-blue-500" title="Sharing Screen" />}
                {isMicMuted && <MicOff size={15} className="text-red-500" title="Muted" />}
                {isCameraOff && <VideoOff size={15} title="Camera Off" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
