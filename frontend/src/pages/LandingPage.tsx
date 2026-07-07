import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { 
  ArrowRight, 
  PlayCircle, 
  Speech, 
  FileText, 
  CheckCircle2, 
  Users, 
  BarChart2, 
  Share2 
} from 'lucide-react';

const FEATURE_LIST = [
  { icon: Speech, title: "Instant AI Transcription", desc: "Every word captured and attributed in real time — no plugins, no post-processing, no effort." },
  { icon: FileText, title: "Smart Meeting Summaries", desc: "GPT-4 distills hours of conversation into crisp, structured summaries your team actually reads." },
  { icon: CheckCircle2, title: "Auto Action Items", desc: "Decisions and next steps are extracted automatically, assigned, and synced to your task board." },
  { icon: Users, title: "Team Collaboration", desc: "Shared meeting history, searchable transcripts, and team-level analytics — all in one place." },
  { icon: BarChart2, title: "Meeting Analytics", desc: "Understand how your team communicates. Track talk time, follow-through, and meeting efficiency." },
  { icon: Share2, title: "Integrations Everywhere", desc: "Push summaries to Notion, Slack, Linear, or Jira — wherever your team already works." }
];

const TESTIMONIALS = [
  { quote: "IntellMeet eliminated our post-meeting chaos. Everyone knows exactly what was decided and who owns what.", author: "Priya Mehta", role: "VP of Product, Vercel", initials: "PM", color: "#4F46E5" },
  { quote: "We cut our meeting follow-up time by 80%. The AI summaries are scarily accurate.", author: "Jake Thornton", role: "Engineering Lead, Linear", initials: "JT", color: "#10B981" },
  { quote: "Finally a tool that treats meetings as a first-class part of the workflow, not an afterthought.", author: "Sofia Reyes", role: "COO, Loom", initials: "SR", color: "#F59E0B" }
];

