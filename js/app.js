// ==========================================
// GLOBALE VARIABLER & DATA
// ==========================================
var globalIcsString = "";
var globalShiftsData = [];

var gjeldendeTillegg = {
    Natt_prosent: 45,
    Skumring_kr: 40,
    Helg_kr: 84,
    Beredskap_dag_kr: 19,
    Beredskap_natt_kr: 32,
    Helligdag_prosent: 133.3,
    Hjemmevakt_faktor: 0.20
};

// ==========================================
// UI, ANIMASJONER & EVENTLISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    let today = new Date().toISOString().split('T')[0];
    document.getElementById("manDatoFra").value = today;
    document.getElementById("manDatoTil").value = today;

    // ---- Load saved user settings ----
    loadUserSettings();

    // ---- Load Theme & Width ----
    let savedTheme = localStorage.getItem('tta_theme') || 'blue';
    if (savedTheme !== 'blue' && savedTheme !== 'dark') savedTheme = 'blue';
    document.documentElement.setAttribute('data-theme', savedTheme);

    const savedWidth = localStorage.getItem('tta_layout_width') || 'auto';
    document.documentElement.setAttribute('data-width', savedWidth);

    // ---- Platform detection & visibility adjustment ----
    const platform = typeof Capacitor !== 'undefined' ? Capacitor.getPlatform() : 'web';
    if (platform === 'web') {
        const btnSave = document.getElementById('btnSaveToCal');
        if (btnSave) btnSave.style.display = 'none';
        
        const cardSaved = document.getElementById('cardSavedVakter');
        if (cardSaved) cardSaved.style.display = 'none';
        
        const resultActions = document.querySelector('.result-actions');
        if (resultActions) {
            resultActions.style.gridTemplateColumns = '1fr 1fr';
        }
    }
});

// ---- Settings persistence ----
function saveUserSettings() {
    try {
        const settings = {
            includeSalary: document.getElementById('checkIncludeSalary')?.checked || false,
            aarslonn: document.getElementById('inputAarslonn')?.value || "580000",
            divisor: document.getElementById('inputDivisor')?.value || "1950",
            checkUregulert: document.getElementById('checkUregulert')?.checked ?? true,
            valUregulert: document.getElementById('valUregulert')?.value || "45000",
            checkEtterforsker: document.getElementById('checkEtterforsker')?.checked ?? false,
            valEtterforsker: document.getElementById('valEtterforsker')?.value || "35000",
            workHours: document.getElementById('WorkHours')?.checked ?? true,
            salaryInTitle: document.getElementById('SalaryInTitle')?.checked ?? false
        };
        localStorage.setItem('tta_user_settings', JSON.stringify(settings));
    } catch(e) {
        console.error('Kunne ikke lagre innstillinger:', e);
    }
}

