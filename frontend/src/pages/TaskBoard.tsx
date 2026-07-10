import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { useTeamStore } from '../store/store';
import type { Task } from '../store/store';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreHorizontal, 
  Calendar,
  AlertCircle
} from 'lucide-react';

const COLUMNS = [
  { id: 'backlog', title: 'Backlog', color: '#6B7280' },
  { id: 'in-progress', title: 'In Progress', color: '#3B82F6' },
  { id: 'in-review', title: 'In Review', color: '#F59E0B' },
  { id: 'done', title: 'Done', color: '#10B981' }
];

export default function TaskBoard() {
  const queryClient = useQueryClient();
  const { currentTeamId } = useTeamStore();
  const { getToken } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Filter states
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  // Task detail modal states
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState<string>('medium');

  // Mouse coords to differentiate click from drag
  const [dragStartCoords, setDragStartCoords] = useState<{ x: number; y: number } | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', currentTeamId],
    queryFn: async () => api.getTasks(currentTeamId || '', await getToken() || ''),
    enabled: !!currentTeamId,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['teamMembers', currentTeamId],
    queryFn: async () => api.getTeamMembers(currentTeamId || '', await getToken() || ''),
    enabled: !!currentTeamId,
  });

  const { mutate: updateStatus } = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: Task['status'] }) => 
      api.updateTaskStatus(id, status, await getToken() || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', currentTeamId] });
    }
  });

  const { mutate: addTask } = useMutation({
    mutationFn: async (taskData: { title: string; assignee?: string; dueDate?: string; priority?: 'low' | 'medium' | 'high' }) => 
      api.addTask(currentTeamId || '', await getToken() || '', taskData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', currentTeamId] });
      setIsModalOpen(false);
      setNewTaskTitle('');
      setNewTaskAssignee('');
      setNewTaskDue('');
      setNewTaskPriority('medium');
    }
  });

  const { mutate: updateTask } = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => 
      api.updateTask(id, await getToken() || '', updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', currentTeamId] });
      setSelectedTask(null);
    }
  });

  const { mutate: deleteTask } = useMutation({
    mutationFn: async (id: string) => 
      api.deleteTask(id, await getToken() || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', currentTeamId] });
      setSelectedTask(null);
    }
  });

  const handleAddTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    addTask({ 
      title: newTaskTitle, 
      assignee: newTaskAssignee || undefined, 
      dueDate: newTaskDue || undefined, 
      priority: newTaskPriority 
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    updateTask({
      id: selectedTask.id,
      updates: {
        title: editTitle,
        description: editDescription,
        assignee: editAssignee || null,
        dueDate: editDueDate || null,
        priority: editPriority
      }
    });
  };

  const handleDeleteTask = () => {
    if (!selectedTask) return;
    if (window.confirm("Are you sure you want to delete this task?")) {
      deleteTask(selectedTask.id);
    }
  };

  const handleOpenDetailModal = (task: Task) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditAssignee(task.assignee?.clerkId || '');
    let formattedDate = '';
    if (task.dueDate) {
      formattedDate = new Date(task.dueDate).toISOString().split('T')[0];
    }
    setEditDueDate(formattedDate);
    setEditPriority(task.priority || 'medium');
  };

  const handleTaskMouseDown = (e: React.MouseEvent) => {
    setDragStartCoords({ x: e.clientX, y: e.clientY });
  };

  const handleTaskMouseUp = (e: React.MouseEvent, task: Task) => {
    if (!dragStartCoords) return;
    const dx = Math.abs(e.clientX - dragStartCoords.x);
    const dy = Math.abs(e.clientY - dragStartCoords.y);
    if (dx < 5 && dy < 5) {
      handleOpenDetailModal(task);
    }
    setDragStartCoords(null);
  };

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(lowerQuery) || 
        t.sourceMeetingTitle?.toLowerCase().includes(lowerQuery)
      );
    }

    if (filterPriority !== 'all') {
      result = result.filter(t => t.priority === filterPriority);
    }

    if (filterAssignee !== 'all') {
      if (filterAssignee === 'unassigned') {
        result = result.filter(t => !t.assignee || t.assignee.name === 'Unassigned');
      } else {
        const member = teamMembers.find((m: any) => m.clerkId === filterAssignee);
        if (member) {
          result = result.filter(t => t.assignee.name === member.name);
        }
      }
    }

    return result;
  }, [tasks, searchQuery, filterPriority, filterAssignee, teamMembers]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-50');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-[#EEF2FF]');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-[#EEF2FF]');
  };

  const handleDrop = (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-[#EEF2FF]');
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      updateStatus({ id: taskId, status });
    }
  };

  if (currentTeamId === null) {
    return (
      <div className="flex flex-col h-full bg-[#FAFAFA] font-sans items-center justify-center text-[#6B7280]">
        You're not part of any team yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] font-sans">
      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-[400px] p-6">
            <h2 className="text-lg font-bold text-[#111827] mb-4">Add Task</h2>
            <form onSubmit={handleAddTaskSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1">Title *</label>
                <input 
                  type="text" 
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1">Assignee</label>
                <select 
                  value={newTaskAssignee}
                  onChange={e => setNewTaskAssignee(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none bg-white"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((member: any) => (
                    <option key={member.clerkId} value={member.clerkId}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#374151] mb-1">Due Date</label>
                  <input 
                    type="date" 
                    value={newTaskDue}
                    onChange={e => setNewTaskDue(e.target.value)}
                    className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#374151] mb-1">Priority</label>
                  <select 
                    value={newTaskPriority}
                    onChange={e => setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                    className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none bg-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-[13px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] rounded-md"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 text-[13px] font-medium bg-[#4F46E5] text-white hover:bg-[#4338CA] rounded-md"
                >
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-[#E5E7EB] bg-white flex-shrink-0">
        <div>
          <h1 className="text-[24px] font-bold text-[#111827]">Action Items</h1>
          <p className="text-[#6B7280] text-[14px] mt-1">Manage and track follow-ups from your meetings.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-[#E5E7EB] rounded-md text-[13px] focus:outline-none focus:ring-1 focus:ring-[#4F46E5] focus:border-[#4F46E5] shadow-sm w-[240px]"
            />
          </div>
          <div className="relative">
            <button 
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className={`px-3 py-2 bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] rounded-md text-[13px] font-medium transition-colors shadow-sm flex items-center gap-2 ${
                filterPriority !== 'all' || filterAssignee !== 'all' ? 'border-[#4F46E5] text-[#4F46E5]' : ''
              }`}
            >
              <Filter size={16} /> Filter
            </button>
            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E5E7EB] rounded-lg shadow-lg p-4 z-50">
                <h3 className="text-xs font-semibold text-[#374151] uppercase tracking-wider mb-3">Filters</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B7280] mb-1">Priority</label>
                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="w-full border border-[#E5E7EB] rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#4F46E5] bg-white"
                    >
                      <option value="all">All Priorities</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B7280] mb-1">Assignee</label>
                    <select
                      value={filterAssignee}
                      onChange={(e) => setFilterAssignee(e.target.value)}
                      className="w-full border border-[#E5E7EB] rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#4F46E5] bg-white"
                    >
                      <option value="all">All Assignees</option>
                      <option value="unassigned">Unassigned</option>
                      {teamMembers.map((member: any) => (
                        <option key={member.clerkId} value={member.clerkId}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[#F3F4F6]">
                  {(filterPriority !== 'all' || filterAssignee !== 'all') && (
                    <button
                      onClick={() => {
                        setFilterPriority('all');
                        setFilterAssignee('all');
                      }}
                      className="text-[11px] font-medium text-[#EF4444] hover:underline"
                    >
                      Clear Filters
                    </button>
                  )}
                  <button
                    onClick={() => setIsFilterDropdownOpen(false)}
                    className="px-2.5 py-1 text-[11px] font-medium bg-[#4F46E5] text-white hover:bg-[#4338CA] rounded"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#4F46E5] text-white hover:bg-[#4338CA] rounded-md text-[13px] font-medium transition-colors shadow-sm flex items-center gap-2"
          >
            <Plus size={16} /> Add Task
          </button>
        </div>
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-[#6B7280]">
          Loading tasks...
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-8">
          <div className="flex gap-6 h-full min-w-max">
            {COLUMNS.map((col) => {
              const columnTasks = filteredTasks.filter(t => t.status === col.id);
              
              return (
                <div 
                  key={col.id} 
                  className="w-[320px] flex flex-col h-full rounded-xl transition-colors border border-transparent"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.id as Task['status'])}
                >
                  <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full" 
                        style={{ background: col.color }}
                      />
                      <h2 className="text-[14px] font-semibold text-[#111827]">{col.title}</h2>
                      <span className="text-[12px] text-[#6B7280] bg-[#E5E7EB] px-2 py-0.5 rounded-full">
                        {columnTasks.length}
                      </span>
                    </div>
                    <button className="text-[#9CA3AF] hover:text-[#374151]">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                    {columnTasks.map((task) => (
                      <div 
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        onMouseDown={handleTaskMouseDown}
                        onMouseUp={(e) => handleTaskMouseUp(e, task)}
                        className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-sm cursor-grab active:cursor-grabbing hover:border-[#D1D5DB] transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2 gap-4">
                          <h3 className="text-[14px] font-medium text-[#111827] leading-tight">
                            {task.title}
                          </h3>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {task.priority && (
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                task.priority === 'high' ? 'bg-red-50 text-red-600 border border-red-100' :
                                task.priority === 'medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                'bg-slate-50 text-slate-600 border border-slate-100'
                              }`}>
                                {task.priority}
                              </span>
                            )}
                            {task.priority === 'high' && (
                              <AlertCircle size={13} className="text-[#EF4444] flex-shrink-0" />
                            )}
                          </div>
                        </div>
                        
                        {task.sourceMeetingTitle && (
                           <div className="text-[12px] text-[#6B7280] mb-3 truncate bg-[#F3F4F6] inline-block px-2 py-0.5 rounded">
                             From: {task.sourceMeetingTitle}
                           </div>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F3F4F6]">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]">
                            <Calendar size={13} className="text-[#9CA3AF]" />
                            {task.due}
                          </div>
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-sm"
                            style={{ background: task.assignee.color }}
                            title={task.assignee.name}
                          >
                            {task.assignee.initials}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {columnTasks.length === 0 && (
                      <div className="h-24 rounded-lg border-2 border-dashed border-[#E5E7EB] flex items-center justify-center text-[#9CA3AF] text-[13px]">
                        Drop tasks here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-[450px] p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#F3F4F6]">
              <h2 className="text-lg font-bold text-[#111827]">Task Details</h2>
              <button 
                type="button"
                onClick={handleDeleteTask}
                className="text-xs font-semibold text-[#EF4444] hover:bg-[#FEF2F2] px-2.5 py-1.5 rounded transition-colors"
              >
                Delete Task
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1">Title *</label>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1">Description</label>
                <textarea 
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none resize-none bg-white"
                  placeholder="Add a detailed description..."
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1">Assignee</label>
                <select 
                  value={editAssignee}
                  onChange={e => setEditAssignee(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none bg-white"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((member: any) => (
                    <option key={member.clerkId} value={member.clerkId}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#374151] mb-1">Due Date</label>
                  <input 
                    type="date" 
                    value={editDueDate}
                    onChange={e => setEditDueDate(e.target.value)}
                    className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#374151] mb-1">Priority</label>
                  <select 
                    value={editPriority}
                    onChange={e => setEditPriority(e.target.value)}
                    className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-[13px] focus:ring-1 focus:ring-[#4F46E5] focus:outline-none bg-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#F3F4F6]">
                <button 
                  type="button" 
                  onClick={() => setSelectedTask(null)}
                  className="px-4 py-2 text-[13px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] rounded-md"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 text-[13px] font-medium bg-[#4F46E5] text-white hover:bg-[#4338CA] rounded-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
