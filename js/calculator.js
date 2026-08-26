// ==========================================
// LOGIKK FOR LØNNSBEREGNING OG KALENDERDATOER
// ==========================================

if (typeof gjeldendeTillegg === 'undefined') {
    if (typeof window !== 'undefined') {
        window.gjeldendeTillegg = {
            Natt_prosent: 45,
            Skumring_kr: 40,
            Helg_kr: 84,
            Beredskap_dag_kr: 19,
            Beredskap_natt_kr: 32,
            Helligdag_prosent: 133.3,
            Hjemmevakt_faktor: 0.20
        };
    } else if (typeof global !== 'undefined') {
        global.gjeldendeTillegg = {
            Natt_prosent: 45,
            Skumring_kr: 40,
            Helg_kr: 84,
            Beredskap_dag_kr: 19,
            Beredskap_natt_kr: 32,
            Helligdag_prosent: 133.3,
            Hjemmevakt_faktor: 0.20
        };
    }
}

function beregnVaktInntekt(isoStart, isoEnd, vaktType, includeSalary = false) {
    const start = parseIsoToDate(isoStart);
    const end = parseIsoToDate(isoEnd);

    if (end < start) end.setDate(end.getDate() + 1);

    let aarslonn = 0;
    let divisor = 1950;
    let timelonn = 0;

    if (includeSalary) {
        aarslonn = parseFloat(document.getElementById('inputAarslonn')?.value) || 0;
        divisor = parseFloat(document.getElementById('inputDivisor')?.value) || 1950;
        timelonn = divisor > 0 ? (aarslonn / divisor) : 0;
    }

    let totalOrdinareTimer = 0, totalSkumringTimer = 0, totalNattTimer = 0, totalHelgeTimer = 0, totalHelligdagTimer = 0;
    let totalOvertid50Timer = 0, totalOvertid100Timer = 0;

    let current = new Date(start.getTime());
    const stepMinutes = 15, stepHours = stepMinutes / 60;

    let segmenter = [];
    let aktivtSegment = null;

    while (current < end) {
        let hour = current.getHours();
        let day = current.getDay(); 
        
        let erHelg = (day === 0 || day === 6);
        let erNatt = (hour >= 20 || hour < 6);
        let erSkumring = ((hour === 6) || (hour >= 17 && hour < 20));
        let erHelligdag = sjekkOmHelligdag(current);

        let label = "Grunnsats";
        let krPerTime = timelonn;

        if (vaktType === "X") {
            let erOvertid100 = (erNatt || erHelg || erHelligdag);
            
            if (erOvertid100) {
                label = "Overtid 100%";
                krPerTime = timelonn * 2.0;
                totalOvertid100Timer += stepHours;
            } else {
                label = "Overtid 50%";
                krPerTime = timelonn * 1.50;
                totalOvertid50Timer += stepHours;
            }
            totalOrdinareTimer += stepHours;
        } else if (vaktType === "H") {
            let basis = timelonn * gjeldendeTillegg.Hjemmevakt_faktor;
            let addisjoner = ["Hjemmevakt (" + Math.round(gjeldendeTillegg.Hjemmevakt_faktor*100) + "%)"];
            
            if (erHelligdag) {
                addisjoner.push("Helligdagstillegg");
                basis += (timelonn * (gjeldendeTillegg.Helligdag_prosent / 100)) * gjeldendeTillegg.Hjemmevakt_faktor;
            }
            if (erNatt) {
                addisjoner.push("Beredskap Natt");
                basis += gjeldendeTillegg.Beredskap_natt_kr;
            } else {
                addisjoner.push("Beredskap Dag");
                basis += gjeldendeTillegg.Beredskap_dag_kr;
            }
            label = addisjoner.join(" + ");
            krPerTime = basis;
            totalOrdinareTimer += stepHours;
        } else {
            totalOrdinareTimer += stepHours;
            if (erHelligdag) {
                label = includeSalary ? ("Helligdag (Grunnsats + " + gjeldendeTillegg.Helligdag_prosent + "%)") : "Helligdag";
                krPerTime = timelonn + (timelonn * (gjeldendeTillegg.Helligdag_prosent / 100));
                totalHelligdagTimer += stepHours;
            } else {
                let tilleggsNavn = [];
                let ekstraKroner = 0;
                if (erNatt) {
                    tilleggsNavn.push(includeSalary ? ("Natt (" + gjeldendeTillegg.Natt_prosent + "%)") : "Natt");
                    ekstraKroner += timelonn * (gjeldendeTillegg.Natt_prosent / 100);
                    totalNattTimer += stepHours;
                }
                if (erSkumring) {
                    tilleggsNavn.push("Kveld");
                    ekstraKroner += gjeldendeTillegg.Skumring_kr;
                    totalSkumringTimer += stepHours;
                }
                if (erHelg) {
                    tilleggsNavn.push("Helg");
                    ekstraKroner += gjeldendeTillegg.Helg_kr;
                    totalHelgeTimer += stepHours;
                }
                
                if (tilleggsNavn.length > 0) {
                    label = includeSalary ? ("Grunnsats + " + tilleggsNavn.join(" + ")) : tilleggsNavn.join(" + ");
                }
                krPerTime = timelonn + ekstraKroner;
            }
        }

        let tidsStreng = String(current.getHours()).padStart(2, '0') + ":" + String(current.getMinutes()).padStart(2, '0');

        if (!aktivtSegment || aktivtSegment.label !== label) {
            if (aktivtSegment) {
                aktivtSegment.sluttTid = tidsStreng;
                segmenter.push(aktivtSegment);
            }
            aktivtSegment = {
                startTid: tidsStreng,
                label: label,
                krPerTime: includeSalary ? krPerTime : 0,
                timer: 0,
                belop: 0
            };
        }
        aktivtSegment.timer += stepHours;
        aktivtSegment.belop += includeSalary ? (stepHours * krPerTime) : 0;

        current.setMinutes(current.getMinutes() + stepMinutes);
    }

    if (aktivtSegment) {
        let sluttStreng = String(end.getHours()).padStart(2, '0') + ":" + String(end.getMinutes()).padStart(2, '0');
        aktivtSegment.sluttTid = sluttStreng;
        segmenter.push(aktivtSegment);
    }

    let avrundetBruttoInntekt = 0;
    segmenter.forEach(seg => {
        seg.belop = Math.round(seg.belop);
        avrundetBruttoInntekt += seg.belop;
    });

    let grunnlonnTotal = 0;
    let helligdagTotal = 0;
    let tilleggTotal = 0;

    if (includeSalary) {
        grunnlonnTotal = totalOrdinareTimer * timelonn;
        helligdagTotal = totalHelligdagTimer * (timelonn * (gjeldendeTillegg.Helligdag_prosent / 100));
        tilleggTotal = avrundetBruttoInntekt - Math.round(grunnlonnTotal) - Math.round(helligdagTotal);

        if (vaktType === "X") {
            grunnlonnTotal = (totalOvertid50Timer + totalOvertid100Timer) * timelonn;
            tilleggTotal = (totalOvertid50Timer * (timelonn * 0.50)) + (totalOvertid100Timer * (timelonn * 1.0));
            helligdagTotal = 0;
        } else if (vaktType === "H") {
            grunnlonnTotal = totalOrdinareTimer * timelonn * gjeldendeTillegg.Hjemmevakt_faktor;
            tilleggTotal = avrundetBruttoInntekt - Math.round(grunnlonnTotal); 
            helligdagTotal = 0;
        }
    }

    return {
        timerTotal: parseFloat(totalOrdinareTimer.toFixed(2)),
        bruttoInntekt: avrundetBruttoInntekt,
        grunnlonn: Math.round(grunnlonnTotal),
        tillegg: Math.round(tilleggTotal),
        helligdagTillegg: Math.round(helligdagTotal),
        nattTimer: parseFloat(totalNattTimer.toFixed(2)),
        helgeTimer: parseFloat(totalHelgeTimer.toFixed(2)),
        skumringTimer: parseFloat(totalSkumringTimer.toFixed(2)),
        helligdagTimer: parseFloat(totalHelligdagTimer.toFixed(2)),
        overtidTimer: parseFloat((totalOvertid50Timer + totalOvertid100Timer).toFixed(2)),
        segmenter: segmenter
    };
}

