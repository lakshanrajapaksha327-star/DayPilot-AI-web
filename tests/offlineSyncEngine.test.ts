import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSensitiveCacheUrl,
  enqueueSyncAction,
  dequeueSyncAction,
  resolveSyncConflict,
  validateOfflineTaskDraft,
  PendingSyncAction,
} from '../src/utils/offlineSyncEngine.ts';

test('isSensitiveCacheUrl identifies endpoints that must never be cached', () => {
  assert.equal(isSensitiveCacheUrl('/api/ai/generate'), true);
  assert.equal(isSensitiveCacheUrl('/api/reminders'), true);
  assert.equal(isSensitiveCacheUrl('https://firestore.googleapis.com/v1/projects'), true);
  assert.equal(isSensitiveCacheUrl('https://identitytoolkit.googleapis.com/v1/accounts'), true);
  assert.equal(isSensitiveCacheUrl('https://generativelanguage.googleapis.com/v1beta/models'), true);

  // Safe static assets
  assert.equal(isSensitiveCacheUrl('/icons/icon-192.png'), false);
  assert.equal(isSensitiveCacheUrl('/manifest.json'), false);
  assert.equal(isSensitiveCacheUrl('/index.html'), false);
  assert.equal(isSensitiveCacheUrl('/assets/index-Bx192.js'), false);
});

test('enqueueSyncAction prevents duplicate sync tasks with identical IDs', () => {
  let queue: PendingSyncAction[] = [];

  queue = enqueueSyncAction(queue, {
    id: 'sync-task-1',
    userId: 'user-123',
    type: 'CREATE_TASK',
    entityId: 'task-1',
    payload: { title: 'First Draft', completed: false },
  });

  assert.equal(queue.length, 1);
  assert.equal(queue[0].payload.title, 'First Draft');

  // Enqueue same ID with updated content
  queue = enqueueSyncAction(queue, {
    id: 'sync-task-1',
    userId: 'user-123',
    type: 'CREATE_TASK',
    entityId: 'task-1',
    payload: { title: 'Updated Draft', completed: true },
  });

  // Length must remain 1 (no duplicate creation!)
  assert.equal(queue.length, 1);
  assert.equal(queue[0].payload.title, 'Updated Draft');
});

test('dequeueSyncAction removes committed items cleanly', () => {
  const initial: PendingSyncAction[] = [
    {
      id: 'action-1',
      userId: 'u1',
      type: 'CREATE_TASK',
      entityId: 't1',
      payload: {},
      queuedAt: new Date().toISOString(),
      clientTimestamp: Date.now(),
      retryCount: 0,
    },
    {
      id: 'action-2',
      userId: 'u1',
      type: 'UPDATE_TASK',
      entityId: 't2',
      payload: {},
      queuedAt: new Date().toISOString(),
      clientTimestamp: Date.now(),
      retryCount: 0,
    },
  ];

  const remaining = dequeueSyncAction(initial, 'action-1');
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 'action-2');
});

test('resolveSyncConflict prefers newer update timestamp', () => {
  const serverTask = {
    id: 't1',
    title: 'Server Task',
    updatedAt: '2026-11-06T10:00:00.000Z',
  };

  const newerClientTask = {
    id: 't1',
    title: 'Offline Edited Task',
    updatedAt: '2026-11-06T10:05:00.000Z',
  };

  assert.equal(resolveSyncConflict(newerClientTask, serverTask), 'APPLY_CLIENT');

  const olderClientTask = {
    id: 't1',
    title: 'Stale Offline Task',
    updatedAt: '2026-11-06T09:50:00.000Z',
  };

  assert.equal(resolveSyncConflict(olderClientTask, serverTask), 'KEEP_SERVER');
});

test('validateOfflineTaskDraft rejects empty title or invalid date', () => {
  assert.equal(validateOfflineTaskDraft({ id: 't1', title: '', date: '2026-11-06' }).valid, false);
  assert.equal(validateOfflineTaskDraft({ id: 't1', title: 'Valid Title', date: 'invalid-date' }).valid, false);
  assert.equal(validateOfflineTaskDraft({ id: '', title: 'Valid Title', date: '2026-11-06' }).valid, false);
  assert.equal(validateOfflineTaskDraft({ id: 't1', title: 'Valid Title', date: '2026-11-06' }).valid, true);
});
