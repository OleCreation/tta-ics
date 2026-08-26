// ==========================================
// TEST SUITE: CALCULATOR & HOLIDAYS (HTA)
// ==========================================

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { loadAppContext } = require('./helpers/dom-mock');

describe('Salary Calculator & Norwegian Holidays (HTA)', () => {
    let ctx, dom;

    beforeEach(() => {
        const app = loadAppContext();
        ctx = app.context;
        dom = app.dom;
        dom.document.getElementById('checkIncludeSalary').checked = true;
        dom.document.getElementById('inputAarslonn').value = '585000'; // 300 kr/t (585000 / 1950)
        dom.document.getElementById('inputDivisor').value = '1950';
    });

    test('beregnVaktInntekt: calculates ordinary daytime shift (no supplements)', () => {
        // Monday 08:00 - 15:30 (7.5 hours)
        const res = ctx.beregnVaktInntekt('20260601T080000', '20260601T153000', 'V', true);
        assert.equal(res.timerTotal, 7.5);
        assert.equal(res.nattTimer, 0);
        assert.equal(res.helgeTimer, 0);
        assert.equal(res.skumringTimer, 0);
        assert.equal(res.helligdagTimer, 0);
        assert.equal(res.overtidTimer, 0);
        assert.equal(res.grunnlonn, 7.5 * 300); // 2250 kr
        assert.equal(res.bruttoInntekt, 2250);
        assert.equal(res.tillegg, 0);
    });

    test('beregnVaktInntekt: calculates dusk/evening supplement (17:00 - 20:00 = 40 kr/t)', () => {
        // Monday 15:00 - 20:00 (5 hours: 2 ordinary + 3 dusk)
        const res = ctx.beregnVaktInntekt('20260601T150000', '20260601T200000', 'V', true);
        assert.equal(res.timerTotal, 5.0);
        assert.equal(res.skumringTimer, 3.0);
        assert.equal(res.nattTimer, 0);
        // Grunnlønn: 5 * 300 = 1500. Kveldstillegg: 3 * 40 = 120. Total = 1620.
        assert.equal(res.bruttoInntekt, 1620);
        assert.equal(res.tillegg, 120);
    });

    test('beregnVaktInntekt: calculates night supplement (20:00 - 06:00 = 45% = 135 kr/t)', () => {
        // Monday 22:00 to Tuesday 06:00 (8 hours pure night)
        const res = ctx.beregnVaktInntekt('20260601T220000', '20260602T060000', 'V', true);
        assert.equal(res.timerTotal, 8.0);
        assert.equal(res.nattTimer, 8.0);
        // Grunnlønn: 8 * 300 = 2400. Nattillegg: 8 * (300 * 0.45 = 135) = 1080. Total = 3480.
        assert.equal(res.grunnlonn, 2400);
        assert.equal(res.bruttoInntekt, 3480);
        assert.equal(res.tillegg, 1080);
    });

    test('beregnVaktInntekt: calculates weekend supplement (84 kr/t)', () => {
        // Saturday 08:00 - 16:00 (8 hours weekend day)
        const res = ctx.beregnVaktInntekt('20260606T080000', '20260606T160000', 'V', true);
        assert.equal(res.timerTotal, 8.0);
        assert.equal(res.helgeTimer, 8.0);
        // Grunnlønn: 8 * 300 = 2400. Helgetillegg: 8 * 84 = 672. Total = 3072.
        assert.equal(res.bruttoInntekt, 3072);
        assert.equal(res.tillegg, 672);
    });

    test('beregnVaktInntekt: combines weekend and night supplements on Saturday night', () => {
        // Saturday 22:00 to Sunday 06:00 (8 hours: Helg + Natt)
        const res = ctx.beregnVaktInntekt('20260606T220000', '20260607T060000', 'V', true);
        assert.equal(res.timerTotal, 8.0);
        assert.equal(res.helgeTimer, 8.0);
        assert.equal(res.nattTimer, 8.0);
        // Grunnlønn: 2400. Natt (45% of 300 = 135 * 8 = 1080). Helg (84 * 8 = 672). Total = 4152.
        assert.equal(res.bruttoInntekt, 4152);
        assert.equal(res.tillegg, 1080 + 672);
    });

    test('beregnVaktInntekt: calculates overtime 50% (daytime weekday)', () => {
        // Monday 10:00 - 14:00 overtid (4 hours at 1.5x)
        const res = ctx.beregnVaktInntekt('20260601T100000', '20260601T140000', 'X', true);
        assert.equal(res.timerTotal, 4.0);
        assert.equal(res.overtidTimer, 4.0);
        // Rate: 300 * 1.5 = 450 kr/t. 4 * 450 = 1800 kr.
        assert.equal(res.bruttoInntekt, 1800);
        assert.equal(res.grunnlonn, 1200);
        assert.equal(res.tillegg, 600);
    });

    test('beregnVaktInntekt: calculates overtime 100% (night and weekend)', () => {
        // Saturday 10:00 - 14:00 overtid (4 hours at 2.0x)
        const res = ctx.beregnVaktInntekt('20260606T100000', '20260606T140000', 'X', true);
        assert.equal(res.timerTotal, 4.0);
        assert.equal(res.overtidTimer, 4.0);
        // Rate: 300 * 2.0 = 600 kr/t. 4 * 600 = 2400 kr.
        assert.equal(res.bruttoInntekt, 2400);
        assert.equal(res.grunnlonn, 1200);
        assert.equal(res.tillegg, 1200);
    });

    test('beregnVaktInntekt: calculates on-call home shift (H) 20% factor + beredskap', () => {
        // Monday 08:00 - 16:00 (8 hours daytime beredskap)
        // Rate: (300 * 0.20 = 60) + 19 (Beredskap Dag) = 79 kr/t.
        // 8 * 79 = 632 kr.
        const res = ctx.beregnVaktInntekt('20260601T080000', '20260601T160000', 'H', true);
        assert.equal(res.timerTotal, 8.0);
        assert.equal(res.bruttoInntekt, 632);
        assert.equal(res.grunnlonn, 480); // 8 * 300 * 0.20
        assert.equal(res.tillegg, 152); // 8 * 19
    });

    describe('sjekkOmHelligdag & beregnPaaske (Norwegian holidays)', () => {
        test('identifies fixed national holidays', () => {
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 0, 1, 10, 0)), true);  // 1. Jan (Nyttårsdag)
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 4, 1, 10, 0)), true);  // 1. Mai (Arbeidernes dag)
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 4, 17, 10, 0)), true); // 17. Mai (Grunnlovsdag)
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 11, 25, 10, 0)), true); // 25. Des (1. juledag)
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 11, 26, 10, 0)), true); // 26. Des (2. juledag)
        });

        test('identifies half-day holidays starting at 12:00', () => {
            // Christmas Eve (24. des)
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 11, 24, 10, 0)), false);
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 11, 24, 13, 0)), true);

            // New Year's Eve (31. des)
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 11, 31, 11, 0)), false);
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 11, 31, 12, 0)), true);
        });

        test('calculates accurate movable Easter and Pentecost dates for 2026', () => {
            // Easter Sunday 2026 is April 5, 2026 (month index 3)
            const easter2026 = ctx.beregnPaaske(2026);
            assert.equal(easter2026.getFullYear(), 2026);
            assert.equal(easter2026.getMonth(), 3); // April
            assert.equal(easter2026.getDate(), 5);

            // Skjærtorsdag (-3 dager: 2. april)
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 3, 2, 10, 0)), true);
            // Langfredag (-2 dager: 3. april)
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 3, 3, 10, 0)), true);
            // 1. Påskedag (0 dager: 5. april)
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 3, 5, 10, 0)), true);
            // 2. Påskedag (+1 dag: 6. april)
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 3, 6, 10, 0)), true);
            // Kristi Himmelfart (+39 dager: 14. mai)
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 4, 14, 10, 0)), true);
            // 1. Pinsedag (+49 dager: 24. mai)
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 4, 24, 10, 0)), true);
            // 2. Pinsedag (+50 dager: 25. mai)
            assert.equal(ctx.sjekkOmHelligdag(new Date(2026, 4, 25, 10, 0)), true);
        });

        test('beregnVaktInntekt: applies holiday supplement (133.3%) on 17. mai', () => {
            // Sunday 17. mai 08:00 - 16:00 (8 hours holiday)
            // Rate: 300 + (300 * 1.333 = 399.9) = 699.9 kr/t. 8 * 699.9 = 5599.2 kr. Math.round = 5599.
            const res = ctx.beregnVaktInntekt('20260517T080000', '20260517T160000', 'V', true);
            assert.equal(res.timerTotal, 8.0);
            assert.equal(res.helligdagTimer, 8.0);
            assert.equal(res.bruttoInntekt, 5599);
            assert.equal(res.grunnlonn, 2400);
            assert.equal(res.helligdagTillegg, 3199);
        });
    });

    test('supports custom rates override dynamically', () => {
        // Override night percentage to 50%
        ctx.gjeldendeTillegg.Natt_prosent = 50;
        const res = ctx.beregnVaktInntekt('20260601T220000', '20260602T060000', 'V', true);
        // 8 * (300 + 150) = 3600 kr
        assert.equal(res.bruttoInntekt, 3600);
        assert.equal(res.tillegg, 1200);
    });
});
