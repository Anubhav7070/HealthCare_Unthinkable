import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import patientRoutes from './routes/patient.routes';
import doctorRoutes from './routes/doctor.routes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// API Route mounts
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), service: 'Healthcare Appointment & Follow-up Manager API' });
});

// --- Serve Frontend Static Files (Production) ---
const frontendDistPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDistPath));

// SPA fallback: serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes that weren't matched
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.url}` });
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

export default app;
