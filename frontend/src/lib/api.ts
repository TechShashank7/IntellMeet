import { useMeetingStore, useTaskStore } from '../store/store';
import type { Meeting, Task } from '../store/store';
import { getInitials, getAvatarColor } from './utils';
import { format } from 'date-fns';

// Set to 0 to test without delay, or remove when swapping for real API.
const SIMULATED_DELAY = 300;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

function mapSessionToMeeting(session: any): Meeting {
  return {
    id: session._id,
    title: session.topic,
    date: session.startTime, // raw ISO string, unchanged
    duration: '', // raw field
    status: session.status,
    summary: session.summary || '',
    actionItems: (session.actionItems || []).map((ai: any) => ({
      id: ai._id || Math.random().toString(),
      title: ai.text || 'Untitled task',
      meeting: session.topic || 'Meeting',
      assignee: { name: 'Unassigned', initials: '?', color: '#9CA3AF' },
      dueDate: ai.dueDate ? format(new Date(ai.dueDate), 'MMM d') : 'No due date',
      isOverdue: ai.dueDate ? new Date(ai.dueDate) < new Date() : false
    })),
    attendees: (session.resolvedParticipants || []).map((u: any) => ({
      name: u.name,
      initials: getInitials(u.name),
      color: getAvatarColor(u.clerkId),
      clerkId: u.clerkId,
      profileImage: u.profileImage || ''
    })),
    startTime: session.startTime,
    endTime: session.endTime,
    estimatedDuration: session.estimatedDuration,
    callId: session.callId,
    hostClerkId: session.host?.clerkId,
    joinCode: session.joinCode,
    openForAll: session.openForAll ?? false,
    ratings: session.ratings || [],
    pendingInvitees: (session.pendingInvitees || []).map((u: any) => ({
      name: u.name,
      initials: getInitials(u.name),
      color: getAvatarColor(u.clerkId),
      clerkId: u.clerkId,
      profileImage: u.profileImage || ''
    }))
  };
}

