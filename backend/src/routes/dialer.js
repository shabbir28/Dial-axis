const express = require('express');
const audit = require('../middleware/audit');
const auth = require('../middleware/auth');
const requireModule = require('../middleware/moduleAccess');
const { createReportClient, reportOverview } = require('../utils/dialerReport');
const { sources } = require('../utils/dialerSources');

function createDialerRouter(dialer) {
const router = express.Router();
const getReport = createReportClient({ dialer });
const auditDownload = audit('download',req=>({dialer_id:dialer.id,details:{
 campaign_id:dialer.campaignId,kind:['unique','duplicates','under5','over5','dnc'].includes(req.params.kind)?req.params.kind:'invalid',
 ...(req.path.includes('/statuses/')?{statuses:Array.isArray(req.body?.statuses)?req.body.statuses.filter(s=>typeof s==='string'&&/^[a-zA-Z0-9 _-]{1,30}$/.test(s)).slice(0,100):[]}: {})
}}));
const auditScan = audit('scan',()=>({dialer_id:dialer.id,details:{campaign_id:dialer.campaignId}}));
const duplicates = require('../utils/dialerDuplicateJob').createDuplicateJob(getReport, dialer);
const getStatusSummary = require('../utils/dialerStatusSummary').createStatusSummary();

router.post('/duplicates/:kind/statuses/download', auth, auditDownload, requireModule('dialer'), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { statuses, export_id } = req.body || {};
    if (!['unique', 'duplicates'].includes(req.params.kind) || !Array.isArray(statuses) || !statuses.length || statuses.length > 100 || statuses.some(s => typeof s !== 'string' || !s.length || s.length > 100)) return res.status(400).json({ message: 'Select valid statuses to download.' });
    const result = duplicates.status().result;
    if (!result || result.export_version !== 3 || result.export_id !== export_id) return res.status(409).json({ message: 'The scan has changed. Reopen the status panel and select statuses again.' });
    try {
        const directory = dialer.directory;
        const summary = await getStatusSummary(result, req.params.kind, directory);
        if (statuses.some(status => !summary.statuses.some(row => row.status === status))) return res.status(400).json({ message: 'A selected status is not in this file.' });
        const file = await require('../utils/dialerStatusExport').exportStatuses(result, req.params.kind, statuses, directory);
        res.locals.audit={export_id:result.export_id,rows:file.count,statuses:[...new Set(statuses)]};
        res.json({ ...file, fileName: `${dialer.id}-${file.fileName}` });
    } catch {
        res.status(503).json({ message: 'Could not prepare the selected statuses. Please retry.' });
    }
});

router.get('/duplicates/:kind/statuses', auth, requireModule('dialer'), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!['unique', 'duplicates'].includes(req.params.kind)) return res.status(400).json({ message: 'Invalid file type.' });
    const result = duplicates.status().result;
    if (!result || result.export_version !== 3) return res.status(409).json({ message: 'Run a scan to prepare status statistics.' });
    try {
        res.json(await getStatusSummary(result, req.params.kind, dialer.directory));
    } catch {
        res.status(503).json({ message: 'Could not read status statistics. Please retry or run a new scan.' });
    }
});

// User-facing terminology; keep the stored fields distinct for calculations.
const downloadHeaders = csv => csv.replace(/^phone_number,occurrence_count,status,call_count,list_id,lead_id\r?\n/,
    'phone_number,call_count,status,lead_call_attempts,list_id,lead_id\n');

router.get('/duplicates', auth, requireModule('dialer'), (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(duplicates.status());
});

router.post('/duplicates/scan', auth, auditScan, requireModule('dialer'), (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.status(202).json(duplicates.start());
});

router.get('/duplicates/:kind/download', auth, auditDownload, requireModule('dialer'), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!['unique', 'duplicates', 'under5', 'over5', 'dnc'].includes(req.params.kind)) return res.status(400).json({ message: 'Invalid export type.' });
    const result = duplicates.status().result;
    if (!result?.export_id || !/^[a-f0-9-]{36}$/.test(result.export_id)) return res.status(409).json({ message: 'Run Scan numbers once to prepare downloadable CSV files.' });
    if (result.export_version !== 3) return res.status(409).json({ message: 'Run a new scan to calculate number occurrences for these files.' });
    try {
        if (['under5', 'over5', 'dnc'].includes(req.params.kind)) {
            const csv = await require('../utils/dialerCallExport').callCountExport(result, req.params.kind, dialer.directory);
            res.locals.audit={export_id:result.export_id,rows:result.occurrence_counts?.[{under5:'zero_to_four',over5:'five_or_more',dnc:'dnc'}[req.params.kind]]};
        return res.json({ csv: downloadHeaders(csv), fileName: `${dialer.id}-${{ under5: 'call-count-1-to-4', over5: 'call-count-5-and-above', dnc: 'dnc' }[req.params.kind]}.csv` });
        }
        const file = require('node:path').join(dialer.directory, `${result.export_id}-${req.params.kind}.csv`);
        const csv = await require('node:fs/promises').readFile(file, 'utf8');
        // This is a dialer inventory export, not a CRM-cleaned lead export.
        res.locals.audit={export_id:result.export_id,rows:req.params.kind==='unique'?result.unique_numbers:result.duplicate_entries};
        return res.json({ csv: downloadHeaders(csv), fileName: `${dialer.id}-${req.params.kind}.csv` });
    } catch {
        return res.status(503).json({ message: 'Export unavailable. Run a new scan and try again.' });
    }
});

router.get('/lists/:id/stats', auth, requireModule('dialer'), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!/^\d{1,12}$/.test(req.params.id)) return res.status(400).json({ message: 'Invalid list ID.' });
    try {
        const report = await getReport({ refresh: req.query.refresh === '1' });
        const list = report.lists.find(item => item.list_id === req.params.id);
        if (!list) return res.status(404).json({ message: `This file is not in campaign ${dialer.campaignId} - ${dialer.campaignName}.` });
        const { lists, ...metadata } = report;
        res.json({ ...metadata, list });
    } catch (error) {
        res.status(error.status || 502).json({ message: error.message });
    }
});

router.get('/lists', auth, requireModule('dialer'), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        res.json(reportOverview(await getReport({ refresh: req.query.refresh === '1' })));
    } catch (error) {
        res.status(error.status || 502).json({ message: error.message });
    }
});

return router;
}

const router = express.Router();
router.get('/sources', auth, requireModule('dialer'), (req, res) => {
    res.json(Object.values(sources).map(({ id, name, campaignId, campaignName }) => ({ id, name, campaignId, campaignName })));
});
const instances = Object.fromEntries(Object.values(sources).map(source => [source.id, createDialerRouter(source)]));
for (const [id, instance] of Object.entries(instances)) router.use(`/sources/${id}`, instance);
router.use(instances.t6);
module.exports = router;
