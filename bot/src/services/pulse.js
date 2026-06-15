import { query } from '../../../server/src/db/index.js';
import { employees } from '../../../server/src/db/tables.js';
import { setSession } from '../session.js';
import { pulseScoreKeyboard } from '../keyboards.js';

export async function broadcastPulseSurvey(telegram) {
  const { rows } = await query(
    `SELECT telegram_id FROM ${employees} WHERE telegram_id IS NOT NULL AND status = 'active'`
  );
  let sent = 0;
  for (const r of rows) {
    try {
      setSession(r.telegram_id, { flow: 'pulse', step: 1, q1: null, q2: null, q3: null });
      await telegram.sendMessage(
        r.telegram_id,
        'Привет! Анонимный пульс-опрос — 3 вопроса, 1 минута.\n\n1/3 Насколько комфортно на работе?',
        pulseScoreKeyboard(1),
      );
      sent++;
    } catch {
      /* skip unreachable users */
    }
  }
  return sent;
}