const LOGOS = ["Stripe", "Linear", "Vercel", "Notion", "Figma", "Loom", "Slack", "Atlassian"];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  return (
    <div className="min-h-screen bg-white font-sans text-[#111827]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]">
        <div className="w-full px-10 h-14 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <span className="text-[#4F46E5] text-[18px] font-bold tracking-[-0.02em]">IntellMeet</span>
            <nav className="hidden md:flex items-center gap-7">
              {["Product", "Features", "Pricing", "Enterprise", "Blog"].map((item) => (
                <a key={item} href="#" className="text-[#374151] hover:text-[#111827] transition-colors text-[14px]">
                  {item}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {isSignedIn ? (
              <button 
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-[#4F46E5] text-white hover:bg-[#4338CA] transition-colors text-[14px] font-medium rounded-md"
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <button 
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 rounded-md text-[#374151] hover:bg-[#F3F4F6] transition-colors text-[14px] font-medium"
                >
                  Log in
                </button>
                <button 
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 bg-[#4F46E5] text-white hover:bg-[#4338CA] transition-colors text-[14px] font-medium rounded-md"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full px-10 pt-20 pb-16 relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-[#EEF2FF] px-3 py-1 rounded-full mb-7 border border-[#4F46E5]/10">
              <span className="w-2 h-2 rounded-full bg-[#4F46E5] animate-pulse" />
              <span className="text-[#4F46E5] text-[12px] font-medium">Now with GPT-4o summaries</span>
              <ArrowRight size={12} className="text-[#4F46E5]" />
            </div>
            
            <h1 className="text-[#111827] mb-6 text-[48px] md:text-[64px] font-bold tracking-[-0.03em] leading-[1.08]">
              Every Meeting.<br />
              <span className="text-[#4F46E5]">Summarized.</span><br />
              Actioned. Done.
            </h1>
            
            <p className="text-[#6B7280] mb-9 text-[18px] leading-[1.65] max-w-[460px]">
              IntellMeet transcribes your calls in real time, surfaces key decisions, and turns every discussion into clear action items — automatically.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button 
                onClick={() => navigate(isSignedIn ? '/dashboard' : '/login')}
                className="flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-3 bg-[#4F46E5] text-white hover:bg-[#4338CA] transition-all rounded-md text-[15px] font-medium shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5"
              >
                {isSignedIn ? 'Go to Dashboard' : 'Start for free'} <ArrowRight size={16} />
              </button>
              <button className="flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-3 bg-white text-[#374151] border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors rounded-md text-[15px] font-medium">
                <PlayCircle size={18} /> Watch demo
              </button>
            </div>
            <p className="mt-5 text-[#9CA3AF] text-[13px]">
              No credit card required · 14-day free trial · Cancel anytime
            </p>
          </div>
          
          <div className="flex-1 relative w-full flex justify-center">
             <div 
              className="rounded-xl overflow-hidden border border-[#E5E7EB] bg-white relative z-10 w-full max-w-[540px]" 
              style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.09), 0 4px 16px rgba(0,0,0,0.04)' }}
            >
                {/* Mockup Header */}
                <div className="bg-[#F3F4F6] border-b border-[#E5E7EB] px-4 py-3 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
                    <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                    <span className="w-3 h-3 rounded-full bg-[#10B981]" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-white border border-[#E5E7EB] rounded px-3 py-0.5 max-w-[200px] mx-auto text-center text-[#9CA3AF] text-[12px]">
                      app.intellmeet.com
                    </div>
                  </div>
                </div>
                {/* Mockup Content (Static Representation) */}
                <div className="h-[380px] bg-[#FAFAFA] flex p-5 flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="font-semibold text-[16px]">Good morning, Sarah</div>
                            <div className="text-[#9CA3AF] text-[11px]">Friday, June 12, 2026</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                        <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 shadow-sm">
                            <div className="text-[20px] font-bold text-[#4F46E5]">12</div>
                            <div className="text-[10px] text-[#6B7280]">Meetings This Week</div>
                        </div>
                        <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 shadow-sm">
                            <div className="text-[20px] font-bold text-[#F59E0B]">7</div>
                            <div className="text-[10px] text-[#6B7280]">Open Action Items</div>
                        </div>
                        <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 shadow-sm">
                            <div className="text-[20px] font-bold text-[#10B981]">4.2h</div>
                            <div className="text-[10px] text-[#6B7280]">Hours Saved</div>
                        </div>
                    </div>
                    <div className="bg-white border border-[#E5E7EB] rounded-lg p-3 flex-1 shadow-sm">
                         <div className="text-[11px] font-semibold mb-2">Upcoming Meetings</div>
                         <div className="text-[10px] text-[#6B7280] border-b border-[#F3F4F6] py-1">Q3 Planning · 2:00 PM</div>
                         <div className="text-[10px] text-[#6B7280] border-b border-[#F3F4F6] py-1">Design Review · 3:30 PM</div>
                         <div className="text-[10px] text-[#6B7280] pt-1">1:1 Alex · 5:00 PM</div>
                    </div>
                </div>
            </div>
            
            {/* Background Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-50 rounded-full blur-3xl -z-10 opacity-70"></div>
          </div>
        </div>
      </section>

      {/* Logo Strip */}
      <section className="border-t border-b border-[#F3F4F6] py-8 w-full px-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-center gap-4">
          <p className="text-[#C4C9D4] text-[11px] font-semibold uppercase tracking-widest flex-shrink-0">
            Trusted by teams at
          </p>
          <div className="w-px h-4 bg-[#E5E7EB] hidden md:block" />
          <div className="flex items-center justify-center gap-8 md:gap-10 flex-wrap opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {LOGOS.map((logo) => (
              <span key={logo} className="text-[#C4C9D4] text-[15px] font-bold tracking-tight">
                {logo}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="w-full px-10 py-24 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <p className="text-[#4F46E5] text-[12px] font-semibold uppercase tracking-[0.05em] mb-3">Platform</p>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <h2 className="text-[#111827] text-[34px] font-bold tracking-[-0.02em] leading-[1.15] max-w-lg">
                Everything your meetings need
              </h2>
              <p className="text-[#6B7280] text-[16px] leading-[1.65] max-w-md">
                From first join to follow-through — IntellMeet captures, distills, and distributes everything that matters, without anyone having to lift a finger.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#E5E7EB] border border-[#E5E7EB] rounded-xl overflow-hidden">
            {FEATURE_LIST.map((feature) => (
              <div key={feature.title} className="bg-white p-8 hover:bg-[#FAFAFA] transition-colors">
                <div className="w-10 h-10 rounded-lg bg-[#EEF2FF] flex items-center justify-center mb-5">
                  <feature.icon size={20} className="text-[#4F46E5]" />
                </div>
                <h3 className="text-[#111827] text-[16px] font-semibold mb-2">{feature.title}</h3>
                <p className="text-[#6B7280] text-[14px] leading-[1.65]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="w-full px-10 py-24 bg-white border-t border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-[#111827] text-[28px] font-bold tracking-[-0.02em] mb-12">
            What teams are saying
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((testimonial) => (
              <div key={testimonial.author} className="bg-white border border-[#E5E7EB] rounded-lg p-8 shadow-sm">
                <p className="text-[#374151] text-[15px] leading-[1.7] mb-8">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-semibold"
                    style={{ background: testimonial.color }}
                  >
                    {testimonial.initials}
                  </div>
                  <div>
                    <div className="text-[#111827] text-[14px] font-semibold">{testimonial.author}</div>
                    <div className="text-[#9CA3AF] text-[12px]">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full bg-[#4F46E5] px-10 py-24">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 items-center gap-16">
          <div>
            <h2 className="text-white text-[38px] font-bold tracking-[-0.02em] leading-[1.1] mb-4">
              Start making your<br />meetings count
            </h2>
            <p className="text-[#C7D2FE] text-[18px] leading-[1.6]">
              Join 12,000+ teams that have reclaimed hours each week with IntellMeet.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
            <button 
              onClick={() => navigate(isSignedIn ? '/dashboard' : '/login')}
              className="w-full sm:w-auto px-7 py-3.5 bg-white text-[#4F46E5] hover:bg-[#F5F3FF] transition-colors rounded-md text-[15px] font-semibold"
            >
              {isSignedIn ? 'Go to Dashboard →' : 'Get started free →'}
            </button>
            <button className="w-full sm:w-auto px-7 py-3.5 border border-[#6366F1] text-white hover:bg-[#4338CA] transition-colors rounded-md text-[15px] font-medium">
              See a live demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] bg-white w-full px-10 py-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start justify-between gap-10">
          <div>
            <span className="text-[#4F46E5] text-[18px] font-bold tracking-[-0.01em]">IntellMeet</span>
            <p className="text-[#9CA3AF] mt-2 text-[14px]">
              AI-powered meetings for modern teams.
            </p>
          </div>
          <div className="flex flex-wrap gap-16">
            {[
              { heading: "Product", links: ["Features", "Pricing", "Changelog", "Roadmap"] },
              { heading: "Company", links: ["About", "Blog", "Careers", "Press"] },
              { heading: "Legal", links: ["Privacy", "Terms", "Security", "Status"] }
            ].map((col) => (
              <div key={col.heading}>
                <p className="text-[#111827] mb-4 text-[14px] font-semibold">{col.heading}</p>
                <div className="space-y-3">
                  {col.links.map((link) => (
                    <a key={link} href="#" className="block text-[#6B7280] hover:text-[#111827] transition-colors text-[14px]">
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-[#F3F4F6] mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-[#9CA3AF] text-[13px]">© 2026 IntellMeet, Inc. All rights reserved.</span>
          <div className="flex gap-6">
            {["Twitter", "GitHub", "LinkedIn"].map((social) => (
              <a key={social} href="#" className="text-[#9CA3AF] hover:text-[#6B7280] transition-colors text-[13px]">
                {social}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
