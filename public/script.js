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
    const toggleViewBtn = document.getElementById('toggleViewBtn');
    const uploadView = document.getElementById('uploadView');
    const contentListView = document.getElementById('contentListView');
    const contentServiceInput = document.getElementById('contentServiceInput');
    const contentListLoading = document.getElementById('contentListLoading');
    const contentListWrapper = document.getElementById('contentListWrapper');
    const contentListDisplay = document.getElementById('contentListDisplay');

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

    // View Toggle
    if (toggleViewBtn) {
        toggleViewBtn.addEventListener('click', () => {
            if (uploadView.classList.contains('hidden')) {
                uploadView.classList.remove('hidden');
                contentListView.classList.add('hidden');
            } else {
                uploadView.classList.add('hidden');
                contentListView.classList.remove('hidden');
            }
        });
    }

    // Fetch Contents List
    if (contentServiceInput) {
        contentServiceInput.addEventListener('change', async (e) => {
            const serviceId = e.target.value;
            if (!serviceId) return;

            contentListLoading.classList.remove('hidden');
            contentListWrapper.classList.add('hidden');
            contentListDisplay.textContent = '';
            alertBox.classList.add('hidden');

            try {
                const res = await fetch(`/api/contentslist?ServiceID=${encodeURIComponent(serviceId)}`);
                const data = await res.json();

                if (!res.ok) throw new Error(data.error || 'Failed to fetch content list');

                contentListDisplay.innerHTML = '';
                if (data.Contents && data.Contents.length > 0) {
                    data.Contents.forEach(content => {
                        const li = document.createElement('li');
                        li.style.cssText = 'padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;';
                        
                        const textSpan = document.createElement('span');
                        textSpan.textContent = content.ContentID;
                        textSpan.style.color = '#a5b4fc';
                        textSpan.style.fontWeight = '500';

                        const delBtn = document.createElement('button');
                        delBtn.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                        `;
                        delBtn.style.cssText = 'background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: none; border-radius: 6px; padding: 0.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;';
                        delBtn.title = 'Delete Content';

                        delBtn.onmouseover = () => delBtn.style.background = 'rgba(239, 68, 68, 0.4)';
                        delBtn.onmouseout = () => delBtn.style.background = 'rgba(239, 68, 68, 0.2)';

                        delBtn.onclick = async () => {
                            if (!confirm(`Are you sure you want to delete ${content.ContentID}?`)) return;
                            
                            const originalHTML = delBtn.innerHTML;
                            delBtn.disabled = true;
                            delBtn.innerHTML = '...';
                            
                            try {
                                const delRes = await fetch(`/api/contents/${encodeURIComponent(serviceId)}/${encodeURIComponent(content.ContentID)}`, {
                                    method: 'DELETE'
                                });
                                const delData = await delRes.json();
                                if (!delRes.ok) throw new Error(delData.error || 'Failed to delete');
                                
                                li.remove();
                                showAlert(`Deleted ${content.ContentID} successfully`, 'success');
                            } catch (error) {
                                delBtn.disabled = false;
                                delBtn.innerHTML = originalHTML;
                                showAlert(error.message, 'error');
                            }
                        };

                        li.appendChild(textSpan);
                        li.appendChild(delBtn);
                        contentListDisplay.appendChild(li);
                    });
                } else {
                    contentListDisplay.innerHTML = '<li style="padding: 1rem; color: #cbd5e1; text-align: center;">No contents found.</li>';
                }
                
                contentListWrapper.classList.remove('hidden');
            } catch (err) {
                showAlert(err.message, 'error');
            } finally {
                contentListLoading.classList.add('hidden');
            }
        });
    }

    // Upload Action (Multi-Part Chunking)
    uploadBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        try {
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = 'Preparing Multi-part...';
            alertBox.classList.add('hidden');

            const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB
            const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);

            // 1. Initiate Multipart
            const initRes = await fetch('/api/upload/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: selectedFile.name, fileType: selectedFile.type || 'application/octet-stream' })
            });

            if (!initRes.ok) throw new Error('Failed to initiate multipart upload');
            const { uploadId, s3Key } = await initRes.json();

            uploadBtn.classList.add('hidden');
            progressSection.classList.remove('hidden');
            progressText.textContent = `Uploading ${totalChunks} chunks (up to 3 at a time)...`;
            progressBar.style.width = '0%';
            progressPercentage.textContent = '0%';

            const uploadedParts = [];
            let chunksCompleted = 0;

            const queue = [];
            for (let i = 0; i < totalChunks; i++) queue.push(i);

            const uploadChunk = async (chunkIndex) => {
                const partNumber = chunkIndex + 1;
                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
                const chunk = selectedFile.slice(start, end);

                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        const presignRes = await fetch('/api/upload/presign-part', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ s3Key, uploadId, partNumber })
                        });
                        if (!presignRes.ok) throw new Error('Failed to get presigned URL');
                        const { uploadUrl } = await presignRes.json();

                        const eTag = await new Promise((resolve, reject) => {
                            const xhr = new XMLHttpRequest();
                            xhr.onload = () => {
                                if (xhr.status >= 200 && xhr.status < 300) {
                                    const rawEtag = xhr.getResponseHeader('ETag');
                                    console.log(`Part ${partNumber} ETag received from server:`, rawEtag);
                                    if (!rawEtag) {
                                        console.warn(`WARNING: ETag is null for part ${partNumber}. Your S3/RGW CORS configuration MUST have <ExposeHeader>ETag</ExposeHeader>. Upload will likely fail with InvalidPart!`);
                                    }
                                    resolve(rawEtag || '"dummy_etag_needs_cors_fix"');
                                } else {
                                    reject(new Error(`S3 Error: ${xhr.status}`));
                                }
                            };
                            xhr.onerror = () => reject(new Error('Network break on chunk'));
                            xhr.open('PUT', uploadUrl, true);
                            xhr.send(chunk);
                        });

                        let finalEtag = eTag;
                        // S3 / RGW expects ETags to have literal double quotes around them in CompleteMultipartUpload
                        if (finalEtag && !finalEtag.startsWith('"')) {
                            finalEtag = '"' + finalEtag + '"';
                        }
                        
                        uploadedParts.push({ PartNumber: partNumber, ETag: finalEtag });
                        
                        chunksCompleted++;
                        const percentComplete = Math.round((chunksCompleted / totalChunks) * 100);
                        progressBar.style.width = `${percentComplete}%`;
                        progressPercentage.textContent = `${percentComplete}%`;
                        return;
                    } catch (e) {
                        if (attempt === 3) throw new Error(`Chunk ${partNumber} ultimately failed.`);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            };

            const MAX_CONCURRENCY = 3;
            const workers = [];
            for (let i = 0; i < MAX_CONCURRENCY; i++) {
                workers.push((async () => {
                    while (queue.length > 0) {
                        const nextChunk = queue.shift();
                        await uploadChunk(nextChunk);
                    }
                })());
            }

            await Promise.all(workers);

            // 3. Complete Upload
            progressText.textContent = 'Stitching massive file...';
            const compRes = await fetch('/api/upload/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ s3Key, uploadId, parts: uploadedParts })
            });

            if (!compRes.ok) throw new Error('Failed to stitch final chunks');

            uploadedS3Key = s3Key;
            progressText.textContent = 'Upload Complete!';
            showAlert('Massive file heavily chunked and uploaded successfully!', 'success');
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
                    const statusRes = await fetch(`/api/status/${encodeURIComponent(requestedAssetId)}`);
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
