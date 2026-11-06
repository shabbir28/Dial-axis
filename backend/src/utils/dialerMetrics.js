function isDnc(status) {
    return /^(?:B?DNC|DO[ _-]*NOT[ _-]*CALL)/i.test(String(status || '').trim());
}

function emptyMetrics() {
    return { version: 3, zero_to_four: 0, five_or_more: 0, unknown: 0, dnc: 0 };
}

function addMetrics(counts, calls, status) {
    if (isDnc(status)) { counts.dnc++; return; }
    if (!/^\d+$/.test(String(calls ?? ''))) { counts.unknown++; return; }
    const count = Number(calls);
    counts[count < 5 ? 'zero_to_four' : 'five_or_more']++;
}

function matchesExport(kind, calls, status) {
    if (kind === 'dnc') return isDnc(status);
    if (isDnc(status) || !/^\d+$/.test(String(calls ?? ''))) return false;
    const count = Number(calls);
    return kind === 'under5' ? count < 5 : kind === 'over5' && count >= 5;
}

module.exports = { emptyMetrics, addMetrics, matchesExport };
