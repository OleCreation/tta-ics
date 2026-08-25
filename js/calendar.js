// ==========================================
// CALENDAR MODULE — LocalStorage + ICS
// Handles save, load, remove, backup, restore
// ==========================================

const TTA_CAL_STORAGE_KEY = 'tta_calendar_events';
const TTA_CAL_BACKUP_KEY = 'tta_calendar_backup';
const TTA_EVENT_ID_SUFFIX = '@oms023.tta';

// ---- Core Storage Functions ----

function calSaveEvents(shifts) {
    const existing = calLoadEvents();
    const newEvents = [];

    shifts.forEach(shift => {
        const id = `TTA_${shift.startIso}_${shift.type}${TTA_EVENT_ID_SUFFIX}`;

        // Strip any dynamic warning prefix so baseTitle stored is clean
        let cleanBaseTitle = shift.baseTitle || "";
        if (cleanBaseTitle.startsWith('! - sjekk - ')) {
            cleanBaseTitle = cleanBaseTitle.substring('! - sjekk - '.length);
        }

        // Build title same as ICS
        let title = cleanBaseTitle;
        const useWorkHours = document.getElementById('WorkHours')?.checked;
        const includeSalary = document.getElementById('checkIncludeSalary')?.checked || false;
        const useSalary = includeSalary && document.getElementById('SalaryInTitle')?.checked;

        if (useWorkHours) {
            title = getWorkHour(shift.startIso) + '-' + getWorkHour(shift.stopIso) + ' | ' + title;
        }
        if (useSalary) {
            title += ' (' + formatMoney(shift.totalMedFast) + ' kr)';
        }

        const event = {
            id: id,
            title: title,
            start: shift.startIso,
            end: shift.stopIso,
            type: shift.type,
            income: includeSalary ? Math.round(shift.totalMedFast) : 0,
            baseTitle: cleanBaseTitle,
            description: shift.baseDescription || "",
            createdAt: new Date().toISOString()
        };

        // Replace existing with same ID or add new
        const existingIdx = existing.findIndex(e => e.id === id);
        if (existingIdx >= 0) {
            existing[existingIdx] = event;
        } else {
            newEvents.push(event);
        }
    });

    const allEvents = [...existing, ...newEvents];
    allEvents.sort((a, b) => a.start.localeCompare(b.start));

    localStorage.setItem(TTA_CAL_STORAGE_KEY, JSON.stringify(allEvents));
    return { total: allEvents.length, added: newEvents.length, updated: shifts.length - newEvents.length };
}

function calLoadEvents() {
    try {
        const data = localStorage.getItem(TTA_CAL_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Feil ved lasting av kalender:', e);
        return [];
    }
}

function calGetEventCount() {
    return calLoadEvents().length;
}

function calRemoveEvent(eventId) {
    const events = calLoadEvents();
    const filtered = events.filter(e => e.id !== eventId);
    localStorage.setItem(TTA_CAL_STORAGE_KEY, JSON.stringify(filtered));
    return filtered.length;
}

function calRemoveAllTTAEvents() {
    // First create backup
    calCreateBackup();

    const events = calLoadEvents();
    const nonTTA = events.filter(e => !e.id.endsWith(TTA_EVENT_ID_SUFFIX));
    localStorage.setItem(TTA_CAL_STORAGE_KEY, JSON.stringify(nonTTA));
    return { removed: events.length - nonTTA.length, remaining: nonTTA.length };
}

// ---- Backup & Restore ----

function calCreateBackup() {
    const events = calLoadEvents();
    if (events.length === 0) return null;

    const backup = {
        version: '1.0',
        app: 'TTA vakter til kalender',
        user: 'OMS023',
        createdAt: new Date().toISOString(),
        eventCount: events.length,
        events: events
    };

    // Also store as last backup in localStorage
    localStorage.setItem(TTA_CAL_BACKUP_KEY, JSON.stringify(backup));

    return backup;
}

function calDownloadBackup() {
    const backup = calCreateBackup();
    if (!backup) {
        visToast('Ingen hendelser å ta backup av.');
        return;
    }

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const date = new Date().toISOString().slice(0, 10);
    const filename = `TTA_backup_${date}.json`;

    const a = document.createElement('a');
    a.download = filename;
    a.href = URL.createObjectURL(blob);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    visToast(`Backup lastet ned: ${filename}`);
}

function calRestoreFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const backup = JSON.parse(e.target.result);
                if (!backup.events || !Array.isArray(backup.events)) {
                    reject('Ugyldig backup-fil: mangler events.');
                    return;
                }

                // Merge with existing
                const existing = calLoadEvents();
                const merged = [...existing];

                let added = 0;
                backup.events.forEach(evt => {
                    const idx = merged.findIndex(e => e.id === evt.id);
                    if (idx >= 0) {
                        merged[idx] = evt; // Update existing
                    } else {
                        merged.push(evt);
                        added++;
                    }
                });

                merged.sort((a, b) => a.start.localeCompare(b.start));
                localStorage.setItem(TTA_CAL_STORAGE_KEY, JSON.stringify(merged));

                resolve({ total: merged.length, added: added, restored: backup.events.length });
            } catch (err) {
                reject('Kunne ikke lese backup-fil: ' + err.message);
            }
        };
        reader.onerror = () => reject('Feil ved lesing av fil.');
        reader.readAsText(file);
    });
}

