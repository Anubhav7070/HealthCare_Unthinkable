import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.post('/doctors', AdminController.createDoctor);
router.get('/doctors', AdminController.listDoctors);
router.post('/doctors/leave', AdminController.markDoctorLeave);
router.get('/appointments', AdminController.getAllAppointments);
router.get('/logs', AdminController.getNotificationLogs);

export default router;
