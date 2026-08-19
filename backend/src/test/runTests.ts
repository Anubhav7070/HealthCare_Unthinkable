import { LLMService } from '../services/llm.service';
import { SlotService } from '../services/slot.service';
import { prisma } from '../prisma';

async function runTests() {
  console.log('🧪 Starting Automated Backend System Tests...');

  // Test 1: LLM Pre-Visit Analysis & Fallback Safety
  console.log('\n[Test 1] LLM Pre-Visit Analysis test...');
  const preResult = await LLMService.generatePreVisitSummary(
    'Chest pressure and mild shortness of breath during physical exertion',
    '3 days',
    'Severe'
  );
  console.log('  Result Urgency:', preResult.urgency);
  console.log('  Chief Complaint:', preResult.chiefComplaint);
  console.log('  Is Fallback:', preResult.isFallback);
  if (!preResult.urgency) throw new Error('Test 1 Failed: Missing urgency');
  console.log('✅ Test 1 Passed!');

  // Test 2: LLM Post-Visit Conversion & Medication Schedule
  console.log('\n[Test 2] LLM Post-Visit Summary test...');
  const postResult = await LLMService.generatePostVisitSummary(
    'Patient shows acute hypertension. Prescribed antihypertensive medications.',
    [{ drug: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', duration: '30 days' }]
  );
  console.log('  Summary Text:', postResult.summaryText);
  console.log('  Medication Schedule Count:', postResult.medicationSchedule.length);
  if (!postResult.summaryText) throw new Error('Test 2 Failed: Missing summary text');
  console.log('✅ Test 2 Passed!');

  console.log('\n🎉 ALL AUTOMATED BACKEND TESTS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
