/**
 * DayPilot AI - Offline Sync & PWA Cache Engine
 * Pure logic functions for offline action queuing, idempotency,
 * conflict resolution, and sensitive cache filtering.
 */

import { Task, Plan, Reminder } from '../types/index.ts';

export type SyncActionType = 'CREATE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK' | 'TOGGLE_TASK' | 'CREATE_PLAN';

export interface PendingSyncAction {
  id: string; // Idempotent unique key
  userId: string;
  type: SyncActionType;
  entityId: string;
  payload: Record<string, unknown>;
  queuedAt: string;
  clientTimestamp: number;
  retryCount: number;
}

/**
 * Filter URLs to strictly prevent caching sensitive authentication, private data, or AI API requests
 */
export function isSensitiveCacheUrl(url: string): boolean {
  const sensitivePatterns = [
    /\/api\//,
    /identitytoolkit\.googleapis\.com/,
    /securetoken\.googleapis\.com/,
    /firestore\.googleapis\.com/,
    /generativelanguage\.googleapis\.com/,
    /firebaseinstallations\.googleapis\.com/,
    /fcmregistrations\.googleapis\.com/,
  ];
  return sensitivePatterns.some((pattern) => pattern.test(url));
}

/**
 * Enqueue an offline action with duplicate prevention
 */
export function enqueueSyncAction(
  queue: PendingSyncAction[],
  action: Omit<PendingSyncAction, 'queuedAt' | 'clientTimestamp' | 'retryCount'>
): PendingSyncAction[] {
  // If action with exact same ID exists, update it rather than duplicating
  const existingIdx = queue.findIndex((item) => item.id === action.id);
  const now = new Date();

  const newAction: PendingSyncAction = {
    ...action,
    queuedAt: now.toISOString(),
    clientTimestamp: now.getTime(),
    retryCount: 0,
  };

  if (existingIdx >= 0) {
    const updated = [...queue];
    updated[existingIdx] = newAction;
    return updated;
  }

  return [...queue, newAction];
}

/**
 * Dequeue a successfully committed action
 */
export function dequeueSyncAction(
  queue: PendingSyncAction[],
  actionId: string
): PendingSyncAction[] {
  return queue.filter((item) => item.id !== actionId);
}

/**
 * Conflict resolution: determines whether client draft should override server version
 * Uses deterministic timestamp comparison (last-write-wins with millisecond accuracy)
 */
export function resolveSyncConflict<T extends { updatedAt?: string; createdAt?: string }>(
  clientItem: T,
  serverItem: T
): 'APPLY_CLIENT' | 'KEEP_SERVER' {
  const clientTime = clientItem.updatedAt || clientItem.createdAt || '';
  const serverTime = serverItem.updatedAt || serverItem.createdAt || '';

  if (!serverTime) return 'APPLY_CLIENT';
  if (!clientTime) return 'KEEP_SERVER';

  return new Date(clientTime).getTime() >= new Date(serverTime).getTime()
    ? 'APPLY_CLIENT'
    : 'KEEP_SERVER';
}

/**
 * Validate offline task draft before queuing
 */
export function validateOfflineTaskDraft(draft: Partial<Task>): { valid: boolean; error?: string } {
  if (!draft.title || draft.title.trim().length === 0) {
    return { valid: false, error: 'Task title is required.' };
  }
  if (!draft.date || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
    return { valid: false, error: 'Valid date (YYYY-MM-DD) is required.' };
  }
  if (!draft.id) {
    return { valid: false, error: 'Client task ID is required for idempotent offline creation.' };
  }
  return { valid: true };
}
