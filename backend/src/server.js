// ============================================================
// MAIN SERVER
// ============================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from './config/supabaseClient.js';
import { logger } from './utils/logger.js';
import { getProvider } from './whatsapp/whatsappProvider.js';
import { handleIncomingMessage } from './services/messageHandler.js';

import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import planRoutes from './routes/planRoutes.js';
import clientProfileRoutes from './routes/clientProfileRoutes.js';
import propertyRoutes from './routes/propertyRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import emergencyBlockRoutes from './routes/emergencyBlockRoutes.js';
import templateRoutes from './routes/templateRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import sendRoutes from './routes/sendRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

const explicitOrigins = [
  process.env.FRONTEND_ADMIN_URL || 'http://localhost:5173',
  process.env.FRONTEND_CLIENT_URL || 'http://localhost:5174',
];
// Matches http://192.168.x.x:PORT, http://10.x.x.x:PORT, http://172.16-31.x.x:PORT
// This lets you open the dashboard from a phone on the same WiFi during
// local testing, without needing to hardcode your PC's LAN IP anywhere.
const lanOriginPattern = /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):(5173|5174)$/;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || explicitOrigins.includes(origin) || lanOriginPattern.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'WhatsApp AI Real Estate Sales Agent API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', planRoutes);
app.use('/api/client', clientProfileRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/emergency-blocks', emergencyBlockRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/send', sendRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// RESUME ACTIVE WHATSAPP SESSIONS ON SERVER RESTART
// ============================================================
// So clients don't have to re-scan the QR code every time the
// backend restarts (e.g. on Render redeploy) as long as the
// session files in /sessions still exist.
// ============================================================
async function resumeActiveSessions() {
  try {
    const { data: clients } = await supabaseAdmin
      .from('clients')
      .select('id, whatsapp_provider')
      .eq('whatsapp_connected', true)
      .eq('status', 'active');

    if (!clients || clients.length === 0) return;

    for (const client of clients) {
      if (client.whatsapp_provider !== 'baileys') continue; // cloud_api needs no session resume
      const provider = getProvider('baileys');
      provider
        .startSession(client.id, {
          onMessage: (fromNumber, text, opts) => handleIncomingMessage(client.id, fromNumber, text, opts?.jidType),
        })
        .catch((err) => logger.error(`Failed to resume session for client ${client.id}:`, err.message));
    }
    logger.info(`Attempting to resume ${clients.length} WhatsApp session(s)...`);
  } catch (err) {
    logger.error('resumeActiveSessions failed:', err.message);
  }
}

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  resumeActiveSessions();
});