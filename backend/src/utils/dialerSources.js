const path = require('node:path');
const root = path.join(__dirname, '../../exports');
const sources = Object.freeze({
    t6: Object.freeze({ id: 't6', name: 'BaliT6 Voice', campaignId: '001', campaignName: 'Bismillah',
        baseUrl: 'https://balit6voice.i5.tel/vicidial/', salesParams: { show_saleha_stats: 'Y' },
        userEnv: 'DIALER_REPORT_USER', passwordEnv: 'DIALER_REPORT_PASSWORD',
        cachePath: path.join(root, 'dialer-duplicates.json'), directory: path.join(root, 'dialer-numbers') }),
    fe: Object.freeze({ id: 'fe', name: 'FE', campaignId: '1002', campaignName: 'FE Bot 2 i9',
        baseUrl: 'https://balitechfe.dialerhosting.com/BcVBcXr/', salesParams: { ha_stats: '1', show_lead_count: '1' }, selectionSubstringBug: true,
        userEnv: 'DIALER_FE_USER', passwordEnv: 'DIALER_FE_PASSWORD',
        cachePath: path.join(root, 'dialer-fe', 'summary.json'), directory: path.join(root, 'dialer-fe', 'numbers') }),
    fe2: Object.freeze({ id: 'fe2', name: 'FE 2', campaignId: '001', campaignName: 'Outbound',
        baseUrl: 'https://balitechfe2s.dialerhosting.com/BA12asx/', salesParams: { ha_stats: '1', show_lead_count: '1' },
        userEnv: 'DIALER_FE2_USER', passwordEnv: 'DIALER_FE2_PASSWORD',
        cachePath: path.join(root, 'dialer-fe2', 'summary.json'), directory: path.join(root, 'dialer-fe2', 'numbers') }),
});

module.exports = { sources };
