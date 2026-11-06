const path = require('node:path');
require('dotenv').config({path:path.join(__dirname,'../../.env'),quiet:true});
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Set a strong JWT_SECRET (at least 32 characters).');
if (process.env.DB_NAME !== 'dialer_record') throw new Error('Standalone app requires DB_NAME=dialer_record.');
