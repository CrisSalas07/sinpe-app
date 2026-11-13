import { app } from './app.js';
import { env } from './config/env.js';
import { initBackups } from './services/backups.service.js';

app.listen(env.port, () => {
  console.log(`Server running at http://localhost:${env.port}`);
});

// Re-activates the automatic backup saved from the Respaldos page.
initBackups().catch((err) => console.error('[respaldo automático]', err.message));
