const { S3Client } = require('@aws-sdk/client-s3');
const env = require('./env.config');

const s3Config = { region: env.aws.region };
if (env.aws.endpoint) {
    s3Config.endpoint = env.aws.endpoint;
    s3Config.forcePathStyle = true; 
}

const s3Client = new S3Client(s3Config);

module.exports = s3Client;
