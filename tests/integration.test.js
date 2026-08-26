// ==========================================
// TEST SUITE: END-TO-END INTEGRATION TEST
// ==========================================

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { loadAppContext } = require('./helpers/dom-mock');

describe('Full End-to-End Workflow Integration', () => {
    let ctx, dom;

    beforeEach(() => {
        const app = loadAppContext();
        ctx = app.context;
        dom = app.dom;
        dom.localStorage.clear();

        // Setup user options
        dom.document.getElementById('checkIncludeSalary').checked = true;
        dom.document.getElementById('inputAarslonn').value = '585000'; // 300 kr/t
        dom.document.getElementById('inputDivisor').value = '1950';
        dom.document.getElementById('checkUregulert').checked = true;
        dom.document.getElementById('valUregulert').value = '48000'; // 4000 kr/mnd
        dom.document.getElementById('WorkHours').checked = true;
        dom.document.getElementById('SalaryInTitle').checked = true;
    });

    test('Full workflow: Parse schedule -> Calculate Salary -> Rule Check -> Generate ICS -> Save to Calendar', () => {
        // Complete realistic schedule:
        // 1. Monday daytime shift
        // 2. Tuesday evening/night overtime ending 23:00
        // 3. Wednesday morning shift starting 06:00 (Rule breach: 7h rest)
        // 4. Saturday night shift (Weekend + Night)
        // 5. Sunday home on-call shift (H)
        const ttaInput = `
Uke Dag Fra dato / kl Til dato / kl Kode
23 Mandag 01.06.26 08:00 01.06.26 15:30 V
23 Tirsdag 02.06.26 15:00 02.06.26 23:00 X
23 Onsdag 03.06.26 06:00 03.06.26 14:00 V
23 Lørdag 06.06.26 22:00 07.06.26 06:00 V
23 Søndag 07.06.26 08:00 07.06.26 16:00 H
`;

        // Step 1: Parse
        const parseErr = ctx.parseTTA2Shifts(ttaInput);
        assert.equal(parseErr, null);
        assert.equal(ctx.globalShiftsData.length, 5);

        // Step 2: Calculate salary & monthly distribution
        ctx.kalkulerMaanedligeOgFaste();
        assert.equal(ctx.globalShiftsData[0].fasteTilleggMnd, 4000);
        assert.equal(ctx.globalShiftsData[0].antallVakterMnd, 5);
        assert.equal(ctx.globalShiftsData[0].fastTilleggAndel, 800);

        // Step 3: Run Rules Engine
        ctx.RulesEngine.kjorSjekk(ctx.globalShiftsData);

        // Verify Wednesday shift caught the rest violation (< 8h after Tuesday overtime)
        const wednesdayShift = ctx.globalShiftsData[2];
        assert.ok(wednesdayShift.baseTitle.startsWith('! - sjekk - Vakt'));
        assert.ok(wednesdayShift.baseDescription.includes('alvorlig brudd (krever minimum 8 timer)'));
        assert.ok(wednesdayShift.baseDescription.includes('kun 7.0 timer hvile'));

        // Step 4: Generate ICS
        const ics = ctx.genererICS();
        assert.ok(ics.includes('BEGIN:VCALENDAR'));
        assert.ok(ics.includes('SUMMARY:06-14 | ! - sjekk - Vakt'));
        assert.ok(ics.includes('alvorlig brudd'));
        assert.ok(ics.includes('Totalt kr for vakt ='));
        assert.ok(ics.includes('END:VCALENDAR'));

        // Step 5: Save to Calendar in LocalStorage
        const saveStats = ctx.calSaveEvents(ctx.globalShiftsData);
        assert.equal(saveStats.added, 5);
        assert.equal(ctx.calGetEventCount(), 5);

        const savedEvents = ctx.calLoadEvents();
        assert.equal(savedEvents.length, 5);
        // Base titles in storage should be clean of dynamic prefix
        assert.equal(savedEvents[2].baseTitle, 'Vakt');

        // Step 6: Backup and clear
        const backup = ctx.calCreateBackup();
        ctx.calRemoveAllTTAEvents();
        assert.equal(ctx.calGetEventCount(), 0);

        // Step 7: Restore
        ctx.calRestoreBackupObject(backup);
        assert.equal(ctx.calGetEventCount(), 5);
    });
});
