require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    aws: {
        region: process.env.AWS_REGION || 'us-east-1',
        bucketName: process.env.AWS_S3_BUCKET_NAME,
        endpoint: process.env.AWS_ENDPOINT
    },
    apis: {
        transcoding: process.env.TRANSCODING_API_URL || 'http://192.16.12.2:9080/api/v1/assets',
        packager: process.env.PACKAGER_API_URL || 'http://192.12.12.13:7010/asset/vodclear',
    },
    app: {
        assetIdPrefix: process.env.ASSET_ID || 'vod-TT217',
        callbackBaseUrl: process.env.CALLBACK_BASE_URL || `http://localhost:${process.env.PORT || 3000}`
    }
};
