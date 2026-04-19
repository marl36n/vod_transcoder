require('dotenv').config();
const env = require('./src/config/env.config');
const app = require('./src/app');

app.listen(env.port, () => {
    console.log(`VOD Uploader UI running at http://localhost:${env.port}`);
});
