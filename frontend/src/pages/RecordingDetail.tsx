import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Users, 
  Download
} from 'lucide-react';
import { formatDurationSeconds } from '../lib/utils';

export default function RecordingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const { data: detailData, isLoading } = useQuery({
    queryKey: ['recordingDetail', id],
    queryFn: async () => api.getRecordingDetail(id || '', await getToken() || ''),
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center font-sans">
        <div className="text-[#6B7280]">Loading recording...</div>
      </div>
    );
  }

  if (!detailData || !detailData.session) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center font-sans">
        <div className="text-[#EF4444]">Meeting recording not found.</div>
      </div>
    );
  }

  const { session, recordings, participants } = detailData;

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      const safeTitle = (session.topic || 'meeting').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      await api.downloadMeetingNotesPdf(id || '', await getToken() || '', safeTitle);
    } catch (err) {
      console.error(err);
      window.alert('Failed to download PDF.');
    } finally {
      setDownloading(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans">
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10 px-8 py-4">
        <div className="max-w-none w-full px-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard?tab=recordings')}
              className="p-2 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-full transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[20px] font-bold text-[#111827]">{session.topic || 'Untitled Meeting'}</h1>
              </div>
              <div className="flex items-center gap-4 mt-1 text-[13px] text-[#6B7280]">
                <span className="flex items-center gap-1.5"><Calendar size={14} /> {session.startTime ? format(new Date(session.startTime), 'MMM d, yyyy') : 'Unknown date'}</span>
                <span className="flex items-center gap-1.5"><Clock size={14} /> {formatDurationSeconds(session.recordingDurationSeconds || 0)}</span>
                <span className="flex items-center gap-1.5"><Users size={14} /> {participants?.length || 0} Attendees</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-[13px] font-medium text-[#374151]">
               Download notes and transcript
             </span>
             <button 
               onClick={handleDownloadPdf}
               disabled={downloading}
               title="Download PDF"
               className="p-2 bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] rounded-md transition-colors shadow-sm flex items-center justify-center disabled:opacity-50"
             >
               {downloading ? <span className="text-[13px] font-medium px-1">...</span> : <Download size={16} />}
             </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1000px] mx-auto w-full py-8 px-8 space-y-8">
        <section className="bg-white p-8 rounded-xl border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <h2 className="text-[18px] font-semibold text-[#111827] mb-4 flex items-center gap-2">
            Recordings
          </h2>
          {recordings && recordings.length > 0 ? (
            <div className="space-y-6">
              {recordings.map((rec: any, idx: number) => (
                <div key={idx} className="flex flex-col gap-2">
                  {recordings.length > 1 && (
                    <span className="text-[13px] font-medium text-[#4B5563]">Segment {idx + 1}</span>
                  )}
                  <video controls src={rec.url} className="w-full rounded-lg bg-black" />
                  <a href={rec.url} download className="text-[13px] text-[#4F46E5] hover:underline self-start">
                    Download Video
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[14px] text-[#6B7280] italic">No recording available for this meeting.</div>
          )}
        </section>

      </div>
    </div>
  );
}
