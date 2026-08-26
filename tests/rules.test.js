// ==========================================
// TEST SUITE: RULES ENGINE & REST PERIODS
// ==========================================

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { loadAppContext } = require('./helpers/dom-mock');

describe('Rules Engine & Rest Period Checks', () => {
    let ctx, dom;

    beforeEach(() => {
        const app = loadAppContext();
        ctx = app.context;
        dom = app.dom;
    });

    test('Overtime rest rule: flags serious breach when rest is less than 8 hours', () => {
        // Shift 1: Overtime ending Monday at 23:00
        // Shift 2: Regular shift starting Tuesday at 06:00 (only 7 hours rest)
        const shifts = [
            {
                startIso: '20260601T150000',
                stopIso: '20260601T230000',
                type: 'X',
                baseTitle: 'Overtid',
                baseDescription: 'Overtid kveld'
            },
            {
                startIso: '20260602T060000',
                stopIso: '20260602T140000',
                type: 'V',
                baseTitle: 'Vakt',
                baseDescription: 'Tidlig vakt'
            }
        ];

        ctx.RulesEngine.kjorSjekk(shifts);

        assert.ok(shifts[1].baseTitle.startsWith('! - sjekk - Vakt'));
        assert.ok(shifts[1].baseDescription.includes('--- ADVARSEL: REGELBRUDD ---'));
        assert.ok(shifts[1].baseDescription.includes('alvorlig brudd (krever minimum 8 timer)'));
        assert.ok(shifts[1].baseDescription.includes('kun 7.0 timer hvile'));
    });

    test('Overtime rest rule: flags norm breach when rest is between 8 and 11 hours', () => {
        // Shift 1: Overtime ending at 22:00
        // Shift 2: Regular shift starting next morning at 07:30 (9.5 hours rest)
        const shifts = [
            {
                startIso: '20260601T140000',
                stopIso: '20260601T220000',
                type: 'X',
                baseTitle: 'Overtid',
                baseDescription: ''
            },
            {
                startIso: '20260602T073000',
                stopIso: '20260602T150000',
                type: 'V',
                baseTitle: 'Vakt',
                baseDescription: ''
            }
        ];

        ctx.RulesEngine.kjorSjekk(shifts);

        assert.ok(shifts[1].baseTitle.startsWith('! - sjekk - Vakt'));
        assert.ok(shifts[1].baseDescription.includes('bryter med normen på 11 timer'));
        assert.ok(shifts[1].baseDescription.includes('kun 9.5 timer hvile'));
    });

    test('Overtime rest rule: passes without warnings when rest is 11 hours or more', () => {
        // Shift 1: Overtime ending at 20:00
        // Shift 2: Regular shift starting next day at 08:00 (12 hours rest)
        const shifts = [
            {
                startIso: '20260601T120000',
                stopIso: '20260601T200000',
                type: 'X',
                baseTitle: 'Overtid',
                baseDescription: ''
            },
            {
                startIso: '20260602T080000',
                stopIso: '20260602T153000',
                type: 'V',
                baseTitle: 'Vakt',
                baseDescription: ''
            }
        ];

        ctx.RulesEngine.kjorSjekk(shifts);

        assert.equal(shifts[0].baseTitle, 'Overtid');
        assert.equal(shifts[1].baseTitle, 'Vakt');
        assert.ok(!shifts[1].baseDescription.includes('ADVARSEL'));
    });

    test('Overlap rule: detects overlapping shifts between current shifts', () => {
        const shifts = [
            {
                startIso: '20260601T080000',
                stopIso: '20260601T160000',
                type: 'V',
                baseTitle: 'Dagvakt',
                baseDescription: ''
            },
            {
                startIso: '20260601T140000',
                stopIso: '20260601T220000',
                type: 'X',
                baseTitle: 'Overtid',
                baseDescription: ''
            }
        ];

        ctx.RulesEngine.kjorSjekk(shifts);

        assert.ok(shifts[0].baseTitle.startsWith('! - sjekk - '));
        assert.ok(shifts[1].baseTitle.startsWith('! - sjekk - '));
        assert.ok(shifts[0].baseDescription.includes('Overlappende vakter'));
        assert.ok(shifts[1].baseDescription.includes('Overlappende vakter'));
    });

    test('Overlap rule: does not flag identical saved calendar event as conflict', () => {
        // Save event in calendar
        const savedEvent = {
            id: 'TTA_20260601T080000_V@oms023.tta',
            title: '08-1530 | Vakt',
            start: '20260601T080000',
            end: '20260601T153000',
            type: 'V',
            baseTitle: 'Vakt',
            description: ''
        };
        dom.localStorage.setItem('tta_calendar_events', JSON.stringify([savedEvent]));

        // Re-parsing the exact same shift
        const currentShifts = [
            {
                startIso: '20260601T080000',
                stopIso: '20260601T153000',
                type: 'V',
                baseTitle: 'Vakt',
                baseDescription: ''
            }
        ];

        ctx.RulesEngine.kjorSjekk(currentShifts);

        // Should NOT be marked as an overlap conflict
        assert.equal(currentShifts[0].baseTitle, 'Vakt');
        assert.ok(!currentShifts[0].baseDescription.includes('Overlappende vakter'));
    });

    test('RulesEngine idempotency: repeated executions do not duplicate prefixes or warning blocks', () => {
        const shifts = [
            {
                startIso: '20260601T150000',
                stopIso: '20260601T230000',
                type: 'X',
                baseTitle: 'Overtid',
                baseDescription: 'Original beskrivelse'
            },
            {
                startIso: '20260602T060000',
                stopIso: '20260602T140000',
                type: 'V',
                baseTitle: 'Vakt',
                baseDescription: 'Original vakt'
            }
        ];

        // Run check 3 times in a row
        ctx.RulesEngine.kjorSjekk(shifts);
        ctx.RulesEngine.kjorSjekk(shifts);
        ctx.RulesEngine.kjorSjekk(shifts);

        assert.equal(shifts[1].baseTitle, '! - sjekk - Vakt');
        // Count occurrences of '! - sjekk - '
        const prefixMatches = shifts[1].baseTitle.match(/! - sjekk - /g) || [];
        assert.equal(prefixMatches.length, 1);

        // Count occurrences of header block
        const warningHeaderMatches = shifts[1].baseDescription.match(/--- ADVARSEL: REGELBRUDD ---/g) || [];
        assert.equal(warningHeaderMatches.length, 1);
    });
});

