import { Router } from 'express';
import { PatientController } from '../controllers/patient.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRole('PATIENT'));

router.get('/doctors', PatientController.searchDoctors);
router.get('/slots', PatientController.getDoctorSlots);
router.post('/hold-slot', PatientController.holdSlot);
router.post('/book', PatientController.bookAppointment);
router.get('/appointments', PatientController.getMyAppointments);
router.get('/reminders', PatientController.getMyReminders);
router.post('/appointments/:id/cancel', PatientController.cancelAppointment);

export default router;
