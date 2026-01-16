import { TriggerClient } from '@trigger.dev/sdk';

if (!process.env.TRIGGER_SECRET_KEY) {
  throw new Error('Missing TRIGGER_SECRET_KEY');
}

export const trigger = new TriggerClient({
  id: process.env.TRIGGER_PROJECT_ID || 'workflow-builder',
  apiKey: process.env.TRIGGER_SECRET_KEY,
  apiUrl: process.env.TRIGGER_API_URL,
});