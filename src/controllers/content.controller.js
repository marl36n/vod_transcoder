const env = require('../config/env.config');
const apiService = require('../services/api.service');

const getContentsList = async (req, res) => {
    try {
        const { ServiceID } = req.query;
        if (!ServiceID) {
            return res.status(400).json({ error: 'ServiceID is required' });
        }

        const baseUrl = new URL(env.apis.packager).origin;
        const fetchUrl = `${baseUrl}/asset/contentslist?ServiceID=${ServiceID}`;

        console.log(`\n--- Fetching Contents List ---`);
        console.log(`URL: ${fetchUrl}`);

        const response = await apiService.fetchContentList(fetchUrl);
        
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching contents list:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch contents list', 
            details: error.response ? error.response.data : error.message 
        });
    }
};

const deleteContent = async (req, res) => {
    try {
        const { serviceId, contentId } = req.params;
        const baseUrl = new URL(env.apis.packager).origin;
        const deleteUrl = `${baseUrl}/asset/${serviceId}/${contentId}`;

        const curlEquivalent = `curl -i -X DELETE "${deleteUrl}"`;
        console.log(`\n--- Deleting Content Request ---`);
        console.log(curlEquivalent);
        console.log(`--------------------------------\n`);

        const response = await apiService.deleteContent(deleteUrl);
        
        // Also call the Transcoder delete API
        const baseTranscoderUrl = env.apis.transcoding.endsWith('/') ? env.apis.transcoding.slice(0, -1) : env.apis.transcoding;
        const transcoderDeleteUrl = `${baseTranscoderUrl}/${serviceId}/${encodeURIComponent(contentId)}`;
        const transcoderCurlEquivalent = `curl -i -X DELETE "${transcoderDeleteUrl}"`;
        
        console.log(`\n--- Deleting Content Request (Transcoder) ---`);
        console.log(transcoderCurlEquivalent);
        console.log(`--------------------------------\n`);
        
        try {
            await apiService.deleteContent(transcoderDeleteUrl);
        } catch (transcoderError) {
            console.error('Error deleting content from Transcoder API:', transcoderError.message);
            // We proceed anyway since the primary packager delete succeeded
        }
        
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error('Error deleting content:', error.message);
        res.status(500).json({ 
            error: 'Failed to delete content', 
            details: error.response ? error.response.data : error.message 
        });
    }
};

module.exports = { getContentsList, deleteContent };