// ---- UI Rendering ----

function calRenderEventList(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Recalculate rules conflicts on saved events
    if (typeof RulesEngine !== 'undefined') {
        RulesEngine.kjorSjekk([]);
    }

    const events = calLoadEvents();

    // Update badge count
    const badge = document.getElementById('calEventBadge');
    if (badge) {
        badge.textContent = events.length;
        badge.className = 'event-count' + (events.length === 0 ? ' empty' : '');
    }

    if (events.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" style="color: var(--text-disabled); margin-bottom: 8px;">
                    <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display: block; margin: 0 auto;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </div>
                <p style="font-weight: 600; color: var(--text); font-size: 0.85rem; margin: 0;">Ingen lagrede vakter ennå.</p>
                <p style="font-size: 0.75rem; margin-top: 4px; color: var(--text-dim);">Beregn vakter og lagre dem til kalenderen.</p>
            </div>`;
        return;
    }

    let html = '';
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
    let currentMonth = '';

    events.forEach(evt => {
        // Month header
        const dateObj = parseIsoToDate(evt.start);
        const monthKey = `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        if (monthKey !== currentMonth) {
            currentMonth = monthKey;
            html += `<div class="section-label" style="padding: 12px 16px 4px;">${monthKey}</div>`;
        }

        const day = String(dateObj.getDate()).padStart(2, '0');
        const mon = String(dateObj.getMonth() + 1).padStart(2, '0');
        const timeStart = evt.start.slice(9, 11) + ':' + evt.start.slice(11, 13);
        const timeEnd = evt.end.slice(9, 11) + ':' + evt.end.slice(11, 13);

        const typeColors = {
            'V': 'var(--accent)',
            'X': 'var(--warning)',
            'H': 'var(--success)',
            'R': 'var(--text-muted)',
            'B': 'var(--danger)'
        };
        const dotColor = typeColors[evt.type] || 'var(--text-dim)';

        let warningTextHtml = '';
        if (evt.description && evt.description.includes('--- ADVARSEL: REGELBRUDD ---')) {
            const warningPart = evt.description.split('--- ADVARSEL: REGELBRUDD ---')[1].trim();
            // Convert bullets to clean layout
            const formattedWarning = warningPart.replace(/• /g, '').replace(/\n/g, '<br>');
            warningTextHtml = `<div style="font-size: 0.72rem; color: var(--danger); margin-top: 4px; line-height: 1.3; font-weight: 500;">⚠️ ${formattedWarning}</div>`;
        }

        let metaText = `${day}.${mon} · ${timeStart}–${timeEnd}`;
        if (evt.income && evt.income > 0) {
            metaText += ` · ${formatMoney(evt.income)} kr`;
        }

        html += `
            <div class="cal-event-item" style="align-items: flex-start; padding: 10px 14px;">
                <div style="width: 6px; height: 6px; border-radius: 50%; background: ${dotColor}; margin-top: 6px; margin-right: 12px; flex-shrink: 0;"></div>
                <div class="cal-event-info" style="flex: 1; min-width: 0;">
                    <div class="cal-event-title" style="font-weight: 600; font-size: 0.88rem; color: var(--text-strong);">${evt.baseTitle || evt.title}</div>
                    <div class="cal-event-meta" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${metaText}</div>
                    ${warningTextHtml}
                </div>
                <button class="cal-event-delete" onclick="calDeleteSingle('${evt.id}', '${containerId}')" title="Slett" style="margin-top: 2px;">✕</button>
            </div>`;
    });

    container.innerHTML = html;
}

function calDeleteSingle(eventId, containerId) {
    calRemoveEvent(eventId);
    calRenderEventList(containerId);
    visToast('Vakt fjernet fra kalender.');
}

function calShowRenskConfirm() {
    const events = calLoadEvents();
    const ttaCount = events.filter(e => e.id.endsWith(TTA_EVENT_ID_SUFFIX)).length;

    if (ttaCount === 0) {
        visToast('Ingen TTA-vakter å fjerne.');
        return;
    }

    if (confirm(`Rensk kalender?\n\nDette vil fjerne ${ttaCount} TTA-vakt(er).\nEn backup blir automatisk lagret først.`)) {
        const result = calRemoveAllTTAEvents();
        calRenderEventList('calEventListContainer');
        visToast(`${result.removed} TTA-vakt(er) fjernet. Backup lagret.`);
    }
}

function calHandleRestore() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const result = await calRestoreFromFile(file);
            calRenderEventList('calEventListContainer');
            visToast(`Gjenopprettet! ${result.added} nye, ${result.total} totalt.`);
        } catch (err) {
            visToast("Feil ved gjenoppretting: " + err);
        }
    };
    input.click();
}
