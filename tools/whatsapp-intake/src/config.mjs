import path from 'node:path';
import { validateRemoteSchedule } from './schedule-sync.mjs';
import { readJson } from './storage.mjs';

export async function loadConfig(file, dataDir) {
  const config = await readJson(file);
  if (config.schemaVersion !== 1 || !/^[a-z0-9][a-z0-9-]{1,60}$/.test(config.id || '')) throw new Error('INVALID_CONFIG_ID');
  if (!config.groupName?.trim() || !config.ownerEmail?.trim()) throw new Error('GROUP_AND_OWNER_REQUIRED');
  new Intl.DateTimeFormat('en-US', { timeZone: config.timeZone });
  const url = new URL(config.apiBaseUrl);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))) throw new Error('INVALID_API_URL');
  if (!/^\/api\/content-intake\/[a-z0-9-]+$/.test(config.workflowPath)) throw new Error('INVALID_WORKFLOW_PATH');
  if (!['DMY', 'MDY'].includes(config.dateOrder)) throw new Error('EXPLICIT_DATE_ORDER_REQUIRED');
  if (!(config.scanLookbackHours > 0 && config.scanLookbackHours <= 168)) throw new Error('INVALID_LOOKBACK');
  if (!(config.scanWindowHours > 0 && config.scanWindowHours <= config.scanLookbackHours)) throw new Error('INVALID_SCAN_WINDOW');
  if (!(config.maxScrolls > 0 && config.maxScrolls <= 500)) throw new Error('INVALID_SCROLL_LIMIT');
  if (!Array.isArray(config.schedule?.weekdays) || config.schedule.weekdays.some((n) => !Number.isInteger(n) || n < 0 || n > 6)) throw new Error('INVALID_SCHEDULE');
  if (!Array.isArray(config.schedule.times) || !config.schedule.times.length || config.schedule.times.some((v) => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v))) throw new Error('INVALID_SCHEDULE');
  if (config.schedule.checks) validateRemoteSchedule({ ...config.schedule, timeZone: config.timeZone });
  return { ...config, configFile: path.resolve(file), apiBaseUrl: url.origin, dataDir: path.resolve(dataDir), profileDir: path.resolve(dataDir, config.id, 'browser'), runtimeDir: path.resolve(dataDir, config.id) };
}
