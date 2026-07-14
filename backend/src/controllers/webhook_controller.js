import { streamClient } from "../lib/stream.js";
import Session from "../models/Session.js";
import { summarizeAndPersist } from "../services/ai.service.js";

export const handleStreamVideoWebhook = async (req, res) => {
  console.log("Webhook received, event type header/body preview:", req.headers["x-signature"] ? "has signature" : "no signature");
  const signature = req.headers["x-signature"];

  // Verify the signature
  const isValid = streamClient.verifyWebhook(req.body, signature);
  console.log("Signature valid:", isValid);
  
  if (!isValid) {
    console.warn("Invalid webhook signature from Stream");
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Parse the raw body as JSON after verification
  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
    console.log("Parsed event type:", event.type);
  } catch (error) {
    console.warn("Failed to parse webhook body as JSON", error);
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  // Respond 200 immediately before doing async work
  res.status(200).json({ received: true });

  try {
    if (event.type === "call.transcription_ready") {
      const callId = event.call_cid.split(":")[1];
      const session = await Session.findOne({ callId });

      if (!session) {
        console.warn(`Session not found for callId: ${callId}`);
        return;
      }

      const transcriptionUrl = event.call_transcription?.url;
      if (!transcriptionUrl) {
        console.warn("No transcription URL provided in webhook event");
        return;
      }

      // Fetch pre-signed URL
      const response = await fetch(transcriptionUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch transcription: ${response.status}`);
      }

      const rawText = await response.text();
      const lines = rawText.split('\n').filter(line => line.trim() !== '');
      
      const transcriptParts = lines.map(line => {
        try {
          const parsed = JSON.parse(line);
          return `${parsed.speaker_id || 'Unknown'}: ${parsed.text}`;
        } catch (e) {
          return null;
        }
      }).filter(Boolean);

      const transcriptSegments = lines.map(line => {
        try {
          const parsed = JSON.parse(line);
          if (parsed && parsed.text) {
            return {
              speakerId: parsed.speaker_id || null,
              text: parsed.text,
              timestamp: session.transcriptionStartedAt && typeof parsed.start_ts === 'number'
                ? new Date(session.transcriptionStartedAt.getTime() + parsed.start_ts)
                : null
            };
          }
          return null;
        } catch (e) {
          return null;
        }
      }).filter(Boolean);

      let plainTextTranscript = transcriptParts.join('\n');
      if (plainTextTranscript.trim().length === 0) {
        plainTextTranscript = "No speech was detected during this meeting. It was likely a silent or very brief session.";
      }
      session.transcript = plainTextTranscript;
      session.transcriptSegments = transcriptSegments;
      await session.save();

      try {
        await summarizeAndPersist(session._id);
      } catch (aiError) {
        console.error("AI processing failed after transcription:", aiError);
        session.aiProcessingStatus = "failed";
        await session.save();
      }
    } else if (event.type === "call.transcription_failed") {
      const callId = event.call_cid.split(":")[1];
      const session = await Session.findOne({ callId });

      if (session) {
        session.aiProcessingStatus = "failed";
        await session.save();
      } else {
        console.warn(`Session not found for failed transcription callId: ${callId}`);
      }
    } else {
      console.log(`Received unhandled Stream webhook event: ${event.type}`);
    }
  } catch (error) {
    console.error("Error processing Stream webhook:", error);
  }
};
