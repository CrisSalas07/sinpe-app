import * as backupsService from '../services/backups.service.js';
import {
  validateFileName,
  validateRestore,
  validateSchedule,
  validateUploadQuery,
} from '../validators/backups.validator.js';

export async function status(req, res) {
  res.json(await backupsService.status());
}

export async function updateSchedule(req, res) {
  const previous = await backupsService.currentSchedule();
  res.json(await backupsService.updateSchedule(validateSchedule(req.body, previous)));
}

export async function backupNow(req, res) {
  res.status(201).json(await backupsService.backupNow());
}

export async function restore(req, res) {
  res.json(await backupsService.restore(validateRestore(req.body)));
}

export async function upload(req, res) {
  res.status(201).json(await backupsService.upload(validateUploadQuery(req.query), req.body));
}

export async function download(req, res) {
  const name = validateFileName(req.params.name, 'name');
  res.download(await backupsService.downloadPath(name), name);
}