export const api = {
  getTeams: async (token: string): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/teams`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch teams');
      return await res.json();
    } catch (err) {
      console.warn('Failed to fetch real teams, falling back to mock data', err);
      // Fall back to existing mock team data (or a safe default if none existed)
      return [
        { _id: '1', name: 'Product Team' },
        { _id: '2', name: 'Engineering' }
      ];
    }
  },

  createTeam: async (token: string, name: string): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Failed to create team');
    return await res.json();
  },

  getTeamMembers: async (teamId: string, token: string): Promise<any[]> => {
    console.log('getTeamMembers called with teamId:', teamId);
    try {
      const res = await fetch(`${API_BASE_URL}/teams/${teamId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      console.log('getTeamMembers response status:', res.status, 'data:', data);
      if (!res.ok) throw new Error('Failed to fetch team members: ' + JSON.stringify(data));
      return data;
    } catch (err) {
      console.warn('Failed to fetch team members', err);
      return [];
    }
  },

  inviteTeamMember: async (teamId: string, token: string, email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/teams/${teamId}/members/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email })
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, message: data.message || 'Failed to invite team member' };
      }
      return { success: true, message: 'Invited successfully' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error or unable to invite' };
    }
  },

  getMyInvites: async (token: string): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/invites`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch invites');
      return await res.json();
    } catch (err) {
      console.warn('Failed to fetch invites', err);
      return [];
    }
  },

  respondToInvite: async (id: string, action: 'accept' | 'decline', token: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/invites/${id}/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Failed to ${action} invite`);
  },

  getMyMeetingInvites: async (token: string): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/meetings/invites/my`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch meeting invites');
      return await res.json();
    } catch (err) {
      console.warn('Failed to fetch meeting invites', err);
      return [];
    }
  },

  respondToMeetingInvite: async (id: string, action: 'accept' | 'decline', token: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/meetings/invites/${id}/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Failed to ${action} meeting invite`);
  },

  leaveTeam: async (teamId: string, token: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/teams/${teamId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to leave team');
    }
  },

  removeTeamMember: async (teamId: string, clerkId: string, token: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/teams/${teamId}/members/${clerkId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to remove member');
    }
  },

  updateTeamIntegrations: async (teamId: string, token: string, updates: { slackWebhookUrl?: string, notionToken?: string, notionPageId?: string }): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/teams/${teamId}/integrations`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to update team integrations');
    }
    return await res.json();
  },

  getStreamToken: async (token: string): Promise<{ token: string; userId: string; userName: string; userImage: string }> => {
    const res = await fetch(`${API_BASE_URL}/chat/token`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to get Stream token');
    return await res.json();
  },

  joinMeeting: async (id: string, token: string): Promise<void> => {
    try {
      await fetch(`${API_BASE_URL}/meetings/${id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.warn('Failed to join meeting on backend', err);
    }
  },

  requestToJoinMeeting: async (id: string, token: string): Promise<{ status: 'admitted' | 'waiting' | 'denied' }> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/waiting-room/request`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to request to join meeting');
    return await res.json();
  },

  getWaitingRoomStatus: async (id: string, token: string): Promise<{ status: 'admitted' | 'waiting' | 'denied' }> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/waiting-room/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch waiting room status');
    return await res.json();
  },

  getWaitingRoom: async (id: string, token: string): Promise<any[]> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/waiting-room`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch waiting room');
    const data = await res.json();
    return data.waitingRoom || [];
  },

  admitParticipant: async (id: string, clerkId: string, token: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/waiting-room/${clerkId}/admit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to admit participant');
  },

  denyParticipant: async (id: string, clerkId: string, token: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/waiting-room/${clerkId}/deny`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to deny participant');
  },

  admitAllParticipants: async (id: string, token: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/waiting-room/admit-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to admit all participants');
  },

  endMeeting: async (id: string, token: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/end`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to end meeting on backend');
  },

  rateMeeting: async (id: string, token: string, payload: { rating?: number; skipped?: boolean }): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE_URL}/meetings/${id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to rate meeting');
    } catch (err) {
      console.warn('Failed to rate meeting', err);
    }
  },

  getMeetingStats: async (token: string): Promise<{ thisWeekCount: number; lastWeekCount: number }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/meetings/stats`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch meeting stats');
      return await res.json();
    } catch (err) {
      console.warn('Failed to fetch real meeting stats, falling back to zero', err);
      return { thisWeekCount: 0, lastWeekCount: 0 };
    }
  },

  getMeetingAnalytics: async (token: string, teamId?: string): Promise<any> => {
    try {
      const qs = teamId ? `?teamId=${teamId}` : '';
      const res = await fetch(`${API_BASE_URL}/meetings/analytics${qs}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return await res.json();
    } catch (err) {
      console.warn('Failed to fetch real analytics, falling back to empty', err);
      return {
        totalMeetings: 0, avgDurationMinutes: 0, totalHours: 0, avgRating: null,
        ratingCount: 0, ratingDistribution: [], weeklyTrend: [],
        engagement: { avgAttendeesPerMeeting: 0, ratingResponseRate: 0, topParticipants: [] },
        productivity: null
      };
    }
  },

  // Meetings
  getMeetings: async (): Promise<Meeting[]> => {
    await delay(SIMULATED_DELAY);
    return useMeetingStore.getState().meetings;
  },

  createMeeting: async (token: string, topic: string, options?: { scheduledFor?: string; participantClerkIds?: string[]; openForAll?: boolean; teamId?: string }): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/meetings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ 
        topic, 
        openForAll: options?.openForAll ?? false,
        ...(options?.scheduledFor ? { scheduledFor: options.scheduledFor } : {}),
        ...(options?.participantClerkIds?.length ? { participantClerkIds: options.participantClerkIds } : {}),
        ...(options?.teamId ? { teamId: options.teamId } : {})
      })
    });
    if (!res.ok) throw new Error('Failed to create meeting');
    const data = await res.json();
    return data.session;
  },

  updateOpenForAll: async (id: string, token: string, openForAll: boolean): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/open-for-all`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ openForAll })
    });
    if (!res.ok) throw new Error('Failed to update meeting setting');
  },

  getRecordingsList: async (token: string): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/meetings/recordings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch recordings list');
      const data = await res.json();
      return data.sessions || [];
    } catch (err) {
      console.warn('Failed to fetch recordings list', err);
      return [];
    }
  },

  getRecordingDetail: async (id: string, token: string): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/meetings/recordings/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch recording detail');
    return await res.json();
  },

  downloadMeetingNotesPdf: async (id: string, token: string, filename: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/export`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to export meeting notes');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-notes.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 1000);
  },

  downloadMeetingSummaryPdf: async (id: string, token: string, filename: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/export?type=summary`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to export meeting summary');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-summary.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 1000);
  },

  shareMeetingToSlack: async (id: string, token: string): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/share/slack`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to share meeting to Slack');
    }
    return await res.json();
  },

  syncMeetingToNotion: async (id: string, token: string): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/share/notion`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to sync meeting to Notion');
    }
    return await res.json();
  },

  getUpcomingMeetings: async (token: string): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/meetings/upcoming`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch upcoming meetings');
      const data = await res.json();
      return (data.sessions || []).map(mapSessionToMeeting);
    } catch (err) {
      console.warn('Failed to fetch real upcoming meetings, falling back to mock data', err);
      return useMeetingStore.getState().meetings.filter(m => m.status === 'scheduled');
    }
  },

  deleteMeeting: async (id: string, token: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to delete meeting');
  },

  inviteToMeeting: async (id: string, participantClerkIds: string[], token: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/invite`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ participantClerkIds })
    });
    if (!res.ok) throw new Error('Failed to invite to meeting');
  },

  removeMeetingParticipant: async (id: string, participantClerkId: string, token: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/remove`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ participantClerkId })
    });
    if (!res.ok) throw new Error('Failed to remove participant');
  },

  leaveMeeting: async (id: string, token: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/meetings/${id}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to leave meeting');
  },

  getRecentMeetings: async (token: string): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/meetings/my-recent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch recent meetings');
      const data = await res.json();
      return (data.sessions || []).map(mapSessionToMeeting);
    } catch (err) {
      console.warn('Failed to fetch real recent meetings, falling back to mock data', err);
      return useMeetingStore.getState().meetings.filter(m => m.status === 'completed');
    }
  },
  
  getMeeting: async (id: string, token?: string | null): Promise<Meeting | undefined> => {
    if (token) {
      try {
        const res = await fetch(`${API_BASE_URL}/meetings/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.session) return mapSessionToMeeting(data.session);
        }
      } catch (err) {
        console.warn('Failed to fetch real meeting, falling back to mock data', err);
      }
    }
    await delay(SIMULATED_DELAY);
    return useMeetingStore.getState().meetings.find(m => m.id === id);
  },

  getAISummary: async (meetingId: string, token: string): Promise<{ summary?: string; actionItems: any[]; status?: string }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/ai/meetings/${meetingId}/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch AI summary');
      return await res.json();
    } catch (err) {
      console.warn('Failed to fetch real AI summary, falling back to mock data', err);
      await delay(SIMULATED_DELAY);
      const meeting = useMeetingStore.getState().meetings.find(m => m.id === meetingId);
      if (!meeting) {
        throw new Error("Meeting not found");
      }
      return {
        summary: meeting.summary,
        actionItems: meeting.actionItems
      };
    }
  },

  // Tasks
  getTasks: async (teamId: string, token: string): Promise<Task[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/teams/${teamId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      return data.map((t: any) => {
        let frontendStatus: Task['status'] = 'backlog';
        if (t.status === 'in_progress') frontendStatus = 'in-progress';
        else if (t.status === 'in_review') frontendStatus = 'in-review';
        else if (t.status === 'done') frontendStatus = 'done';
        
        let assignee: { name: string; initials: string; color: string; clerkId?: string; profileImage?: string } = { name: 'Unassigned', initials: '?', color: '#9CA3AF', clerkId: t.assignee || undefined };
        if (t.assigneeInfo) {
          assignee = {
            name: t.assigneeInfo.name,
            initials: getInitials(t.assigneeInfo.name),
            color: getAvatarColor(t.assigneeInfo.clerkId),
            clerkId: t.assigneeInfo.clerkId,
            profileImage: t.assigneeInfo.profileImage || undefined
          };
        }

        return {
          id: t._id,
          title: t.title,
          status: frontendStatus,
          priority: t.priority || 'medium',
          due: t.dueDate ? format(new Date(t.dueDate), 'MMM d') : 'No due date',
          assignee,
          description: t.description || '',
          dueDate: t.dueDate || null,
          sourceActionItem: t.sourceActionItem || undefined,
          sourceMeetingId: t.sourceMeetingId || undefined,
          comments: t.comments || []
        };
      });
    } catch (err) {
      console.warn('Failed to fetch real tasks, falling back to mock data', err);
      return useTaskStore.getState().tasks;
    }
  },
  
  updateTaskStatus: async (id: string, status: Task['status'], token: string): Promise<void> => {
    try {
      let backendStatus = 'todo';
      if (status === 'in-progress') backendStatus = 'in_progress';
      else if (status === 'in-review') backendStatus = 'in_review';
      else if (status === 'done') backendStatus = 'done';
      
      const res = await fetch(`${API_BASE_URL}/tasks/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: backendStatus })
      });
      if (!res.ok) throw new Error('Failed to update task status');
    } catch (err) {
      console.warn('Failed to update real task status, falling back to mock data', err);
      useTaskStore.getState().updateTaskStatus(id, status);
    }
  },
  
  addTask: async (teamId: string, token: string, task: { title: string; assignee?: string | null; dueDate?: string | null; priority?: 'low' | 'medium' | 'high'; sourceActionItem?: string; sourceMeetingId?: string }): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE_URL}/teams/${teamId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(task)
      });
      if (!res.ok) throw new Error('Failed to add task');
    } catch (err) {
      console.warn('Failed to add real task, falling back to mock data', err);
      useTaskStore.getState().addTask({
        id: `mock-t-${Date.now()}`,
        title: task.title,
        status: 'backlog',
        priority: task.priority || 'medium',
        due: task.dueDate ? format(new Date(task.dueDate), 'MMM d') : 'No due date',
        assignee: { name: task.assignee || 'Unassigned', initials: '?', color: '#9CA3AF' }
      });
    }
  },

  updateTask: async (id: string, token: string, updates: { title?: string; description?: string; assignee?: string | null; dueDate?: string | null; priority?: string }): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE_URL}/tasks/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update task');
    } catch (err) {
      console.warn('Failed to update real task', err);
    }
  },

  deleteTask: async (id: string, token: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error('Failed to delete task');
  },

  addTaskComment: async (id: string, text: string, token: string): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/tasks/${id}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error('Failed to add task comment');
    return await res.json();
  }
};
