import { geminiModel } from '../config/gemini.js';
import Meeting from '../models/Session.js';
import ActionItem from '../models/ActionItem.js';

/**
 * Sends a meeting transcript to Gemini and asks for a structured
 * JSON response: a short summary plus a list of action items.
 *
 * Because config/gemini.js sets responseMimeType: "application/json"
 * on the model, Gemini's output should already be valid JSON — but we
 * still wrap the parse in a try/catch since models can occasionally
 * wrap output in markdown fences or return malformed JSON.
 *
 * @param {string} transcript - raw meeting transcript text
 * @returns {{ summary: string, actionItems: Array<{ text: string, assignee: string|null, dueDate: string|null, confidence: string }> }}
 */
const generateMeetingSummary = async (transcript) => {
  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Cannot summarize an empty transcript');
  }

  const prompt = `
You are an assistant that summarizes business meeting transcripts.

Read the transcript below and return ONLY a JSON object with this exact shape:
{
  "summary": "3-5 bullet points as a single string, separated by newlines, covering the key discussion points and decisions",
  "actionItems": [
    {
      "text": "a specific, actionable task mentioned in the meeting",
      "assignee": "the name of the person responsible, or null if unclear",
      "dueDate": "an ISO date string if a deadline was mentioned, or null",
      "confidence": "high, medium, or low — how confident you are this is a real action item"
    }
  ]
}

Do not include any text outside the JSON object. If no action items were discussed, return an empty array.

TRANSCRIPT:
"""
${transcript}
"""
`;

  const result = await geminiModel.generateContent(prompt);
  const rawText = result.response.text();

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    // Fallback: Try to extract the JSON object using regex if Gemini included extra text
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (innerErr) {
        throw new Error('Failed to parse extracted JSON from Gemini response');
      }
    } else {
      throw new Error('Could not find valid JSON object in Gemini response');
    }
  }

  return {
    summary: parsed.summary || '',
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
  };
};

/**
 * Runs the full pipeline for one meeting: reads its stored transcript,
 * calls Gemini, and persists the summary + ActionItem documents.
 *
 * Shared by:
 *  - POST /api/ai/summarize/:meetingId (manual trigger from the frontend)
 *  - the call.transcription_ready webhook (automatic trigger)
 *
 * Throws on failure — callers are responsible for setting
 * meeting.aiProcessingStatus = "failed" in their own catch block if needed.
 */
const summarizeAndPersist = async (meetingId) => {
  const meeting = await Meeting.findById(meetingId);

  if (!meeting) {
    throw new Error(`Session ${meetingId} not found`);
  }

  if (!meeting.transcript || meeting.transcript.trim().length === 0) {
    throw new Error('Session has no transcript yet — nothing to summarize');
  }

  meeting.aiProcessingStatus = 'processing';
  await meeting.save();

  const { summary, actionItems } = await generateMeetingSummary(meeting.transcript);

  // Wipe previous action items so re-running summarization doesn't duplicate them
  await ActionItem.deleteMany({ meetingId: meeting._id });

  const createdActionItems = await ActionItem.insertMany(
    actionItems.map((item) => ({
      meetingId: meeting._id,
      text: item.text,
      assignee:
        item.assignee === 'null' || item.assignee === 'N/A' || item.assignee === 'None'
          ? null
          : item.assignee || null,
      dueDate: item.dueDate && !isNaN(Date.parse(item.dueDate)) ? item.dueDate : null,
      sourceConfidence: item.confidence || 'medium',
    }))
  );

  await Meeting.findByIdAndUpdate(meetingId, {
    $set: {
      summary: summary,
      actionItems: createdActionItems.map((ai) => ai._id),
      aiProcessingStatus: 'completed',
    },
  });

  return { summary, actionItems: createdActionItems };
};

export { generateMeetingSummary, summarizeAndPersist };