function loadUserSettings() {
    try {
        const saved = localStorage.getItem('tta_user_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            
            const chkSalary = document.getElementById('checkIncludeSalary');
            if (chkSalary && typeof settings.includeSalary === 'boolean') chkSalary.checked = settings.includeSalary;
            
            const inpAarslonn = document.getElementById('inputAarslonn');
            if (inpAarslonn && settings.aarslonn) inpAarslonn.value = settings.aarslonn;
            
            const inpDivisor = document.getElementById('inputDivisor');
            if (inpDivisor && settings.divisor) inpDivisor.value = settings.divisor;
            
            const chkUreg = document.getElementById('checkUregulert');
            if (chkUreg && typeof settings.checkUregulert === 'boolean') chkUreg.checked = settings.checkUregulert;
            
            const valUreg = document.getElementById('valUregulert');
            if (valUreg && settings.valUregulert) valUreg.value = settings.valUregulert;
            
            const chkEtter = document.getElementById('checkEtterforsker');
            if (chkEtter && typeof settings.checkEtterforsker === 'boolean') chkEtter.checked = settings.checkEtterforsker;
            
            const valEtter = document.getElementById('valEtterforsker');
            if (valEtter && settings.valEtterforsker) valEtter.value = settings.valEtterforsker;
            
            const chkHours = document.getElementById('WorkHours');
            if (chkHours && typeof settings.workHours === 'boolean') chkHours.checked = settings.workHours;
            
            const chkSalTitle = document.getElementById('SalaryInTitle');
            if (chkSalTitle && typeof settings.salaryInTitle === 'boolean') chkSalTitle.checked = settings.salaryInTitle;
        }
    } catch(e) {
        console.error('Kunne ikke laste innstillinger:', e);
    }

    // Attach auto-save listeners
    ['inputAarslonn', 'inputDivisor', 'checkUregulert', 'valUregulert', 'checkEtterforsker', 'valEtterforsker', 'WorkHours', 'SalaryInTitle'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                updateRatePreview();
                saveUserSettings();
            });
            if (el.tagName === 'INPUT' && el.type === 'number') {
                el.addEventListener('input', () => {
                    updateRatePreview();
                    saveUserSettings();
                });
            }
        }
    });

    toggleSalaryOption(false);
    updateRatePreview();
}

function toggleSalaryOption(doSave = true) {
    const chkSalary = document.getElementById('checkIncludeSalary');
    const isSalary = chkSalary ? chkSalary.checked : false;
    
    const quickPanel = document.getElementById('quickSalaryPanel');
    const lblSalTitle = document.getElementById('lblSalaryInTitle');
    const ctaBtnText = document.getElementById('ctaBtnText');

    if (quickPanel) quickPanel.style.display = isSalary ? 'block' : 'none';
    if (lblSalTitle) lblSalTitle.style.display = isSalary ? 'inline-flex' : 'none';
    if (ctaBtnText) {
        ctaBtnText.textContent = isSalary ? "Beregn vakter & lønn" : "Konverter til kalender (ICS)";
    }

    if (doSave) {
        saveUserSettings();
    }
}

function updateRatePreview() {
    const aarslonn = parseFloat(document.getElementById('inputAarslonn')?.value) || 0;
    const divisor = parseFloat(document.getElementById('inputDivisor')?.value) || 1950;
    const rate = divisor > 0 ? (aarslonn / divisor) : 0;
    
    const badge = document.getElementById('ratePreviewBadge');
    if (badge) {
        badge.textContent = `${(rate).toFixed(2).replace('.', ',')} kr/t`;
    }
}

// ---- Theme & Width Cycling ----
var themes = ['blue', 'dark'];
function cycleTheme() {
    let current = document.documentElement.getAttribute('data-theme') || 'blue';
    let nextIndex = (themes.indexOf(current) + 1) % themes.length;
    let nextTheme = themes[nextIndex];
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('tta_theme', nextTheme);
    visToast(`Tema endret til: ${nextTheme === 'blue' ? 'BLÅ' : 'MØRK'}`);
}

function toggleLayoutWidth() {
    const current = document.documentElement.getAttribute('data-width') || 'auto';
    let next;
    if (current === 'wide') {
        next = 'compact';
        visToast("Layout: Kompakt (480px)");
    } else {
        next = 'wide';
        visToast("Layout: Dobbel bredde (960px)");
    }
    document.documentElement.setAttribute('data-width', next);
    localStorage.setItem('tta_layout_width', next);
}

// ---- Input Mode Toggle (Manual only — TTA is always visible) ----
let currentInputMode = null;

function toggleInputMode(mode) {
    const manualPanel = document.getElementById('manualPanel');
    const salaryCard = document.getElementById('salaryCard');

    if (mode === 'manual') {
        if (manualPanel.style.display === 'block') {
            manualPanel.style.display = 'none';
        } else {
            manualPanel.style.display = 'block';
            manualPanel.classList.add('fade-in');
            salaryCard.style.display = 'none';
        }
    }
}

