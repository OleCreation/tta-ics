// ==========================================
// TTA PARSER & ICS GENERATOR
// ==========================================

function parseTTA2Shifts(tta) {
    let input = tta.trim();
    globalShiftsData = [];

    if (input.length < 1) return "Lim inn TTA data i tekstfeltet først!";

    let vakter = input.split(/\r?\n/);
    let x = 0;
    if (vakter[0] && vakter[0].replace(/\s/g, '').includes("UkeDagFradato/klTildato/kl")) {
        x = 1;
    } 

    for (let i = x; i < vakter.length; i++) {
        if (vakter[i].trim() === "") continue;

        try {   
            let sSubject = "";
            let sDescription = "";
            
            let dagIndex = vakter[i].toLowerCase().indexOf("dag");
            if (dagIndex === -1) continue; 
            
            let vaktLinje = vakter[i].substring(dagIndex + 3).replace(/\s+/g, '').trim();
            
            let colonFirst = vaktLinje.indexOf(":");
            let colonLast = vaktLinje.lastIndexOf(":");
            if (colonFirst === -1 || colonLast === -1 || colonFirst === colonLast) continue;
            
            let dateStartStr = vaktLinje.slice(0, colonFirst + 3);
            let dateStopStr = vaktLinje.slice(colonFirst + 3, colonLast + 3);
            let codePart = vaktLinje.slice(colonLast + 3);
            
            let type = getVaktKode(codePart) || getVaktKode(vaktLinje);
            
            if (["V", "R", "H", "B", "X"].includes(type)) { 
                let vaktkoderStr = getVaktKoder(codePart) || getVaktKoder(vaktLinje) || "";
                let vaktkoderArray = vaktkoderStr.split("");

                const koderSomSkalSkjules = ["F", "P", "S"]; 
                if (vaktkoderArray.some(kode => koderSomSkalSkjules.includes(kode))) continue; 
                
                let dateStart = convertDateToIso(dateStartStr);
                let dateStop = convertDateToIso(dateStopStr);

                let subKoderText = [];
                for (let t = 0; t < vaktkoderArray.length; t++) {
                    let aktuellKode = vaktkoderArray[t];
                    if (aktuellKode === "" || aktuellKode === type) continue; 
                    
                    switch (aktuellKode) {
                        case "A": subKoderText.push("Annet fravær"); break;
                        case "B": subKoderText.push("(Byttet)"); break; 
                        case "H": subKoderText.push("(OM)"); break;
                        case "N": subKoderText.push("(NyFri)"); break;
                        case "O": case "Q": subKoderText.push("Omlegg"); break;
                        case "W": subKoderText.push("flyttet fra"); break;
                        case "X": subKoderText.push("(X)"); break;
                        case "Y": subKoderText.push("flytt til"); break;
                        default:
                            subKoderText.push(aktuellKode);
                            break;
                    }
                }
                
                let typeNavn = "Vakt";
                if (type === "V") { typeNavn = "Vakt"; } 
                else if (type === "R") { typeNavn = "Reserve"; } 
                else if (type === "H") { typeNavn = "Hjemmevakt"; } 
                else if (type === "B") { typeNavn = "Utkjøpt reserve"; }
                else if (type === "X") { typeNavn = "Overtid"; }

                if (subKoderText.length > 0) {
                    sSubject = `${typeNavn} ${subKoderText.join(' ')}`.trim();
                } else {
                    sSubject = typeNavn;
                }
                
                let includeSalary = document.getElementById('checkIncludeSalary')?.checked || false;
                let vaktInntekt = beregnVaktInntekt(dateStart, dateStop, type, includeSalary);
                
                globalShiftsData.push({
                    baseTitle: sSubject,
                    baseDescription: sDescription,
                    startIso: dateStart,
                    stopIso: dateStop,
                    type: type,
                    income: vaktInntekt,
                    fasteTilleggMnd: 0, 
                    antallVakterMnd: 0,
                    fastTilleggAndel: 0,
                    totalMedFast: 0
                });
            }
        } catch(e) {
            console.error("Feil under parsing:", e, vakter[i]);
        }
    }

    if (globalShiftsData.length === 0) return "Fant ingen gyldige vakter i inndataen.";
    return null;
}

