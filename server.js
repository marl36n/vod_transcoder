require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const axios = require('axios');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Store transcoding/packaging status in memory for frontend polling
const assetStatuses = {};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration
const region = process.env.AWS_REGION || 'us-east-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME;
const apiUrl = process.env.TRANSCODING_API_URL || 'http://192.16.12.2:9080/api/v1/assets';
const packagerApiUrl = process.env.PACKAGER_API_URL || 'http://192.12.12.13:7010/asset/vodclear';
const assetIdPrefix = process.env.ASSET_ID || 'vod-TT217';
const callbackBaseUrl = process.env.CALLBACK_BASE_URL || `http://localhost:${port}`;

const s3Config = { region };
if (process.env.AWS_ENDPOINT) {
    s3Config.endpoint = process.env.AWS_ENDPOINT;
    s3Config.forcePathStyle = true; // Essential for MinIO and other S3-compatible APIs
}

const s3Client = new S3Client(s3Config);

// 1. Generate a presigned URL for the browser to upload directly to S3
app.post('/api/presign-upload', async (req, res) => {
    try {
        const { fileName, fileType } = req.body;
        
        if (!fileName || !fileType) {
            return res.status(400).json({ error: 'fileName and fileType are required' });
        }

        const s3Key = `VOD_MAIN/${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            ContentType: fileType
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        
        res.json({
            uploadUrl,
            s3Key,
            bucket: bucketName
        });
    } catch (error) {
        console.error('Error generating upload presigned URL:', error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
});

// 2. Generate a download presigned URL and trigger Transcoding API
app.post('/api/transcode', async (req, res) => {
    try {
        const { s3Key, assetId } = req.body;

        if (!s3Key) {
            return res.status(400).json({ error: 's3Key is required' });
        }
        
        const finalAssetId = assetId || assetIdPrefix;

        // Generate download URL
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
        });

        const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 7200 });

        // Trigger transcoding workflow
        const apiPayload = {
            asset_info: {
                asset_id: finalAssetId,
                source_url: downloadUrl,
                service: "template_h264_high_2997_vod",
                storage: "hdd",
                priority: 5
            },
            callback_urls: [`${callbackBaseUrl}/api/callback`]
        };
        
        // Initialize status tracker
        assetStatuses[finalAssetId] = { status: 'TRANSCODING' };

        const response = await axios.post(apiUrl, apiPayload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        res.json({
            success: true,
            message: 'Transcoding started successfully',
            data: response.data
        });

    } catch (error) {
        console.error('Error triggering transcoding:', error);
        res.status(500).json({ 
            error: 'Failed to trigger transcoding',
            details: error.response ? error.response.data : error.message 
        });
    }
});

// 3. Callback endpoint for transcoding completion
app.post('/api/callback', async (req, res) => {
    console.log('\n--- Transcoding Callback Received ---');
    console.log('Callback Payload:', JSON.stringify(req.body, null, 2));
    
    // Respond to the transcoder quickly
    res.status(200).send('OK');

    // Here you would check req.body to see if transcoding was successful
    // Assuming success...
    
    // Attempt to extract asset ID carefully
    let assetIdToPackage = req.body?.asset_id || req.body?.AssetId || assetIdPrefix;
    if (req.body?.asset_info?.asset_id) assetIdToPackage = req.body.asset_info.asset_id;

    console.log('\nTriggering Packaging API for:', assetIdToPackage);
    assetStatuses[assetIdToPackage] = { status: 'PACKAGING' };

    const putUrl = `${packagerApiUrl}/${assetIdToPackage}`;
    const payload = {
        "CommercialName": "Avatar 5.8",
        "Source": `file:///opt/peak/nas_storage/vodsource/${assetIdToPackage}/`,
        "ProfileName": "MP4"
    };

    try {
        const packagerResponse = await axios.put(putUrl, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Packaging API triggered successfully!');
        console.log('Response Status:', packagerResponse.status);
        assetStatuses[assetIdToPackage] = { status: 'COMPLETED', packagerResponse: packagerResponse.data };
    } catch (packagerError) {
        console.error('Error triggering Packaging API:', packagerError.message);
        const errorDetails = packagerError.response ? packagerError.response.data : packagerError.message;
        if (packagerError.response) {
            console.error('API Error Response:', packagerError.response.status, packagerError.response.data);
        }
        assetStatuses[assetIdToPackage] = { status: 'ERROR', error: errorDetails, packagerResponse: errorDetails };
    }
});

// 4. Status endpoint for frontend polling
app.get('/api/status/:assetId', (req, res) => {
    const status = assetStatuses[req.params.assetId] || { status: 'UNKNOWN' };
    res.json(status);
});

app.listen(port, () => {
    console.log(`VOD Uploader UI running at http://localhost:${port}`);
});
