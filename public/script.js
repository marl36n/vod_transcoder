document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const dropzone = document.getElementById('uploadDropzone');
    const fileInput = document.getElementById('fileInput');
    const selectBtn = document.getElementById('selectBtn');
    const fileListContainer = document.getElementById('fileListContainer');
    const batchProcessBtn = document.getElementById('batchProcessBtn');
    
    const alertBox = document.getElementById('alertBox');
    const alertMessage = document.getElementById('alertMessage');
    const toggleViewBtn = document.getElementById('toggleViewBtn');
    const uploadView = document.getElementById('uploadView');
    const contentListView = document.getElementById('contentListView');
    const contentServiceInput = document.getElementById('contentServiceInput');
    const contentListLoading = document.getElementById('contentListLoading');
    const contentListWrapper = document.getElementById('contentListWrapper');
    const contentListDisplay = document.getElementById('contentListDisplay');

    // State
    const MAX_FILES = 15;
    let fileEntries = []; // Array of { id, file }
    let globalIdSeq = 0;

    const showAlert = (message, type = 'success') => {
        alertMessage.textContent = message;
        alertBox.className = `alert ${type}`;
        alertBox.classList.remove('hidden');
    };

    const renderFileList = () => {
        // We only re-render if needed, but for simplicity, we map to DOM nodes or create new ones
        if (fileEntries.length === 0) {
            fileListContainer.classList.add('hidden');
            batchProcessBtn.classList.add('hidden');
            return;
        }

        fileListContainer.classList.remove('hidden');
        batchProcessBtn.classList.remove('hidden');
    };

    const addFiles = (files) => {
        const currentCount = fileEntries.length;
        Array.from(files).forEach(file => {
            if (fileEntries.length >= MAX_FILES) return;
            const id = globalIdSeq++;
            fileEntries.push({ id, file, rowElement: createRowElement(id, file) });
        });
        
        fileListContainer.innerHTML = '';
        fileEntries.forEach(entry => fileListContainer.appendChild(entry.rowElement));
        renderFileList();
    };

    const removeFile = (id) => {
        fileEntries = fileEntries.filter(e => e.id !== id);
        renderFileList();
        
        const row = document.getElementById(`file-row-${id}`);
        if(row) row.remove();
    };

    const createRowElement = (id, file) => {
        const div = document.createElement('div');
        div.className = 'file-row';
        div.id = `file-row-${id}`;
        
        div.innerHTML = `
            <div class="file-row-header">
                <span class="file-row-name">${file.name}</span>
                <button class="file-row-remove" type="button" title="Remove">&times;</button>
            </div>
            <div class="file-row-inputs">
                <div>
                    <label class="file-row-label">Asset ID</label>
                    <input type="text" class="file-row-input asset-id-input" value="" placeholder="Asset ID">
                </div>
                <div>
                    <label class="file-row-label">Transcoding Service</label>
                    <select class="file-row-input service-input">
                        <option value="pac1_abr_h264_1080p_720p_480p_vod">pac1_abr_h264_1080p_720p_480p_vod</option>
                        <option value="pac2_abr_h264_4k_1080p_720p_480p_vod">pac2_abr_h264_4k_1080p_720p_480p_vod</option>
                        <option value="pac3_abr_h265_4k_1080p_720p_vod">pac3_abr_h265_4k_1080p_720p_vod</option>
                        <option value="pak11_cbr_h264_4k">pak11_cbr_h264_4k</option>
                        <option value="pak12_cbr_h264_1080p">pak12_cbr_h264_1080p</option>
                        <option value="pak13_cbr_h264_720p">pak13_cbr_h264_720p</option>
                        <option value="pak14_cbr_h264_480p">pak14_cbr_h264_480p</option>
                        <option value="pak21_cbr_h265_4k">pak21_cbr_h265_4k</option>
                        <option value="pak22_cbr_h264_1080p">pak22_cbr_h264_1080p</option>
                        <option value="pak23_cbr_h264_720p">pak23_cbr_h264_720p</option>
                    </select>
                </div>
                <div>
                    <label class="file-row-label">Packager Service</label>
                    <select class="file-row-input packager-input">
                        <option value="rro-mnc">rro-mnc</option>
                        <option value="rro-dex">rro-dex</option>
                        <option value="vodultra">vodultra</option>
                    </select>
                </div>
            </div>
            <div class="progress-section hidden" style="margin-top: 8px; margin-bottom: 0;">
                <div class="progress-info">
                    <span class="progress-text">Pending...</span>
                    <span class="progress-percentage">0%</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar"></div>
                </div>
            </div>
            <div class="file-row-links hidden"></div>
        `;

        div.querySelector('.file-row-remove').addEventListener('click', () => removeFile(id));
        return div;
    };

    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });

    selectBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files) addFiles(e.target.files);
        fileInput.value = '';
    });

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
                        li.style.cssText = 'padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 0.5rem;';
                        
                        const topRow = document.createElement('div');
                        topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; width: 100%;';

                        const textSpan = document.createElement('span');
                        textSpan.textContent = content.ContentID;
                        textSpan.style.color = '#a5b4fc';
                        textSpan.style.fontWeight = '500';

                        const btnGroup = document.createElement('div');
                        btnGroup.style.cssText = 'display: flex; gap: 0.5rem;';

                        const assetName = content.ContentID.split('/').pop();
                        const hlsUrl = content.PlayUrl || content.playUrl || content.URL || content.url || `https://${serviceId}.mydex.tv/bpk-vod/${serviceId}/default/${content.ContentID}/${assetName}/index.m3u8`;

                        const urlDisplay = document.createElement('div');
                        urlDisplay.style.cssText = 'display: none; background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 6px; font-size: 0.85rem; word-break: break-all;';
                        urlDisplay.innerHTML = `<span style="color: #6ee7b7; font-weight: 600;">HLS:</span> <a href="${hlsUrl}" target="_blank" style="color: #60a5fa; text-decoration: underline;">${hlsUrl}</a>`;

                        const playBtn = document.createElement('button');
                        playBtn.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                            </svg>
                        `;
                        playBtn.style.cssText = 'background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: none; border-radius: 6px; padding: 0.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;';
                        playBtn.title = 'Show Play URL';

                        playBtn.onmouseover = () => playBtn.style.background = 'rgba(59, 130, 246, 0.4)';
                        playBtn.onmouseout = () => playBtn.style.background = 'rgba(59, 130, 246, 0.2)';
                        
                        playBtn.onclick = () => {
                            urlDisplay.style.display = urlDisplay.style.display === 'none' ? 'block' : 'none';
                        };

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
                                const delRes = await fetch(`/api/contents/${encodeURIComponent(serviceId)}/${encodeURIComponent(content.ContentID)}`, { method: 'DELETE' });
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

                        btnGroup.appendChild(playBtn);
                        btnGroup.appendChild(delBtn);
                        topRow.appendChild(textSpan);
                        topRow.appendChild(btnGroup);
                        li.appendChild(topRow);
                        li.appendChild(urlDisplay);
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

    // Batch Processing Workflow
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const setRowStatus = (row, statusClass, msg, pct = null) => {
        row.classList.remove('active', 'success', 'error');
        if (statusClass) row.classList.add(statusClass);

        const pSec = row.querySelector('.progress-section');
        if(pSec) pSec.classList.remove('hidden');

        const pText = row.querySelector('.progress-text');
        const pBar = row.querySelector('.progress-bar');
        const pPct = row.querySelector('.progress-percentage');

        if(msg && pText) pText.textContent = msg;
        if(pct !== null && pBar && pPct) {
            pBar.style.width = `${pct}%`;
            pPct.textContent = `${pct}%`;
        }
    };

    const processUpload = async (entry, row) => {
        const file = entry.file;
        const CHUNK_SIZE = 50 * 1024 * 1024;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        
        setRowStatus(row, 'active', 'Initiating Upload...', 0);

        const initRes = await fetch('/api/upload/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, fileType: file.type || 'application/octet-stream' })
        });
        if (!initRes.ok) throw new Error('Failed to initiate multipart upload');
        const { uploadId, s3Key } = await initRes.json();

        const uploadedParts = [];
        let chunksCompleted = 0;
        const queue = Array.from({length: totalChunks}, (_, i) => i);

        const uploadChunk = async (chunkIndex) => {
            const partNumber = chunkIndex + 1;
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

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
                                resolve(xhr.getResponseHeader('ETag') || '"dummy_etag_needs_cors_fix"');
                            } else reject(new Error(`S3 Error: ${xhr.status}`));
                        };
                        xhr.onerror = () => reject(new Error('Network break on chunk'));
                        xhr.open('PUT', uploadUrl, true);
                        xhr.send(chunk);
                    });

                    let finalEtag = eTag.startsWith('"') ? eTag : '"' + eTag + '"';
                    uploadedParts.push({ PartNumber: partNumber, ETag: finalEtag });
                    chunksCompleted++;
                    setRowStatus(row, 'active', `Uploading (${chunksCompleted}/${totalChunks})...`, Math.round((chunksCompleted/totalChunks)*100));
                    return;
                } catch (e) {
                    if (attempt === 3) throw new Error(`Chunk ${partNumber} failed.`);
                    await sleep(1000);
                }
            }
        };

        const workers = [];
        for (let i = 0; i < 3; i++) {
            workers.push((async () => {
                while (queue.length > 0) await uploadChunk(queue.shift());
            })());
        }
        await Promise.all(workers);

        setRowStatus(row, 'active', 'Stitching file...', 100);
        const compRes = await fetch('/api/upload/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ s3Key, uploadId, parts: uploadedParts })
        });
        if (!compRes.ok) throw new Error('Failed to stitch chunks');

        return s3Key;
    };

    const processTranscode = async (row, s3Key, assetId, service, packagerService) => {
        setRowStatus(row, 'active', 'Triggering Transcoder...', 0);
        const res = await fetch('/api/transcode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ s3Key, assetId, service, packagerService })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to trigger transcoder');
        }

        // Poll
        while (true) {
            await sleep(3000);
            try {
                const statusRes = await fetch(`/api/status/${encodeURIComponent(assetId)}`);
                const statusData = await statusRes.json();

                if (statusData.status === 'TRANSCODING') {
                    setRowStatus(row, 'active', 'Transcoding...', statusData.progress || 0);
                } else if (statusData.status === 'PACKAGING') {
                    setRowStatus(row, 'active', 'Packaging...', 100);
                } else if (statusData.status === 'COMPLETED') {
                    setRowStatus(row, 'success', 'Completed Successfully', 100);
                    
                    const assetName = assetId.split('/').pop();
                    const hlsUrl = `https://${packagerService}.mydex.tv/bpk-vod/${packagerService}/default/${assetId}/${assetName}/index.m3u8`;
                    const dashUrl = `https://${packagerService}.mydex.tv/bpk-vod/${packagerService}/default/${assetId}/${assetName}/index.mpd`;
                    
                    const linksDiv = row.querySelector('.file-row-links');
                    linksDiv.classList.remove('hidden');
                    linksDiv.innerHTML = `<strong>HLS:</strong> <a href="${hlsUrl}" target="_blank">${hlsUrl}</a><br/><strong>DASH:</strong> <a href="${dashUrl}" target="_blank">${dashUrl}</a>`;
                    return;
                } else if (statusData.status === 'ERROR') {
                    throw new Error(JSON.stringify(statusData.error || statusData.packagerResponse));
                }
            } catch(e) {
                if (e.message.includes('JSON')) throw e; // Fatal error
                // else transient poll error, keep trying
            }
        }
    };

    batchProcessBtn.addEventListener('click', async () => {
        if (fileEntries.length === 0) return;
        
        // Disable UI
        alertBox.classList.add('hidden');
        batchProcessBtn.disabled = true;
        batchProcessBtn.innerHTML = 'Processing Batch...';
        dropzone.style.pointerEvents = 'none';
        dropzone.style.opacity = '0.5';

        document.querySelectorAll('.file-row-remove, .file-row-input').forEach(el => el.disabled = true);

        for (const entry of fileEntries) {
            const row = entry.rowElement;
            
            // Check if already done or error? We just process all that aren't success.
            if (row.classList.contains('success')) continue;
            
            const assetId = row.querySelector('.asset-id-input').value.trim();
            const service = row.querySelector('.service-input').value;
            const packager = row.querySelector('.packager-input').value;

            if (!assetId) {
                setRowStatus(row, 'error', 'Error: Missing Asset ID');
                continue;
            }

            try {
                const s3Key = await processUpload(entry, row);
                await processTranscode(row, s3Key, assetId, service, packager);
            } catch (err) {
                console.error(`Error processing ${entry.file.name}:`, err);
                setRowStatus(row, 'error', `Error: ${err.message}`);
                // Continue to next file
            }
        }

        batchProcessBtn.innerHTML = 'Batch Process Complete';
        showAlert('Batch processing finished. Check individual rows for status.', 'success');
        document.querySelectorAll('.file-row-input').forEach(el => el.disabled = false);
        dropzone.style.pointerEvents = 'auto';
        dropzone.style.opacity = '1';
    });

});
