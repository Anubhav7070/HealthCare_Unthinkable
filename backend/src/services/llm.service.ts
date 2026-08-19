export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface PreVisitLLMResult {
  urgency: UrgencyLevel;
  chiefComplaint: string;
  suggestedQuestions: string[];
  isFallback: boolean;
  rawInput?: string;
  errorLog?: string;
}

export interface PostVisitLLMResult {
  summaryText: string;
  medicationSchedule: string[];
  followUpSteps: string[];
  isFallback: boolean;
  errorLog?: string;
}

export class LLMService {
  private static provider = process.env.LLM_PROVIDER || 'mock';

  /**
   * Generates Pre-visit summary from symptom form text, duration, and severity.
   */
  public static async generatePreVisitSummary(
    symptoms: string,
    duration: string,
    severity: string
  ): Promise<PreVisitLLMResult> {
    const prompt = `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptoms}, Duration: ${duration}, Severity: ${severity}`;

    try {
      const response = await this.executeWithRetry(() => this.callLLMAPI(prompt, 'pre-visit'), 2, 1000);
      const parsed = JSON.parse(response);

      const urgencyStr = (parsed.urgency || parsed.urgency_level || 'MEDIUM').toUpperCase();
      let urgency: UrgencyLevel = 'MEDIUM';
      if (urgencyStr.includes('HIGH')) urgency = 'HIGH';
      else if (urgencyStr.includes('LOW')) urgency = 'LOW';

      return {
        urgency,
        chiefComplaint: parsed.chief_complaint || symptoms.slice(0, 100),
        suggestedQuestions: Array.isArray(parsed.suggested_questions)
          ? parsed.suggested_questions
          : ['What triggers these symptoms?', 'Should any diagnostic tests be ordered?', 'What is the recommended treatment plan?'],
        isFallback: false,
      };
    } catch (error: any) {
      console.error('[LLMService] Pre-visit summary generation failed, activating fallback:', error?.message);
      
      let fallbackUrgency: UrgencyLevel = 'MEDIUM';
      const lowerSev = severity.toLowerCase();
      if (lowerSev.includes('severe') || lowerSev.includes('high') || lowerSev.includes('9') || lowerSev.includes('10')) {
        fallbackUrgency = 'HIGH';
      } else if (lowerSev.includes('mild') || lowerSev.includes('low') || lowerSev.includes('1') || lowerSev.includes('2')) {
        fallbackUrgency = 'LOW';
      }

      return {
        urgency: fallbackUrgency,
        chiefComplaint: `Patient reported: ${symptoms} (Duration: ${duration}, Severity: ${severity})`,
        suggestedQuestions: [
          'Can you elaborate on when symptoms first began?',
          'Have you tried any over-the-counter medications?',
          'Are there any aggravating or relieving factors?'
        ],
        isFallback: true,
        rawInput: symptoms,
        errorLog: error?.message || 'LLM execution timed out or returned invalid JSON',
      };
    }
  }

  /**
   * Generates Post-visit summary from clinical notes and prescription.
   */
  public static async generatePostVisitSummary(
    notes: string,
    prescriptionsList: Array<{ drug: string; dosage: string; frequency: string; duration: string }>
  ): Promise<PostVisitLLMResult> {
    const rxText = prescriptionsList
      .map(p => `${p.drug} ${p.dosage} - ${p.frequency} for ${p.duration}`)
      .join(', ');
    const prompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: Clinical Notes: "${notes}". Prescriptions: "${rxText}"`;

    try {
      const response = await this.executeWithRetry(() => this.callLLMAPI(prompt, 'post-visit'), 2, 1000);
      const parsed = JSON.parse(response);

      return {
        summaryText: parsed.summary_text || notes,
        medicationSchedule: Array.isArray(parsed.medication_schedule)
          ? parsed.medication_schedule
          : prescriptionsList.map(p => `Take ${p.drug} (${p.dosage}) ${p.frequency} for ${p.duration}`),
        followUpSteps: Array.isArray(parsed.follow_up_steps)
          ? parsed.follow_up_steps
          : ['Rest and maintain adequate hydration', 'Complete full course of prescribed medication', 'Schedule follow-up if symptoms worsen'],
        isFallback: false,
      };
    } catch (error: any) {
      console.error('[LLMService] Post-visit summary generation failed, activating fallback:', error?.message);
      return {
        summaryText: `AI summary unavailable — showing raw clinical notes: ${notes}`,
        medicationSchedule: prescriptionsList.length > 0
          ? prescriptionsList.map(p => `Take ${p.drug} (${p.dosage}) ${p.frequency} for ${p.duration}`)
          : ['No medications prescribed.'],
        followUpSteps: [
          'Follow doctor advice provided during consultation.',
          'Contact clinic if you experience severe symptoms or side effects.'
        ],
        isFallback: true,
        errorLog: error?.message || 'LLM API error',
      };
    }
  }

  private static async callLLMAPI(prompt: string, type: 'pre-visit' | 'post-visit'): Promise<string> {
    const timeoutMs = 4000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`LLM API request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      (async () => {
        try {
          if (this.provider === 'openai' && process.env.OPENAI_API_KEY) {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                  { role: 'system', content: 'You are an AI medical communication assistant. Always output strict JSON.' },
                  { role: 'user', content: prompt }
                ],
                temperature: 0.2,
                response_format: { type: 'json_object' },
              })
            });
            const data: any = await response.json();
            clearTimeout(timer);
            if (data.choices && data.choices[0]?.message?.content) {
              return resolve(data.choices[0].message.content);
            } else {
              return reject(new Error(data.error?.message || 'OpenAI API failed'));
            }
          }

          clearTimeout(timer);
          if (type === 'pre-visit') {
            resolve(JSON.stringify({
              urgency: prompt.toLowerCase().includes('severe') || prompt.toLowerCase().includes('chest pain') ? 'High' : 'Medium',
              chief_complaint: 'Patient reports persistent symptoms requiring clinical assessment.',
              suggested_questions: [
                'How long have these specific symptoms affected daily activities?',
                'Are there associated systemic symptoms like fever or nausea?',
                'Have you had similar symptoms in the past?'
              ]
            }));
          } else {
            resolve(JSON.stringify({
              summary_text: 'Your physician reviewed your condition and prescribed a targeted care plan. Please follow dosage instructions carefully.',
              medication_schedule: [
                'Take oral medication with meal every morning and evening as directed.',
                'Maintain regular hydration throughout the recovery period.'
              ],
              follow_up_steps: [
                'Monitor symptom changes over the next 5 days.',
                'Contact clinic immediately if fever exceeds 101°F.',
                'Book a follow-up appointment in 2 weeks.'
              ]
            }));
          }
        } catch (err) {
          clearTimeout(timer);
          reject(err);
        }
      })();
    });
  }

  private static async executeWithRetry<T>(
    fn: () => Promise<T>,
    retries: number = 2,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, delayMs * attempt));
        }
      }
    }
    throw lastError;
  }
}
