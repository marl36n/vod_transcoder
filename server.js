require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { S3Client, PutObjectCommand, GetObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } = require('@aws-sdk/client-s3');
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

// 1. Multi-part Upload: Initiate
app.post('/api/upload/initiate', async (req, res) => {
    try {
        const { fileName, fileType } = req.body;
        if (!fileName || !fileType) return res.status(400).json({ error: 'fileName and fileType are required' });

        const s3Key = `VOD_MAIN/${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const command = new CreateMultipartUploadCommand({
            Bucket: bucketName,
            Key: s3Key,
            ContentType: fileType
        });

        const response = await s3Client.send(command);
        res.json({ uploadId: response.UploadId, s3Key, bucket: bucketName });
    } catch (error) {
        console.error('Error initiating multi-part upload:', error);
        res.status(500).json({ error: 'Failed to initiate Upload' });
    }
});

// 1b. Multi-part Upload: Presign Part
app.post('/api/upload/presign-part', async (req, res) => {
    try {
        const { s3Key, uploadId, partNumber } = req.body;
        if (!s3Key || !uploadId || !partNumber) return res.status(400).json({ error: 's3Key, uploadId, and partNumber are required' });

        const command = new UploadPartCommand({
            Bucket: bucketName,
            Key: s3Key,
            UploadId: uploadId,
            PartNumber: partNumber
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        res.json({ uploadUrl });
    } catch (error) {
        console.error('Error presigning part:', error);
        res.status(500).json({ error: 'Failed to presign part' });
    }
});

// 1c. Multi-part Upload: Complete
app.post('/api/upload/complete', async (req, res) => {
    try {
        const { s3Key, uploadId, parts } = req.body;
        if (!s3Key || !uploadId || !parts || !Array.isArray(parts)) return res.status(400).json({ error: 's3Key, uploadId, and parts array are required' });

        // Sort ascending by PartNumber just in case
        parts.sort((a, b) => a.PartNumber - b.PartNumber);

        const command = new CompleteMultipartUploadCommand({
            Bucket: bucketName,
            Key: s3Key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts.map(p => ({ ETag: p.ETag, PartNumber: p.PartNumber }))
            }
        });

        const response = await s3Client.send(command);
        res.json({ success: true, location: response.Location });
    } catch (error) {
        console.error('Error completing multi-part upload:', error);
        res.status(500).json({ error: 'Failed to complete upload' });
    }
});

// 2. Generate a download presigned URL and trigger Transcoding API
app.post('/api/transcode', async (req, res) => {
    try {
        const { s3Key, assetId, service, packagerService } = req.body;

        if (!s3Key) {
            return res.status(400).json({ error: 's3Key is required' });
        }

        // Allow sub-directory structures in asset ID (e.g. 'rro-dex/test10')
        let rawFinalId = assetId || assetIdPrefix;
        const finalAssetId = rawFinalId.replace(/^vods\/?/, '');

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
                service: service || "template_h264_high_2997_vod",
                storage: "hdd",
                priority: 5
            },
            callback_urls: [`${callbackBaseUrl}/api/callback`]
        };

        // Initialize status tracker and save the chosen packager service
        assetStatuses[finalAssetId] = { status: 'TRANSCODING', packagerService: packagerService || 'vodclear' };

        // DEBUG: Log the exact curl command being executed to PM2 logs
        const curlEquivalent = `curl -i -X POST "${apiUrl}" -H "Content-Type: application/json" -d '${JSON.stringify(apiPayload)}'`;
        console.log('\\n--- Sending Transcoding API Request ---');
        console.log(curlEquivalent);
        console.log('---------------------------------------\\n');

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

    // Attempt to extract asset ID carefully
    let rawAssetId = req.body?.asset_id || req.body?.AssetId || assetIdPrefix;
    if (req.body?.asset_info?.asset_id) rawAssetId = req.body.asset_info.asset_id;

    // Strip leading 'vods/' if added by transcoder, but preserve other subdirectories
    const assetIdToPackage = rawAssetId.replace(/^vods\/?/, '');

    // Check if transcoding was successful based on the 'status' field
    const jobStatus = req.body?.status;

    // Handle ongoing progress updates
    if (jobStatus === 'TRANSCODING' || jobStatus === 'PROCESSING' || jobStatus === 'IN_PROGRESS' || req.body?.progress !== undefined) {
        let progress = req.body?.progress || req.body?.percentage || 0;
        
        // Sometimes progress might be a string like "45%" or a decimal "0.45"
        if (typeof progress === 'string') progress = parseFloat(progress);
        if (progress > 0 && progress <= 1) progress = progress * 100;
        progress = Math.round(progress);

        console.log(`Transcoding in progress for ${assetIdToPackage}: ${progress}%`);
        assetStatuses[assetIdToPackage] = Object.assign(assetStatuses[assetIdToPackage] || {}, { 
            status: 'TRANSCODING', 
            progress: progress 
        });

        // Don't error out on progress updates
        if (jobStatus !== 'DONE') return;
    }

    if (jobStatus !== 'DONE') {
        const errorMsg = req.body?.error_msg || 'Unknown error';
        console.error(`Transcoding job did not complete successfully. Status: ${jobStatus}. Error: ${errorMsg}. Cannot proceed to packaging.`);
        assetStatuses[assetIdToPackage] = { status: 'ERROR', error: `Transcoding failed with status ${jobStatus}: ${errorMsg}` };
        return;
    }

    console.log('Transcoding successful (status: DONE). Proceeding to packaging...');

    console.log('\nTriggering Packaging API for:', assetIdToPackage);
    const selectedPackagerService = assetStatuses[assetIdToPackage]?.packagerService || 'vodclear';
    assetStatuses[assetIdToPackage] = Object.assign(assetStatuses[assetIdToPackage] || {}, { status: 'PACKAGING' });

    // Dynamically replace 'vodclear' with the chosen service name in the URL
    const dynamicPackagerUrl = packagerApiUrl.includes('/vodclear')
        ? packagerApiUrl.replace('/vodclear', `/${selectedPackagerService}`)
        : `${packagerApiUrl}/${selectedPackagerService}`;

    // For the URL, we want to preserve subdirectories but avoid repeating the service name
    let finalAssetIdForUrl = assetIdToPackage;
    if (finalAssetIdForUrl.startsWith(`${selectedPackagerService}/`)) {
        finalAssetIdForUrl = finalAssetIdForUrl.substring(selectedPackagerService.length + 1);
    }
    const putUrl = `${dynamicPackagerUrl}/${finalAssetIdForUrl}`;

    // Dynamically calculate ProfileName based on selectedPackagerService (e.g., rro-dex -> MP4-DEX)
    let dynamicProfileName = "MP4";
    if (selectedPackagerService && selectedPackagerService.includes('-')) {
        const suffix = selectedPackagerService.split('-').pop().toUpperCase();
        dynamicProfileName = `MP4-${suffix}`;
    }

    const payload = {
        "CommercialName": "Avatar 5.8",
        "Source": `file:///opt/broadpeak/nas_storage/vodsource/${assetIdToPackage}/`,
        "ProfileName": dynamicProfileName
    };

    // DEBUG: Log the exact curl command being executed to PM2 logs
    const curlEquivalent = `curl -i -X PUT "${putUrl}" -H "Content-Type: application/json" -d '${JSON.stringify(payload)}'`;
    console.log('\\n--- Sending Packager API Request ---');
    console.log(curlEquivalent);
    console.log('--------------------------------------\\n');

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

// 3b. Content List endpoint
app.get('/api/contentslist', async (req, res) => {
    try {
        const { ServiceID } = req.query;
        if (!ServiceID) {
            return res.status(400).json({ error: 'ServiceID is required' });
        }

        const baseUrl = new URL(packagerApiUrl).origin;
        const fetchUrl = `${baseUrl}/asset/contentslist?ServiceID=${ServiceID}`;

        console.log(`\n--- Fetching Contents List ---`);
        console.log(`URL: ${fetchUrl}`);

        const response = await axios.get(fetchUrl);
        
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching contents list:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch contents list', 
            details: error.response ? error.response.data : error.message 
        });
    }
});

