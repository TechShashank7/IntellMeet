import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, useUser, useClerk } from '@clerk/clerk-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getInitials, getAvatarColor, formatDurationSeconds } from '../lib/utils';
import { useTeamStore } from '../store/store';
import { 
  Plus, 
  Calendar, 
  ArrowRight,
  FileText,
  Video,
  LogIn,
  Sparkles,
  X,
  Search,
  BarChart2,
  Camera,
  Lock,
  Shield,
  Laptop,
  Trash2,
  Loader2,
  Check,
  ChevronDown,
  Clock,
  ChevronRight,
  Download, Users, TrendingUp
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';




export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const { user } = useUser();
  const { getToken, sessionId } = useAuth();
  const { signOut } = useClerk();
  
  const [settingsSection, setSettingsSection] = useState<'profile' | 'security'>('profile');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [isOpenForAll, setIsOpenForAll] = useState(false);
  const [isNewMeetingModalOpen, setIsNewMeetingModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [meetingTopic, setMeetingTopic] = useState('');
  const [joinMeetingId, setJoinMeetingId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [meetingSearchQuery, setMeetingSearchQuery] = useState('');
  
  const [scheduleOpenForAll, setScheduleOpenForAll] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [deleteMeetingId, setDeleteMeetingId] = useState<string | null>(null);
  const [leaveMeetingId, setLeaveMeetingId] = useState<string | null>(null);
  
  const [activeMeetingManageId, setActiveMeetingManageId] = useState<string | null>(null);
  const [manageSelectedTeamId, setManageSelectedTeamId] = useState<string | null>(null);
  const [isManageTeamDropdownOpen, setIsManageTeamDropdownOpen] = useState(false);
  const [manageSearchQuery, setManageSearchQuery] = useState('');
  const [newParticipants, setNewParticipants] = useState<string[]>([]);
  const [removeConfirmParticipant, setRemoveConfirmParticipant] = useState<{ meetingId: string; clerkId: string; name: string } | null>(null);

  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduleParticipants, setScheduleParticipants] = useState<{clerkId: string; name: string}[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleSelectedTeamId, setScheduleSelectedTeamId] = useState<string | null>(null);
  const [isScheduleTeamDropdownOpen, setIsScheduleTeamDropdownOpen] = useState(false);
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState('');
  const [scheduleSuccessMessage, setScheduleSuccessMessage] = useState<string | null>(null);
  const [copiedMeetingId, setCopiedMeetingId] = useState<string | null>(null);

  const handleCopyInvitation = (meeting: any) => {
    const timeStr = format(new Date(meeting.startTime), "MMM d, yyyy h:mm a");
    const joinUrl = `${window.location.origin}/meeting/${meeting.joinCode || meeting.id}`;
    const message = `${user?.fullName || user?.firstName || 'Someone'} is inviting you to a scheduled IntellMeet meeting.\nTopic: ${meeting.title}\nTime: ${timeStr}\nJoin Meeting: ${joinUrl}`;
    navigator.clipboard.writeText(message);
    setCopiedMeetingId(meeting.id);
    setTimeout(() => setCopiedMeetingId((prev) => (prev === meeting.id ? null : prev)), 2000);
  };

  const canJoinNow = (meeting: any) => {
    if (!user?.id) return false;
    const isMeetingHost = meeting.hostClerkId === user.id;
    if (isMeetingHost) return true;
    if (meeting.status === 'active') return true;
    if (meeting.status === 'scheduled' && meeting.startTime) {
      return new Date() >= new Date(meeting.startTime);
    }
    return meeting.status !== 'scheduled';
  };
  
  const queryClient = useQueryClient();
  const { teams, currentTeamId, setTeams, setCurrentTeamId } = useTeamStore();
  const currentTeam = teams.find((t) => t._id === currentTeamId);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState<{ success: boolean; text: string } | null>(null);

  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [notionToken, setNotionToken] = useState('');
  const [notionPageId, setNotionPageId] = useState('');
  const [isSavingIntegrations, setIsSavingIntegrations] = useState(false);
  const [integrationMessage, setIntegrationMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState<{ teamId: string; teamName: string } | null>(null);
  const [kickConfirm, setKickConfirm] = useState<{ teamId: string; clerkId: string; memberName: string; teamName: string } | null>(null);
  const [isLeavingOrKicking, setIsLeavingOrKicking] = useState(false);

  const removeConfirmRef = useRef<HTMLDivElement>(null);
  const manageParticipantsRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      const isInsideConfirm = removeConfirmRef.current?.contains(target);
      const isInsideManage = manageParticipantsRef.current?.contains(target);
      const isManageBtn = (target as Element).closest?.('.manage-participants-btn');

      if (removeConfirmParticipant && !isInsideConfirm) {
        setRemoveConfirmParticipant(null);
      }

      if (activeMeetingManageId && !isInsideManage && !isInsideConfirm && !isManageBtn) {
        setActiveMeetingManageId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [removeConfirmParticipant, activeMeetingManageId]);

  const { data: teamMembers = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ['teamMembers', currentTeamId],
    queryFn: async () => api.getTeamMembers(currentTeamId || '', await getToken() || ''),
    enabled: !!currentTeamId && tab === 'team'
  });

  const { data: scheduleTeamMembers = [], isLoading: isLoadingScheduleMembers } = useQuery({
    queryKey: ['scheduleTeamMembers', scheduleSelectedTeamId],
    queryFn: async () => api.getTeamMembers(scheduleSelectedTeamId || '', await getToken() || ''),
    enabled: !!scheduleSelectedTeamId && isScheduleModalOpen
  });

  const { data: manageTeamMembers = [], isLoading: isLoadingManageMembers } = useQuery({
    queryKey: ['manageTeamMembers', manageSelectedTeamId],
    queryFn: async () => api.getTeamMembers(manageSelectedTeamId || '', await getToken() || ''),
    enabled: !!manageSelectedTeamId && !!activeMeetingManageId
  });

  const { mutate: inviteMember, isPending: isInviting } = useMutation({
    mutationFn: async (email: string) => api.inviteTeamMember(currentTeamId || '', await getToken() || '', email),
    onSuccess: (res) => {
      setInviteMessage({ success: res.success, text: res.message });
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['teamMembers', currentTeamId] });
        setInviteEmail('');
      }
    }
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMember(inviteEmail.trim());
  };

  useEffect(() => {
    if (currentTeam) {
      setSlackWebhookUrl(currentTeam.slackWebhookUrl || '');
      setNotionToken(currentTeam.notionToken || '');
      setNotionPageId(currentTeam.notionPageId || '');
    }
  }, [currentTeam]);

  const handleSaveIntegrations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTeamId) return;
    try {
      setIsSavingIntegrations(true);
      const token = await getToken();
      if (!token) return;
      const updatedTeam = await api.updateTeamIntegrations(currentTeamId, token, {
        slackWebhookUrl,
        notionToken,
        notionPageId
      });
      // update team in store
      setTeams(teams.map(t => t._id === currentTeamId ? updatedTeam : t));
      setIntegrationMessage({ success: true, text: 'Integrations saved successfully' });
      setTimeout(() => setIntegrationMessage(null), 3000);
    } catch (err: any) {
      setIntegrationMessage({ success: false, text: err.message || 'Failed to save integrations' });
    } finally {
      setIsSavingIntegrations(false);
    }
  };

  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      setIsCreatingTeam(true);
      const token = await getToken();
      if (!token) return;
      const newTeam = await api.createTeam(token, newTeamName.trim());
      setTeams([...teams, newTeam]);
      setCurrentTeamId(newTeam._id);
      setIsCreateTeamModalOpen(false);
      setNewTeamName('');
    } catch (error) {
      console.error('Error creating team:', error);
      window.alert('Failed to create team, please try again.');
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleSelectTeam = (teamId: string) => {
    setCurrentTeamId(teamId);
    setIsTeamDropdownOpen(false);
  };

  const handleConfirmLeave = async () => {
    if (!leaveConfirm) return;
    setIsLeavingOrKicking(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.leaveTeam(leaveConfirm.teamId, token);
      setTeams(teams.filter((t) => t._id !== leaveConfirm.teamId));
      setLeaveConfirm(null);
    } catch (error: any) {
      window.alert(error.message || 'Failed to leave team. Please try again.');
    } finally {
      setIsLeavingOrKicking(false);
    }
  };

  const handleConfirmKick = async () => {
    if (!kickConfirm) return;
    setIsLeavingOrKicking(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.removeTeamMember(kickConfirm.teamId, kickConfirm.clerkId, token);
      queryClient.invalidateQueries({ queryKey: ['teamMembers', kickConfirm.teamId] });
      setKickConfirm(null);
    } catch (error: any) {
      window.alert(error.message || 'Failed to remove member. Please try again.');
    } finally {
      setIsLeavingOrKicking(false);
    }
  };

  const { data: upcomingMeetings = [], isLoading: isLoadingUpcoming } = useQuery({
    queryKey: ['upcomingMeetings'],
    queryFn: async () => {
      const token = await getToken();
      return api.getUpcomingMeetings(token || '');
    }
  });

  const { data: recentMeetings = [], isLoading: isLoadingRecent } = useQuery({
    queryKey: ['recentMeetings'],
    queryFn: async () => {
      const token = await getToken();
      return api.getRecentMeetings(token || '');
    }
  });

  const { data: meetingStats } = useQuery({
    queryKey: ['meetingStats'],
    queryFn: async () => api.getMeetingStats(await getToken() || '')
  });

  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ['meetingAnalytics', currentTeamId],
    queryFn: async () => api.getMeetingAnalytics(await getToken() || '', currentTeamId || undefined),
    enabled: tab === 'analytics'
  });

  const { data: myTasks = [] } = useQuery({
    queryKey: ['tasks', currentTeamId],
    queryFn: async () => api.getTasks(currentTeamId || '', await getToken() || ''),
    enabled: !!currentTeamId
  });

  const { data: recordingsList = [], isLoading: isLoadingRecordings } = useQuery({
    queryKey: ['recordingsList'],
    queryFn: async () => api.getRecordingsList(await getToken() || ''),
    enabled: tab === 'recordings'
  });

  const { data: userSessions, isLoading: isLoadingSessions } = useQuery({
    queryKey: ['userSessions'],
    queryFn: async () => {
      if (!user) return [];
      const sessions = await (user as any).getSessions();
      console.log('DEBUG user.getSessions() raw output:', sessions);
      return sessions;
    },
    enabled: !!user && tab === 'settings' && settingsSection === 'security'
  });

  const myOpenTasks = myTasks.filter(t => t.assignee?.clerkId === user?.id && t.status !== 'done');
  const dueTodayCount = myOpenTasks.filter(t => t.dueDate && isToday(new Date(t.dueDate))).length;
  const weekDelta = (meetingStats?.thisWeekCount ?? 0) - (meetingStats?.lastWeekCount ?? 0);

  const { mutate: completeTask } = useMutation({
    mutationFn: async (id: string) => api.updateTaskStatus(id, 'done', await getToken() || ''),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', currentTeamId] })
  });

  const handleNewMeeting = () => {
    setMeetingTopic('');
    setIsOpenForAll(false);
    setIsNewMeetingModalOpen(true);
  };

  const { mutate: deleteMeeting, isPending: isDeletingMeeting } = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await api.deleteMeeting(id, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcomingMeetings'] });
      setDeleteMeetingId(null);
    }
  });

  const { mutate: leaveMeeting, isPending: isLeavingMeeting } = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await api.leaveMeeting(id, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcomingMeetings'] });
      setLeaveMeetingId(null);
    }
  });

  const { mutate: inviteToMeeting, isPending: isInvitingToMeeting } = useMutation({
    mutationFn: async ({ id, participantClerkIds }: { id: string; participantClerkIds: string[] }) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await api.inviteToMeeting(id, participantClerkIds, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcomingMeetings'] });
      setNewParticipants([]);
      setActiveMeetingManageId(null);
    }
  });

  const { mutate: removeMeetingParticipant, isPending: isRemovingParticipant } = useMutation({
    mutationFn: async ({ id, participantClerkId }: { id: string; participantClerkId: string }) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await api.removeMeetingParticipant(id, participantClerkId, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upcomingMeetings'] });
      setRemoveConfirmParticipant(null);
    }
  });

  const submitNewMeeting = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!meetingTopic.trim()) return;
    try {
      setIsCreating(true);
      const token = await getToken();
      if (!token) return;
      const session = await api.createMeeting(token, meetingTopic, { openForAll: isOpenForAll, teamId: currentTeamId || undefined });
      setIsNewMeetingModalOpen(false);
      window.open(`/meeting/${session.joinCode || session._id}`, '_blank');
    } catch (error) {
      console.error('Error creating meeting:', error);
      window.alert('Failed to create meeting, please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const submitScheduleMeeting = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scheduleTitle.trim() || !scheduleDateTime) return;
    try {
      setIsScheduling(true);
      const token = await getToken();
      if (!token) return;
      await api.createMeeting(token, scheduleTitle, {
        scheduledFor: new Date(scheduleDateTime).toISOString(),
        participantClerkIds: scheduleParticipants.map(p => p.clerkId),
        openForAll: scheduleOpenForAll,
        teamId: scheduleSelectedTeamId || undefined
      });
      queryClient.invalidateQueries({ queryKey: ['upcomingMeetings'] });

      if (scheduleParticipants.length > 0) {
        const invitedNames = scheduleParticipants.map(p => p.name);
        setScheduleSuccessMessage(`Successfully invited ${invitedNames.join(', ')}.`);
      } else {
        setScheduleSuccessMessage('Meeting scheduled successfully.');
      }

      setScheduleTitle('');
      setScheduleDateTime('');
      setScheduleParticipants([]);
      setScheduleOpenForAll(false);

      setTimeout(() => {
        setIsScheduleModalOpen(false);
        setScheduleSuccessMessage(null);
        setScheduleSearchQuery('');
      }, 2200);
    } catch (error) {
      console.error('Error scheduling meeting:', error);
      window.alert('Failed to schedule meeting, please try again.');
    } finally {
      setIsScheduling(false);
    }
  };

  const handleJoinWithCode = () => {
    setJoinMeetingId('');
    setIsJoinModalOpen(true);
  };

  const submitJoinMeeting = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!joinMeetingId.trim()) return;
    setIsJoinModalOpen(false);
    window.open(`/meeting/${joinMeetingId.trim()}`, '_blank');
  };

  const handleJoinMeeting = (id: string) => {
    window.open(`/meeting/${id}`, '_blank');
  };

  const handleViewSummary = (id: string) => {
    navigate(`/summary/${id}`);
  };

  const handleStartEditName = () => {
    setEditFirstName(user?.firstName || '');
    setEditLastName(user?.lastName || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!user) return;
    setIsSavingName(true);
    try {
      await user.update({ firstName: editFirstName, lastName: editLastName });
      setIsEditingName(false);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update name', err);
      window.alert('Failed to update name. Please try again.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleAvatarClick = () => avatarInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploadingAvatar(true);
    try {
      await user.setProfileImage({ file });
    } catch (err) {
      console.error('Failed to update avatar', err);
      window.alert('Failed to update profile picture. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ success: false, text: 'New passwords do not match.' });
      return;
    }
    setIsSavingPassword(true);
    setPasswordMessage(null);
    try {
      const payload: any = { newPassword, signOutOfOtherSessions: false };
      if (user.passwordEnabled) payload.currentPassword = currentPassword;
      await user.updatePassword(payload);
      setPasswordMessage({ success: true, text: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMessage({ success: false, text: err?.errors?.[0]?.message || 'Failed to update password.' });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleRevokeSession = async (session: any) => {
    setRevokingSessionId(session.id);
    try {
      await session.revoke();
      queryClient.invalidateQueries({ queryKey: ['userSessions'] });
    } catch (err) {
      console.error('Failed to revoke session', err);
      window.alert('Failed to sign out that device. Please try again.');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!window.confirm('This will permanently delete your account and all associated data. This cannot be undone. Continue?')) return;
    try {
      await user.delete();
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('Failed to delete account', err);
      window.alert('Failed to delete account. Please try again or contact support.');
    }
  };

  if (tab === 'team') {
    const currentUserMember = teamMembers.find((m: any) => m.clerkId === user?.id);
    const isCurrentUserAdmin = currentUserMember?.isAdmin;

    return (
      <div className="bg-[#FAFAFA] min-h-screen w-full font-['Inter'] p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[24px] font-[600] text-[#111827]">Teams</h2>
          <button
            onClick={() => setIsCreateTeamModalOpen(true)}
            className="hidden md:flex h-[36px] px-4 bg-[#4F46E5] text-white hover:bg-[#4338CA] rounded-[8px] text-[14px] font-[500] transition-colors items-center gap-2 mr-14"
          >
            <Plus size={16} /> Create Team
          </button>
        </div>

        {teams.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-8 text-center text-[#6B7280] text-[14px] shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
            You're not part of any team yet. Create one to get started.
          </div>
        ) : (
          <>
            <div className="flex flex-row items-center gap-3 mb-6">
              <div className="relative inline-block flex-1 md:flex-none">
                <button
                  onClick={() => setIsTeamDropdownOpen(!isTeamDropdownOpen)}
                  className="flex w-full items-center gap-2.5 bg-white border border-[#E5E7EB] rounded-[8px] px-3 py-2 md:px-4 md:py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:border-[#D1D5DB] transition-colors md:min-w-[220px]"
                >
                <div
                  className="w-7 h-7 rounded-[6px] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                  style={{ background: getAvatarColor(currentTeam?._id || '') }}
                >
                  {getInitials(currentTeam?.name)}
                </div>
                <span className="text-[14px] font-[600] text-[#111827] flex-1 text-left truncate">{currentTeam?.name || 'Select a team'}</span>
                <ChevronDown size={16} className={`text-[#9CA3AF] transition-transform ${isTeamDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isTeamDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-full min-w-[220px] bg-white border border-[#E5E7EB] rounded-[10px] shadow-lg z-20 py-1.5 max-h-[280px] overflow-y-auto">
                  {teams.map((team) => (
                    <button
                      key={team._id}
                      onClick={() => handleSelectTeam(team._id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${team._id === currentTeamId ? 'bg-[#EEF2FF]' : 'hover:bg-[#F9FAFB]'}`}
                    >
                      <div
                        className="w-6 h-6 rounded-[5px] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background: getAvatarColor(team._id) }}
                      >
                        {getInitials(team.name)}
                      </div>
                      <span className="text-[13px] font-[500] text-[#111827] flex-1 truncate">{team.name}</span>
                      {team._id === currentTeamId && <Check size={14} className="text-[#4F46E5] flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
              </div>
              <button
                onClick={() => setIsCreateTeamModalOpen(true)}
                className="md:hidden flex h-[36px] px-3 bg-[#4F46E5] text-white hover:bg-[#4338CA] rounded-[8px] text-[13px] font-[500] transition-colors items-center justify-center whitespace-nowrap shadow-sm"
              >
                <Plus size={14} className="mr-1" /> Create Team
              </button>
            </div>

            <div className="md:bg-white md:border md:border-[#E5E7EB] md:rounded-[12px] md:p-6 md:shadow-[0_2px_4px_rgba(0,0,0,0.04)] -mx-4 md:mx-0 px-4 md:px-0">
              <h3 className="text-[15px] font-[600] text-[#111827] mb-4">Members</h3>
              {isLoadingMembers ? (
                <p className="text-[#6B7280] text-[14px]">Loading members...</p>
              ) : (
                <div className="space-y-4">
                  {teamMembers.map((member: any) => {
                    const isSelf = member.clerkId === user?.id;
                    const canLeave = isSelf && !member.isAdmin;
                    const canKick = isCurrentUserAdmin && !isSelf && !member.isAdmin;
                    return (
                      <div key={member.clerkId} className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-lg">
                        <div className="flex items-center gap-4">
                          {member.profileImage ? (
                            <img src={member.profileImage} alt={member.name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm"
                              style={{ background: getAvatarColor(member.clerkId) }}
                            >
                              {getInitials(member.name)}
                            </div>
                          )}
                          <div>
                            <div className="text-[14px] font-[600] text-[#111827] flex items-center gap-2">
                              {member.name} {isSelf && <span className="text-[#9CA3AF] font-[400]">(You)</span>}
                              {member.isAdmin && (
                                <span className="bg-[#EEF2FF] text-[#4F46E5] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border border-[#EEF2FF]">
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="text-[13px] text-[#6B7280]">{member.email}</div>
                          </div>
                        </div>
                        {(canLeave || canKick) && (
                          <button
                            onClick={() =>
                              canLeave
                                ? setLeaveConfirm({ teamId: currentTeamId || '', teamName: currentTeam?.name || 'this team' })
                                : setKickConfirm({ teamId: currentTeamId || '', clerkId: member.clerkId, memberName: member.name, teamName: currentTeam?.name || 'this team' })
                            }
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors flex-shrink-0"
                            title={canLeave ? 'Leave team' : 'Remove member'}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {isCurrentUserAdmin && (
                <div className="mt-8 pt-6 border-t border-[#E5E7EB]">
                  <h3 className="text-[15px] font-[600] text-[#111827] mb-4">Invite Team Member</h3>
                  <form onSubmit={handleInvite} className="flex flex-col gap-3 max-w-md">
                    <div className="flex items-center gap-3">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="Email address"
                        className="flex-1 border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none"
                        required
                        disabled={isInviting}
                      />
                      <button
                        type="submit"
                        disabled={isInviting || !inviteEmail.trim()}
                        className="px-4 py-2 bg-[#4F46E5] text-white rounded-md text-[13px] font-medium hover:bg-[#4338CA] transition-colors disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {isInviting ? 'Inviting...' : 'Invite'}
                      </button>
                    </div>
                    {inviteMessage && (
                      <div className={`text-[13px] p-2 rounded-md ${inviteMessage.success ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}>
                        {inviteMessage.text}
                      </div>
                    )}
                  </form>
                </div>
              )}

              {isCurrentUserAdmin && (
                <div className="mt-8 pt-6 border-t border-[#E5E7EB]">
                  <h3 className="text-[15px] font-[600] text-[#111827] mb-4">Integrations</h3>
                  <form onSubmit={handleSaveIntegrations} className="flex flex-col gap-4 max-w-md">
                    <div>
                      <label className="block text-[13px] font-[500] text-[#374151] mb-1">Slack Webhook URL</label>
                      <input
                        type="url"
                        value={slackWebhookUrl}
                        onChange={(e) => setSlackWebhookUrl(e.target.value)}
                        placeholder="https://hooks.slack.com/services/..."
                        className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none"
                        disabled={isSavingIntegrations}
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-[500] text-[#374151] mb-1">Notion Token</label>
                      <input
                        type="password"
                        value={notionToken}
                        onChange={(e) => setNotionToken(e.target.value)}
                        placeholder="secret_..."
                        className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none"
                        disabled={isSavingIntegrations}
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-[500] text-[#374151] mb-1">Notion Page ID</label>
                      <input
                        type="text"
                        value={notionPageId}
                        onChange={(e) => setNotionPageId(e.target.value)}
                        placeholder="e.g. 1234567890abcdef..."
                        className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none"
                        disabled={isSavingIntegrations}
                      />
                    </div>
                    <div>
                      <button
                        type="submit"
                        disabled={isSavingIntegrations}
                        className="px-4 py-2 bg-[#4F46E5] text-white rounded-md text-[13px] font-medium hover:bg-[#4338CA] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isSavingIntegrations ? 'Saving...' : 'Save Integrations'}
                      </button>
                    </div>
                    {integrationMessage && (
                      <div className={`text-[13px] p-2 rounded-md ${integrationMessage.success ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}>
                        {integrationMessage.text}
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>
          </>
        )}

        {isCreateTeamModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB]">
                <h3 className="text-[16px] font-[600] text-[#111827]">Create New Team</h3>
                <button onClick={() => setIsCreateTeamModalOpen(false)} className="text-[#9CA3AF] hover:text-[#4B5563] transition-colors p-1 rounded-full hover:bg-[#F3F4F6]">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleCreateTeamSubmit} className="p-5">
                <div className="mb-5">
                  <label className="block text-[13px] font-[500] text-[#374151] mb-2">Team Name</label>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full border border-[#D1D5DB] rounded-lg px-4 py-2.5 text-[14px] focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent outline-none transition-all"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setIsCreateTeamModalOpen(false)} className="px-4 py-2 text-[14px] font-[500] text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={isCreatingTeam || !newTeamName.trim()} className="px-4 py-2 bg-[#4F46E5] text-white text-[14px] font-[500] rounded-lg hover:bg-[#4338CA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {isCreatingTeam ? 'Creating...' : 'Create Team'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {leaveConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
              <h3 className="text-[16px] font-[600] text-[#111827] mb-2">Leave team?</h3>
              <p className="text-[14px] text-[#6B7280] mb-6">Do you really want to leave <strong>{leaveConfirm.teamName}</strong>?</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setLeaveConfirm(null)} disabled={isLeavingOrKicking} className="px-4 py-2 text-[14px] font-[500] text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                  No
                </button>
                <button onClick={handleConfirmLeave} disabled={isLeavingOrKicking} className="px-4 py-2 bg-[#EF4444] text-white text-[14px] font-[500] rounded-lg hover:bg-[#DC2626] transition-colors disabled:opacity-60">
                  {isLeavingOrKicking ? 'Leaving...' : 'Yes, Leave'}
                </button>
              </div>
            </div>
          </div>
        )}

        {kickConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
              <h3 className="text-[16px] font-[600] text-[#111827] mb-2">Remove member?</h3>
              <p className="text-[14px] text-[#6B7280] mb-6">Do you really want to kick <strong>{kickConfirm.memberName}</strong> from <strong>{kickConfirm.teamName}</strong>?</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setKickConfirm(null)} disabled={isLeavingOrKicking} className="px-4 py-2 text-[14px] font-[500] text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                  No
                </button>
                <button onClick={handleConfirmKick} disabled={isLeavingOrKicking} className="px-4 py-2 bg-[#EF4444] text-white text-[14px] font-[500] rounded-lg hover:bg-[#DC2626] transition-colors disabled:opacity-60">
                  {isLeavingOrKicking ? 'Removing...' : 'Yes, Remove'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tab === 'meetings') {
    const combined = [...upcomingMeetings, ...recentMeetings];
    const filtered = meetingSearchQuery.trim()
      ? combined.filter((m: any) => m.title?.toLowerCase().includes(meetingSearchQuery.trim().toLowerCase()))
      : combined;
    const filteredUpcoming = filtered.filter((m: any) => m.status !== 'completed');
    const filteredPast = filtered.filter((m: any) => m.status === 'completed');
    const isLoadingAny = isLoadingUpcoming || isLoadingRecent;

    return (
      <div className="bg-[#FAFAFA] min-h-screen w-full font-['Inter'] p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0 mb-6">
          <h2 className="text-[24px] font-[600] text-[#111827]">Meetings</h2>
          <div className="relative w-full md:w-auto md:mr-14">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search meetings..."
              value={meetingSearchQuery}
              onChange={(e) => setMeetingSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-[#E5E7EB] rounded-md text-[13px] focus:outline-none focus:ring-1 focus:ring-[#4F46E5] focus:border-[#4F46E5] shadow-sm w-full md:w-[260px]"
            />
          </div>
        </div>

        {isLoadingAny ? (
          <div className="text-[#6B7280] text-[14px]">Loading meetings...</div>
        ) : (
          <div className="space-y-8">
            <div>
              <h3 className="text-[15px] font-[600] text-[#111827] mb-3">Upcoming ({filteredUpcoming.length})</h3>
              <div className="bg-white border border-[#E5E7EB] rounded-[12px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] flex flex-col">
                {filteredUpcoming.length === 0 ? (
                  <div className="p-5 text-[#6B7280] text-[14px]">No upcoming meetings found.</div>
                ) : filteredUpcoming.map((meeting: any, index: number) => {
                  const meetingDate = new Date(meeting.startTime || meeting.date);
                  const isMeetingToday = isToday(meetingDate);
                  const timeStr = format(meetingDate, 'd MMMM yyyy h:mm a');
                  const isMeetingHost = meeting.hostClerkId === user?.id;
                  
                  return (
                    <div 
                      key={meeting.id} 
                      className={`relative p-5 flex items-center justify-between group hover:bg-[#F9FAFB] transition-colors ${index !== filteredUpcoming.length - 1 ? 'border-b border-[#F3F4F6]' : ''} ${index === 0 ? 'rounded-t-[12px]' : ''} ${index === filteredUpcoming.length - 1 ? 'rounded-b-[12px]' : ''}`}
                    >
                      {/* Left Border indicator */}
                      <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${index === 0 ? 'rounded-tl-[12px]' : ''} ${index === filteredUpcoming.length - 1 ? 'rounded-bl-[12px]' : ''} ${isMeetingToday ? 'bg-[#4F46E5]' : 'bg-[#E5E7EB]'}`} />
                      
                      <div className="flex-1 pl-2">
                        <h4 className="text-[15px] font-[600] text-[#111827] mb-1">{meeting.title}</h4>
                        <div className="flex items-center text-[13px] text-[#6B7280] font-[400] gap-1.5">
                          <Calendar size={13} />
                          <span>{timeStr}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {/* Avatars */}
                        <div className="flex -space-x-[8px]">
                          {meeting.attendees?.map((attendee: any, i: number) => (
                            attendee.profileImage ? (
                              <img 
                                key={i}
                                src={attendee.profileImage} 
                                alt={attendee.name}
                                title={attendee.name}
                                className="w-[28px] h-[28px] rounded-full border-[2px] border-[#FFFFFF] object-cover shadow-sm"
                              />
                            ) : (
                              <div 
                                key={i} 
                                className="w-[28px] h-[28px] rounded-full border-[2px] border-[#FFFFFF] flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                                style={{ background: attendee.color || getAvatarColor(attendee.clerkId) }}
                                title={attendee.name}
                              >
                                {attendee.initials || getInitials(attendee.name)}
                              </div>
                            )
                          ))}
                        </div>
                        
                        {isMeetingHost && (
                          <button
                            onClick={() => {
                              if (activeMeetingManageId === meeting.id) {
                                setActiveMeetingManageId(null);
                              } else {
                                setActiveMeetingManageId(meeting.id);
                                setManageSelectedTeamId(currentTeamId);
                                setManageSearchQuery('');
                                setNewParticipants([]);
                              }
                            }}
                            className="manage-participants-btn w-[28px] h-[28px] rounded-full border-[2px] border-[#FFFFFF] bg-[#E5E7EB] hover:bg-[#D1D5DB] flex items-center justify-center text-[#4B5563] ml-1 z-10 transition-colors"
                            title="Manage Participants"
                          >
                            <Plus size={14} />
                          </button>
                        )}

                        {isMeetingHost ? (
                          <div className="flex items-center gap-2 ml-1">
                            <button
                              onClick={() => handleJoinMeeting(meeting.joinCode || meeting.id)}
                              className="h-[32px] px-4 bg-[#4F46E5] text-white hover:bg-[#4338CA] rounded-[6px] text-[13px] font-[500] transition-colors"
                            >
                              Start
                            </button>
                            <button
                              onClick={() => handleCopyInvitation(meeting)}
                              className="h-[32px] px-3 bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] rounded-[6px] text-[13px] font-[500] transition-colors flex items-center gap-1.5"
                            >
                              {copiedMeetingId === meeting.id ? (
                                <>Copied!</>
                              ) : (
                                <>Copy Invitation</>
                              )}
                            </button>
                          </div>
                        ) : canJoinNow(meeting) ? (
                          <button 
                            onClick={() => handleJoinMeeting(meeting.joinCode || meeting.id)}
                            className="opacity-0 group-hover:opacity-100 h-[32px] px-3 bg-transparent border border-[#4F46E5] text-[#4F46E5] rounded-[6px] hover:bg-[#EEF2FF] text-[13px] font-[500] transition-all ml-2"
                          >
                            Join
                          </button>
                        ) : (
                          <span className="text-[12px] text-[#9CA3AF] italic ml-2">
                            Starts {format(new Date(meeting.startTime), 'h:mm a')}
                          </span>
                        )}

                        <button
                          onClick={() => isMeetingHost ? setDeleteMeetingId(meeting.id) : setLeaveMeetingId(meeting.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 ml-2 text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-md transition-all"
                          title={isMeetingHost ? "Delete Meeting" : "Leave Meeting"}
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Add Participants Popup */}
                      {activeMeetingManageId === meeting.id && (
                        <div ref={manageParticipantsRef} className="absolute top-[80%] right-5 mt-2 w-[480px] bg-white border border-[#E5E7EB] rounded-lg shadow-xl z-[60] p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="relative flex-1">
                              <button
                                type="button"
                                onClick={() => setIsManageTeamDropdownOpen(!isManageTeamDropdownOpen)}
                                className="w-full flex items-center justify-between bg-white border border-[#E5E7EB] rounded-md px-3 py-1.5 text-[13px] text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                              >
                                <span className="truncate">
                                  {teams.find((t: any) => t._id === manageSelectedTeamId)?.name || 'Select a Team'}
                                </span>
                                <ChevronDown size={14} className="text-[#9CA3AF]" />
                              </button>
                              {isManageTeamDropdownOpen && (
                                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-md shadow-lg py-1 z-50 max-h-[160px] overflow-y-auto">
                                  {teams.map((team: any) => (
                                    <button
                                      key={team._id}
                                      type="button"
                                      onClick={() => {
                                        setManageSelectedTeamId(team._id);
                                        setIsManageTeamDropdownOpen(false);
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-[13px] text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                                    >
                                      {team.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="relative flex-1">
                              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                              <input
                                type="text"
                                placeholder="Search teammates..."
                                value={manageSearchQuery}
                                onChange={(e) => setManageSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 border border-[#E5E7EB] rounded-md text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none"
                              />
                            </div>
                          </div>

                          {manageTeamMembers.length > 0 && (
                            <div className="flex items-center justify-between mb-3 px-1">
                              <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={
                                  manageTeamMembers.filter((m: any) => m.clerkId !== user?.id && !meeting.attendees?.some((a: any) => a.clerkId === m.clerkId) && !meeting.pendingInvitees?.some((a: any) => a.clerkId === m.clerkId)).length > 0 &&
                                  manageTeamMembers.filter((m: any) => m.clerkId !== user?.id && !meeting.attendees?.some((a: any) => a.clerkId === m.clerkId) && !meeting.pendingInvitees?.some((a: any) => a.clerkId === m.clerkId)).every((m: any) => newParticipants.includes(m.clerkId))
                                }
                                onChange={(e) => {
                                  const eligibleMembers = manageTeamMembers.filter((m: any) => m.clerkId !== user?.id && !meeting.attendees?.some((a: any) => a.clerkId === m.clerkId) && !meeting.pendingInvitees?.some((a: any) => a.clerkId === m.clerkId));
                                  if (e.target.checked) {
                                    const idsToAdd = eligibleMembers.map((m: any) => m.clerkId);
                                    setNewParticipants(Array.from(new Set([...newParticipants, ...idsToAdd])));
                                  } else {
                                    const idsToRemove = eligibleMembers.map((m: any) => m.clerkId);
                                    setNewParticipants(newParticipants.filter((id: string) => !idsToRemove.includes(id)));
                                  }
                                }}
                                className="w-4 h-4 text-[#4F46E5] border-[#D1D5DB] rounded focus:ring-[#4F46E5]"
                              />
                              <span className="text-[13px] font-[500] text-[#374151]">Select all members of this team</span>
                              </label>
                              <span className="text-[12px] font-[500] text-[#6B7280]">{newParticipants.length} selected</span>
                            </div>
                          )}

                          <div className="max-h-[200px] overflow-y-auto border border-[#E5E7EB] rounded-lg divide-y divide-[#E5E7EB] mb-3">
                            {isLoadingManageMembers ? (
                              <div className="p-3 text-[13px] text-[#6B7280] text-center">Loading...</div>
                            ) : manageTeamMembers.filter((m: any) => m.clerkId !== user?.id && m.name?.toLowerCase().includes(manageSearchQuery.toLowerCase())).length === 0 ? (
                              <div className="p-3 text-[13px] text-[#6B7280] text-center">No team members found</div>
                            ) : manageTeamMembers
                                .filter((m: any) => m.clerkId !== user?.id && m.name?.toLowerCase().includes(manageSearchQuery.toLowerCase()))
                                .map((member: any) => {
                                  const isAlreadyParticipant = meeting.attendees?.some((a: any) => a.clerkId === member.clerkId);
                                  const isPendingInvite = meeting.pendingInvitees?.some((a: any) => a.clerkId === member.clerkId);
                                  const isAlreadyInMeeting = isAlreadyParticipant || isPendingInvite;
                                  const isSelected = newParticipants.includes(member.clerkId);

                                  return (
                                    <div key={member.clerkId} className="flex items-center justify-between p-3 hover:bg-[#F9FAFB] transition-colors">
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="checkbox"
                                          checked={isAlreadyInMeeting || isSelected}
                                          disabled={isAlreadyInMeeting}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setNewParticipants([...newParticipants, member.clerkId]);
                                            } else {
                                              setNewParticipants(newParticipants.filter((id) => id !== member.clerkId));
                                            }
                                          }}
                                          className="w-4 h-4 text-[#4F46E5] border-[#D1D5DB] rounded focus:ring-[#4F46E5] disabled:opacity-50"
                                        />
                                        {member.profileImage ? (
                                          <img src={member.profileImage} alt={member.name} className="w-6 h-6 rounded-full object-cover" />
                                        ) : (
                                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: getAvatarColor(member.clerkId) }}>
                                            {getInitials(member.name)}
                                          </div>
                                        )}
                                        <span className="text-[13px] font-[500] text-[#111827]">{member.name}</span>
                                      </div>
                                      {isAlreadyInMeeting && (
                                        <button
                                          onClick={() => setRemoveConfirmParticipant({ meetingId: meeting.id, clerkId: member.clerkId, name: member.name })}
                                          className="text-[#9CA3AF] hover:text-[#EF4444] p-1 rounded-md hover:bg-[#FEE2E2] transition-colors"
                                          title="Remove participant"
                                        >
                                          <X size={14} />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                          </div>
                          
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setActiveMeetingManageId(null)}
                              className="px-3 py-1.5 text-[13px] font-[500] text-[#374151] hover:bg-[#F3F4F6] rounded-md transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => inviteToMeeting({ id: meeting.id, participantClerkIds: newParticipants })}
                              disabled={newParticipants.length === 0 || isInvitingToMeeting}
                              className="px-3 py-1.5 text-[13px] font-[500] text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-md transition-colors disabled:opacity-50"
                            >
                              {isInvitingToMeeting ? 'Inviting...' : 'Invite'}
                            </button>
                          </div>

                          {removeConfirmParticipant?.meetingId === meeting.id && (
                            <div ref={removeConfirmRef} className="absolute top-full mt-2 right-0 w-[300px] bg-white border border-[#E5E7EB] rounded-lg shadow-xl p-5 z-[70]">
                              <h3 className="text-[16px] font-[600] text-[#111827] mb-2">Remove Participant</h3>
                              <p className="text-[13px] text-[#4B5563] mb-5">
                                Do you really want to remove <span className="font-semibold text-[#111827]">{removeConfirmParticipant?.name}</span> from this meeting?
                              </p>
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setRemoveConfirmParticipant(null)}
                                  className="px-3 py-1.5 text-[13px] font-[500] text-[#374151] hover:bg-[#F3F4F6] rounded-md transition-colors"
                                >
                                  No
                                </button>
                                <button
                                  onClick={() => removeConfirmParticipant && removeMeetingParticipant({ id: removeConfirmParticipant.meetingId, participantClerkId: removeConfirmParticipant.clerkId })}
                                  disabled={isRemovingParticipant}
                                  className="px-3 py-1.5 text-[13px] font-[500] text-white bg-[#EF4444] hover:bg-[#DC2626] rounded-md transition-colors disabled:opacity-50"
                                >
                                  {isRemovingParticipant ? 'Removing...' : 'Yes'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-[15px] font-[600] text-[#111827] mb-3">Past Meetings ({filteredPast.length})</h3>
              <div className="bg-white border border-[#E5E7EB] rounded-[12px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
                {filteredPast.length === 0 ? (
                  <div className="p-5 text-[#6B7280] text-[14px]">No past meetings found.</div>
                ) : filteredPast.map((meeting: any, index: number) => {
                  const meetingDate = new Date(meeting.startTime || meeting.date);
                  const dateLabel = isToday(meetingDate) ? 'Today' : isYesterday(meetingDate) ? 'Yesterday' : format(meetingDate, 'MMM d, yyyy');
                  return (
                    <div
                      key={meeting.id}
                      onClick={() => handleViewSummary(meeting.id)}
                      className={`p-5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors cursor-pointer ${index !== filteredPast.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}
                    >
                      <div className="flex-1 overflow-hidden">
                        <h4 className="text-[15px] font-[600] text-[#111827] mb-1 truncate">{meeting.title}</h4>
                        <p className="text-[13px] text-[#6B7280] line-clamp-1">{meeting.summary || 'Summary pending'}</p>
                      </div>
                      <span className="bg-[#F3F4F6] text-[#6B7280] text-[12px] font-[400] px-[8px] py-[2px] rounded-[6px] flex-shrink-0 ml-4">
                        {dateLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tab === 'recordings') {
    const filteredRecordings = meetingSearchQuery.trim()
      ? recordingsList.filter((m: any) => m.topic?.toLowerCase().includes(meetingSearchQuery.trim().toLowerCase()))
      : recordingsList;

    return (
      <div className="bg-[#FAFAFA] min-h-screen w-full font-['Inter'] p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0 mb-6">
          <h2 className="text-[24px] font-[600] text-[#111827]">Recordings & Transcripts</h2>
          <div className="relative w-full md:w-auto md:mr-14">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search recordings..."
              value={meetingSearchQuery}
              onChange={(e) => setMeetingSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-[#E5E7EB] rounded-md text-[13px] focus:outline-none focus:ring-1 focus:ring-[#4F46E5] focus:border-[#4F46E5] shadow-sm w-full md:w-[260px]"
            />
          </div>
        </div>

        {isLoadingRecordings ? (
          <div className="text-[#6B7280] text-[14px]">Loading recordings...</div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white border border-[#E5E7EB] rounded-[12px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] flex flex-col">
              {filteredRecordings.length === 0 ? (
                <div className="p-5 text-[#6B7280] text-[14px]">No recordings found.</div>
              ) : filteredRecordings.map((meeting: any, index: number) => {
                const meetingDate = new Date(meeting.startTime);
                const timeStr = format(meetingDate, 'MMM d, yyyy');
                const durationStr = formatDurationSeconds(meeting.recordingDurationSeconds || 0);
                
                return (
                  <div 
                    key={meeting._id || meeting.id} 
                    onClick={() => navigate(`/recordings/${meeting._id || meeting.id}`)}
                    className={`p-5 flex items-center justify-between group hover:bg-[#F9FAFB] transition-colors cursor-pointer ${index !== filteredRecordings.length - 1 ? 'border-b border-[#F3F4F6]' : ''} ${index === 0 ? 'rounded-t-[12px]' : ''} ${index === filteredRecordings.length - 1 ? 'rounded-b-[12px]' : ''}`}
                  >
                    <div className="flex flex-col">
                      <h4 className="text-[15px] font-[600] text-[#111827] mb-1">{meeting.topic || 'Untitled Meeting'}</h4>
                      <div className="flex items-center text-[13px] text-[#6B7280] font-[400] gap-4">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} />
                          <span>{timeStr}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} />
                          <span>{durationStr}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-[8px]">
                        {(meeting.resolvedParticipants || []).slice(0, 5).map((attendee: any, i: number) => (
                          attendee.profileImage ? (
                            <img
                              key={i}
                              src={attendee.profileImage}
                              alt={attendee.name}
                              title={attendee.name}
                              className="w-[28px] h-[28px] rounded-full border-[2px] border-[#FFFFFF] object-cover shadow-sm"
                            />
                          ) : (
                            <div
                              key={i}
                              className="w-[28px] h-[28px] rounded-full border-[2px] border-[#FFFFFF] flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                              style={{ background: getAvatarColor(attendee.clerkId) }}
                              title={attendee.name}
                            >
                              {getInitials(attendee.name)}
                            </div>
                          )
                        ))}
                      </div>
                      <ChevronRight size={18} className="text-[#9CA3AF] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tab === 'analytics') {
    const taskStatusData = [
      { name: 'Backlog', value: myTasks.filter((t: any) => t.status === 'backlog').length, color: '#6B7280' },
      { name: 'In Progress', value: myTasks.filter((t: any) => t.status === 'in-progress').length, color: '#3B82F6' },
      { name: 'In Review', value: myTasks.filter((t: any) => t.status === 'in-review').length, color: '#F59E0B' },
      { name: 'Done', value: myTasks.filter((t: any) => t.status === 'done').length, color: '#10B981' },
    ].filter(d => d.value > 0);

    const ratingColors: Record<number, string> = { 1: '#EF4444', 2: '#F97316', 3: '#F59E0B', 4: '#3B82F6', 5: '#4F46E5' };
    const ratingData = (analytics?.ratingDistribution || [])
      .filter((d: any) => d.count > 0)
      .map((d: any) => ({ name: `${d.stars} Star${d.stars !== 1 ? 's' : ''}`, value: d.count, color: ratingColors[d.stars] }));

    const trendData = (analytics?.weeklyTrend || []).map((w: any) => ({
      week: format(new Date(w.week), 'MMM d'),
      meetings: w.count
    }));

    const tooltipStyle = {
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      fontSize: '13px',
      padding: '8px 12px'
    };

    const handleExportAnalyticsCsv = () => {
      const rows: string[][] = [];
      rows.push(['Metric', 'Value']);
      rows.push(['Total Meetings', String(analytics?.totalMeetings ?? 0)]);
      rows.push(['Avg Duration (min)', String(analytics?.avgDurationMinutes ?? 0)]);
      rows.push(['Total Hours', String(analytics?.totalHours ?? 0)]);
      rows.push(['Avg Rating', String(analytics?.avgRating ?? 'N/A')]);
      rows.push(['Avg Attendees / Meeting', String(analytics?.engagement?.avgAttendeesPerMeeting ?? 0)]);
      rows.push(['Rating Response Rate (%)', String(analytics?.engagement?.ratingResponseRate ?? 0)]);
      if (analytics?.productivity) {
        rows.push(['Task Completion Rate (%)', String(analytics.productivity.taskCompletionRate)]);
        rows.push(['Overdue Tasks', String(analytics.productivity.overdueTasks)]);
        rows.push(['Avg Action Items / Meeting', String(analytics.productivity.avgActionItemsPerMeeting)]);
        rows.push(['Action Item -> Task Conversion (%)', String(analytics.productivity.actionItemToTaskConversionRate)]);
      }
      rows.push([]);
      rows.push(['Week', 'Meetings']);
      (analytics?.weeklyTrend || []).forEach((w: any) => rows.push([w.week, String(w.count)]));
      rows.push([]);
      rows.push(['Top Participant', 'Meetings Together']);
      (analytics?.engagement?.topParticipants || []).forEach((p: any) => rows.push([p.name, String(p.meetingCount)]));

      const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    };

    return (
      <div className="bg-[#FAFAFA] min-h-screen w-full font-['Inter'] p-4 md:p-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[24px] font-[700] text-[#111827]">Analytics</h2>
            <p className="text-[#6B7280] text-[14px] mt-1">Your meeting activity, engagement, and team throughput at a glance.</p>
          </div>
          <button
            onClick={handleExportAnalyticsCsv}
            disabled={isLoadingAnalytics}
            className="w-full justify-center md:justify-start md:w-auto h-[36px] px-4 bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] rounded-[8px] text-[14px] font-[500] transition-colors flex items-center gap-2 md:mr-14 disabled:opacity-50"
          >
            <Download size={16} /> Export Report
          </button>
        </div>

        {isLoadingAnalytics ? (
          <div className="text-[#6B7280] text-[14px]">Loading analytics...</div>
        ) : (
          <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <div className="bg-white p-5 rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
                <h3 className="text-[#6B7280] text-[13px] font-[400] mb-2">Total Meetings</h3>
                <span className="text-[28px] font-[700] text-[#111827]">{analytics?.totalMeetings ?? 0}</span>
              </div>
              <div className="bg-white p-5 rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
                <h3 className="text-[#6B7280] text-[13px] font-[400] mb-2">Avg Duration</h3>
                <span className="text-[28px] font-[700] text-[#111827]">{analytics?.avgDurationMinutes ?? 0}<span className="text-[15px] font-[500] text-[#6B7280] ml-1">min</span></span>
              </div>
              <div className="bg-white p-5 rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
                <h3 className="text-[#6B7280] text-[13px] font-[400] mb-2">Total Hours</h3>
                <span className="text-[28px] font-[700] text-[#111827]">{analytics?.totalHours ?? 0}<span className="text-[15px] font-[500] text-[#6B7280] ml-1">hrs</span></span>
              </div>
              <div className="bg-white p-5 rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
                <h3 className="text-[#6B7280] text-[13px] font-[400] mb-2">Avg Rating</h3>
                <span className="text-[28px] font-[700] text-[#111827]">{analytics?.avgRating ?? '—'}{analytics?.avgRating ? <span className="text-[15px] font-[500] text-[#6B7280] ml-1">/ 5</span> : null}</span>
              </div>
            </div>

            {/* Trend Chart */}
            <div className="bg-white p-6 rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2 mb-5">
                <BarChart2 size={18} className="text-[#4F46E5]" />
                <h3 className="text-[15px] font-[600] text-[#111827]">Meeting Activity — Last 8 Weeks</h3>
              </div>
              {trendData.every((d: any) => d.meetings === 0) ? (
                <div className="h-[240px] flex items-center justify-center text-[#9CA3AF] text-[13px]">No meeting activity yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="meetingGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="meetings" stroke="#4F46E5" strokeWidth={2.5} fill="url(#meetingGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Two Donut Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
                <h3 className="text-[15px] font-[600] text-[#111827] mb-5">Call Satisfaction</h3>
                {ratingData.length === 0 ? (
                  <div className="h-[220px] flex items-center justify-center text-[#9CA3AF] text-[13px]">No ratings yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={ratingData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                        {ratingData.map((entry: any, idx: number) => <Cell key={idx} fill={entry.color} stroke="none" />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="flex flex-wrap gap-3 justify-center mt-3">
                  {ratingData.map((entry: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[12px] text-[#6B7280]">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
                      {entry.name} ({entry.value})
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
                <h3 className="text-[15px] font-[600] text-[#111827] mb-5">Team Task Distribution</h3>
                {taskStatusData.length === 0 ? (
                  <div className="h-[220px] flex items-center justify-center text-[#9CA3AF] text-[13px]">No tasks yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={taskStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                        {taskStatusData.map((entry: any, idx: number) => <Cell key={idx} fill={entry.color} stroke="none" />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="flex flex-wrap gap-3 justify-center mt-3">
                  {taskStatusData.map((entry: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[12px] text-[#6B7280]">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
                      {entry.name} ({entry.value})
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Productivity Metrics */}
            <div className="bg-white p-6 rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp size={18} className="text-[#4F46E5]" />
                <h3 className="text-[15px] font-[600] text-[#111827]">Productivity Metrics</h3>
              </div>
              {!analytics?.productivity ? (
                <div className="text-[#9CA3AF] text-[13px]">Select a team to see productivity metrics.</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  <div>
                    <h4 className="text-[#6B7280] text-[13px] font-[400] mb-2">Task Completion Rate</h4>
                    <span className="text-[24px] font-[700] text-[#111827]">{analytics.productivity.taskCompletionRate}%</span>
                  </div>
                  <div>
                    <h4 className="text-[#6B7280] text-[13px] font-[400] mb-2">Overdue Tasks</h4>
                    <span className="text-[24px] font-[700] text-[#111827]">{analytics.productivity.overdueTasks}</span>
                  </div>
                  <div>
                    <h4 className="text-[#6B7280] text-[13px] font-[400] mb-2">Avg Action Items / Meeting</h4>
                    <span className="text-[24px] font-[700] text-[#111827]">{analytics.productivity.avgActionItemsPerMeeting}</span>
                  </div>
                  <div>
                    <h4 className="text-[#6B7280] text-[13px] font-[400] mb-2">Action Item → Task Rate</h4>
                    <span className="text-[24px] font-[700] text-[#111827]">{analytics.productivity.actionItemToTaskConversionRate}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Engagement Report */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-2 mb-5">
                  <Users size={18} className="text-[#4F46E5]" />
                  <h3 className="text-[15px] font-[600] text-[#111827]">Engagement Overview</h3>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <h4 className="text-[#6B7280] text-[13px] font-[400] mb-2">Avg Attendees / Meeting</h4>
                    <span className="text-[24px] font-[700] text-[#111827]">{analytics?.engagement?.avgAttendeesPerMeeting ?? 0}</span>
                  </div>
                  <div>
                    <h4 className="text-[#6B7280] text-[13px] font-[400] mb-2">Rating Response Rate</h4>
                    <span className="text-[24px] font-[700] text-[#111827]">{analytics?.engagement?.ratingResponseRate ?? 0}%</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
                <h3 className="text-[15px] font-[600] text-[#111827] mb-5">Most Engaged Teammates</h3>
                {(!analytics?.engagement?.topParticipants || analytics.engagement.topParticipants.length === 0) ? (
                  <div className="text-[#9CA3AF] text-[13px]">Not enough meeting history yet.</div>
                ) : (
                  <div className="space-y-3">
                    {analytics.engagement.topParticipants.map((p: any, idx: number) => (
                      <div key={p.clerkId || idx} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {p.profileImage ? (
                            <img src={p.profileImage} alt={p.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full flex flex-shrink-0 items-center justify-center text-white text-[12px] font-bold" style={{ background: getAvatarColor(p.clerkId || p.name) }}>
                              {getInitials(p.name)}
                            </div>
                          )}
                          <span className="text-[14px] font-[500] text-[#111827] truncate">{p.name}</span>
                        </div>
                        <div className="text-[13px] text-[#6B7280] flex-shrink-0">
                          {p.meetingCount} meeting{p.meetingCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tab === 'settings') {
    return (
      <div className="bg-[#FAFAFA] min-h-screen w-full font-['Inter'] p-4 md:p-8">
        <h2 className="text-[24px] font-[700] text-[#111827] mb-6">Account Settings</h2>
        <div className="flex flex-col md:flex-row gap-6 max-w-5xl">
          {/* Left mini-nav */}
          <div className="w-full md:w-[200px] flex-shrink-0">
            <div className="bg-white border border-[#E5E7EB] rounded-[12px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] p-2">
              <button
                onClick={() => setSettingsSection('profile')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-[14px] font-[500] transition-colors ${settingsSection === 'profile' ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'text-[#374151] hover:bg-[#F3F4F6]'}`}
              >
                <FileText size={16} /> Profile
              </button>
              <button
                onClick={() => setSettingsSection('security')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-[14px] font-[500] transition-colors mt-1 ${settingsSection === 'security' ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'text-[#374151] hover:bg-[#F3F4F6]'}`}
              >
                <Shield size={16} /> Security
              </button>
            </div>
          </div>

          {/* Right content */}
          <div className="w-full md:flex-1 space-y-6">
            {settingsSection === 'profile' && (
              <>
                <div className="bg-white border border-[#E5E7EB] rounded-[12px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] p-6">
                  <h3 className="text-[15px] font-[600] text-[#111827] mb-5">Profile details</h3>
                  <div className="flex items-center gap-5 pb-5 border-b border-[#F3F4F6]">
                    <div className="relative">
                      {user?.imageUrl ? (
                        <img src={user.imageUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
                      ) : (
                        <div
                          className="w-16 h-16 rounded-full flex items-center justify-center text-white text-[18px] font-bold"
                          style={{ background: getAvatarColor(user?.id || 'default') }}
                        >
                          {getInitials(user?.fullName)}
                        </div>
                      )}
                      <button
                        onClick={handleAvatarClick}
                        disabled={isUploadingAvatar}
                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] flex items-center justify-center text-white shadow-sm transition-colors disabled:opacity-60"
                        title="Change photo"
                      >
                        {isUploadingAvatar ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                      </button>
                      <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                    </div>

                    <div className="flex-1">
                      {!isEditingName ? (
                        <div className="flex items-center gap-3">
                          <span className="text-[16px] font-[600] text-[#111827]">{user?.fullName || 'User'}</span>
                          <button onClick={handleStartEditName} className="text-[#4F46E5] text-[13px] font-[500] hover:underline">
                            Edit
                          </button>
                          {nameSaved && <span className="text-[#10B981] text-[12px] flex items-center gap-1"><Check size={12} /> Saved</span>}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={editFirstName}
                            onChange={(e) => setEditFirstName(e.target.value)}
                            placeholder="First name"
                            className="border border-[#E5E7EB] rounded-md px-3 py-1.5 text-[13px] w-[130px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none"
                          />
                          <input
                            value={editLastName}
                            onChange={(e) => setEditLastName(e.target.value)}
                            placeholder="Last name"
                            className="border border-[#E5E7EB] rounded-md px-3 py-1.5 text-[13px] w-[130px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none"
                          />
                          <button
                            onClick={handleSaveName}
                            disabled={isSavingName}
                            className="px-3 py-1.5 bg-[#4F46E5] text-white rounded-md text-[13px] font-[500] hover:bg-[#4338CA] disabled:opacity-60"
                          >
                            {isSavingName ? 'Saving...' : 'Save'}
                          </button>
                          <button onClick={() => setIsEditingName(false)} className="px-3 py-1.5 text-[#6B7280] text-[13px] hover:bg-[#F3F4F6] rounded-md">
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-5">
                    <div className="text-[13px] text-[#6B7280] mb-2">Email addresses</div>
                    <div className="space-y-2">
                      {user?.emailAddresses?.map((email: any) => (
                        <div key={email.id} className="flex items-center gap-2">
                          <span className="text-[14px] text-[#111827]">{email.emailAddress}</span>
                          {email.id === user.primaryEmailAddressId && (
                            <span className="bg-[#F3F4F6] text-[#6B7280] text-[11px] font-[500] px-2 py-0.5 rounded-full">Primary</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {(user?.externalAccounts?.length ?? 0) > 0 && (
                  <div className="bg-white border border-[#E5E7EB] rounded-[12px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] p-6">
                    <h3 className="text-[15px] font-[600] text-[#111827] mb-4">Connected accounts</h3>
                    <div className="space-y-3">
                      {user?.externalAccounts?.map((acc: any) => (
                        <div key={acc.id} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#374151] text-[13px] font-bold uppercase">
                            {acc.provider?.[0] || '?'}
                          </div>
                          <div>
                            <div className="text-[14px] text-[#111827] font-[500] capitalize">{acc.provider}</div>
                            <div className="text-[12px] text-[#6B7280]">{acc.emailAddress}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {settingsSection === 'security' && (
              <>
                <div className="bg-white border border-[#E5E7EB] rounded-[12px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] p-6">
                  <h3 className="text-[15px] font-[600] text-[#111827] mb-5 flex items-center gap-2">
                    <Lock size={16} className="text-[#4F46E5]" /> {user?.passwordEnabled ? 'Change password' : 'Set password'}
                  </h3>
                  <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
                    {user?.passwordEnabled && (
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current password"
                        required
                        className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none"
                      />
                    )}
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      required
                      minLength={8}
                      className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                      minLength={8}
                      className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none"
                    />
                    {passwordMessage && (
                      <div className={`text-[13px] p-2 rounded-md ${passwordMessage.success ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}>
                        {passwordMessage.text}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={isSavingPassword}
                      className="px-4 py-2 bg-[#4F46E5] text-white rounded-md text-[13px] font-[500] hover:bg-[#4338CA] disabled:opacity-60"
                    >
                      {isSavingPassword ? 'Saving...' : user?.passwordEnabled ? 'Update password' : 'Set password'}
                    </button>
                  </form>
                </div>

                <div className="bg-white border border-[#E5E7EB] rounded-[12px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] p-6">
                  <h3 className="text-[15px] font-[600] text-[#111827] mb-5 flex items-center gap-2">
                    <Laptop size={16} className="text-[#4F46E5]" /> Active devices
                  </h3>
                  {isLoadingSessions ? (
                    <div className="text-[#6B7280] text-[13px]">Loading devices...</div>
                  ) : !userSessions || userSessions.length === 0 ? (
                    <div className="text-[#6B7280] text-[13px]">No active device data available.</div>
                  ) : (
                    <div className="space-y-4">
                      {userSessions.map((session: any) => {
                        const isCurrent = session.id === sessionId;
                        const activity = session.latestActivity || {};
                        return (
                          <div key={session.id} className="flex items-start justify-between pb-4 border-b border-[#F3F4F6] last:border-b-0 last:pb-0">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] font-[600] text-[#111827]">{activity.deviceType || 'Unknown device'}</span>
                                {isCurrent && (
                                  <span className="bg-[#EEF2FF] text-[#4F46E5] text-[11px] font-[500] px-2 py-0.5 rounded-full">This device</span>
                                )}
                              </div>
                              <div className="text-[13px] text-[#6B7280] mt-1">{activity.browserName} {activity.browserVersion || ''}</div>
                              <div className="text-[12px] text-[#9CA3AF] mt-0.5">
                                {activity.city && activity.country ? `${activity.city}, ${activity.country}` : activity.ipAddress || ''}
                              </div>
                              <div className="text-[12px] text-[#9CA3AF]">
                                {session.lastActiveAt ? `Active ${format(new Date(session.lastActiveAt), 'MMM d, h:mm a')}` : ''}
                              </div>
                            </div>
                            {!isCurrent && (
                              <button
                                onClick={() => handleRevokeSession(session)}
                                disabled={revokingSessionId === session.id}
                                className="text-[#EF4444] text-[12px] font-[500] hover:underline disabled:opacity-60"
                              >
                                {revokingSessionId === session.id ? 'Signing out...' : 'Sign out'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-[#FEE2E2] rounded-[12px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] p-6">
                  <h3 className="text-[15px] font-[600] text-[#DC2626] mb-2 flex items-center gap-2">
                    <Trash2 size={16} /> Delete account
                  </h3>
                  <p className="text-[13px] text-[#6B7280] mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
                  <button
                    onClick={handleDeleteAccount}
                    className="px-4 py-2 bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2] rounded-md text-[13px] font-[500] hover:bg-[#FEE2E2] transition-colors"
                  >
                    Delete account
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FAFAFA] min-h-screen w-full font-['Inter']">
      <div className="max-w-[1200px] mx-auto w-full px-4 md:px-[32px] pb-[32px]">
        
        {/* Section 1 — Page Header */}
        <div className="flex items-center justify-between pt-[32px]">
          <div>
            <h1 className="text-[24px] font-[700] text-[#111827] leading-tight">
              Good morning, {user?.firstName || 'Shashank'}
            </h1>
            <p className="text-[#6B7280] text-[14px] mt-1 font-[400]">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div className="hidden md:flex gap-3">
            <button onClick={handleJoinWithCode} className="h-[36px] px-4 bg-transparent border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6] rounded-[8px] text-[14px] font-[500] transition-colors flex items-center justify-center">
              Join with Code
            </button>
            <button onClick={handleNewMeeting} className="h-[36px] px-4 bg-[#4F46E5] text-white hover:bg-[#4338CA] rounded-[8px] text-[14px] font-[500] transition-colors flex items-center justify-center gap-2">
              <Plus size={16} />
              New Meeting
            </button>
          </div>
        </div>

        {/* Section 2 — KPI Stats Row */}
        <div className="hidden md:flex gap-[24px] mt-[24px]">
          {/* Card 1 */}
          <div className="flex-1 bg-[#FFFFFF] p-[20px] rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
            <h3 className="text-[#6B7280] text-[13px] font-[400] mb-2">Meetings This Week</h3>
            <div className="flex items-baseline gap-3">
              <span className="text-[28px] font-[700] text-[#111827] leading-none">{meetingStats?.thisWeekCount ?? 0}</span>
              <span className={weekDelta >= 0 ? "bg-[#D1FAE5] text-[#065F46] text-[12px] font-[400] px-[8px] py-[2px] rounded-[6px]" : "bg-[#F3F4F6] text-[#6B7280] text-[12px] font-[400] px-[8px] py-[2px] rounded-[6px]"}>
                {weekDelta > 0 ? `+${weekDelta} from last week` : weekDelta < 0 ? `${weekDelta} from last week` : 'Same as last week'}
              </span>
            </div>
          </div>
          {/* Card 2 */}
          <div className="flex-1 bg-[#FFFFFF] p-[20px] rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.04)] relative">
            <h3 className="text-[#6B7280] text-[13px] font-[400] mb-2">Open Action Items</h3>
            <div className="flex items-baseline gap-3">
              <span className="text-[28px] font-[700] text-[#111827] leading-none">{myOpenTasks.length}</span>
              {dueTodayCount > 0 && (
                <span className="bg-[#FEF3C7] text-[#92400E] text-[12px] font-[400] px-[8px] py-[2px] rounded-[6px]">
                  {dueTodayCount} due today
                </span>
              )}
            </div>
            <button onClick={() => navigate('/tasks')} className="absolute top-[20px] right-[20px] text-[#4F46E5] text-[13px] font-[400] hover:underline">
              View board &rarr;
            </button>
          </div>
        </div>

        {/* Section 3 — Core Action Launcher (Compact Zoom-style) */}
        <div className="flex justify-evenly mt-[44px] w-full">
          {/* Action 1 */}
          <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={handleNewMeeting}>
            <button className="w-[80px] h-[80px] bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center justify-center group-hover:bg-[#F5F3FF] group-hover:border-[#C7D2FE] hover:bg-[#F5F3FF] hover:border-[#C7D2FE] transition-all">
              <Video size={24} className="text-[#4F46E5]" />
            </button>
            <span className="text-[12px] font-[500] text-[#374151] group-hover:text-[#4F46E5] transition-colors">New Meeting</span>
          </div>
          {/* Action 2 */}
          <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={handleJoinWithCode}>
            <button className="w-[80px] h-[80px] bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center justify-center group-hover:bg-[#F5F3FF] group-hover:border-[#C7D2FE] hover:bg-[#F5F3FF] hover:border-[#C7D2FE] transition-all">
              <LogIn size={24} className="text-[#4F46E5]" />
            </button>
            <span className="text-[12px] font-[500] text-[#374151] group-hover:text-[#4F46E5] transition-colors">Join</span>
          </div>
          {/* Action 3 */}
          <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => { setScheduleSelectedTeamId(currentTeamId); setScheduleOpenForAll(false); setIsScheduleModalOpen(true); }}>
            <button className="w-[80px] h-[80px] bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center justify-center group-hover:bg-[#F5F3FF] group-hover:border-[#C7D2FE] hover:bg-[#F5F3FF] hover:border-[#C7D2FE] transition-all">
              <Calendar size={24} className="text-[#4F46E5]" />
            </button>
            <span className="text-[12px] font-[500] text-[#374151] group-hover:text-[#4F46E5] transition-colors">Schedule</span>
          </div>
        </div>

        {/* Section 4 — Two Column Content Area */}
        <div className="flex flex-col md:flex-row items-stretch gap-[24px] mt-[44px]">
          {/* Left Column — Upcoming Meetings */}
          <div className="w-full md:w-[58%] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-[16px] font-[600] text-[#111827]">Upcoming Meetings</h2>
              <button className="text-[#4F46E5] text-[13px] font-[400] hover:underline">View Calendar &rarr;</button>
            </div>
            <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] flex flex-col flex-1">
              <div className="flex flex-col">
                {isLoadingUpcoming ? (
                  <div className="p-5 text-[#6B7280] text-[14px]">Loading upcoming meetings...</div>
                ) : upcomingMeetings.length === 0 ? (
                  <div className="p-5 text-[#6B7280] text-[14px]">No upcoming meetings</div>
                ) : upcomingMeetings.slice(0, 4).map((meeting: any, index: number) => {
                  const meetingDate = new Date(meeting.startTime || meeting.date);
                  const isMeetingToday = isToday(meetingDate);
                  const timeStr = format(meetingDate, 'd MMMM yyyy h:mm a');
                  const isMeetingHost = meeting.hostClerkId === user?.id;
                  
                  return (
                  <div 
                    key={meeting.id} 
                    className={`relative p-5 flex items-center justify-between group hover:bg-[#F9FAFB] transition-colors ${index !== upcomingMeetings.length - 1 ? 'border-b border-[#F3F4F6]' : ''} ${index === 0 ? 'rounded-t-[12px]' : ''} ${index === Math.min(upcomingMeetings.length, 4) - 1 ? 'rounded-b-[12px]' : ''}`}
                  >
                    {/* Left Border indicator */}
                    <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${index === 0 ? 'rounded-tl-[12px]' : ''} ${index === Math.min(upcomingMeetings.length, 4) - 1 ? 'rounded-bl-[12px]' : ''} ${isMeetingToday ? 'bg-[#4F46E5]' : 'bg-[#E5E7EB]'}`} />
                    
                    <div className="flex-1 pl-2">
                      <h4 className="text-[15px] font-[600] text-[#111827] mb-1">{meeting.title}</h4>
                      <div className="flex items-center text-[13px] text-[#6B7280] font-[400] gap-1.5">
                        <Calendar size={13} />
                        <span>{timeStr}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {/* Avatars */}
                      <div className="flex -space-x-[8px]">
                        {meeting.attendees?.map((attendee: any, i: number) => (
                          attendee.profileImage ? (
                            <img 
                              key={i}
                              src={attendee.profileImage} 
                              alt={attendee.name}
                              title={attendee.name}
                              className="w-[28px] h-[28px] rounded-full border-[2px] border-[#FFFFFF] object-cover shadow-sm"
                            />
                          ) : (
                            <div 
                              key={i} 
                              className="w-[28px] h-[28px] rounded-full border-[2px] border-[#FFFFFF] flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                              style={{ background: attendee.color }}
                              title={attendee.name}
                            >
                              {attendee.initials}
                            </div>
                          )
                        ))}
                      </div>
                      
                      {isMeetingHost && (
                        <button
                          onClick={() => {
                            if (activeMeetingManageId === meeting.id) {
                              setActiveMeetingManageId(null);
                            } else {
                              setActiveMeetingManageId(meeting.id);
                              setManageSelectedTeamId(currentTeamId);
                              setManageSearchQuery('');
                              setNewParticipants([]);
                            }
                          }}
                          className="manage-participants-btn w-[28px] h-[28px] rounded-full border-[2px] border-[#FFFFFF] bg-[#E5E7EB] hover:bg-[#D1D5DB] flex items-center justify-center text-[#4B5563] ml-1 z-10 transition-colors"
                          title="Manage Participants"
                        >
                          <Plus size={14} />
                        </button>
                      )}

                      {isMeetingHost ? (
                        <div className="flex items-center gap-2 ml-1">
                          <button
                            onClick={() => handleJoinMeeting(meeting.joinCode || meeting.id)}
                            className="h-[32px] px-4 bg-[#4F46E5] text-white hover:bg-[#4338CA] rounded-[6px] text-[13px] font-[500] transition-colors"
                          >
                            Start
                          </button>
                          <button
                            onClick={() => handleCopyInvitation(meeting)}
                            className="h-[32px] px-3 bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] rounded-[6px] text-[13px] font-[500] transition-colors flex items-center gap-1.5"
                          >
                            {copiedMeetingId === meeting.id ? (
                              <>Copied!</>
                            ) : (
                              <>Copy Invitation</>
                            )}
                          </button>
                        </div>
                      ) : canJoinNow(meeting) ? (
                        <button 
                          onClick={() => handleJoinMeeting(meeting.joinCode || meeting.id)}
                          className="opacity-0 group-hover:opacity-100 h-[32px] px-3 bg-transparent border border-[#4F46E5] text-[#4F46E5] rounded-[6px] hover:bg-[#EEF2FF] text-[13px] font-[500] transition-all ml-2"
                        >
                          Join
                        </button>
                      ) : (
                        <span className="text-[12px] text-[#9CA3AF] italic ml-2">
                          Starts {format(new Date(meeting.startTime), 'h:mm a')}
                        </span>
                      )}

                      <button
                        onClick={() => isMeetingHost ? setDeleteMeetingId(meeting.id) : setLeaveMeetingId(meeting.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 ml-2 text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-md transition-all"
                        title={isMeetingHost ? "Delete Meeting" : "Leave Meeting"}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Add Participants Popup */}
                    {activeMeetingManageId === meeting.id && (
                      <div ref={manageParticipantsRef} className="absolute top-[80%] right-5 mt-2 w-[480px] bg-white border border-[#E5E7EB] rounded-lg shadow-xl z-[60] p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="relative flex-1">
                            <button
                              type="button"
                              onClick={() => setIsManageTeamDropdownOpen(!isManageTeamDropdownOpen)}
                              className="w-full flex items-center justify-between bg-white border border-[#E5E7EB] rounded-md px-3 py-1.5 text-[13px] text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                            >
                              <span className="truncate">
                                {teams.find((t: any) => t._id === manageSelectedTeamId)?.name || 'Select a Team'}
                              </span>
                              <ChevronDown size={14} className="text-[#9CA3AF]" />
                            </button>
                            {isManageTeamDropdownOpen && (
                              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-md shadow-lg py-1 z-50 max-h-[160px] overflow-y-auto">
                                {teams.map((team: any) => (
                                  <button
                                    key={team._id}
                                    type="button"
                                    onClick={() => {
                                      setManageSelectedTeamId(team._id);
                                      setIsManageTeamDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-[13px] text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                                  >
                                    {team.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="relative flex-1">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                            <input
                              type="text"
                              placeholder="Search teammates..."
                              value={manageSearchQuery}
                              onChange={(e) => setManageSearchQuery(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 border border-[#E5E7EB] rounded-md text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none"
                            />
                          </div>
                        </div>

                        {manageTeamMembers.length > 0 && (
                          <div className="flex items-center justify-between mb-3 px-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                manageTeamMembers.filter((m: any) => m.clerkId !== user?.id && !meeting.attendees?.some((a: any) => a.clerkId === m.clerkId) && !meeting.pendingInvitees?.some((a: any) => a.clerkId === m.clerkId)).length > 0 &&
                                manageTeamMembers.filter((m: any) => m.clerkId !== user?.id && !meeting.attendees?.some((a: any) => a.clerkId === m.clerkId) && !meeting.pendingInvitees?.some((a: any) => a.clerkId === m.clerkId)).every((m: any) => newParticipants.includes(m.clerkId))
                              }
                              onChange={(e) => {
                                const eligibleMembers = manageTeamMembers.filter((m: any) => m.clerkId !== user?.id && !meeting.attendees?.some((a: any) => a.clerkId === m.clerkId) && !meeting.pendingInvitees?.some((a: any) => a.clerkId === m.clerkId));
                                if (e.target.checked) {
                                  const idsToAdd = eligibleMembers.map((m: any) => m.clerkId);
                                  setNewParticipants(Array.from(new Set([...newParticipants, ...idsToAdd])));
                                } else {
                                  const idsToRemove = eligibleMembers.map((m: any) => m.clerkId);
                                  setNewParticipants(newParticipants.filter((id: string) => !idsToRemove.includes(id)));
                                }
                              }}
                              className="w-4 h-4 text-[#4F46E5] border-[#D1D5DB] rounded focus:ring-[#4F46E5]"
                            />
                            <span className="text-[13px] font-[500] text-[#374151]">Select all members of this team</span>
                            </label>
                            <span className="text-[12px] font-[500] text-[#6B7280]">{newParticipants.length} selected</span>
                          </div>
                        )}

                        <div className="max-h-[200px] overflow-y-auto border border-[#E5E7EB] rounded-lg divide-y divide-[#E5E7EB] mb-3">
                          {isLoadingManageMembers ? (
                            <div className="p-3 text-[13px] text-[#6B7280] text-center">Loading...</div>
                          ) : manageTeamMembers.filter((m: any) => m.clerkId !== user?.id && m.name?.toLowerCase().includes(manageSearchQuery.toLowerCase())).length === 0 ? (
                            <div className="p-3 text-[13px] text-[#6B7280] text-center">No team members found</div>
                          ) : manageTeamMembers
                              .filter((m: any) => m.clerkId !== user?.id && m.name?.toLowerCase().includes(manageSearchQuery.toLowerCase()))
                              .map((member: any) => {
                                const isAlreadyParticipant = meeting.attendees.some((a: any) => a.clerkId === member.clerkId);
                                const isPendingInvite = meeting.pendingInvitees?.some((a: any) => a.clerkId === member.clerkId);
                                const isAlreadyInMeeting = isAlreadyParticipant || isPendingInvite;
                                const isSelected = newParticipants.includes(member.clerkId);

                                return (
                                  <div key={member.clerkId} className="flex items-center justify-between p-3 hover:bg-[#F9FAFB] transition-colors">
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        checked={isAlreadyInMeeting || isSelected}
                                        disabled={isAlreadyInMeeting}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setNewParticipants([...newParticipants, member.clerkId]);
                                          } else {
                                            setNewParticipants(newParticipants.filter((id) => id !== member.clerkId));
                                          }
                                        }}
                                        className="w-4 h-4 text-[#4F46E5] border-[#D1D5DB] rounded focus:ring-[#4F46E5] disabled:opacity-50"
                                      />
                                      {member.profileImage ? (
                                        <img src={member.profileImage} alt={member.name} className="w-6 h-6 rounded-full object-cover" />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: getAvatarColor(member.clerkId) }}>
                                          {getInitials(member.name)}
                                        </div>
                                      )}
                                      <span className="text-[13px] font-[500] text-[#111827]">{member.name}</span>
                                    </div>
                                    {isAlreadyInMeeting && (
                                      <button
                                        onClick={() => setRemoveConfirmParticipant({ meetingId: meeting.id, clerkId: member.clerkId, name: member.name })}
                                        className="text-[#9CA3AF] hover:text-[#EF4444] p-1 rounded-md hover:bg-[#FEE2E2] transition-colors"
                                        title="Remove participant"
                                      >
                                        <X size={14} />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                        </div>
                        
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setActiveMeetingManageId(null)}
                            className="px-3 py-1.5 text-[13px] font-[500] text-[#374151] hover:bg-[#F3F4F6] rounded-md transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => inviteToMeeting({ id: meeting.id, participantClerkIds: newParticipants })}
                            disabled={newParticipants.length === 0 || isInvitingToMeeting}
                            className="px-3 py-1.5 text-[13px] font-[500] text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-md transition-colors disabled:opacity-50"
                          >
                            {isInvitingToMeeting ? 'Inviting...' : 'Invite'}
                          </button>
                        </div>

                        {removeConfirmParticipant?.meetingId === meeting.id && (
                          <div ref={removeConfirmRef} className="absolute top-0 -right-[320px] w-[300px] bg-white border border-[#E5E7EB] rounded-lg shadow-xl p-5 z-[70]">
                            <h3 className="text-[16px] font-[600] text-[#111827] mb-2">Remove Participant</h3>
                            <p className="text-[13px] text-[#4B5563] mb-5">
                              Do you really want to remove <span className="font-semibold text-[#111827]">{removeConfirmParticipant?.name}</span> from this meeting?
                            </p>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setRemoveConfirmParticipant(null)}
                                className="px-3 py-1.5 text-[13px] font-[500] text-[#374151] hover:bg-[#F3F4F6] rounded-md transition-colors"
                              >
                                No
                              </button>
                              <button
                                onClick={() => removeConfirmParticipant && removeMeetingParticipant({ id: removeConfirmParticipant.meetingId, participantClerkId: removeConfirmParticipant.clerkId })}
                                disabled={isRemovingParticipant}
                                className="px-3 py-1.5 text-[13px] font-[500] text-white bg-[#EF4444] hover:bg-[#DC2626] rounded-md transition-colors disabled:opacity-50"
                              >
                                {isRemovingParticipant ? 'Removing...' : 'Yes'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
              <div className="border-t border-[#F3F4F6] p-3 text-center mt-auto shrink-0">
                {upcomingMeetings.length > 0 && (
                  <button onClick={() => navigate('/dashboard?tab=meetings')} className="text-[#4F46E5] text-[13px] font-[400] hover:underline">
                    See all meetings &rarr;
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column — Recent AI Summaries */}
          <div className="hidden md:flex w-[42%] flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-[16px] font-[600] text-[#111827]">Recent AI Summaries</h2>
            </div>
            <div className="flex flex-col gap-[12px] flex-1">
              {isLoadingRecent ? (
                <div className="text-[#6B7280] text-[14px]">Loading recent meetings...</div>
              ) : recentMeetings.length === 0 ? (
                <div className="text-[#6B7280] text-[14px]">No recent meetings</div>
              ) : recentMeetings.slice(0, 3).map((summary: any) => {
                const meetingDate = new Date(summary.startTime || summary.date);
                let dateLabel = format(meetingDate, 'MMM d');
                if (isToday(meetingDate)) dateLabel = 'Today';
                else if (isYesterday(meetingDate)) dateLabel = 'Yesterday';
                
                const summaryText = summary.summary ? summary.summary : 'Summary pending';
                const actionItemsCount = summary.actionItems?.length || 0;

                return (
                <div 
                  key={summary.id} 
                  className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] p-[16px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] hover:border-[#D1D5DB] transition-colors cursor-pointer flex-1 flex flex-col justify-center"
                  onClick={() => handleViewSummary(summary.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-[28px] h-[28px] rounded-[6px] bg-[#EEF2FF] flex items-center justify-center flex-shrink-0 relative">
                        <FileText size={14} className="text-[#4F46E5]" />
                        <Sparkles size={8} className="text-[#4F46E5] absolute top-[4px] right-[4px]" />
                      </div>
                      <h4 className="text-[15px] font-[600] text-[#111827] truncate">{summary.title}</h4>
                    </div>
                    <span className="bg-[#F3F4F6] text-[#6B7280] text-[12px] font-[400] px-[8px] py-[2px] rounded-[6px] flex-shrink-0">
                      {dateLabel}
                    </span>
                  </div>
                  
                  <p className="text-[13px] text-[#6B7280] font-[400] line-clamp-2 leading-[1.5] mb-3">
                    {summaryText}
                  </p>
                  
                  {actionItemsCount > 0 ? (
                    <div className="flex items-center gap-1 text-[12px] font-[400] text-[#4F46E5]">
                      {actionItemsCount} action item{actionItemsCount !== 1 ? 's' : ''}
                      <ArrowRight size={12} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[12px] font-[400] text-[#6B7280]">
                      No action items
                    </div>
                  )}
                </div>
                );
              })}
            </div>
            {recentMeetings.length > 0 && (
              <div className="mt-4 text-center">
                <button onClick={() => navigate('/dashboard?tab=meetings')} className="text-[#4F46E5] text-[13px] font-[400] hover:underline">
                  View All &rarr;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Section 5 — My Action Items */}
        <div className="mt-[44px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-[600] text-[#111827]">My Action Items</h2>
            <button onClick={() => navigate('/tasks')} className="text-[#4F46E5] text-[13px] font-[400] hover:underline">Go to Task Board &rarr;</button>
          </div>
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] shadow-[0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex flex-col">
              {myOpenTasks.length === 0 ? (
                <div className="p-[16px] text-[#6B7280] text-[14px]">No open action items assigned to you.</div>
              ) : myOpenTasks.map((task: any, index: number) => (
                <div 
                  key={task.id} 
                  className={`p-[16px] flex items-center justify-between hover:bg-[#F9FAFB] transition-colors group ${index !== myOpenTasks.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}
                >
                  <div className="flex items-center gap-4 flex-1 overflow-hidden">
                    <input 
                      type="checkbox" 
                      checked={false}
                      onChange={() => completeTask(task.id)}
                      className="w-[16px] h-[16px] border border-[#D1D5DB] rounded-[4px] text-[#4F46E5] focus:ring-[#4F46E5] cursor-pointer appearance-none checked:bg-[#4F46E5] checked:border-transparent flex-shrink-0 relative checked:after:content-['✓'] checked:after:absolute checked:after:text-white checked:after:text-[10px] checked:after:left-[3px] checked:after:top-[0px]"
                    />
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[14px] font-[400] truncate transition-all text-[#111827]">
                        {task.title}
                      </span>
                      {task.sourceMeetingTitle && (
                        <span className="bg-[#F3F4F6] text-[#6B7280] text-[12px] font-[400] px-[8px] py-[2px] rounded-[6px] flex-shrink-0">
                          From: {task.sourceMeetingTitle}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    {task.dueDate && new Date(task.dueDate) < new Date() && (
                      <span className="bg-[#FEF2F2] text-[#DC2626] text-[12px] font-[400] px-[8px] py-[2px] rounded-[6px]">
                        Overdue
                      </span>
                    )}
                    <span className="text-[12px] font-[400] text-[#9CA3AF]">{task.due}</span>
                    {task.assignee?.profileImage ? (
                      <img 
                        src={task.assignee.profileImage} 
                        alt={task.assignee.name}
                        title={task.assignee.name}
                        className="w-[24px] h-[24px] rounded-full border border-[#FFFFFF] object-cover shadow-sm"
                      />
                    ) : (
                      <div 
                        className="w-[24px] h-[24px] rounded-full border border-[#FFFFFF] flex items-center justify-center text-white text-[9px] font-bold shadow-sm transition-opacity opacity-100"
                        style={{ background: task.assignee?.color || '#9CA3AF' }}
                        title={task.assignee?.name || 'Unassigned'}
                      >
                        {task.assignee?.initials || '?'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
      </div>
      
      {/* Modals */}
      {isNewMeetingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB]">
              <h3 className="text-[16px] font-[600] text-[#111827]">Create New Meeting</h3>
              <button onClick={() => setIsNewMeetingModalOpen(false)} className="text-[#9CA3AF] hover:text-[#4B5563] transition-colors p-1 rounded-full hover:bg-[#F3F4F6]">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitNewMeeting} className="p-5">
              <div className="mb-5">
                <label className="block text-[13px] font-[500] text-[#374151] mb-2">Meeting Topic</label>
                <input 
                  type="text" 
                  value={meetingTopic}
                  onChange={(e) => setMeetingTopic(e.target.value)}
                  className="w-full border border-[#D1D5DB] rounded-lg px-4 py-2.5 text-[14px] focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent outline-none transition-all"
                  autoFocus
                />
              </div>
              <div className="mb-5 flex items-center justify-between">
                <div className="pr-3">
                  <label className="block text-[13px] font-[500] text-[#374151] mb-0.5">Make this meeting open for all</label>
                  <p className="text-[12px] text-[#9CA3AF]">Anyone with the link or code joins instantly — no admit needed</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpenForAll(prev => !prev)}
                  className={`w-10 h-[22px] rounded-full relative transition-colors flex-shrink-0 ${isOpenForAll ? 'bg-[#4F46E5]' : 'bg-[#D1D5DB]'}`}
                >
                  <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform duration-200 ${isOpenForAll ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setIsNewMeetingModalOpen(false)} className="px-4 py-2 text-[14px] font-[500] text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isCreating || !meetingTopic.trim()} className="px-4 py-2 bg-[#4F46E5] text-white text-[14px] font-[500] rounded-lg hover:bg-[#4338CA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {isCreating ? 'Creating...' : 'Create Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB]">
              <h3 className="text-[16px] font-[600] text-[#111827]">Join with Code</h3>
              <button onClick={() => setIsJoinModalOpen(false)} className="text-[#9CA3AF] hover:text-[#4B5563] transition-colors p-1 rounded-full hover:bg-[#F3F4F6]">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitJoinMeeting} className="p-5">
              <div className="mb-5">
                <label className="block text-[13px] font-[500] text-[#374151] mb-2">Meeting ID</label>
                <input 
                  type="text" 
                  value={joinMeetingId}
                  onChange={(e) => setJoinMeetingId(e.target.value)}
                  className="w-full border border-[#D1D5DB] rounded-lg px-4 py-2.5 text-[14px] focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent outline-none transition-all"
                  placeholder="Enter meeting ID"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setIsJoinModalOpen(false)} className="px-4 py-2 text-[14px] font-[500] text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={!joinMeetingId.trim()} className="px-4 py-2 bg-[#4F46E5] text-white text-[14px] font-[500] rounded-lg hover:bg-[#4338CA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Join Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB]">
              <h3 className="text-[16px] font-[600] text-[#111827]">Schedule Meeting</h3>
              <button onClick={() => { setIsScheduleModalOpen(false); setScheduleSuccessMessage(null); setScheduleSearchQuery(''); setScheduleOpenForAll(false); }} className="text-[#9CA3AF] hover:text-[#4B5563] transition-colors p-1 rounded-full hover:bg-[#F3F4F6]">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitScheduleMeeting} className="p-5">
              {scheduleSuccessMessage ? (
                <div className="py-6 text-center">
                  <div className="text-[#10B981] text-[14px] font-medium mb-4">{scheduleSuccessMessage}</div>
                  <button
                    type="button"
                    onClick={() => { setIsScheduleModalOpen(false); setScheduleSuccessMessage(null); setScheduleSearchQuery(''); }}
                    className="px-4 py-2 bg-[#4F46E5] text-white text-[14px] font-[500] rounded-lg hover:bg-[#4338CA] transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-5">
                    <label className="block text-[13px] font-[500] text-[#374151] mb-2">Meeting Topic</label>
                    <input 
                      type="text" 
                      value={scheduleTitle}
                      onChange={(e) => setScheduleTitle(e.target.value)}
                      className="w-full border border-[#D1D5DB] rounded-lg px-4 py-2.5 text-[14px] focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent outline-none transition-all"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="mb-5">
                    <label className="block text-[13px] font-[500] text-[#374151] mb-2">Date & Time</label>
                    <input 
                      type="datetime-local" 
                      min={new Date().toISOString().slice(0, 16)}
                      value={scheduleDateTime}
                      onChange={(e) => setScheduleDateTime(e.target.value)}
                      className="w-full border border-[#D1D5DB] rounded-lg px-4 py-2.5 text-[14px] focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent outline-none transition-all"
                      required
                    />
                  </div>
                  
                  <div className="mb-5 flex items-center justify-between">
                    <div className="pr-3">
                      <label className="block text-[13px] font-[500] text-[#374151] mb-0.5">Make this meeting open for all</label>
                      <p className="text-[12px] text-[#9CA3AF]">Anyone with the link or code joins instantly — no admit needed</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setScheduleOpenForAll(prev => !prev)}
                      className={`w-10 h-[22px] rounded-full relative transition-colors flex-shrink-0 ${scheduleOpenForAll ? 'bg-[#4F46E5]' : 'bg-[#D1D5DB]'}`}
                    >
                      <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform duration-200 ${scheduleOpenForAll ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[13px] font-[500] text-[#374151]">Add Participants</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsScheduleTeamDropdownOpen(!isScheduleTeamDropdownOpen)}
                          className="flex items-center gap-1.5 bg-white border border-[#E5E7EB] rounded-md px-2.5 py-1 text-[12px] font-[500] text-[#374151] hover:border-[#D1D5DB] transition-colors"
                        >
                          <div
                            className="w-4 h-4 rounded-[4px] flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                            style={{ background: getAvatarColor(scheduleSelectedTeamId || '') }}
                          >
                            {getInitials(teams.find((t) => t._id === scheduleSelectedTeamId)?.name)}
                          </div>
                          <span className="truncate max-w-[100px]">{teams.find((t) => t._id === scheduleSelectedTeamId)?.name || 'Select team'}</span>
                          <ChevronDown size={12} />
                        </button>
                        {isScheduleTeamDropdownOpen && (
                          <div className="absolute right-0 mt-1 w-48 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-30 py-1 max-h-[200px] overflow-y-auto">
                            {teams.map((team) => (
                              <button
                                key={team._id}
                                type="button"
                                onClick={() => { setScheduleSelectedTeamId(team._id); setIsScheduleTeamDropdownOpen(false); }}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${team._id === scheduleSelectedTeamId ? 'bg-[#EEF2FF]' : 'hover:bg-[#F9FAFB]'}`}
                              >
                                <div
                                  className="w-5 h-5 rounded-[5px] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                                  style={{ background: getAvatarColor(team._id) }}
                                >
                                  {getInitials(team.name)}
                                </div>
                                <span className="text-[12px] font-[500] text-[#111827] truncate">{team.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                      <input
                        type="text"
                        placeholder="Search teammates..."
                        value={scheduleSearchQuery}
                        onChange={(e) => setScheduleSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-[#E5E7EB] rounded-md text-[12px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none"
                      />
                    </div>

                    {scheduleTeamMembers.length > 0 && (
                      <div className="flex items-center justify-between mb-3 px-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scheduleParticipants.length === scheduleTeamMembers.filter((m: any) => m.clerkId !== user?.id).length && scheduleTeamMembers.filter((m: any) => m.clerkId !== user?.id).length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setScheduleParticipants(
                                scheduleTeamMembers
                                  .filter((m: any) => m.clerkId !== user?.id)
                                  .map((m: any) => ({ clerkId: m.clerkId, name: m.name }))
                              );
                            } else {
                              setScheduleParticipants([]);
                            }
                          }}
                          className="w-4 h-4 text-[#4F46E5] border-[#D1D5DB] rounded focus:ring-[#4F46E5]"
                        />
                        <span className="text-[13px] font-[500] text-[#374151]">Select all members of this team</span>
                        </label>
                        <span className="text-[12px] font-[500] text-[#6B7280]">{scheduleParticipants.length} selected</span>
                      </div>
                    )}

                    <div className="max-h-[160px] overflow-y-auto border border-[#E5E7EB] rounded-lg divide-y divide-[#E5E7EB]">
                      {isLoadingScheduleMembers ? (
                        <div className="p-3 text-[13px] text-[#6B7280] text-center">Loading teammates...</div>
                      ) : scheduleTeamMembers.filter((m: any) => m.clerkId !== user?.id && m.name?.toLowerCase().includes(scheduleSearchQuery.toLowerCase())).length === 0 ? (
                        <div className="p-3 text-[13px] text-[#6B7280] text-center">No teammates found</div>
                      ) : scheduleTeamMembers
                          .filter((m: any) => m.clerkId !== user?.id && m.name?.toLowerCase().includes(scheduleSearchQuery.toLowerCase()))
                          .map((member: any) => {
                            const isSelected = scheduleParticipants.some(p => p.clerkId === member.clerkId);
                            return (
                              <label key={member.clerkId} className="flex items-center gap-3 p-3 hover:bg-[#F9FAFB] cursor-pointer transition-colors">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setScheduleParticipants([...scheduleParticipants, { clerkId: member.clerkId, name: member.name }]);
                                    } else {
                                      setScheduleParticipants(scheduleParticipants.filter((p) => p.clerkId !== member.clerkId));
                                    }
                                  }}
                                  className="w-4 h-4 text-[#4F46E5] border-[#D1D5DB] rounded focus:ring-[#4F46E5]"
                                />
                                {member.profileImage ? (
                                  <img src={member.profileImage} alt={member.name} className="w-6 h-6 rounded-full object-cover" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: getAvatarColor(member.clerkId) }}>
                                    {getInitials(member.name)}
                                  </div>
                                )}
                                <span className="text-[13px] font-[500] text-[#111827]">{member.name}</span>
                              </label>
                            );
                          })}
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsScheduleModalOpen(false);
                        setScheduleTitle('');
                        setScheduleDateTime('');
                        setScheduleParticipants([]);
                        setScheduleSuccessMessage(null);
                        setScheduleSearchQuery('');
                        setScheduleOpenForAll(false);
                      }} 
                      className="px-4 py-2 text-[14px] font-[500] text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isScheduling || !scheduleTitle.trim() || !scheduleDateTime} 
                      className="px-4 py-2 bg-[#4F46E5] text-white text-[14px] font-[500] rounded-lg hover:bg-[#4338CA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isScheduling ? 'Scheduling...' : 'Schedule Meeting'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Delete Meeting Modal */}
      {deleteMeetingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-[400px] shadow-lg">
            <h3 className="text-[18px] font-[600] text-[#111827] mb-2">Delete Meeting</h3>
            <p className="text-[14px] text-[#4B5563] mb-6">Do you want to delete this meeting?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteMeetingId(null)}
                className="px-4 py-2 text-[14px] font-[500] text-[#374151] hover:bg-[#F3F4F6] rounded-md transition-colors"
              >
                No
              </button>
              <button
                onClick={() => deleteMeeting(deleteMeetingId)}
                disabled={isDeletingMeeting}
                className="px-4 py-2 text-[14px] font-[500] text-white bg-[#EF4444] hover:bg-[#DC2626] rounded-md transition-colors disabled:opacity-50"
              >
                {isDeletingMeeting ? 'Deleting...' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Meeting Modal */}
      {leaveMeetingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-[400px] shadow-lg">
            <h3 className="text-[18px] font-[600] text-[#111827] mb-2">Leave Meeting</h3>
            <p className="text-[14px] text-[#4B5563] mb-6">Do you want to leave this meeting?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setLeaveMeetingId(null)}
                className="px-4 py-2 text-[14px] font-[500] text-[#374151] hover:bg-[#F3F4F6] rounded-md transition-colors"
              >
                No
              </button>
              <button
                onClick={() => leaveMeeting(leaveMeetingId)}
                disabled={isLeavingMeeting}
                className="px-4 py-2 text-[14px] font-[500] text-white bg-[#EF4444] hover:bg-[#DC2626] rounded-md transition-colors disabled:opacity-50"
              >
                {isLeavingMeeting ? 'Leaving...' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
