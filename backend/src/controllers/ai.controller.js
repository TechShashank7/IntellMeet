import asyncHandler from 'express-async-handler';
import Session from '../models/Session.js';
import ActionItem from '../models/ActionItem.js';
import Task from '../models/Task.js';
import { generateMeetingSummary, summarizeAndPersist } from '../services/ai.service.js';
import { streamClient } from '../lib/stream.js';

/**
 * POST /api/ai/summarize/:meetingId
 * Reads the meeting's stored transcript, sends it to Gemini, and persists
 * the resulting summary + ActionItem documents.
 *
 * Assumes meeting.transcript has already been populated — that happens
 * either via a Stream transcription webhook or a manual upload endpoint,
 * both outside the scope of this controller.
 */
const summarizeMeeting = asyncHandler(async (req, res) => {
  const id = req.params.meetingId;
  let session;
  if (id && id.length === 6 && /^\d+$/.test(id)) {
    session = await Session.findOne({ joinCode: id });
  } else {
    session = await Session.findById(id);
  }

  if (!session) {
    res.status(404);
    throw new Error('Session not found');
  }

  if (!session.transcript || session.transcript.trim().length === 0) {
    res.status(400);
    throw new Error('This session has no transcript yet — nothing to summarize');
  }

  session.aiProcessingStatus = 'processing';
  await session.save();

  try {
    const { summary, actionItems } = await generateMeetingSummary(session.transcript);

    // Wipe any previous action items for this session before re-generating,
    // so re-running summarization doesn't create duplicates.
    await ActionItem.deleteMany({ meetingId: session._id });

    const createdActionItems = await ActionItem.insertMany(
      actionItems.map((item) => ({
        meetingId: session._id,
        text: item.text,
        assignee:
          item.assignee === 'null' || item.assignee === 'N/A' || item.assignee === 'None'
            ? null
            : item.assignee || null,
        dueDate: item.dueDate && !isNaN(Date.parse(item.dueDate)) ? item.dueDate : null,
        sourceConfidence: item.confidence || 'medium',
      }))
    );

    session.summary = summary;
    session.actionItems = createdActionItems.map((ai) => ai._id);
    session.aiProcessingStatus = 'completed';
    await session.save();

    res.status(200).json({ summary, actionItems: createdActionItems });
  } catch (err) {
    session.aiProcessingStatus = 'failed';
    await session.save();
    res.status(502);
    throw new Error(`AI summarization failed: ${err.message}`, { cause: err });
  }
});

/**
 * GET /api/ai/sessions/:sessionId/summary
 */
