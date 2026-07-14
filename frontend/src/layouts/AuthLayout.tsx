import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Video, MessageSquareText, FileText } from 'lucide-react';

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen w-full flex bg-[#FAFAFA]">
      {/* Left Panel: Branding & Features (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between bg-zinc-950 p-12 relative overflow-hidden text-white">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-[128px] opacity-50" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[128px] opacity-40" />

        <div className="relative z-10 flex flex-col gap-6 max-w-md mt-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-3xl font-bold tracking-tight">IntellMeet</span>
          </Link>

          <div className="mt-12 space-y-8">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Enterprise AI <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-400">
                Meeting Intelligence
              </span>
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed font-medium">
              Elevate your team's productivity with automatic summaries, intelligent task extraction, and crystal clear video.
            </p>

            <div className="space-y-5 pt-4">
              <FeatureItem 
                icon={<Video className="w-5 h-5 text-primary" />} 
                title="Crystal Clear Meetings" 
                desc="Ultra-low latency meetings." 
              />
              <FeatureItem 
                icon={<MessageSquareText className="w-5 h-5 text-primary" />} 
                title="Live Transcriptions" 
                desc="Accurate captions." 
              />
              <FeatureItem 
                icon={<FileText className="w-5 h-5 text-primary" />} 
                title="Automated Action Items" 
                desc="Never lose track of tasks discussed during calls." 
              />
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-zinc-500 font-medium">
          © {new Date().getFullYear()} IntellMeet Inc. All rights reserved.
        </div>
      </div>

      {/* Right Panel: Auth Form container */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 relative">
         {/* Optional subtle accent on right side */}
         <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Mobile Logo */}
        <div className="lg:hidden mb-8 flex items-center gap-2 z-10">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-zinc-900">IntellMeet</span>
        </div>

        <div className="w-full max-w-md z-10">
          {children}
        </div>
      </div>
    </div>
  );
};

const FeatureItem = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
  <div className="flex items-start gap-4">
    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 shadow-inner">
      {icon}
    </div>
    <div>
      <h3 className="font-semibold text-zinc-100">{title}</h3>
      <p className="text-sm text-zinc-400 mt-1">{desc}</p>
    </div>
  </div>
);

export default AuthLayout;
