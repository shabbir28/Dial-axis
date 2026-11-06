const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
try {
 const key = process.env.DIALAXIS_MIGRATION_KEY || '';
 if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error('A valid migration key is required.');
 const target = process.argv[2];
 if (!target) throw new Error('Provide an output SQL file path.');
 const payload = JSON.parse(fs.readFileSync(path.join(__dirname, 'migration-data.encrypted.json'), 'utf8'));
 if (payload.version !== 1) throw new Error('Unsupported migration format.');
 const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(payload.iv, 'base64'));
 decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
 const sql = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]);
 fs.writeFileSync(target, sql, {flag:'wx', mode:0o600});
 console.log('Private migration SQL saved.');
} catch (error) {
 console.error(error.code === 'EEXIST' ? 'Output already exists; not overwritten.' : 'Decryption failed: check the key and output path.');
 process.exitCode = 1;
}
