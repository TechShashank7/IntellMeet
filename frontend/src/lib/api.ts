import { useMeetingStore, useTaskStore } from '../store/store';
import type { Meeting, Task } from '../store/store';

// Set to 0 to test without delay, or remove when swapping for real API.
const SIMULATED_DELAY = 300;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const api = {
  // Meetings
  getMeetings: async (): Promise<Meeting[]> => {
    await delay(SIMULATED_DELAY);
    return useMeetingStore.getState().meetings;
  },
  
  getMeeting: async (id: string): Promise<Meeting | undefined> => {
    await delay(SIMULATED_DELAY);
    return useMeetingStore.getState().meetings.find(m => m.id === id);
  },

  getAISummary: async (meetingId: string): Promise<{ summary?: string; actionItems: any[] }> => {
    await delay(SIMULATED_DELAY);
    const meeting = useMeetingStore.getState().meetings.find(m => m.id === meetingId);
    if (!meeting) {
      throw new Error("Meeting not found");
    }
    return {
      summary: meeting.summary,
      actionItems: meeting.actionItems
    };
  },

  // Tasks
  getTasks: async (): Promise<Task[]> => {
    await delay(SIMULATED_DELAY);
    return useTaskStore.getState().tasks;
  },
  
  updateTaskStatus: async (id: string, status: Task['status']): Promise<void> => {
    await delay(SIMULATED_DELAY);
    useTaskStore.getState().updateTaskStatus(id, status);
  },
  
  addTask: async (task: Task): Promise<void> => {
    await delay(SIMULATED_DELAY);
    useTaskStore.getState().addTask(task);
  }
};
