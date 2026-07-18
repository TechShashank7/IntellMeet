import express from 'express';
import path from 'path';
import cors from 'cors';
import { serve } from 'inngest/express';
import { clerkMiddleware } from '@clerk/express';

import { ENV } from './src/lib/env.js';
import { connectDB } from './src/lib/db.js';
import { inngest, functions } from './src/lib/inngest.js';

import chatRoutes from './src/routes/chatRoutes.js';
import meetingRoutes from './src/routes/meetingRoutes.js';
import teamRoutes from './src/routes/teamRoutes.js';
import taskRoutes from './src/routes/taskRoutes.js';
import aiRoutes from './src/routes/aiRoutes.js';
import webhookRoutes from './src/routes/webhookRoutes.js';
import inviteRoutes from './src/routes/inviteRoutes.js';

const app = express();
const __dirname = path.resolve();

app.use('/api/webhooks', express.raw({ type: '*/*' }), webhookRoutes);
app.use(express.json());
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(clerkMiddleware());

app.use('/api/inngest', serve({ client: inngest, functions }));
app.use('/api/chat', chatRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api', taskRoutes); // task.routes.js already defines /teams/:teamId/tasks and /tasks/:id
app.use('/api/ai', aiRoutes);

if (ENV.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  app.get('/{*any}', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'dist', 'index.html'));
  });
}

const startServer = async () => {
  try {
    await connectDB();
    app.listen(ENV.PORT, () => console.log('Server is running on port:', ENV.PORT));
  } catch (error) {
    console.error('💥 Error starting the server', error);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
