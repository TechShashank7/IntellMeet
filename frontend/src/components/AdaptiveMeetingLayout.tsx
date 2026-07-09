import { useCallStateHooks, ParticipantView } from '@stream-io/video-react-sdk';

interface AdaptiveMeetingLayoutProps {
  isSidebarOpen?: boolean;
  onShowParticipants?: () => void;
}

export default function AdaptiveMeetingLayout({ isSidebarOpen = true, onShowParticipants }: AdaptiveMeetingLayoutProps) {
  const { useParticipants, useLocalParticipant } = useCallStateHooks();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();

  const remoteParticipants = participants.filter(
    (p) => p.sessionId !== localParticipant?.sessionId
  );

  // Screen Share Layout Override
  const sharingParticipants = participants.filter((p) => 
    p.publishedTracks.includes('SCREEN_SHARE') || 
    p.publishedTracks.includes(3) ||
    p.publishedTracks.includes('screenShareTrack') ||
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

    // 2+ Participants
    const orderedParticipants = [...remoteParticipants, localParticipant].filter(Boolean);

    let stripContent;

    if (isSidebarOpen || orderedParticipants.length <= 2) {
      // Vertical Stack
      const MAX_VISIBLE = 4;
      let visibleParticipants = orderedParticipants;
      let hiddenCount = 0;
      
      if (orderedParticipants.length > MAX_VISIBLE) {
        const visibleRemotes = remoteParticipants.slice(0, 3);
        visibleParticipants = [...visibleRemotes, localParticipant].filter(Boolean);
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

  // 1 Participant (Just yourself)
  if (participants.length === 1 && localParticipant) {
    return (
      <div className="w-full h-full relative rounded-xl overflow-hidden">
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
    const orderedParticipants = [...remoteParticipants, localParticipant].filter(Boolean);
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
  const orderedParticipants = [...remoteParticipants, localParticipant].filter(Boolean);
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
