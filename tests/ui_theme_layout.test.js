// ==========================================
// TEST SUITE: UI, THEMES & RESPONSIVE LAYOUT
// ==========================================

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadAppContext } = require('./helpers/dom-mock');

describe('UI Theme & Layout Width Controls', () => {
    let ctx, dom;

    beforeEach(() => {
        const app = loadAppContext();
        ctx = app.context;
        dom = app.dom;
        dom.localStorage.clear();
    });

    test('Theme cycling: supports strictly 2 modes (blue and dark)', () => {
        assert.deepEqual(Array.from(ctx.themes), ['blue', 'dark']);

        // Start at blue
        dom.document.documentElement.setAttribute('data-theme', 'blue');

        // Cycle 1 -> dark
        ctx.cycleTheme();
        assert.equal(dom.document.documentElement.getAttribute('data-theme'), 'dark');
        assert.equal(dom.localStorage.getItem('tta_theme'), 'dark');

        // Cycle 2 -> blue
        ctx.cycleTheme();
        assert.equal(dom.document.documentElement.getAttribute('data-theme'), 'blue');
        assert.equal(dom.localStorage.getItem('tta_theme'), 'blue');
    });

    test('Layout width toggle: switches between wide (960px) and compact (480px)', () => {
        // Default auto/compact
        dom.document.documentElement.setAttribute('data-width', 'auto');

        // Toggle 1 -> wide
        ctx.toggleLayoutWidth();
        assert.equal(dom.document.documentElement.getAttribute('data-width'), 'wide');
        assert.equal(dom.localStorage.getItem('tta_layout_width'), 'wide');

        // Toggle 2 -> compact
        ctx.toggleLayoutWidth();
        assert.equal(dom.document.documentElement.getAttribute('data-width'), 'compact');
        assert.equal(dom.localStorage.getItem('tta_layout_width'), 'compact');
    });

    test('Settings persistence: correctly serializes and restores user form settings', () => {
        dom.document.getElementById('checkIncludeSalary').checked = true;
        dom.document.getElementById('inputAarslonn').value = '650000';
        dom.document.getElementById('inputDivisor').value = '1950';
        dom.document.getElementById('checkUregulert').checked = false;
        dom.document.getElementById('valUregulert').value = '50000';
        dom.document.getElementById('checkEtterforsker').checked = true;
        dom.document.getElementById('valEtterforsker').value = '40000';
        dom.document.getElementById('WorkHours').checked = false;
        dom.document.getElementById('SalaryInTitle').checked = true;

        ctx.saveUserSettings();

        const savedRaw = dom.localStorage.getItem('tta_user_settings');
        assert.ok(savedRaw);

        // Reset form values
        dom.document.getElementById('inputAarslonn').value = '0';
        dom.document.getElementById('checkIncludeSalary').checked = false;

        // Load settings
        ctx.loadUserSettings();

        assert.equal(dom.document.getElementById('checkIncludeSalary').checked, true);
        assert.equal(dom.document.getElementById('inputAarslonn').value, '650000');
        assert.equal(dom.document.getElementById('checkUregulert').checked, false);
        assert.equal(dom.document.getElementById('checkEtterforsker').checked, true);
        assert.equal(dom.document.getElementById('valEtterforsker').value, '40000');
        assert.equal(dom.document.getElementById('WorkHours').checked, false);
        assert.equal(dom.document.getElementById('SalaryInTitle').checked, true);
    });

    test('HTML Structure: index.html has GitHub link, header actions, and no duplicate buttons', () => {
        const htmlPath = path.resolve(__dirname, '../index.html');
        const html = fs.readFileSync(htmlPath, 'utf8');

        // Verify GitHub link in header
        assert.ok(html.includes('https://github.com/OleCreation/tta-ics'), 'GitHub link must be present');
        assert.ok(html.includes('class="header-actions"'), 'header-actions container must be present');
        assert.ok(html.includes('toggleLayoutWidth()'), 'toggleLayoutWidth button must be present in header');
        assert.ok(html.includes('cycleTheme()'), 'cycleTheme button must be present in header');

        // Verify responsive grid layout wrappers
        assert.ok(html.includes('class="layout-grid"'), 'layout-grid wrapper must be present');
        assert.ok(html.includes('class="layout-col-main"'), 'layout-col-main must be present');
        assert.ok(html.includes('class="layout-col-side"'), 'layout-col-side must be present');
        assert.ok(html.includes('class="result-grid"'), 'result-grid must be present');

        // Verify that secondary-tools does NOT have duplicated icon-only buttons
        const toolRowMatch = html.match(/<div class="tool-row">([\s\S]*?)<\/div>/);
        assert.ok(toolRowMatch);
        const toolRowContent = toolRowMatch[1];
        assert.ok(!toolRowContent.includes('toggleLayoutWidth'), 'tool-row should not duplicate width toggle');
        assert.ok(!toolRowContent.includes('cycleTheme'), 'tool-row should not duplicate theme toggle');
    });
});
