# VOD Uploader to S3 and Transcoding Trigger

This application uploads a local video file (VOD) to an AWS S3 bucket, generates a presigned URL for the uploaded S3 object, and subsequently triggers a custom transcoding API passing the generated presigned URL.

## Prerequisites

1.  **Node.js**: Ensure Node.js (v14 or higher) is installed.
2.  **AWS Account**: An AWS account with an S3 bucket configured.
3.  **AWS Credentials**: Obtain your `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` with permissions to read/write to the specific bucket. 

## Installation

1. Install all dependencies:
   ```bash
   npm install
   ```

2. Copy the example `.env` file and customize it:
   ```bash
   cp .env.example .env
   ```

3. Open `.env` and fill in your details:
   - `AWS_REGION`: Your S3 bucket region (e.g., `us-east-1`)
   - `AWS_ACCESS_KEY_ID`: Your AWS access key
   - `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
   - `AWS_S3_BUCKET_NAME`: The name of your S3 bucket
   - `TRANSCODING_API_URL`: The full URL to your transcoding endpoint (defaults to `http://192.16.12.2:9080/api/v1/assets`)
   - `VOD_FILE_PATH`: The local path to the video file you want to upload (e.g., `./sample.mp4`)
   - `ASSET_ID`: The ID of the asset being transcoded.

## Running the Application

To upload your video and trigger the transcoding pipeline, run:

```bash
npm start
```

## How It Works

1.  **S3 Upload**: Uses `@aws-sdk/client-s3` to upload the video referenced by `VOD_FILE_PATH` to `s3://<YOUR_BUCKET>/VOD_MAIN/<FILENAME>`.
2.  **Presign URL Generation**: Uses `@aws-sdk/s3-request-presigner` to create a secure `GetObject` URL valid for 2 hours (7200 seconds).
3.  **API Call**: Issues an HTTP POST request to the `TRANSCODING_API_URL` matching the provided schema, injecting the presigned URL as the `source_url`.

---

## Server Deployment Guide (Ubuntu / Debian)

If you have a fresh Virtual Machine (VPS) or cloud server and want to deploy this VOD Uploader application to run permanently, follow these steps:

### 1. Install Node.js & Prerequisites

Connect to your server via SSH and install Node.js and `bzip2`/`git` (if not already installed).

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install Node.js (v20 x64 for example)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential
```

### 2. Install PM2

PM2 is a production process manager for Node.js. It will keep your application alive forever and restart it if it crashes.

```bash
sudo npm install -g pm2
```

### 3. Deploy the Application

Clone your repository (or copy your files using SCP/rsync) to the server.

```bash
# Example cloning from git (replace with your repo URL)
git clone https://your-repository-url.git vod-uploader
cd vod-uploader

# Install dependencies
npm install
```

### 4. Configure the Production Environment

Setup your `.env` configuration file properly for the cloud environment.

```bash
cp .env.example .env
nano .env
```

**Crucial Deployment Settings**:
Make sure to set `CALLBACK_BASE_URL` to the public IP or Domain name of your server, so the Transcoder API knows where to send back the POST callback requests.
```env
# Example .env config:
PORT=3000
CALLBACK_PORT=3000
CALLBACK_BASE_URL=http://YOUR_SERVER_PUBLIC_IP:3000
PACKAGER_API_URL=http://192.12.12.13:7010/asset/vodclear
```

### 5. Start the App using PM2

Start the web server using PM2. Instead of `index.js`, we run `server.js` for the frontend web application.

```bash
pm2 start server.js --name vod-uploader
```

**To make PM2 start automatically on server reboots:**
```bash
pm2 startup
# (Run the command that PM2 outputs here)
pm2 save

pm2 list (Shows if your app is currently "online", how much Memory/CPU it's using, and how many times it has restarted)
pm2 logs vod-uploader (Shows you the live console output and any errors happening on the backend)
pm2 restart vod-uploader (Applies your new backend code updates)
pm2 stop vod-uploader (Turns the app off)
```

### 6. (Optional) Set up an NGINX Reverse Proxy

If you want to access the UI on a standard web port (Port 80 HTTP) instead of typing `:3000` at the end of the URL:

```bash
# Install Nginx
sudo apt install nginx -y
```

Create a new Nginx site configuration:
```bash
sudo nano /etc/nginx/sites-available/vod-uploader
```

Paste the following configuration:
```nginx
server {
    listen 80;
    server_name YOUR_SERVER_PUBLIC_IP; # Or your domain like vod.example.com

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the configuration and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/vod-uploader /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

If you configured a domain to point to your NGINX reverse proxy, don't forget to update your `.env` file to use `CALLBACK_BASE_URL=http://your-domain.com`. Restart pm2 via `pm2 restart vod-uploader` so the changes take effect.

You can view application logs using:
```bash
pm2 logs vod-uploader
```
