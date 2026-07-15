import { useCallStateHooks, ParticipantView, type StreamVideoParticipant } from '@stream-io/video-react-sdk';
import { useState, useEffect } from 'react';

interface AdaptiveMeetingLayoutProps {
  isSidebarOpen?: boolean;
  onShowParticipants?: () => void;
}

export default function AdaptiveMeetingLayout({ isSidebarOpen = true, onShowParticipants }: AdaptiveMeetingLayoutProps) {
  const { useParticipants, useLocalParticipant } = useCallStateHooks();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const remoteParticipants = participants.filter(
    (p) => p.sessionId !== localParticipant?.sessionId
  );

  // Screen Share Layout Override
  const sharingParticipants = participants.filter((p) => 
    (p.publishedTracks as any[]).includes('SCREEN_SHARE') || 
    (p.publishedTracks as any[]).includes(3) ||
    (p.publishedTracks as any[]).includes('screenShareTrack') ||
    (p as any).hasScreenShare
  );
  
  if (sharingParticipants.length > 0) {
    // Known limitation: No clear timestamp field exists on the root participant object 
    // for when the track was published, so we pick the last one found if multiple share.
    const activeSharer = sharingParticipants[sharingParticipants.length - 1];
    
    // 1 Participant (Just presenter)
    if (participants.length === 1) {
      return (
        <div className="w-full h-full relative rounded-xl overflow-hidden bg-[#0F172A] [&_video]:!object-contain">
          <ParticipantView participant={activeSharer} trackType="screenShareTrack" />
        </div>
      );
    }

    if (isMobile) {
      const orderedParticipants = [...remoteParticipants, localParticipant].filter((p): p is StreamVideoParticipant => !!p);
      let visibleParticipants: StreamVideoParticipant[] = [];
      let hiddenCount = 0;
      
      if (orderedParticipants.length <= 2) {
        visibleParticipants = orderedParticipants;
      } else {
        visibleParticipants = [orderedParticipants[0], localParticipant].filter((p): p is StreamVideoParticipant => !!p);
        hiddenCount = orderedParticipants.length - 2;
      }

      return (
        <div className="flex flex-col w-full h-full gap-2">
          {/* Main Screen Share Area */}
          <div className="flex-1 rounded-xl overflow-hidden bg-[#0F172A] [&_video]:!object-contain relative">
            <ParticipantView participant={activeSharer} trackType="screenShareTrack" />
          </div>
          
          {/* Bottom Strip */}
          <div className="h-[120px] w-full flex-shrink-0 grid grid-cols-2 gap-2">
            {visibleParticipants.map((p) => {
              const isLocal = p.sessionId === localParticipant?.sessionId;
              return (
                <div key={p.sessionId} className="relative w-full h-full rounded-lg overflow-hidden bg-[#0F172A]">
                  <ParticipantView participant={p} trackType="videoTrack" />
                  {isLocal && hiddenCount > 0 && (
                    <div 
                      onClick={() => onShowParticipants && onShowParticipants()}
                      className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full bg-white text-[#111827] text-[12px] font-semibold flex items-center justify-center shadow-md cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      +{hiddenCount}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 2+ Participants Desktop
    const orderedParticipants = [...remoteParticipants, localParticipant].filter((p): p is StreamVideoParticipant => !!p);

    let stripContent;

    if (isSidebarOpen || orderedParticipants.length <= 2) {
      // Vertical Stack
      const MAX_VISIBLE = 4;
      let visibleParticipants = orderedParticipants;
      let hiddenCount = 0;
      
      if (orderedParticipants.length > MAX_VISIBLE) {
        const visibleRemotes = remoteParticipants.slice(0, 3);
        visibleParticipants = [...visibleRemotes, localParticipant].filter((p): p is StreamVideoParticipant => !!p);
        hiddenCount = remoteParticipants.length - 3;
      }

      stripContent = (
        <div className="flex flex-col gap-2 h-full w-full overflow-y-auto pr-1">
          {visibleParticipants.map((p) => {
            const isLocal = p.sessionId === localParticipant?.sessionId;
            return (
              <div key={p.sessionId} className="relative w-full flex-1 min-h-[120px] rounded-lg overflow-hidden bg-[#0F172A]">
                <ParticipantView participant={p} trackType="videoTrack" />
                {isLocal && hiddenCount > 0 && (
                  <div 
                    onClick={() => onShowParticipants && onShowParticipants()}
                    className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full bg-white text-[#111827] text-[12px] font-semibold flex items-center justify-center shadow-md cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    +{hiddenCount}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    } else if (orderedParticipants.length === 3) {
      // 3 Tiles Grid
      stripContent = (
        <div className="grid grid-cols-2 grid-rows-2 gap-2 h-full w-full">
          {orderedParticipants.map((p, idx) => (
            <div key={p.sessionId} className={`w-full h-full rounded-lg overflow-hidden bg-[#0F172A] ${idx === 0 ? 'col-span-2' : ''}`}>
              <ParticipantView participant={p} trackType="videoTrack" />
            </div>
          ))}
        </div>
      );
    } else if (orderedParticipants.length === 4) {
      // 4 Tiles Grid
      stripContent = (
        <div className="grid grid-cols-2 grid-rows-2 gap-2 h-full w-full">
          {orderedParticipants.map((p) => (
            <div key={p.sessionId} className="w-full h-full rounded-lg overflow-hidden bg-[#0F172A]">
              <ParticipantView participant={p} trackType="videoTrack" />
            </div>
          ))}
        </div>
      );
    } else {
      // 5+ Tiles Grid (Assumed auto-rows-fr with overflow)
      stripContent = (
        <div className="grid grid-cols-2 auto-rows-fr gap-2 h-full w-full overflow-y-auto pr-1">
          {orderedParticipants.map((p) => (
            <div key={p.sessionId} className="w-full min-h-[100px] rounded-lg overflow-hidden bg-[#0F172A]">
              <ParticipantView participant={p} trackType="videoTrack" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="flex w-full h-full gap-2">
        {/* Main Screen Share Area */}
        <div className={`${isSidebarOpen ? 'basis-3/4' : 'basis-[65%]'} shrink-0 h-full rounded-lg overflow-hidden bg-[#0F172A] [&_video]:!object-contain`}>
          <ParticipantView participant={activeSharer} trackType="screenShareTrack" />
        </div>
        
        {/* Strip container */}
        <div className="flex-1 h-full min-w-0">
          {stripContent}
        </div>
      </div>
    );
  }

  // --- MOBILE LAYOUT (No Screen Share) ---
  if (isMobile) {
    const orderedParticipants = [...remoteParticipants, localParticipant].filter((p): p is StreamVideoParticipant => !!p);
    
    // 1 Participant
    if (orderedParticipants.length === 1) {
      return (
        <div className="w-full h-full relative rounded-xl overflow-hidden bg-[#0F172A] [&_video]:!object-cover">
          <ParticipantView participant={orderedParticipants[0]} />
        </div>
      );
    }
    
    // 2 Participants
    if (orderedParticipants.length === 2) {
      return (
        <div className="grid grid-cols-1 grid-rows-2 gap-2 w-full h-full">
          {orderedParticipants.map((p) => (
            <div key={p.sessionId} className="w-full h-full rounded-xl overflow-hidden bg-[#0F172A]">
              <ParticipantView participant={p} />
            </div>
          ))}
        </div>
      );
    }

    // 3+ Participants
    const MAX_VISIBLE = 8;
    
    let visibleParticipants = orderedParticipants;
    let hiddenCount = 0;

    if (orderedParticipants.length > MAX_VISIBLE) {
      const visibleRemotes = remoteParticipants.slice(0, 7);
      visibleParticipants = [...visibleRemotes, localParticipant].filter((p): p is StreamVideoParticipant => !!p);
      hiddenCount = orderedParticipants.length - MAX_VISIBLE;
    }

    return (
      <div className="grid grid-cols-2 auto-rows-fr gap-2 w-full h-full overflow-y-auto">
        {visibleParticipants.map((p, idx) => {
          const isLocal = p.sessionId === localParticipant?.sessionId;
          // Apply col-span-2 to the first item only if the TOTAL visible length is odd
          const isFullWidth = idx === 0 && visibleParticipants.length % 2 !== 0;
          
          return (
            <div key={p.sessionId} className={`relative w-full h-full min-h-[120px] rounded-xl overflow-hidden bg-[#0F172A] ${isFullWidth ? 'col-span-2' : 'col-span-1'}`}>
              <ParticipantView participant={p} />
              {isLocal && hiddenCount > 0 && (
                <div 
                  onClick={() => onShowParticipants && onShowParticipants()}
                  className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full bg-white text-[#111827] text-[12px] font-semibold flex items-center justify-center shadow-md cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  +{hiddenCount}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // --- DESKTOP LAYOUT (No Screen Share) ---
  
  // 1 Participant (Just yourself)
  if (participants.length === 1 && localParticipant) {
    return (
      <div className="w-full h-full relative rounded-xl overflow-hidden [&_video]:!object-cover">
        <ParticipantView participant={localParticipant} />
      </div>
    );
  }

  // 2 Participants (1-on-1 PiP style)
  if (participants.length === 2 && remoteParticipants.length === 1 && localParticipant) {
    return (
      <div className="w-full h-full relative">
        <div className="w-full h-full rounded-xl overflow-hidden">
          <ParticipantView participant={remoteParticipants[0]} />
        </div>
        <div 
          className="absolute bottom-4 right-4 w-[200px] h-[130px] rounded-lg overflow-hidden shadow-lg border border-white/20 z-10 bg-[#0F172A] [&_video]:!object-cover transition-all duration-300 ease-in-out"
        >
          <ParticipantView participant={localParticipant} />
        </div>
      </div>
    );
  }

  // 3 or 4 Participants (Flex row)
  if (participants.length === 3 || participants.length === 4) {
    // Ensure local participant is always rendered last (rightmost)
    const orderedParticipants = [...remoteParticipants, localParticipant].filter((p): p is StreamVideoParticipant => !!p);
    return (
      <div className="flex w-full h-full gap-2">
        {orderedParticipants.map((p) => (
          <div key={p.sessionId} className="flex-1 h-full rounded-lg overflow-hidden bg-[#0F172A]">
            <ParticipantView participant={p} />
          </div>
        ))}
      </div>
    );
  }

  // 5 or more Participants (CSS Grid)
  const orderedParticipants = [...remoteParticipants, localParticipant].filter((p): p is StreamVideoParticipant => !!p);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-fr gap-2 w-full h-full">
      {orderedParticipants.map((p) => (
        <div key={p.sessionId} className="w-full h-full rounded-lg overflow-hidden bg-[#0F172A]">
          <ParticipantView participant={p} />
        </div>
      ))}
    </div>
  );
}
