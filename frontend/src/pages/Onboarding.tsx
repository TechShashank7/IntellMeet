import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { useTeamStore } from '../store/store';
import { Users } from 'lucide-react';

export default function Onboarding() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { getToken } = useAuth();
  const { teams, setTeams, setCurrentTeamId } = useTeamStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const newTeam = await api.createTeam(token, name.trim());

      setTeams([...teams, newTeam]);
      setCurrentTeamId(newTeam._id);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to create team. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-10 border border-[#E5E7EB]">
        <div className="w-12 h-12 bg-[#EEF2FF] rounded-full flex items-center justify-center text-[#4F46E5] mb-6">
          <Users size={24} />
        </div>
        <h1 className="text-[24px] font-bold text-[#111827] tracking-tight mb-2">
          Create your team
        </h1>
        <p className="text-[#6B7280] text-[14px] mb-8">
          Set up a space for your team to collaborate on meetings and action items.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="teamName"
              className="block text-[13px] font-medium text-[#374151] mb-1.5"
            >
              Team Name
            </label>
            <input
              id="teamName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp or Engineering"
              className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[14px] text-[#111827] focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] focus:outline-none transition-all placeholder:text-[#9CA3AF]"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 bg-[#FEF2F2] border border-[#F87171]/20 rounded-md text-[13px] text-[#EF4444]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-[#4F46E5] text-white font-medium rounded-lg px-4 py-2.5 text-[14px] hover:bg-[#4338CA] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Team'}
          </button>
        </form>
      </div>
    </div>
  );
}