// ---- Section Toggle & Close ----
function toggleSection(contentId, iconId) {
    if (contentId === 'salaryContent') {
        const salaryCard = document.getElementById('salaryCard');
        const manualPanel = document.getElementById('manualPanel');
        if (salaryCard.style.display === 'block') {
            salaryCard.style.display = 'none';
        } else {
            salaryCard.style.display = 'block';
            salaryCard.classList.add('fade-in');
            manualPanel.style.display = 'none';
        }
        return;
    }
    
    const content = document.getElementById(contentId);
    if (content) {
        content.classList.toggle('hidden');
    }
    const icon = document.getElementById(iconId);
    if (icon) icon.classList.toggle('rotated');
}

function forceCloseSection(contentId, iconId) {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(iconId);
    if (content && !content.classList.contains('hidden')) {
        content.classList.add('hidden');
        if (icon) icon.classList.add('rotated');
    }
}

function toggleCalendarView() {
    const mgmt = document.getElementById('calendarManagement');
    if (mgmt.classList.contains('hidden')) {
        mgmt.classList.remove('hidden');
        calRenderEventList('calEventListContainer');
    } else {
        mgmt.classList.add('hidden');
    }
}

function visToast(melding) {
    let toast = document.getElementById("toast");
    toast.innerText = melding;
    toast.className = "show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

function formatMoney(num) {
    return new Intl.NumberFormat('no-NO').format(Math.round(num));
}

// ==========================================
// FILHÅNDTERING & MANUELL VAKT
// ==========================================
function handterKildeValg() {
    let velger = document.getElementById('kildeVelger');
    let filInput = document.getElementById('filOpplaster');
    let filInstruksjon = document.getElementById('filInstruksjon');
    
    if (velger.value === "fil") {
        filInput.style.display = "block";
        filInstruksjon.style.display = "block";
    } else {
        filInput.style.display = "none";
        filInstruksjon.style.display = "none";
        gjeldendeTillegg = {
            Natt_prosent: 45, Skumring_kr: 40, Helg_kr: 84, Beredskap_dag_kr: 19, 
            Beredskap_natt_kr: 32, Helligdag_prosent: 133.3, Hjemmevakt_faktor: 0.20
        };
        const dot = document.getElementById('satsStatus');
        if (dot) dot.style.background = 'var(--success)';
        visToast("Gjenopprettet standard satser.");
    }
}

function lesSatsFil(event) {
    let fil = event.target.files[0];
    if (!fil) return;

    let reader = new FileReader();
    reader.onload = function(e) {
        let innhold = e.target.result;
        let linjer = innhold.split('\n');
        let lesteVerdier = 0;

        linjer.forEach(linje => {
            if (linje.trim().startsWith("//") || !linje.includes("=")) return;
            
            let deler = linje.split("=");
            let nokkel = deler[0].trim();
            let verdi = parseFloat(deler[1].trim());

            if (!isNaN(verdi)) {
                if (gjeldendeTillegg.hasOwnProperty(nokkel)) {
                    gjeldendeTillegg[nokkel] = verdi;
                    lesteVerdier++;
                } else if (nokkel === "AT_tillegg_kr") {
                    document.getElementById('valUregulert').value = verdi;
                    document.getElementById('checkUregulert').checked = true;
                    saveUserSettings();
                    lesteVerdier++;
                }
            }
        });

        if (lesteVerdier > 0) {
            const dot = document.getElementById('satsStatus');
            if (dot) dot.style.background = 'var(--warning)';
            visToast(`Suksess! Lastet inn ${lesteVerdier} satser fra fil.`);
        } else {
            visToast("Feil: Kunne ikke finne noen gyldige satser i filen.");
            document.getElementById('kildeVelger').value = "standard";
            handterKildeValg();
        }
    };
    reader.readAsText(fil);
}

function leggTilManuelt() {
    let dFra = document.getElementById('manDatoFra').value;
    let tFra = document.getElementById('manTidFra').value;
    let dTil = document.getElementById('manDatoTil').value;
    let tTil = document.getElementById('manTidTil').value;
    let type = document.getElementById('manType').value;
    let ekstra = document.getElementById('manEkstra').value.trim().toUpperCase();

    if (!dFra || !tFra || !dTil || !tTil) {
        visToast("Du må fylle inn både dato og tid for start og slutt.");
        return;
    }

    let fParts = dFra.split('-');
    let tParts = dTil.split('-');
    let formatertFra = `${fParts[2]}.${fParts[1]}.${fParts[0].slice(2)}`;
    let formatertTil = `${tParts[2]}.${tParts[1]}.${tParts[0].slice(2)}`;

    const dagerNavn = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
    let dateObj = new Date(parseInt(fParts[0]), parseInt(fParts[1]) - 1, parseInt(fParts[2]));
    let dagNavn = dagerNavn[dateObj.getDay()] || "Mandag";

    let nyLinje = `${dagNavn} ${formatertFra} ${tFra} ${formatertTil} ${tTil} ${type}${ekstra}`;
    
    let ttaFelt = document.getElementById('TTA');
    if (ttaFelt.value.trim().length > 0 && !ttaFelt.value.endsWith('\n')) {
        ttaFelt.value += '\n';
    }
    ttaFelt.value += nyLinje;
    
    visToast("Vakt lagt til! Trykk 'Beregn' når du er ferdig.");
}

function settInnTestdata() {
    let dummy = "UkeDagFradato/klTildato/kl\n" +
    "1  Mandag 22.05.26 08:00 22.05.26 15:30 V\n" +
    "1  Tirsdag 23.05.26 14:00 23.05.26 22:00 V\n" +
    "1  Fredag 25.05.26 16:00 25.05.26 22:00 X\n" + 
    "1  Lørdag 26.05.26 22:00 27.05.26 06:00 X\n" + 
    "1  Søndag 27.05.26 08:00 27.05.26 15:30 X";
    
    document.getElementById('TTA').value = dummy;
    visToast("Testdata lastet inn!");
}

// ==========================================
// HOVEDFLYT (Utførelse og Opptegning)
// ==========================================
function konverter() {
    let ttaInput = document.getElementById('TTA').value;
    
    let errorMsg = parseTTA2Shifts(ttaInput);
    if (errorMsg) {
        visToast(errorMsg);
        const ttaCard = document.getElementById('ttaCard');
        if (ttaCard) {
            ttaCard.style.borderColor = 'var(--danger)';
            setTimeout(() => { ttaCard.style.borderColor = ''; }, 3000);
        }
        return;
    }

    kalkulerMaanedligeOgFaste();
    
    // Validate shifts rules conflicts (overtime rest, overlaps)
    if (typeof RulesEngine !== 'undefined') {
        RulesEngine.kjorSjekk(globalShiftsData);
    }
    
    globalIcsString = genererICS();

    document.getElementById('inputSection').style.display = "none";
    document.getElementById('resultSection').style.display = "block";

    renderSummaryAndList();

    // Also render calendar event list
    calRenderEventList('calEventListContainer');
}

function renderSummaryAndList() {
    let includeSalary = document.getElementById('checkIncludeSalary')?.checked || false;
    let monthlyStats = {};
    const monthNames = ["Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember"];

    globalShiftsData.forEach(shift => {
        let dateObj = parseIsoToDate(shift.startIso);
        let monthKey = `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        
        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = { 
                antallVakter: 0, 
                bruttoVakter: 0, 
                grunnlonn: 0, 
                tillegg: 0, 
                timer: 0,
                nattTimer: 0,
                helgeTimer: 0,
                overtidTimer: 0
            };
        }
        monthlyStats[monthKey].antallVakter += 1;
        monthlyStats[monthKey].bruttoVakter += shift.income.bruttoInntekt;
        monthlyStats[monthKey].grunnlonn += shift.income.grunnlonn;
        monthlyStats[monthKey].tillegg += (shift.income.tillegg + shift.income.helligdagTillegg);
        monthlyStats[monthKey].timer += shift.income.timerTotal;
        monthlyStats[monthKey].nattTimer += (shift.income.nattTimer || 0);
        monthlyStats[monthKey].helgeTimer += (shift.income.helgeTimer || 0);
        monthlyStats[monthKey].overtidTimer += (shift.income.overtidTimer || 0);
    });

    let htmlSummary = "";

    for (const [month, stats] of Object.entries(monthlyStats)) {
        let sampleShiftForMonth = globalShiftsData.find(s => {
            let d = parseIsoToDate(s.startIso);
            return `${monthNames[d.getMonth()]} ${d.getFullYear()}` === month;
        });
        let fasteTilleggMnd = sampleShiftForMonth ? sampleShiftForMonth.fasteTilleggMnd : 0;
        let mndBruttoTotal = stats.bruttoVakter + fasteTilleggMnd;
        
        if (includeSalary) {
            htmlSummary += `<div class="card card-accent-success">
                <div class="card-header" style="border:none; padding-bottom:0;">
                    <h3 style="border:none; margin:0; font-size: 1rem; display: flex; align-items: center; gap: 6px;">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: var(--success);"><rect x="18" y="3" width="4" height="18" rx="1"></rect><rect x="10" y="8" width="4" height="13" rx="1"></rect><rect x="2" y="13" width="4" height="8" rx="1"></rect></svg>
                        <span>${month}</span>
                    </h3>
                </div>
                <div class="card-body">
                    <div class="dashboard-grid">
                        <div class="metric-card"><span>Vakter</span><strong>${stats.antallVakter}</strong></div>
                        <div class="metric-card"><span>Timer totalt</span><strong>${stats.timer.toFixed(1)} t</strong></div>
                        <div class="metric-card"><span>Faste Tillegg</span><strong>${formatMoney(fasteTilleggMnd)} kr</strong></div>
                        <div class="metric-card metric-success">
                            <span>Total Bruttolønn</span>
                            <strong>${formatMoney(mndBruttoTotal)} kr</strong>
                        </div>
                    </div>

                    <details style="cursor: pointer; padding: 10px; background: var(--surface); border-radius: var(--radius-sm); font-size: 0.9rem; border: 1px solid var(--border);">
                        <summary style="font-weight: 600; color: var(--accent);">Se fordeling av lønn</summary>
                        <div style="padding-top: 10px; line-height: 1.8; color: var(--text-muted);">
                            • Grunnlønn for vakter: <b style="color: var(--text-strong);">${formatMoney(stats.grunnlonn)} kr</b><br>
                            • Turnustillegg (Natt/Helg/Overtid): <b style="color: var(--text-strong);">${formatMoney(stats.tillegg)} kr</b><br>
                            • Faste månedlige tillegg fordelt: <b style="color: var(--text-strong);">${formatMoney(fasteTilleggMnd)} kr</b>
                        </div>
                    </details>
                </div>
            </div>`;
        } else {
            htmlSummary += `<div class="card card-accent-top">
                <div class="card-header" style="border:none; padding-bottom:0;">
                    <h3 style="border:none; margin:0; font-size: 1rem; display: flex; align-items: center; gap: 6px;">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span>${month}</span>
                    </h3>
                </div>
                <div class="card-body">
                    <div class="dashboard-grid">
                        <div class="metric-card"><span>Antall vakter</span><strong>${stats.antallVakter}</strong></div>
                        <div class="metric-card"><span>Timer totalt</span><strong>${stats.timer.toFixed(1)} t</strong></div>
                        <div class="metric-card"><span>Natt / Helg</span><strong>${(stats.nattTimer + stats.helgeTimer).toFixed(1)} t</strong></div>
                        <div class="metric-card"><span>Overtid</span><strong>${stats.overtidTimer.toFixed(1)} t</strong></div>
                    </div>
                </div>
            </div>`;
        }
    }
    
    document.getElementById('summaryDiv').innerHTML = htmlSummary;

    let htmlList = '';

    globalShiftsData.forEach(shift => {
        let startD = parseIsoToDate(shift.startIso);
        let endD = parseIsoToDate(shift.stopIso);
        
        let yy = String(startD.getFullYear()).slice(2);
        let dateStr = `${String(startD.getDate()).padStart(2, '0')}.${String(startD.getMonth() + 1).padStart(2, '0')}.${yy}`;
        let timeStr = `${String(startD.getHours()).padStart(2, '0')}:${String(startD.getMinutes()).padStart(2, '0')}-${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
        
        let warningBadge = '';
        if (shift.baseDescription && shift.baseDescription.includes('--- ADVARSEL: REGELBRUDD ---')) {
            warningBadge = `<span style="font-size: 0.75rem; color: var(--danger); font-weight: bold; margin-left: 6px;">⚠️ Regelbrudd</span>`;
        }

        let breakdownInner = '';
        if (includeSalary) {
            shift.income.segmenter.forEach(seg => {
                breakdownInner += `<div style="display: flex; gap: 8px; border-bottom: 1px dotted var(--border); padding: 3px 0; font-size: 0.8rem;">
                    <span style="min-width: 80px; color: var(--text-muted);">${seg.startTid}-${seg.sluttTid}</span>
                    <span style="flex:1; color: var(--text);">${seg.label}</span>
                    <span style="white-space:nowrap; color: var(--text-muted);">${formatMoney(seg.krPerTime)} kr/t = <b style="color: var(--text);">${formatMoney(seg.belop)} kr</b></span>
                </div>`;
            });
            
            breakdownInner += `
                <div style="margin-top: 8px; font-size: 0.85rem;">
                    <div style="display: flex; justify-content: space-between; color: var(--text-muted);"><span>Vakt totalt</span><span><b style="color: var(--text-strong);">${formatMoney(shift.income.bruttoInntekt)} kr</b></span></div>
                    ${shift.fasteTilleggMnd > 0 ? `<div style="display: flex; justify-content: space-between; color: var(--text-dim);"><span>Faste tillegg (${formatMoney(shift.fasteTilleggMnd)}/${shift.antallVakterMnd} vakter)</span><span><b>${formatMoney(shift.fastTilleggAndel)} kr</b></span></div>` : ''}
                    <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--success); margin-top: 4px; border-top: 1.5px solid var(--border); padding-top: 4px;">
                        <span>Totalt</span><span>${formatMoney(shift.totalMedFast)} kr</span>
                    </div>
                </div>`;
        } else {
            breakdownInner += `
                <div style="font-size: 0.85rem; line-height: 1.6; color: var(--text);">
                    <div><strong>Vakttype:</strong> ${shift.baseTitle}</div>
                    <div><strong>Tidspunkt:</strong> ${timeStr} (${shift.income.timerTotal} timer)</div>
                    ${shift.income.nattTimer > 0 ? `<div>• Natt-timer: ${shift.income.nattTimer} t</div>` : ''}
                    ${shift.income.helgeTimer > 0 ? `<div>• Helge-timer: ${shift.income.helgeTimer} t</div>` : ''}
                    ${shift.income.skumringTimer > 0 ? `<div>• Kvelds-timer: ${shift.income.skumringTimer} t</div>` : ''}
                    ${shift.income.overtidTimer > 0 ? `<div>• Overtid: ${shift.income.overtidTimer} t</div>` : ''}
                </div>`;
        }

        if (shift.baseDescription && shift.baseDescription.includes('--- ADVARSEL: REGELBRUDD ---')) {
            const warningPart = shift.baseDescription.substring(shift.baseDescription.indexOf('--- ADVARSEL: REGELBRUDD ---'));
            breakdownInner += `<div style="margin-top: 10px; padding: 8px; background: rgba(200, 90, 84, 0.1); border-left: 3px solid var(--danger); border-radius: 4px; color: var(--danger); font-size: 0.8rem; white-space: pre-wrap;">${warningPart.trim()}</div>`;
        }

        let rightBadge = includeSalary 
            ? `<span style="font-weight: 700; font-size: 0.9rem; white-space: nowrap; margin-left: 8px; color: var(--success);">${formatMoney(shift.totalMedFast)} kr</span>`
            : `<span style="font-weight: 600; font-size: 0.85rem; white-space: nowrap; margin-left: 8px; color: var(--accent-hover);">${shift.income.timerTotal} t</span>`;

        htmlList += `<details>
            <summary>
                <div style="display: flex; align-items: baseline; gap: 8px; flex: 1; min-width: 0;">
                    <span style="font-weight: 600; font-size: 0.9rem; white-space: nowrap;">${dateStr}</span>
                    <span style="color: var(--text-muted); font-size: 0.8rem; white-space: nowrap;">${timeStr}</span>
                    <span style="font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${shift.baseTitle}</span>
                    ${warningBadge}
                </div>
                ${rightBadge}
            </summary>
            <div style="background: var(--surface); padding: 12px; border-radius: var(--radius-sm); margin: 8px 16px 12px; font-family: 'SF Mono', Menlo, 'Cascadia Code', monospace, sans-serif; overflow-x: auto; border: 1px solid var(--border);">
                ${breakdownInner}
            </div>
        </details>`;
    });

    document.getElementById('listDiv').innerHTML = htmlList;
}

// ==========================================
// CALENDAR SAVE HANDLER
// ==========================================
function handleSaveToCalendar() {
    if (globalShiftsData.length === 0) {
        visToast('Ingen vakter å lagre.');
        return;
    }

    const result = calSaveEvents(globalShiftsData);
    calRenderEventList('calEventListContainer');
    visToast(`Lagret! ${result.added} nye, ${result.total} totalt i kalender.`);
}

// ==========================================
// ICS DOWNLOAD & SHARE
// ==========================================
async function save2ics() {
    if (!globalIcsString) return;
    let today = new Date();
    let dd = String(today.getDate()).padStart(2, '0');
    let mm = String(today.getMonth() + 1).padStart(2, '0');
    let yyyy = today.getFullYear();
    let filename = yyyy + '-' + mm + '-' + dd + '_TTA_Arbeidstid.ics';
    
    // Check if running inside Capacitor with Filesystem and Share plugins available
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem && window.Capacitor.Plugins.Share) {
        try {
            const { Filesystem, Directory } = window.Capacitor.Plugins;
            const { Share } = window.Capacitor.Plugins;
            
            // Save the file to the Cache directory
            const writeResult = await Filesystem.writeFile({
                path: filename,
                data: globalIcsString,
                directory: Directory.Cache,
                encoding: 'utf8'
            });
            
            // Open the native share dialog for the file
            await Share.share({
                title: 'TTA Arbeidstid',
                text: 'Her er din vaktliste-kalenderfil.',
                url: writeResult.uri,
                dialogTitle: 'Lagre eller del kalenderfil'
            });
            visToast("Kalender delt!");
            return;
        } catch (err) {
            console.error("Feil ved deling av kalender via Capacitor:", err);
            visToast("Deling mislyktes. Laster ned standard fil...");
        }
    }
    
    // Fallback for normal web browsers
    let blob = new Blob([globalIcsString], { type: "text/calendar;charset=utf-8"});
    let anchor = document.createElement("a");
    anchor.download = filename;
    anchor.href = window.URL.createObjectURL(blob);
    anchor.target = "_blank";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);  
}
