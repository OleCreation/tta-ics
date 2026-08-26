// ==========================================
// TEST SUITE: TTA PARSER & ICS GENERATOR
// ==========================================

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { loadAppContext } = require('./helpers/dom-mock');

describe('TTA Parser & ICS Generator', () => {
    let ctx, dom;

    beforeEach(() => {
        const app = loadAppContext();
        ctx = app.context;
        dom = app.dom;
    });

    test('parseTTA2Shifts: returns error on empty input', () => {
        const result = ctx.parseTTA2Shifts('');
        assert.equal(result, 'Lim inn TTA data i tekstfeltet først!');
        assert.equal(ctx.globalShiftsData.length, 0);
    });

    test('parseTTA2Shifts: returns error when no valid shifts found', () => {
        const result = ctx.parseTTA2Shifts('Dette er bare noe tilfeldig tekst uten vakter');
        assert.equal(result, 'Fant ingen gyldige vakter i inndataen.');
    });

    test('parseTTA2Shifts: parses single standard shift (V)', () => {
        const input = 'Uke 23\nMandag 01.06.26 08:00 01.06.26 15:30 V';
        const err = ctx.parseTTA2Shifts(input);
        assert.equal(err, null);
        assert.equal(ctx.globalShiftsData.length, 1);

        const shift = ctx.globalShiftsData[0];
        assert.equal(shift.type, 'V');
        assert.equal(shift.baseTitle, 'Vakt');
        assert.equal(shift.startIso, '20260601T080000');
        assert.equal(shift.stopIso, '20260601T153000');
    });

    test('parseTTA2Shifts: handles TTA header line without choking', () => {
        const input = `Uke Dag Fra dato / kl Til dato / kl Kode
23 Mandag 01.06.26 08:00 01.06.26 15:30 V
23 Tirsdag 02.06.26 15:00 02.06.26 22:30 V`;
        const err = ctx.parseTTA2Shifts(input);
        assert.equal(err, null);
        assert.equal(ctx.globalShiftsData.length, 2);
    });

    test('parseTTA2Shifts: parses all shift types correctly (V, X, H, R, B)', () => {
        const input = `
Mandag 01.06.26 08:00 01.06.26 15:30 V
Tirsdag 02.06.26 15:00 02.06.26 23:00 X
Onsdag 03.06.26 20:00 04.06.26 08:00 H
Torsdag 04.06.26 08:00 04.06.26 15:30 R
Fredag 05.06.26 08:00 05.06.26 15:30 B
`;
        const err = ctx.parseTTA2Shifts(input);
        assert.equal(err, null);
        assert.equal(ctx.globalShiftsData.length, 5);

        assert.equal(ctx.globalShiftsData[0].type, 'V');
        assert.equal(ctx.globalShiftsData[0].baseTitle, 'Vakt');

        assert.equal(ctx.globalShiftsData[1].type, 'X');
        assert.equal(ctx.globalShiftsData[1].baseTitle, 'Overtid');

        assert.equal(ctx.globalShiftsData[2].type, 'H');
        assert.equal(ctx.globalShiftsData[2].baseTitle, 'Hjemmevakt');

        assert.equal(ctx.globalShiftsData[3].type, 'R');
        assert.equal(ctx.globalShiftsData[3].baseTitle, 'Reserve');

        assert.equal(ctx.globalShiftsData[4].type, 'B');
        assert.equal(ctx.globalShiftsData[4].baseTitle, 'Utkjøpt reserve');
    });

    test('parseTTA2Shifts: filters out hidden/leave codes F (Fri), P (Permisjon), S (Syk)', () => {
        const input = `
Mandag 01.06.26 08:00 01.06.26 15:30 V
Tirsdag 02.06.26 08:00 02.06.26 15:30 VF
Onsdag 03.06.26 08:00 03.06.26 15:30 VP
Torsdag 04.06.26 08:00 04.06.26 15:30 VS
Fredag 05.06.26 08:00 05.06.26 15:30 V
`;
        const err = ctx.parseTTA2Shifts(input);
        assert.equal(err, null);
        assert.equal(ctx.globalShiftsData.length, 2);
        assert.equal(ctx.globalShiftsData[0].startIso, '20260601T080000');
        assert.equal(ctx.globalShiftsData[1].startIso, '20260605T080000');
    });

    test('parseTTA2Shifts: interprets sub-codes (A, B, H, N, O, Q, W, X, Y)', () => {
        const input = `
Mandag 01.06.26 08:00 01.06.26 15:30 VA
Tirsdag 02.06.26 08:00 02.06.26 15:30 VB
Onsdag 03.06.26 08:00 03.06.26 15:30 VH
Torsdag 04.06.26 08:00 04.06.26 15:30 VN
Fredag 05.06.26 08:00 05.06.26 15:30 VO
Lørdag 06.06.26 08:00 06.06.26 15:30 VW
Søndag 07.06.26 08:00 07.06.26 15:30 VX
Mandag 08.06.26 08:00 08.06.26 15:30 VY
`;
        const err = ctx.parseTTA2Shifts(input);
        assert.equal(err, null);
        assert.equal(ctx.globalShiftsData.length, 8);

        assert.equal(ctx.globalShiftsData[0].baseTitle, 'Vakt Annet fravær');
        assert.equal(ctx.globalShiftsData[1].baseTitle, 'Vakt (Byttet)');
        assert.equal(ctx.globalShiftsData[2].baseTitle, 'Vakt (OM)');
        assert.equal(ctx.globalShiftsData[3].baseTitle, 'Vakt (NyFri)');
        assert.equal(ctx.globalShiftsData[4].baseTitle, 'Vakt Omlegg');
        assert.equal(ctx.globalShiftsData[5].baseTitle, 'Vakt flyttet fra');
        assert.equal(ctx.globalShiftsData[6].baseTitle, 'Vakt (X)');
        assert.equal(ctx.globalShiftsData[7].baseTitle, 'Vakt flytt til');
    });

    test('convertDateToIso: correctly converts 2-digit and 4-digit years and pads hours/minutes', () => {
        assert.equal(ctx.convertDateToIso('01.06.26 08:00'), '20260601T080000');
        assert.equal(ctx.convertDateToIso('1.6.2026 8:05'), '20260601T080500');
        assert.equal(ctx.convertDateToIso('31.12.25 23:59'), '20251231T235900');
    });

    test('getWorkHour: returns 2 digits when minutes are 00, full 4 digits otherwise', () => {
        assert.equal(ctx.getWorkHour('20260601T080000'), '08');
        assert.equal(ctx.getWorkHour('20260601T153000'), '1530');
        assert.equal(ctx.getWorkHour('20260601T000000'), '00');
    });

    test('getVaktKode & getVaktKoder: extracts primary and secondary codes', () => {
        assert.equal(ctx.getVaktKode('V'), 'V');
        assert.equal(ctx.getVaktKode('VO'), 'V');
        assert.equal(ctx.getVaktKode('15:30VO'), 'V');
        assert.equal(ctx.getVaktKoder('15:30VO'), 'VO');
        assert.equal(ctx.getVaktKoder('15:30V'), 'V');
    });

    test('kalkulerMaanedligeOgFaste: distributes fixed monthly additions among shifts', () => {
        dom.document.getElementById('checkIncludeSalary').checked = true;
        dom.document.getElementById('checkUregulert').checked = true;
        dom.document.getElementById('valUregulert').value = '48000'; // 4000/mnd
        dom.document.getElementById('checkEtterforsker').checked = true;
        dom.document.getElementById('valEtterforsker').value = '24000'; // 2000/mnd -> total 6000/mnd

        const input = `
Mandag 01.06.26 08:00 01.06.26 15:30 V
Tirsdag 02.06.26 08:00 02.06.26 15:30 V
Onsdag 03.06.26 08:00 03.06.26 15:30 V
Torsdag 04.06.26 08:00 04.06.26 15:30 V
`;
        ctx.parseTTA2Shifts(input);
        ctx.kalkulerMaanedligeOgFaste();

        assert.equal(ctx.globalShiftsData[0].fasteTilleggMnd, 6000);
        assert.equal(ctx.globalShiftsData[0].antallVakterMnd, 4);
        assert.equal(ctx.globalShiftsData[0].fastTilleggAndel, 1500);
        assert.ok(ctx.globalShiftsData[0].totalMedFast > 1500);
    });

    test('genererICS: creates valid iCalendar string with required RFC 5545 components', () => {
        dom.document.getElementById('WorkHours').checked = true;
        dom.document.getElementById('checkIncludeSalary').checked = false;

        const input = 'Mandag 01.06.26 08:00 01.06.26 15:30 V';
        ctx.parseTTA2Shifts(input);
        ctx.kalkulerMaanedligeOgFaste();

        const ics = ctx.genererICS();
        assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
        assert.ok(ics.includes('PRODID:-//Vakter fra TTA til kalender OMS023//NO'));
        assert.ok(ics.includes('BEGIN:VTIMEZONE'));
        assert.ok(ics.includes('TZID:Europe/Oslo'));
        assert.ok(ics.includes('BEGIN:VEVENT'));
        assert.ok(ics.includes('UID:TTA_20260601T080000_V@oms023.tta'));
        assert.ok(ics.includes('DTSTART;TZID=Europe/Oslo:20260601T080000'));
        assert.ok(ics.includes('DTEND;TZID=Europe/Oslo:20260601T153000'));
        assert.ok(ics.includes('SUMMARY:08-1530 | Vakt'));
        assert.ok(ics.includes('DESCRIPTION:Vakt: Vakt\\nTid: 08:00 - 15:30\\nVarighet: 7.5 timer'));
        assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
    });

    test('genererICS: includes salary breakdown in description and salary in title when requested', () => {
        dom.document.getElementById('checkIncludeSalary').checked = true;
        dom.document.getElementById('SalaryInTitle').checked = true;
        dom.document.getElementById('WorkHours').checked = true;
        dom.document.getElementById('inputAarslonn').value = '585000'; // 300 kr/t
        dom.document.getElementById('inputDivisor').value = '1950';

        const input = 'Mandag 01.06.26 08:00 01.06.26 16:00 V';
        ctx.parseTTA2Shifts(input);
        ctx.kalkulerMaanedligeOgFaste();

        const ics = ctx.genererICS();
        assert.ok(ics.includes('SUMMARY:08-16 | Vakt ('));
        assert.ok(ics.includes('kr)'));
        assert.ok(ics.includes('Grunnsats'));
        assert.ok(ics.includes('Vakt totalt ='));
    });

    test('genererICS: propagates rules engine warnings into ICS event description', () => {
        const shift = {
            baseTitle: '! - sjekk - Vakt',
            baseDescription: 'Vakt: Vakt\n\n--- ADVARSEL: REGELBRUDD ---\n• Kolliderer med overtid: kun 7.0 timer hvile',
            startIso: '20260602T080000',
            stopIso: '20260602T153000',
            type: 'V',
            income: { timerTotal: 7.5, bruttoInntekt: 0, segmenter: [] },
            fasteTilleggMnd: 0,
            antallVakterMnd: 1,
            fastTilleggAndel: 0,
            totalMedFast: 0
        };
        ctx.globalShiftsData = [shift];

        const ics = ctx.genererICS();
        assert.ok(ics.includes('ADVARSEL: REGELBRUDD'));
        assert.ok(ics.includes('Kolliderer med overtid'));
    });
});

