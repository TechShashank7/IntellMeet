import { useState } from 'react';
import { MicOff, VideoOff, ScreenShare, X } from 'lucide-react';
import { useCallStateHooks } from '@stream-io/video-react-sdk';
import { getInitials, getAvatarColor } from '../lib/utils';

function ChevronUpIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={`transition-transform ${open ? '' : 'rotate-180'}`}
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

interface ParticipantListPanelProps {
  onClose: () => void;
  hostClerkId?: string | null;
  waitingRoom?: any[];
  isHost?: boolean;
  onAdmit?: (clerkId: string) => void;
  onDeny?: (clerkId: string) => void;
  onAdmitAll?: () => void;
}

export default function ParticipantListPanel({
  onClose,
  hostClerkId,
  waitingRoom = [],
  isHost = false,
  onAdmit,
  onDeny,
  onAdmitAll,
}: ParticipantListPanelProps) {
  const [isWaitingSectionOpen, setIsWaitingSectionOpen] = useState(true);
  const [isMembersSectionOpen, setIsMembersSectionOpen] = useState(true);
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
    <div className="flex flex-col h-full bg-[#0F172A]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#1E293B]">
        <h2 className="text-[15px] font-semibold text-white">
          Participants ({participants.length})
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 text-[#94A3B8] hover:bg-[#1E293B] rounded-full transition-colors"
          aria-label="Close participant list"
        >
          <X size={18} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isHost && waitingRoom.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setIsWaitingSectionOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-2 py-2 text-[#94A3B8] hover:bg-[#1E293B] rounded-lg transition-colors"
            >
              <span className="text-[13px] font-semibold uppercase tracking-wider">
                Waiting to be admitted
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#64748B]">{waitingRoom.length}</span>
                <ChevronUpIcon open={isWaitingSectionOpen} />
              </div>
            </button>

            {isWaitingSectionOpen && (
              <div className="mt-1">
                {onAdmitAll && (
                  <button
                    onClick={onAdmitAll}
                    className="w-full text-left px-2 py-1.5 text-[13px] font-medium text-[#4F46E5] hover:underline mb-1"
                  >
                    Admit all
                  </button>
                )}
                {waitingRoom.map((w: any) => (
                  <div
                    key={w.clerkId}
                    className="flex items-center justify-between p-2 hover:bg-[#1E293B] rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {w.profileImage ? (
                        <img
                          src={w.profileImage}
                          alt={w.name}
                          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                          style={{ background: getAvatarColor(w.clerkId) }}
                        >
                          {getInitials(w.name)}
                        </div>
                      )}
                      <span className="text-[14px] font-medium text-white truncate">{w.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => onAdmit && onAdmit(w.clerkId)}
                        className="px-2.5 py-1 bg-[#4F46E5] text-white text-[12px] font-medium rounded-md hover:bg-[#4338CA] transition-colors"
                      >
                        Admit
                      </button>
                      <button
                        onClick={() => onDeny && onDeny(w.clerkId)}
                        className="px-2.5 py-1 bg-[#334155] text-white text-[12px] font-medium rounded-md hover:bg-[#475569] transition-colors"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <button
            onClick={() => setIsMembersSectionOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-2 py-2 text-[#94A3B8] hover:bg-[#1E293B] rounded-lg transition-colors"
          >
            <span className="text-[13px] font-semibold uppercase tracking-wider">
              In the meeting
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#64748B]">{orderedList.length}</span>
              <ChevronUpIcon open={isMembersSectionOpen} />
            </div>
          </button>

          {isMembersSectionOpen &&
            orderedList.map((p) => {
              const isLocal = p?.sessionId === localUser?.sessionId;
              const isHost = p?.userId === hostClerkId;
              const name = p?.name || p?.userId || 'Unknown';
              const imageUrl = p?.image;

              // Check live status via Stream's publishedTracks arrays (or boolean fallbacks)
              // Stream uses 1/'audioTrack' for Mic, 2/'videoTrack' for Camera, 3/'SCREEN_SHARE' for sharing
              const isAudioOn =
                (p?.publishedTracks as any[])?.includes(1) ||
                (p?.publishedTracks as any[])?.includes('audioTrack') ||
                (p as any).hasAudio;
              const isMicMuted = !isAudioOn;

              const isVideoOn =
                (p?.publishedTracks as any[])?.includes(2) ||
                (p?.publishedTracks as any[])?.includes('videoTrack') ||
                (p as any).hasVideo;
              const isCameraOff = !isVideoOn;

              const isSharingScreen =
                (p?.publishedTracks as any[])?.includes(3) ||
                (p?.publishedTracks as any[])?.includes('SCREEN_SHARE') ||
                (p?.publishedTracks as any[])?.includes('screenShareTrack') ||
                (p as any).hasScreenShare;

              return (
                <div
                  key={p?.sessionId}
                  className="flex items-center justify-between p-2 hover:bg-[#1E293B] rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={name}
                        className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-[#1E293B]"
                      />
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
                      <span className="text-[14px] font-medium text-white truncate">
                        {name} {isLocal && '(You)'}
                      </span>
                      {isHost && <span className="text-[11px] text-[#94A3B8]">Meeting Host</span>}
                    </div>
                  </div>

                  {/* Status Icons */}
                  <div className="flex items-center gap-2 text-[#64748B]">
                    {isSharingScreen && (
                      <span title="Sharing Screen">
                        <ScreenShare size={15} className="text-blue-500" />
                      </span>
                    )}
                    {isMicMuted && (
                      <span title="Muted">
                        <MicOff size={15} className="text-red-500" />
                      </span>
                    )}
                    {isCameraOff && (
                      <span title="Camera Off">
                        <VideoOff size={15} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
