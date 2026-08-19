import { Router } from 'express';
import { DoctorController } from '../controllers/doctor.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRole('DOCTOR'));

router.get('/schedule', DoctorController.getSchedule);
router.post('/post-visit', DoctorController.submitPostVisit);
router.post('/leave', DoctorController.markLeave);

export default router;