function kalkulerMaanedligeOgFaste() {
    let includeSalary = document.getElementById('checkIncludeSalary')?.checked || false;
    let monthlyStats = {};
    const monthNames = ["Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember"];

    globalShiftsData.forEach(shift => {
        let dateObj = parseIsoToDate(shift.startIso);
        let monthKey = `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        
        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = { antallVakter: 0, shifts: [] };
        }
        
        monthlyStats[monthKey].antallVakter += 1;
        monthlyStats[monthKey].shifts.push(shift);
    });

    let fasteTilleggMnd = 0;
    if (includeSalary) {
        let uregulertMnd = document.getElementById('checkUregulert')?.checked ? (parseFloat(document.getElementById('valUregulert').value) / 12) : 0;
        let etterforskerMnd = document.getElementById('checkEtterforsker')?.checked ? (parseFloat(document.getElementById('valEtterforsker').value) / 12) : 0;
        fasteTilleggMnd = Math.round(uregulertMnd + etterforskerMnd);
    }

    for (const [month, stats] of Object.entries(monthlyStats)) {
        let fastTilleggPerVakt = (includeSalary && stats.antallVakter > 0) ? (fasteTilleggMnd / stats.antallVakter) : 0;
        
        stats.shifts.forEach(s => {
            s.fasteTilleggMnd = fasteTilleggMnd;
            s.antallVakterMnd = stats.antallVakter;
            s.fastTilleggAndel = fastTilleggPerVakt;
            s.totalMedFast = includeSalary ? (s.income.bruttoInntekt + fastTilleggPerVakt) : 0;
        });
    }
}

function genererICS() {
    let IcsHeader = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TTA vakter til kalender OMS023//NO\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:TTA Arbeidstid\r\nX-WR-CALDESC:Vaktplan generert fra TTA (OMS023)\r\nBEGIN:VTIMEZONE\r\nTZID:Europe/Oslo\r\nX-LIC-LOCATION:Europe/Oslo\r\nBEGIN:DAYLIGHT\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\nTZNAME:Europe/Oslo\r\nDTSTART:19700328T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\nTZNAME:Europe/Oslo\r\nDTSTART:19701030T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n";
    let IcsFooter = "END:VCALENDAR\r\n";
    
    let IcsBuilder = "";
    let useWorkHours = document.getElementById('WorkHours')?.checked;
    let includeSalary = document.getElementById('checkIncludeSalary')?.checked || false;
    let useSalaryInTitle = includeSalary && document.getElementById('SalaryInTitle')?.checked;

    globalShiftsData.forEach(shift => {
        let sSubject = shift.baseTitle;
        let sDescription = "";
        
        if (includeSalary) {
            shift.income.segmenter.forEach(seg => {
                sDescription += `${seg.startTid} - ${seg.sluttTid} : ${seg.label} : ${formatMoney(seg.krPerTime)} kr / t = ${formatMoney(seg.belop)} kr\n`;
            });
            
            sDescription += `\nVakt totalt = ${formatMoney(shift.income.bruttoInntekt)} kr\n`;
            if (shift.fasteTilleggMnd > 0) {
                sDescription += `Faste tillegg (${formatMoney(shift.fasteTilleggMnd)} / ${shift.antallVakterMnd} vakter) = ${formatMoney(shift.fastTilleggAndel)} kr\n\n`;
                sDescription += `Totalt kr for vakt = ${formatMoney(shift.totalMedFast)} kr`;
            }
        } else {
            let startTid = shift.startIso.slice(9, 11) + ":" + shift.startIso.slice(11, 13);
            let sluttTid = shift.stopIso.slice(9, 11) + ":" + shift.stopIso.slice(11, 13);
            sDescription = `Vakt: ${shift.baseTitle}\nTid: ${startTid} - ${sluttTid}\nVarighet: ${shift.income.timerTotal} timer`;
        }

        // If shift has additional baseDescription (like warnings from RulesEngine), append it
        if (shift.baseDescription && shift.baseDescription.includes('--- ADVARSEL: REGELBRUDD ---')) {
            const warningPart = shift.baseDescription.substring(shift.baseDescription.indexOf('--- ADVARSEL: REGELBRUDD ---'));
            sDescription += `\n\n${warningPart}`;
        }

        if (useWorkHours) { 
            sSubject = getWorkHour(shift.startIso) + "-" + getWorkHour(shift.stopIso) + " | " + sSubject;
        }

        if (useSalaryInTitle) {
            sSubject += " (" + formatMoney(shift.totalMedFast) + " kr)";
        }

        IcsBuilder += "BEGIN:VEVENT\r\n";
        IcsBuilder += `UID:TTA_${shift.startIso}_${shift.type}@oms023.tta\r\n`;
        IcsBuilder += `DTSTART;TZID=Europe/Oslo:${shift.startIso}\r\n`;
        IcsBuilder += `DTEND;TZID=Europe/Oslo:${shift.stopIso}\r\n`;
        IcsBuilder += `SUMMARY:${sSubject}\r\n`;
        IcsBuilder += `DESCRIPTION:${sDescription.replace(/\n/g, "\\n")}\r\n`;
        IcsBuilder += "END:VEVENT\r\n";
    });

    return IcsHeader + IcsBuilder + IcsFooter;
}

function convertDateToIso(input){
    let parts = input.trim().split(".");
    let day = parts[0].trim().padStart(2, '0');
    let month = parts[1].trim().padStart(2, '0');
    let rest = parts[2].trim(); 
    let colonIndex = rest.indexOf(":");
    let hours = rest.slice(colonIndex - 2, colonIndex).trim().padStart(2, '0');
    let minutes = rest.slice(colonIndex + 1, colonIndex + 3).trim().padStart(2, '0');
    let yearPart = rest.slice(0, colonIndex - 2).replace(/\s/g, '').trim();
    let year = yearPart.length === 2 ? "20" + yearPart : yearPart; 
    return `${year}${month}${day}T${hours}${minutes}00`;
}

function getWorkHour(input){
    let temp = input.slice(9,13);
    if (temp.slice(-2) === "00") temp = temp.slice(0,2); 
    return temp;
}

function getVaktKoder(sInput) {
    let sTemp = "";
    let regDigit = /^[0-9]$/, regLetter = /^[a-zA-Z]$/; 
    for (let i = sInput.length - 1; i >= 0; i--) {
        let char = sInput.charAt(i);
        if (regDigit.test(char)) return sTemp;
        else if (regLetter.test(char)) sTemp = char + sTemp; 
    }
    return sTemp;
}

function getVaktKode(sInput) {
    let reg = /^[a-zA-Z]$/; 
    for (let y = 0; y < sInput.length; y++) {
        if (reg.test(sInput.charAt(y))) return sInput.charAt(y);
    }
    return "";
}