function sjekkOmHelligdag(dateObj) {
    let year = dateObj.getFullYear(), month = dateObj.getMonth() + 1, day = dateObj.getDate(), hour = dateObj.getHours();
    if (month === 1 && day === 1) return true;
    if (month === 5 && day === 1) return true;
    if (month === 5 && day === 17) return true;
    if (month === 12 && day === 25) return true;
    if (month === 12 && day === 26) return true;
    if (month === 12 && day === 24 && hour >= 12) return true; 
    if (month === 12 && day === 31 && hour >= 12) return true;

    let paaskeSondag = beregnPaaske(year);
    let diffDager = Math.round((dateObj.getTime() - paaskeSondag.getTime()) / (1000 * 60 * 60 * 24));
    if ([-3, -2, 0, 1, 39, 49, 50].includes(diffDager)) return true;
    if (diffDager === -4 && hour >= 12) return true;
    if (diffDager === -1 && hour >= 12) return true;
    if (diffDager === 48 && hour >= 12) return true;
    return false;
}

function beregnPaaske(year) {
    let a = year % 19, b = Math.floor(year / 100), c = year % 100;
    let d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    let i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    let m = Math.floor((a + 11 * h + 22 * l) / 451), n = h + l - 7 * m + 114;
    let month = Math.floor(n / 31) - 1, day = (n % 31) + 1;
    return new Date(year, month, day, 12, 0, 0); 
}

function parseIsoToDate(isoStr) {
    let year = parseInt(isoStr.slice(0, 4));
    let month = parseInt(isoStr.slice(4, 6)) - 1;
    let day = parseInt(isoStr.slice(6, 8));
    let hours = parseInt(isoStr.slice(9, 11));
    let minutes = parseInt(isoStr.slice(11, 13));
    return new Date(year, month, day, hours, minutes, 0);
}

function formatMoney(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) amount = 0;
    return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
