const { CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3Client = require('../config/aws.config');
const env = require('../config/env.config');

const initiateUpload = async (req, res) => {
    try {
        const { fileName, fileType } = req.body;
        if (!fileName || !fileType) return res.status(400).json({ error: 'fileName and fileType are required' });

        const s3Key = `VOD_MAIN/${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const command = new CreateMultipartUploadCommand({
            Bucket: env.aws.bucketName,
            Key: s3Key,
            ContentType: fileType
        });

        const response = await s3Client.send(command);
        res.json({ uploadId: response.UploadId, s3Key, bucket: env.aws.bucketName });
    } catch (error) {
        console.error('Error initiating multi-part upload:', error);
        res.status(500).json({ error: 'Failed to initiate Upload' });
    }
};

const presignPart = async (req, res) => {
    try {
        const { s3Key, uploadId, partNumber } = req.body;
        if (!s3Key || !uploadId || !partNumber) return res.status(400).json({ error: 's3Key, uploadId, and partNumber are required' });

        const command = new UploadPartCommand({
            Bucket: env.aws.bucketName,
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
};

const completeUpload = async (req, res) => {
    try {
        const { s3Key, uploadId, parts } = req.body;
        if (!s3Key || !uploadId || !parts || !Array.isArray(parts)) return res.status(400).json({ error: 's3Key, uploadId, and parts array are required' });

        parts.sort((a, b) => a.PartNumber - b.PartNumber);

        const command = new CompleteMultipartUploadCommand({
            Bucket: env.aws.bucketName,
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
};

module.exports = { initiateUpload, presignPart, completeUpload };
