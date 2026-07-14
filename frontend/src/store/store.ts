import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ---------------------------
// DATA MODELS
// ---------------------------


export interface Attendee {
  initials: string;
  name: string;
  color: string;
  clerkId?: string;
  profileImage?: string;
}

export interface ActionItem {
  id: string;
  task: string;
  assignee: Attendee;
  due: string;
  done: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  status: 'scheduled' | 'active' | 'completed';
  summary?: string;
  actionItems: ActionItem[];
  attendees: Attendee[];
  transcript?: { speaker: string; initials: string; color: string; text: string; time?: string }[];
  chat?: { sender: string; initials: string; color: string; text: string; time: string }[];
  startTime?: string;
  endTime?: string;
  estimatedDuration?: number;
  callId?: string;
  hostClerkId?: string;
  joinCode?: string;
  openForAll?: boolean;
  ratings?: { clerkId: string; rating: number | null; skipped: boolean; ratedAt?: string }[];
  pendingInvitees?: Attendee[];
}

export interface Task {
  id: string;
  title: string;
  status: 'backlog' | 'in-progress' | 'in-review' | 'done';
  assignee: Attendee;
  priority: 'high' | 'medium' | 'low';
  due: string;
  sourceMeetingId?: string;
  sourceMeetingTitle?: string;
  sourceActionItem?: string;
  description?: string;
  dueDate?: string | null;
  comments?: { _id?: string; clerkId: string; text: string; createdAt: string }[];
}


// ---------------------------
// MEETINGS STORE
// ---------------------------
const MOCK_MEETINGS: Meeting[] = [
  {
    id: 'm1',
    title: 'Product Roadmap Sync',
    date: new Date().toISOString(),
    duration: '48 min',
    status: 'completed',
    summary: 'Decided to prioritize the mobile app launch for Q3. API rate limiting discussion tabled to next sprint.',
    actionItems: [
      { id: 'a1', task: 'Draft Q3 mobile launch communication', assignee: { initials: 'SA', name: 'Sarah Anderson', color: '#4F46E5' }, due: 'Jun 12', done: true },
    ],
    attendees: [
      { initials: 'SA', name: 'Sarah Anderson', color: '#4F46E5' },
      { initials: 'MK', name: 'Marcus Kim', color: '#10B981' },
      { initials: 'JL', name: 'Julia Liu', color: '#F59E0B' }
    ],
    transcript: [
      { speaker: "Sarah Anderson", initials: "SA", color: "#4F46E5", time: "10:02 AM", text: "Alright everyone, thanks for joining. Let's kick off the Q3 roadmap review." },
      { speaker: "Marcus Kim", initials: "MK", color: "#10B981", time: "10:03 AM", text: "Hey Sarah. Quick question before we start - did we get the final numbers from the marketing campaign?" },
      { speaker: "Sarah Anderson", initials: "SA", color: "#4F46E5", time: "10:03 AM", text: "Yes, they're in the shared doc. We can cover that in the second half. For now, let's focus on the mobile app launch." },
      { speaker: "Julia Liu", initials: "JL", color: "#F59E0B", time: "10:04 AM", text: "I've pushed the latest designs to Figma. We're about 90% there with the core flows." }
    ],
    chat: [
      { sender: "Marcus Kim", initials: "MK", color: "#10B981", time: "10:01 AM", text: "I might have to drop 5 mins early for another call." },
      { sender: "Julia Liu", initials: "JL", color: "#F59E0B", time: "10:04 AM", text: "Link to designs: figma.com/file/xyz" }
    ]
  },
  {
    id: 'm2',
    title: 'Q3 Planning & Roadmap Review',
    date: new Date(Date.now() + 86400000).toISOString(),
    duration: '60 min',
    status: 'scheduled',
    summary: '',
    actionItems: [],
    attendees: [
      { initials: 'SA', name: 'Sarah Anderson', color: '#4F46E5' },
      { initials: 'MK', name: 'Marcus Kim', color: '#10B981' },
      { initials: 'JL', name: 'Julia Liu', color: '#F59E0B' },
      { initials: 'RD', name: 'Ryan Davis', color: '#EF4444' }
    ],
    transcript: [],
    chat: []
  }
];

interface MeetingsState {
  meetings: Meeting[];
  addMeeting: (meeting: Meeting) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
}

export const useMeetingStore = create<MeetingsState>()(
  persist(
    (set) => ({
      meetings: MOCK_MEETINGS,
      addMeeting: (meeting) => set((state) => ({ meetings: [meeting, ...state.meetings] })),
      updateMeeting: (id, updates) => set((state) => ({
        meetings: state.meetings.map(m => m.id === id ? { ...m, ...updates } : m)
      })),
    }),
    { name: 'intellmeet-meetings' }
  )
);

// ---------------------------
// TASKS STORE
// ---------------------------
const MOCK_TASKS: Task[] = [
  { id: 't1', title: 'Implement SSO integration for enterprise accounts', sourceMeetingTitle: 'Client Discovery — Acme Corp', priority: 'high', assignee: { initials: 'RD', color: '#EF4444', name: 'Ryan Davis' }, due: 'Jun 17', status: 'backlog' },
  { id: 't5', title: 'Mobile app — core auth flow testing', sourceMeetingTitle: 'Engineering Standup', priority: 'high', assignee: { initials: 'MK', color: '#10B981', name: 'Marcus Kim' }, due: 'Jun 14', status: 'in-progress' },
  { id: 't10', title: 'Q3 stakeholder communication draft', sourceMeetingTitle: 'Q3 Planning Call', priority: 'low', assignee: { initials: 'SA', color: '#4F46E5', name: 'Sarah Anderson' }, due: 'Jun 12', status: 'done' },
];

interface TasksState {
  tasks: Task[];
  addTask: (task: Task) => void;
  updateTaskStatus: (id: string, status: Task['status']) => void;
}

export const useTaskStore = create<TasksState>()(
  persist(
    (set) => ({
      tasks: MOCK_TASKS,
      addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
      updateTaskStatus: (id, status) => set((state) => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, status } : t)
      })),
    }),
    { name: 'intellmeet-tasks' }
  )
);

// ---------------------------
// TEAMS STORE
// ---------------------------
export interface Team {
  _id: string;
  name: string;
  slackWebhookUrl?: string;
  notionToken?: string;
  notionPageId?: string;
}

interface TeamState {
  teams: Team[];
  currentTeamId: string | null;
  setTeams: (teams: Team[]) => void;
  setCurrentTeamId: (id: string) => void;
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set) => ({
      teams: [],
      currentTeamId: null,
      setTeams: (teams) => set((state) => {
        const hasCurrent = teams.some(t => t._id === state.currentTeamId);
        const nextId = (state.currentTeamId === null || !hasCurrent) && teams.length > 0 
          ? teams[0]._id 
          : (teams.length === 0 ? null : state.currentTeamId);
        return { teams, currentTeamId: nextId };
      }),
      setCurrentTeamId: (id) => set({ currentTeamId: id }),
    }),
    { name: 'intellmeet-teams' }
  )
);
