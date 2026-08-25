// ==========================================
// RULES ENGINE MODULE
// Extensible framework for shift rules checking
// ==========================================

const RulesEngine = {
    // Array of rule checkers
    rules: [
        // Rule 1: Overtime daily rest limit (8 or 11 hours)
        {
            name: "Hviletid etter overtid",
            sjekk: function(vaktA, vaktB) {
                // Returns warning string if there is a conflict, otherwise null
                // vaktA is the earlier shift, vaktB is the later shift.
                // We check if vaktA is Overtime ("X") and vaktB starts within 11 hours.
                if (vaktA.type !== 'X') return null;
                
                const startB = parseIsoToDate(vaktB.startIso);
                const endA = parseIsoToDate(vaktA.stopIso);
                
                const gapMs = startB - endA;
                const gapHours = gapMs / (1000 * 60 * 60);
                
                if (gapHours >= 0 && gapHours < 11) {
                    const gapStr = gapHours.toFixed(1);
                    const formattedDate = formatDateShort(endA);
                    const formattedTime = formatTimeShort(endA);
                    
                    if (gapHours < 8) {
                        return `Kolliderer med overtid: kun ${gapStr} timer hvile etter overtid (avsluttet ${formattedDate} kl. ${formattedTime}). Dette er et alvorlig brudd (krever minimum 8 timer).`;
                    } else {
                        return `Kolliderer med overtid: kun ${gapStr} timer hvile etter overtid (avsluttet ${formattedDate} kl. ${formattedTime}). Dette bryter med normen på 11 timer.`;
                    }
                }
                return null;
            }
        },
        // Rule 2: Overlapping shifts
        {
            name: "Overlappende vakter",
            sjekk: function(vaktA, vaktB) {
                // If one is a saved event and the other is a parsed shift, and they represent
                // the exact same shift (exact same start and end times), do not flag as overlap.
                if (vaktA.isSavedEvent !== vaktB.isSavedEvent && vaktA.startIso === vaktB.startIso && vaktA.stopIso === vaktB.stopIso) {
                    return null;
                }

                const startA = parseIsoToDate(vaktA.startIso);
                const endA = parseIsoToDate(vaktA.stopIso);
                const startB = parseIsoToDate(vaktB.startIso);
                const endB = parseIsoToDate(vaktB.stopIso);
                
                // Overlap exists if startB is before endA and endB is after startA
                if (startB < endA && endB > startA) {
                    return `Overlappende vakter: Denne vakten overlapper med en annen vakt (${vaktA.baseTitle || vaktA.title}).`;
                }
                return null;
            }
        }
    ],

    // Master checker: takes current shifts and saved calendar events,
    // recalculates conflicts, and decorates titles and descriptions.
    kjorSjekk: function(currentShifts) {
        const shifts = currentShifts || [];
        const savedEvents = typeof calLoadEvents === 'function' ? calLoadEvents() : [];

        if (shifts.length === 0 && savedEvents.length === 0) return;

        // Build a sorted, unified list of events to evaluate
        // Map saved calendar events to standard format so they can be processed by rules
        const savedEventWrappers = savedEvents.map(e => ({
            id: e.id,
            startIso: e.start,
            stopIso: e.end,
            type: e.type,
            baseTitle: e.baseTitle || e.title,
            baseDescription: e.description || "",
            isSavedEvent: true,
            originalRef: e
        }));

        // Map current shifts to unified structure
        const shiftWrappers = shifts.map((s, idx) => ({
            index: idx,
            startIso: s.startIso,
            stopIso: s.stopIso,
            type: s.type,
            baseTitle: s.baseTitle,
            baseDescription: s.baseDescription || "",
            isSavedEvent: false,
            originalRef: s
        }));

        const allEvents = [...savedEventWrappers, ...shiftWrappers];
        
        // Clean prefixes if they already exist, so we don't duplicate '! - sjekk - ' on recalculations
        allEvents.forEach(e => {
            if (e.baseTitle.startsWith('! - sjekk - ')) {
                e.baseTitle = e.baseTitle.substring('! - sjekk - '.length);
                if (e.originalRef && e.originalRef.baseTitle) {
                    e.originalRef.baseTitle = e.baseTitle;
                }
            }
            // Strip any warning text from description if it was added previously
            const idx = e.baseDescription.indexOf('\n\n--- ADVARSEL: REGELBRUDD ---');
            if (idx >= 0) {
                e.baseDescription = e.baseDescription.substring(0, idx);
            }
        });

        // Sort all events chronologically by start time
        allEvents.sort((a, b) => a.startIso.localeCompare(b.startIso));

        // Perform validation loop: for each event i, compare it with other events j
        // within a 7-day window (before and after)
        const updatedSavedEvents = new Set();

        for (let i = 0; i < allEvents.length; i++) {
            const curr = allEvents[i];
            const startCurr = parseIsoToDate(curr.startIso);
            const warnings = [];

            // Read backwards for 7 days
            for (let j = i - 1; j >= 0; j--) {
                const prev = allEvents[j];
                const endPrev = parseIsoToDate(prev.stopIso);
                const diffDays = (startCurr - endPrev) / (1000 * 60 * 60 * 24);
                if (diffDays > 7) break; // Beyond 7 days window

                // Run rules
                this.rules.forEach(rule => {
                    const warn = rule.sjekk(prev, curr);
                    if (warn) {
                        warnings.push(warn);
                    }
                });
            }

            // Read forwards for 7 days
            for (let j = i + 1; j < allEvents.length; j++) {
                const next = allEvents[j];
                const startNext = parseIsoToDate(next.startIso);
                const diffDays = (startNext - parseIsoToDate(curr.stopIso)) / (1000 * 60 * 60 * 24);
                if (diffDays > 7) break;

                // Run rules where curr is the first shift (A) and next is the second shift (B)
                this.rules.forEach(rule => {
                    const warn = rule.sjekk(curr, next);
                    if (warn) {
                        if (rule.name === "Overlappende vakter") {
                            warnings.push(warn);
                        }
                    }
                });
            }

            // If warnings found, decorate the shift
            if (warnings.length > 0) {
                curr.baseTitle = `! - sjekk - ${curr.baseTitle}`;
                const warningBlock = `\n\n--- ADVARSEL: REGELBRUDD ---\n` + warnings.map(w => `• ${w}`).join('\n');
                curr.baseDescription = curr.baseDescription + warningBlock;

                // Update original objects
                if (curr.isSavedEvent) {
                    curr.originalRef.title = curr.baseTitle;
                    curr.originalRef.description = curr.baseDescription;
                    updatedSavedEvents.add(curr.originalRef);
                } else {
                    curr.originalRef.baseTitle = curr.baseTitle;
                    curr.originalRef.baseDescription = curr.baseDescription;
                }
            } else {
                // Revert to original text if no warning matches anymore
                if (curr.isSavedEvent) {
                    curr.originalRef.title = curr.baseTitle;
                    curr.originalRef.description = curr.baseDescription;
                } else {
                    curr.originalRef.baseTitle = curr.baseTitle;
                    curr.originalRef.baseDescription = curr.baseDescription;
                }
            }
        }

        // Save back any updated calendar events in localStorage so the changes persist
        if (typeof calLoadEvents === 'function' && savedEvents.length > 0) {
            localStorage.setItem(TTA_CAL_STORAGE_KEY, JSON.stringify(savedEvents));
        }
    }
};

// ---- Local formatting helpers ----
function formatDateShort(date) {
    const days = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${days[date.getDay()]} ${d}.${m}`;
}

function formatTimeShort(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

if (typeof window !== 'undefined') window.RulesEngine = RulesEngine;
if (typeof global !== 'undefined') global.RulesEngine = RulesEngine;
