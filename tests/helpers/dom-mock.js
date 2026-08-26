// ==========================================
// DOM MOCK & TEST HARNESS FOR NODE.JS
// Provides browser globals (window, document, localStorage)
// ==========================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createDOMMock() {
    const storage = new Map();
    const elements = new Map();

    const localStorageMock = {
        getItem: (key) => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: (key) => storage.delete(key),
        clear: () => storage.clear(),
        get length() { return storage.size; }
    };

    const documentAttributes = new Map();

    const documentElementMock = {
        setAttribute: (k, v) => documentAttributes.set(k, String(v)),
        getAttribute: (k) => documentAttributes.get(k) || null,
        removeAttribute: (k) => documentAttributes.delete(k)
    };

    function createMockElement(id, initialProps = {}) {
        const el = {
            id: id,
            value: initialProps.value || '',
            checked: initialProps.checked !== undefined ? initialProps.checked : false,
            style: {},
            classList: {
                classes: new Set(),
                add(cls) { this.classes.add(cls); },
                remove(cls) { this.classes.delete(cls); },
                contains(cls) { return this.classes.has(cls); }
            },
            textContent: '',
            innerHTML: '',
            children: [],
            appendChild(child) { this.children.push(child); return child; },
            setAttribute(k, v) { this[k] = v; },
            getAttribute(k) { return this[k] || null; },
            addEventListener() {},
            removeEventListener() {},
            ...initialProps
        };
        elements.set(id, el);
        return el;
    }

    // Pre-populate standard form controls found in www/index.html
    createMockElement('checkIncludeSalary', { checked: false });
    createMockElement('inputAarslonn', { value: '580000' });
    createMockElement('inputDivisor', { value: '1950' });
    createMockElement('checkUregulert', { checked: true });
    createMockElement('valUregulert', { value: '45000' });
    createMockElement('checkEtterforsker', { checked: false });
    createMockElement('valEtterforsker', { value: '35000' });
    createMockElement('WorkHours', { checked: true });
    createMockElement('SalaryInTitle', { checked: false });
    createMockElement('TTA', { value: '' });
    createMockElement('manDatoFra', { value: '2026-06-01' });
    createMockElement('manTidFra', { value: '08:00' });
    createMockElement('manDatoTil', { value: '2026-06-01' });
    createMockElement('manTidTil', { value: '15:30' });
    createMockElement('manType', { value: 'V' });
    createMockElement('manEkstra', { value: '' });
    createMockElement('toast', { textContent: '' });
    createMockElement('listDiv', { innerHTML: '' });
    createMockElement('summaryDiv', { innerHTML: '' });
    createMockElement('calEventListContainer', { innerHTML: '' });
    createMockElement('btnSaveToCal', { style: {} });
    createMockElement('cardSavedVakter', { style: {} });
    createMockElement('ratePreviewBadge', { textContent: '' });
    createMockElement('inputSection', { style: {} });
    createMockElement('resultSection', { style: {} });

    const documentMock = {
        documentElement: documentElementMock,
        getElementById: (id) => {
            if (elements.has(id)) return elements.get(id);
            return createMockElement(id);
        },
        querySelector: (selector) => {
            if (selector.startsWith('#')) return documentMock.getElementById(selector.slice(1));
            return createMockElement(selector);
        },
        querySelectorAll: () => [],
        createElement: (tag) => createMockElement(tag),
        addEventListener: () => {}
    };

    return {
        localStorage: localStorageMock,
        document: documentMock,
        createMockElement,
        storage,
        documentAttributes,
        elements
    };
}

function loadAppContext() {
    const dom = createDOMMock();
    const sandbox = {
        window: {},
        document: dom.document,
        localStorage: dom.localStorage,
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        Date: Date,
        Math: Math,
        parseFloat: parseFloat,
        parseInt: parseInt,
        String: String,
        JSON: JSON,
        RegExp: RegExp,
        Array: Array,
        Object: Object,
        Set: Set,
        Map: Map,
        visToast: () => {}
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;

    const context = vm.createContext(sandbox);

    const baseDir = path.resolve(__dirname, '../../js');
    const files = ['calculator.js', 'rules.js', 'parser.js', 'calendar.js', 'app.js'];

    files.forEach(file => {
        const filePath = path.join(baseDir, file);
        const code = fs.readFileSync(filePath, 'utf8');
        vm.runInContext(code, context, { filename: file });
    });

    return {
        context: context,
        dom: dom
    };
}

module.exports = {
    createDOMMock,
    loadAppContext
};
