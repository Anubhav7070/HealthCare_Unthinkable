import app from './app';
import { ReminderService } from './services/reminder.service';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` Healthcare Appointment & Follow-up Manager Server`);
  console.log(` Running on port: http://localhost:${PORT}`);
  console.log(`==================================================`);

  // Start background job loop for medication reminder processing every 30 seconds
  setInterval(() => {
    ReminderService.processPendingReminders();
  }, 30000);
});
