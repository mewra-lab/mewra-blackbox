import { z } from 'zod';
import { id } from '../core/config/schema';
export const viewerMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('run'), scenarioId: id }).strict(),
  z.object({ type: z.literal('cancel') }).strict(),
  z
    .object({ type: z.literal('baseline'), scenarioId: id, viewport: id })
    .strict(),
]);
