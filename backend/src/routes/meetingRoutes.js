import express from 'express';
import { protectRoute } from '../middleware/protectRoute.js';
import {
  createSession,
  endSession,
  getActiveSessions,
  getMyRecentSessions,
  getSessionById,
  joinSession,
  getUpcomingSessions,
  rateSession,
  getMeetingStats,
  getMeetingAnalytics,
  getMyMeetingInvites,
  acceptMeetingInvite,
  declineMeetingInvite,
  deleteMeeting,
  leaveMeeting,
  addMeetingParticipants,
  removeMeetingParticipant,
  requestToJoin,
  getWaitingRoomStatus,
  getWaitingRoom,
  admitFromWaitingRoom,
  denyFromWaitingRoom,
  admitAllFromWaitingRoom,
  updateOpenForAll,
  getMyRecordingsList,
  getRecordingDetail,
  exportMeetingNotes,
  shareMeetingToSlack,
  syncMeetingToNotion,
} from '../controllers/sessionController.js';

const router = express.Router();

router.use((req, res, next) => {
  console.log('MEETING ROUTE:', req.method, req.originalUrl, req.path);
  next();
});

router.post('/', protectRoute, createSession);
router.get('/active', protectRoute, getActiveSessions);
router.get('/my-recent', protectRoute, getMyRecentSessions);
router.get('/upcoming', protectRoute, getUpcomingSessions);
router.get('/stats', protectRoute, getMeetingStats);
router.get('/analytics', protectRoute, getMeetingAnalytics);
router.get('/recordings', protectRoute, getMyRecordingsList);
router.get('/recordings/:id', protectRoute, getRecordingDetail);

router.get('/invites/my', protectRoute, getMyMeetingInvites);
router.post('/invites/:id/accept', protectRoute, acceptMeetingInvite);
router.post('/invites/:id/decline', protectRoute, declineMeetingInvite);

router.get('/:id/export', protectRoute, exportMeetingNotes);
router.get('/:id', protectRoute, getSessionById);
router.post('/:id/join', protectRoute, joinSession);
router.post('/:id/waiting-room/request', protectRoute, requestToJoin);
router.get('/:id/waiting-room/status', protectRoute, getWaitingRoomStatus);
router.get('/:id/waiting-room', protectRoute, getWaitingRoom);
router.post('/:id/waiting-room/:clerkId/admit', protectRoute, admitFromWaitingRoom);
router.post('/:id/waiting-room/:clerkId/deny', protectRoute, denyFromWaitingRoom);
router.post('/:id/waiting-room/admit-all', protectRoute, admitAllFromWaitingRoom);
router.patch('/:id/open-for-all', protectRoute, updateOpenForAll);
router.post('/:id/leave', protectRoute, leaveMeeting);
router.post('/:id/invite', protectRoute, addMeetingParticipants);
router.post('/:id/remove', protectRoute, removeMeetingParticipant);
router.post('/:id/end', protectRoute, endSession);
router.post('/:id/rate', protectRoute, rateSession);
router.post('/:id/share/slack', protectRoute, shareMeetingToSlack);
router.post('/:id/share/notion', protectRoute, syncMeetingToNotion);
router.delete('/:id', protectRoute, deleteMeeting);

export default router;