// 3c. Delete Content endpoint
app.delete('/api/contents/:serviceId/:contentId', async (req, res) => {
    try {
        const { serviceId, contentId } = req.params;
        const baseUrl = new URL(packagerApiUrl).origin;
        const deleteUrl = `${baseUrl}/asset/${serviceId}/${contentId}`;

        const curlEquivalent = `curl -i -X DELETE "${deleteUrl}"`;
        console.log(`\n--- Deleting Content Request ---`);
        console.log(curlEquivalent);
        console.log(`--------------------------------\n`);

        const response = await axios.delete(deleteUrl);
        
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error('Error deleting content:', error.message);
        res.status(500).json({ 
            error: 'Failed to delete content', 
            details: error.response ? error.response.data : error.message 
        });
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
// 5. Batch transcode endpoint
app.post('/api/batch-transcode', async (req, res) => {
    const { files } = req.body; // [{ s3Key, assetId, service, packagerService }]
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'files array required' });
    }

    // Process files sequentially (async but not blocking response)
    (async () => {
        for (const file of files) {
            try {
                // Trigger transcoding for each file
                await axios.post('http://localhost:' + port + '/api/transcode', {
                    s3Key: file.s3Key,
                    assetId: file.assetId,
                    service: file.service,
                    packagerService: file.packagerService
                });
                // Wait a bit between jobs to avoid overloading
                await new Promise(r => setTimeout(r, 1000));
            } catch (err) {
                console.error('Batch transcode error for', file.assetId, err.message);
            }
        }
    })();

    res.json({ success: true, message: 'Batch processing started' });
});