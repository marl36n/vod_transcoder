document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const dropzone = document.getElementById('uploadDropzone');
    const fileInput = document.getElementById('fileInput');
    const selectBtn = document.getElementById('selectBtn');
    const fileInfo = document.getElementById('fileInfo');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const clearBtn = document.getElementById('clearBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const transcodeBtn = document.getElementById('transcodeBtn');
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressText = document.getElementById('progressText');
    const alertBox = document.getElementById('alertBox');
    const alertMessage = document.getElementById('alertMessage');
    const transcodeSection = document.getElementById('transcodeSection');
    const assetIdInput = document.getElementById('assetIdInput');
    const serviceInput = document.getElementById('serviceInput');
    const packagerServiceInput = document.getElementById('packagerServiceInput');
    const statusSection = document.getElementById('statusSection');
    const statusText = document.getElementById('statusText');
    const packagerResponseDisplay = document.getElementById('packagerResponseDisplay');

    // State
    let selectedFile = null;
    let uploadedS3Key = null;

    // Functions
    const showFile = (file) => {
        if (!file) return;
        selectedFile = file;
        fileNameDisplay.textContent = file.name;

        fileInfo.classList.remove('hidden');
        selectBtn.classList.add('hidden');
        dropzone.querySelector('h2').classList.add('hidden');
        dropzone.querySelector('.file-limits').classList.add('hidden');
        dropzone.querySelector('.icon').classList.add('hidden');

        uploadBtn.disabled = false;

        uploadBtn.disabled = false;

        // Reset states
        transcodeSection.classList.add('hidden');
        statusSection.classList.add('hidden');
        alertBox.classList.add('hidden');
        progressSection.classList.add('hidden');
        uploadedS3Key = null;
    };

    const clearFile = () => {
        selectedFile = null;
        fileInput.value = '';

        fileInfo.classList.add('hidden');
        selectBtn.classList.remove('hidden');
        dropzone.querySelector('h2').classList.remove('hidden');
        dropzone.querySelector('.file-limits').classList.remove('hidden');
        dropzone.querySelector('.icon').classList.remove('hidden');

        uploadBtn.disabled = true;
        uploadBtn.classList.remove('hidden');
        transcodeSection.classList.add('hidden');
        statusSection.classList.add('hidden');
        alertBox.classList.add('hidden');
        progressSection.classList.add('hidden');
    };

    const showAlert = (message, type = 'success') => {
        alertMessage.textContent = message;
        alertBox.className = `alert ${type}`;
        alertBox.classList.remove('hidden');
    };

    // Event Listeners for Drag and Drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            showFile(e.dataTransfer.files[0]);
        }
    });

    // File Input Select
    selectBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            showFile(e.target.files[0]);
        }
    });

    // Clear File
    clearBtn.addEventListener('click', clearFile);

    // Upload Action
    uploadBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        try {
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = 'Preparing...';
            alertBox.classList.add('hidden');

            // 1. Get presigned URL from backend
            const presignRes = await fetch('/api/presign-upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: selectedFile.name,
                    fileType: selectedFile.type || 'application/octet-stream'
                })
            });

            if (!presignRes.ok) throw new Error('Failed to start upload process');

            const { uploadUrl, s3Key } = await presignRes.json();

            // 2. Upload directly to S3 using XHR to track progress
            uploadBtn.classList.add('hidden');
            progressSection.classList.remove('hidden');
            progressText.textContent = 'Uploading to S3...';
            progressBar.style.width = '0%';
            progressPercentage.textContent = '0%';

            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        progressBar.style.width = `${percentComplete}%`;
                        progressPercentage.textContent = `${percentComplete}%`;
                    }
                });

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(new Error(`S3 Upload failed with status ${xhr.status}`));
                    }
                };

                xhr.onerror = () => reject(new Error('Network error during upload'));

                xhr.open('PUT', uploadUrl, true);
                xhr.setRequestHeader('Content-Type', selectedFile.type || 'application/octet-stream');
                xhr.send(selectedFile);
            });

            // Upload Success
            uploadedS3Key = s3Key;
            progressText.textContent = 'Upload Complete!';
            showAlert('Video successfully uploaded to S3.', 'success');

            // Show Transcode Section
            transcodeSection.classList.remove('hidden');

        } catch (error) {
            console.error('Upload Error:', error);
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = 'Retry Upload';
            uploadBtn.classList.remove('hidden');
            progressSection.classList.add('hidden');
            showAlert(error.message || 'An error occurred during upload', 'error');
        }
    });

    // Transcode Action
    let pollingInterval = null;

    transcodeBtn.addEventListener('click', async () => {
        if (!uploadedS3Key) return;
        const requestedAssetId = assetIdInput.value.trim();
        if (!requestedAssetId) {
            showAlert('Please enter an Asset ID before transcoding', 'error');
            return;
        }

        try {
            const originalHtml = transcodeBtn.innerHTML;
            transcodeBtn.disabled = true;
            transcodeBtn.innerHTML = 'Starting Transcoding...';
            statusSection.classList.add('hidden');

            const res = await fetch('/api/transcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    s3Key: uploadedS3Key,
                    assetId: requestedAssetId,
                    service: serviceInput.value,
                    packagerService: packagerServiceInput.value
                })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to trigger transcoding API');

            showAlert('Transcoding API called successfully! The background job has started.', 'success');
            transcodeBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="btn-icon-svg"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Transcoding Initiated
            `;

            // Start Polling Status
            statusSection.classList.remove('hidden');
            statusText.textContent = 'Transcoding in progress...';
            packagerResponseDisplay.textContent = 'Waiting for transcoder callback...';

            if (pollingInterval) clearInterval(pollingInterval);
            pollingInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch(`/api/status/${requestedAssetId}`);
                    const statusData = await statusRes.json();

                    if (statusData.status === 'PACKAGING') {
                        statusText.textContent = 'Triggering Packager...';
                        packagerResponseDisplay.textContent = 'Callback received. Calling Packaging API...';
                    } else if (statusData.status === 'COMPLETED') {
                        statusText.textContent = 'Packaging Completed';
                        packagerResponseDisplay.textContent = JSON.stringify(statusData.packagerResponse, null, 2);
                        clearInterval(pollingInterval);
                        showAlert('PlayBack Url Generated', 'success');
                    } else if (statusData.status === 'ERROR') {
                        statusText.textContent = 'Pipeline Error';
                        packagerResponseDisplay.textContent = 'Error: ' + JSON.stringify(statusData.error || statusData.packagerResponse, null, 2);
                        clearInterval(pollingInterval);
                    }
                } catch (e) {
                    // Ignore transient errors
                }
            }, 3000);

        } catch (error) {
            console.error('Transcode Error:', error);
            transcodeBtn.disabled = false;
            transcodeBtn.innerHTML = 'Retry Transcoding';
            showAlert('Error triggering transcoding: ' + error.message, 'error');
        }
    });
});
