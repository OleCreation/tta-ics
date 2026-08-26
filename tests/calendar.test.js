// ==========================================
// TEST SUITE: CALENDAR STORAGE & BACKUP
// ==========================================

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { loadAppContext } = require('./helpers/dom-mock');

describe('Calendar Storage, Management & Backup', () => {
    let ctx, dom;

    beforeEach(() => {
        const app = loadAppContext();
        ctx = app.context;
        dom = app.dom;
        dom.localStorage.clear();
    });

    test('calSaveEvents: stores shifts in localStorage and returns accurate stats', () => {
        const shifts = [
            {
                startIso: '20260601T080000',
                stopIso: '20260601T153000',
                type: 'V',
                baseTitle: 'Vakt',
                baseDescription: 'Test',
                totalMedFast: 2250
            },
            {
                startIso: '20260602T080000',
                stopIso: '20260602T153000',
                type: 'V',
                baseTitle: 'Vakt',
                baseDescription: 'Test 2',
                totalMedFast: 2250
            }
        ];

        const result = ctx.calSaveEvents(shifts);
        assert.equal(result.added, 2);
        assert.equal(result.total, 2);
        assert.equal(result.updated, 0);

        const loaded = ctx.calLoadEvents();
        assert.equal(loaded.length, 2);
        assert.equal(loaded[0].id, 'TTA_20260601T080000_V@oms023.tta');
        assert.equal(loaded[1].id, 'TTA_20260602T080000_V@oms023.tta');
    });

    test('calSaveEvents: updates existing shift if re-imported with same UID', () => {
        const initialShift = [{
            startIso: '20260601T080000',
            stopIso: '20260601T153000',
            type: 'V',
            baseTitle: 'Vakt Gammel',
            totalMedFast: 2000
        }];
        ctx.calSaveEvents(initialShift);
        assert.equal(ctx.calGetEventCount(), 1);

        const updatedShift = [{
            startIso: '20260601T080000',
            stopIso: '20260601T153000',
            type: 'V',
            baseTitle: 'Vakt Ny',
            totalMedFast: 2500
        }];
        const result = ctx.calSaveEvents(updatedShift);
        assert.equal(result.added, 0);
        assert.equal(result.updated, 1);
        assert.equal(result.total, 1);

        const loaded = ctx.calLoadEvents();
        assert.equal(loaded[0].baseTitle, 'Vakt Ny');
    });

    test('calRemoveEvent: removes single event by ID', () => {
        const shifts = [
            { startIso: '20260601T080000', stopIso: '20260601T153000', type: 'V', baseTitle: 'Vakt 1' },
            { startIso: '20260602T080000', stopIso: '20260602T153000', type: 'V', baseTitle: 'Vakt 2' }
        ];
        ctx.calSaveEvents(shifts);
        assert.equal(ctx.calGetEventCount(), 2);

        const remaining = ctx.calRemoveEvent('TTA_20260601T080000_V@oms023.tta');
        assert.equal(remaining, 1);
        assert.equal(ctx.calGetEventCount(), 1);
        assert.equal(ctx.calLoadEvents()[0].id, 'TTA_20260602T080000_V@oms023.tta');
    });

    test('calRemoveAllTTAEvents: clears all TTA events and creates a restorable backup', () => {
        const shifts = [
            { startIso: '20260601T080000', stopIso: '20260601T153000', type: 'V', baseTitle: 'Vakt 1' },
            { startIso: '20260602T080000', stopIso: '20260602T153000', type: 'V', baseTitle: 'Vakt 2' }
        ];
        ctx.calSaveEvents(shifts);

        const result = ctx.calRemoveAllTTAEvents();
        assert.equal(result.removed, 2);
        assert.equal(result.remaining, 0);
        assert.equal(ctx.calGetEventCount(), 0);

        // Verify backup exists in localStorage
        const backupRaw = dom.localStorage.getItem('tta_calendar_backup');
        assert.ok(backupRaw);
        const backup = JSON.parse(backupRaw);
        assert.equal(backup.events.length, 2);
    });

    test('calCreateBackup & calRestoreBackup: can backup and fully restore data', () => {
        const shifts = [
            { startIso: '20260601T080000', stopIso: '20260601T153000', type: 'V', baseTitle: 'Vakt 1' }
        ];
        ctx.calSaveEvents(shifts);

        const backup = ctx.calCreateBackup();
        assert.ok(backup);

        // Wipe events
        dom.localStorage.removeItem('tta_calendar_events');
        assert.equal(ctx.calGetEventCount(), 0);

        // Restore
        const restoreResult = ctx.calRestoreBackupObject(backup);
        assert.equal(restoreResult.restored, 1);
        assert.equal(ctx.calGetEventCount(), 1);
        assert.equal(ctx.calLoadEvents()[0].start, '20260601T080000');
    });
});
