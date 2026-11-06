const { parentPort, workerData } = require('node:worker_threads');
const { scanDuplicates } = require('./dialerDuplicates');
const dialer = require('./dialerSources').sources[workerData.dialerId || 't6'];
scanDuplicates({ ...workerData, user: process.env[dialer.userEnv], password: process.env[dialer.passwordEnv],
    outputDir: dialer.directory,
    progress: value => parentPort.postMessage({ type: 'progress', value }),
}).then(async value => {
    const path = require('node:path');
    const directory = dialer.directory;
    try {
        return await require('./dialerOccurrences').addOccurrences(value, directory);
    } finally {
        // These are intermediate files from this scan, not the last published snapshot.
        await Promise.all(['unique', 'duplicates'].map(kind => require('node:fs/promises')
            .unlink(path.join(directory, `${value.export_id}-${kind}.csv`)).catch(() => {})));
    }
})
.then(value => parentPort.postMessage({ type: 'complete', value })).catch(() => {
    parentPort.postMessage({ type: 'failed' });
});