const getSessionSummary = asyncHandler(async (req, res) => {
  const id = req.params.meetingId;
  let session;
  if (id && id.length === 6 && /^\d+$/.test(id)) {
    session = await Session.findOne({ joinCode: id }).populate('actionItems');
  } else {
    session = await Session.findById(id).populate('actionItems');
  }

  if (!session) {
    res.status(404);
    throw new Error('Session not found');
  }

  const isStuckProcessing =
    session.aiProcessingStatus === 'processing' &&
    Date.now() - new Date(session.updatedAt).getTime() > 20000;

  // Fallback: If pending, or stuck in processing from a previous timeout
  if (
    (session.aiProcessingStatus === 'pending' || isStuckProcessing) &&
    session.status === 'completed'
  ) {
    // Try to get a lock atomically (only if pending, if already processing we just continue but the lock won't trigger if multiple hit this branch at once)
    let lockedSession;
    if (session.aiProcessingStatus === 'pending' || isStuckProcessing) {
      lockedSession = await Session.findOneAndUpdate(
        {
          _id: session._id,
          $or: [{ aiProcessingStatus: 'pending' }, { aiProcessingStatus: 'processing' }],
        },
        { $set: { aiProcessingStatus: 'processing' } },
        { new: true }
      );
    }

    if (lockedSession) {
      session = lockedSession; // we got the lock
      try {
        if (!session.transcript || session.transcript.trim().length === 0) {
          const timeSinceEnd = session.endTime
            ? Date.now() - new Date(session.endTime).getTime()
            : 0;

          if (timeSinceEnd > 120000) {
            session.transcript =
              'No speech was detected during this meeting. It was likely a silent or very brief session.';
            await session.save();
          } else {
            const call = streamClient.video.call('default', session.callId);
            const transcriptionsResult = await call.listTranscriptions();
            const transcriptions = transcriptionsResult.transcriptions || [];

            if (transcriptions.length > 0) {
              const readyTranscription = transcriptions.find((t) => t.url);
              if (readyTranscription) {
                const response = await fetch(readyTranscription.url);
                if (response.ok) {
                  const rawText = await response.text();
                  const lines = rawText.split('\n').filter((line) => line.trim() !== '');

                  const transcriptParts = lines
                    .map((line) => {
                      try {
                        const parsed = JSON.parse(line);
                        return `${parsed.speaker_id || 'Unknown'}: ${parsed.text}`;
                      } catch {
                        return null;
                      }
                    })
                    .filter(Boolean);

                  const transcriptSegments = lines
                    .map((line) => {
                      try {
                        const parsed = JSON.parse(line);
                        if (parsed && parsed.text) {
                          return {
                            speakerId: parsed.speaker_id || null,
                            text: parsed.text,
                            timestamp:
                              session.transcriptionStartedAt && typeof parsed.start_ts === 'number'
                                ? new Date(
                                    session.transcriptionStartedAt.getTime() + parsed.start_ts
                                  )
                                : null,
                          };
                        }
                        return null;
                      } catch {
                        return null;
                      }
                    })
                    .filter(Boolean);

                  session.transcript = transcriptParts.join('\n');
                  session.transcriptSegments = transcriptSegments;
                  if (session.transcript.trim().length === 0) {
                    session.transcript =
                      'No speech was detected during this meeting. It was likely a silent or very brief session.';
                  }
                  await session.save();
                }
              }
            }
          }
        }

        if (session.transcript && session.transcript.trim().length > 0) {
          // AWAIT the summarization so Vercel does not kill the lambda
          try {
            await summarizeAndPersist(session._id);
            // Re-fetch the completed session with action items populated
            const completedSession = await Session.findById(session._id).populate('actionItems');
            if (completedSession) session = completedSession;
          } catch (err) {
            console.error('AI Fallback processing failed:', err);
            await Session.findByIdAndUpdate(session._id, {
              $set: { aiProcessingStatus: 'failed' },
            });
            session.aiProcessingStatus = 'failed';
          }
        } else {
          // Transcript not ready yet on Stream's side. Revert to 'pending' for next poll
          session.aiProcessingStatus = 'pending';
          await session.save();
        }
      } catch (err) {
        console.error('Error in fallback transcription check:', err);
        session.aiProcessingStatus = 'pending';
        await session.save();
      }
    } else {
      // Another request got the lock and is currently processing.
      session.aiProcessingStatus = 'processing';
    }
  }

  // Populate actionItems if they weren't populated in lockedSession or if just finished
  if (
    session.aiProcessingStatus === 'completed' &&
    session.actionItems &&
    session.actionItems.length > 0
  ) {
    if (!session.actionItems[0].text) {
      const popSession = await Session.findById(session._id).populate('actionItems');
      if (popSession) session = popSession;
    }
  }

  res.status(200).json({
    summary: session.summary,
    actionItems: session.actionItems,
    status: session.aiProcessingStatus,
  });
});

/**
 * POST /api/ai/action-items/:actionItemId/promote
 * body: { teamId }
 * Converts an AI-extracted ActionItem into a real Task on a team board.
 */
const promoteActionItemToTask = asyncHandler(async (req, res) => {
  const { teamId } = req.body;
  const actionItem = await ActionItem.findById(req.params.actionItemId);

  if (!actionItem) {
    res.status(404);
    throw new Error('Action item not found');
  }

  if (!teamId) {
    res.status(400);
    throw new Error('teamId is required to promote an action item into a task');
  }

  const task = await Task.create({
    title: actionItem.text,
    teamId,
    assignee: actionItem.assignee,
    dueDate: actionItem.dueDate,
    sourceActionItem: actionItem._id,
    sourceMeetingId: actionItem.meetingId,
  });

  res.status(201).json(task);
});

export { summarizeMeeting, getSessionSummary, promoteActionItemToTask };
