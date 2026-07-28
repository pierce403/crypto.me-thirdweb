// @ts-ignore The OpenNext worker does not exist until after the Next.js build.
import openNextHandler from './.open-next/worker.js';
import { createPrisma } from './lib/prisma';
import {
  refreshProfileService,
  type ProfileRefreshMessage,
} from './src/lib/profileRefresh';

export default {
  fetch: openNextHandler.fetch,

  async queue(batch, env): Promise<void> {
    const selfReference = env.WORKER_SELF_REFERENCE;
    if (!selfReference?.fetch) {
      throw new Error('WORKER_SELF_REFERENCE binding is unavailable');
    }
    const refreshToken = (
      env as CloudflareEnv & { PROFILE_REFRESH_TOKEN?: string }
    ).PROFILE_REFRESH_TOKEN;
    const prisma = createPrisma(env.HYPERDRIVE.connectionString);

    try {
      for (const message of batch.messages) {
        try {
          const result = await refreshProfileService(
            prisma,
            message.body,
            (input, init) => selfReference.fetch(input, init),
            'https://crypto.me',
            refreshToken,
          );
          const key = {
            address: message.body.address.toLowerCase(),
            service: message.body.service,
          };
          if (result === 'updated' || result === 'configuration-error') {
            await prisma.sync_queue.deleteMany({ where: key });
            message.ack();
          } else {
            await prisma.sync_queue.updateMany({
              where: key,
              data: {
                attempts: message.attempts,
                last_attempt: new Date(),
                error: 'Upstream service refresh failed',
              },
            });
            message.retry();
          }
        } catch (error) {
          const failure = error instanceof Error ? error.message : String(error);
          await prisma.sync_queue.updateMany({
            where: {
              address: message.body.address.toLowerCase(),
              service: message.body.service,
            },
            data: {
              attempts: message.attempts,
              last_attempt: new Date(),
              error: failure,
            },
          }).catch(() => undefined);
          console.error(JSON.stringify({
            event: 'profile_refresh_job_failed',
            service: message.body.service,
            address: message.body.address,
            error: failure,
          }));
          message.retry();
        }
      }
    } finally {
      await prisma.$disconnect();
    }
  },
} satisfies ExportedHandler<CloudflareEnv, ProfileRefreshMessage>;
