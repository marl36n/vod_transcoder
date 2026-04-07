require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const axios = require('axios');
const mime = require('mime-types');

async function main() {
  const region = process.env.AWS_REGION || 'us-east-1';
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  const filePath = process.env.VOD_FILE_PATH;
  const assetId = process.env.ASSET_ID || 'vod-TT217';
  const apiUrl = process.env.TRANSCODING_API_URL || 'http://192.16.12.2:9080/api/v1/assets';
  const packagerApiUrl = process.env.PACKAGER_API_URL || 'http://192.12.12.13:7010/asset/vodclear';
  const callbackPort = process.env.CALLBACK_PORT || 3000;
  // This needs to be a remotely accessible IP/hostname that the transcoding server can reach
  const callbackBaseUrl = process.env.CALLBACK_BASE_URL || `http://localhost:${callbackPort}`;

  if (!bucketName || !filePath) {
    console.error('Error: Please provide AWS_S3_BUCKET_NAME and VOD_FILE_PATH in your .env file.');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at path: ${filePath}`);
    process.exit(1);
  }

  // Set up local server to listen for the transcode callback
  const app = express();
  app.use(express.json());

  const server = app.listen(callbackPort, () => {
    console.log(`Callback listener running on port ${callbackPort}`);
  });

  app.post('/api/callback', async (req, res) => {
    console.log('\n--- Transcoding Callback Received ---');
    console.log('Callback Payload:', JSON.stringify(req.body, null, 2));

    res.status(200).send('OK');

    // Assume success for triggering the packaging API.
    // In production, check req.body for actual success status (e.g., req.body.status === 'SUCCESS')
    console.log('\nTriggering Packaging API...');
    const putUrl = `${packagerApiUrl}/${assetId}`;
    const payload = {
      "CommercialName": "Avatar 5.8",
      "Source": `file:///opt/peak/nas_storage/vodsource/${assetId}/`,
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
    } catch (packagerError) {
      console.error('Error triggering Packaging API:');
      if (packagerError.response) {
        console.error('API Error Response:', packagerError.response.status, packagerError.response.data);
      } else {
        console.error(packagerError.message);
      }
    }

    // Exit the script successfully after processing callback
    server.close();
    process.exit(0);
  });

  // Initialize S3 Client
  // AWS credentials will be automatically picked up from standard environment variables:
  // AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
  const s3Client = new S3Client({ region });
  const fileName = path.basename(filePath);
  const s3Key = `VOD_MAIN/${fileName}`; // Using VOD_MAIN based on your sample URL

  try {
    console.log(`Starting upload of ${filePath} to s3://${bucketName}/${s3Key} ...`);

    // 1. Upload the file to S3
    const fileStream = fs.createReadStream(filePath);
    const contentType = mime.lookup(filePath) || 'application/octet-stream';

    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileStream,
      ContentType: contentType,
    });

    await s3Client.send(putCommand);
    console.log('Upload completed successfully!');

    // 2. Generate Presigned URL for downloading (source_url for the transcoding API)
    console.log('Generating presigned URL for the uploaded asset...');
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    // URL expires in 2 hours (7200 seconds) as per your example
    const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 7200 });
    console.log('Presigned URL generated successfully.');

    // 3. Call the Transcoding API
    console.log('Calling Transcoding API...');
    const apiPayload = {
      asset_info: {
        asset_id: assetId,
        source_url: presignedUrl,
        service: "template_h264_high_2997_vod",
        storage: "hdd",
        priority: 5
      },
      callback_urls: [`${callbackBaseUrl}/api/callback`]
    };

    const response = await axios.post(apiUrl, apiPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Transcoding API called successfully!');
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));

    console.log(`\nWaiting for transcoding callback at ${callbackBaseUrl}/api/callback ...`);
    // Note: Do not process.exit() here, since we need to wait for the express server callback

  } catch (error) {
    console.error('An error occurred during the process:');
    if (error.response) {
      console.error('API Error Response:', error.response.status, error.response.data);
    } else {
      console.error(error.message);
    }
    server.close();
    process.exit(1);
  }
}

main();
