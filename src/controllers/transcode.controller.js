const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3Client = require('../config/aws.config');
const env = require('../config/env.config');
const assetModel = require('../models/assetModel');
const apiService = require('../services/api.service');

const processTranscode = async (data) => {
    const { s3Key, assetId, service, packagerService } = data;

    if (!s3Key) {
        throw new Error('s3Key is required');
    }

    let rawFinalId = assetId || env.app.assetIdPrefix;
    const finalAssetId = rawFinalId.replace(/^vods\/?/, '');

    const command = new GetObjectCommand({
        Bucket: env.aws.bucketName,
        Key: s3Key,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 7200 });

    const apiPayload = {
        asset_info: {
            asset_id: finalAssetId,
            source_url: downloadUrl,
            service: service || "template_h264_high_2997_vod",
            storage: "hdd",
            priority: 5
        },
        callback_urls: [`${env.app.callbackBaseUrl}/api/callback`]
    };

    assetModel.setStatus(finalAssetId, { status: 'TRANSCODING', packagerService: packagerService || 'vodclear' });

    const curlEquivalent = `curl -i -X POST "${env.apis.transcoding}" -H "Content-Type: application/json" -d '${JSON.stringify(apiPayload)}'`;
    console.log('\n--- Sending Transcoding API Request ---');
    console.log(curlEquivalent);
    console.log('---------------------------------------\n');

    console.log(`[Controller] Awaiting apiService.triggerTranscode for ${finalAssetId}...`);
    const apiResponse = await apiService.triggerTranscode(env.apis.transcoding, apiPayload);
    console.log(`[Controller] apiService.triggerTranscode completed for ${finalAssetId}.`);
    
    return apiResponse;
};

const triggerTranscode = async (req, res) => {
    try {
        const response = await processTranscode(req.body);

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
};

const batchTranscode = async (req, res) => {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'files array required' });
    }

    console.log(`\n[Controller] batchTranscode initiated for ${files.length} files.`);

    (async () => {
        for (const file of files) {
            console.log(`[Controller] Batch loop: Starting processTranscode for asset: ${file.assetId}`);
            try {
                await processTranscode(file);
                console.log(`[Controller] Batch loop: processTranscode successfully finished for asset: ${file.assetId}`);
                await new Promise(r => setTimeout(r, 1000));
            } catch (err) {
                console.error(`[Controller] Batch transcode error for asset: ${file.assetId}`, err.message);
            }
        }
        console.log(`[Controller] Batch transcode loop completed for all files.`);
    })();

    res.json({ success: true, message: 'Batch processing started' });
};

const handleCallback = async (req, res) => {
    console.log('\n--- Transcoding Callback Received ---');
    console.log('Callback Payload:', JSON.stringify(req.body, null, 2));

    res.status(200).send('OK');

    let rawAssetId = req.body?.asset_id || req.body?.AssetId || env.app.assetIdPrefix;
    if (req.body?.asset_info?.asset_id) rawAssetId = req.body.asset_info.asset_id;

    const assetIdToPackage = rawAssetId.replace(/^vods\/?/, '');
    const jobStatus = req.body?.status;

    // Handle ongoing progress updates
    if (jobStatus === 'TRANSCODING' || jobStatus === 'PROCESSING' || jobStatus === 'IN_PROGRESS' || req.body?.progress !== undefined) {
        let progress = req.body?.progress || req.body?.percentage || 0;
        
        if (typeof progress === 'string') progress = parseFloat(progress);
        if (progress > 0 && progress <= 1) progress = progress * 100;
        progress = Math.round(progress);

        console.log(`Transcoding in progress for ${assetIdToPackage}: ${progress}%`);
        
        const currentData = assetModel.getStatus(assetIdToPackage);
        assetModel.setStatus(assetIdToPackage, { 
            ...currentData,
            status: 'TRANSCODING', 
            progress: progress 
        });

        if (jobStatus !== 'DONE') return;
    }

    if (jobStatus !== 'DONE') {
        const errorMsg = req.body?.error_msg || 'Unknown error';
        console.error(`Transcoding job did not complete successfully. Status: ${jobStatus}. Error: ${errorMsg}. Cannot proceed to packaging.`);
        assetModel.setStatus(assetIdToPackage, { status: 'ERROR', error: `Transcoding failed with status ${jobStatus}: ${errorMsg}` });
        return;
    }

    console.log('Transcoding successful (status: DONE). Proceeding to packaging...');
    console.log('\nTriggering Packaging API for:', assetIdToPackage);

    const assetStatus = assetModel.getStatus(assetIdToPackage);
    const selectedPackagerService = assetStatus.packagerService || 'vodclear';
    assetModel.setStatus(assetIdToPackage, { status: 'PACKAGING' });

    const packagerApiUrl = env.apis.packager;
    const dynamicPackagerUrl = packagerApiUrl.includes('/vodclear')
        ? packagerApiUrl.replace('/vodclear', `/${selectedPackagerService}`)
        : `${packagerApiUrl}/${selectedPackagerService}`;

    const finalAssetIdForUrl = assetIdToPackage.includes('/') ? assetIdToPackage.split('/').pop() : assetIdToPackage;
    const putUrl = `${dynamicPackagerUrl}/${finalAssetIdForUrl}`;
    
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

    const curlEquivalent = `curl -i -X PUT "${putUrl}" -H "Content-Type: application/json" -d '${JSON.stringify(payload)}'`;
    console.log('\n--- Sending Packager API Request ---');
    console.log(curlEquivalent);
    console.log('--------------------------------------\n');

    try {
        const packagerResponse = await apiService.triggerPackaging(putUrl, payload);
        console.log('Packaging API triggered successfully!');
        console.log('Response Status:', packagerResponse.status);
        assetModel.setStatus(assetIdToPackage, { status: 'COMPLETED', packagerResponse: packagerResponse.data });
    } catch (packagerError) {
        console.error('Error triggering Packaging API:', packagerError.message);
        const errorDetails = packagerError.response ? packagerError.response.data : packagerError.message;
        if (packagerError.response) {
            console.error('API Error Response:', packagerError.response.status, packagerError.response.data);
        }
        assetModel.setStatus(assetIdToPackage, { status: 'ERROR', error: errorDetails, packagerResponse: errorDetails });
    }
};

module.exports = { triggerTranscode, batchTranscode, handleCallback };
