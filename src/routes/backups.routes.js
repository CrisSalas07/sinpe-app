import express, { Router } from 'express';
import * as backups from '../controllers/backups.controller.js';

export const backupsRoutes = Router();

// Uploaded backups arrive as the raw file (application/octet-stream), not as JSON.
const MAX_UPLOAD = '50mb';
const rawFile = express.raw({ type: 'application/octet-stream', limit: MAX_UPLOAD });

backupsRoutes.get('/', backups.status);
backupsRoutes.put('/schedule', backups.updateSchedule);
backupsRoutes.post('/run', backups.backupNow);
backupsRoutes.post('/restore', backups.restore);
backupsRoutes.post('/upload', rawFile, backups.upload);
backupsRoutes.get('/files/:name', backups.download);
