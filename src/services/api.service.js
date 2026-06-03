const axios = require('axios');

async function triggerTranscode(apiUrl, payload) {
    console.log(`[API Service] triggerTranscode POST to: ${apiUrl}`);
    try {
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 120000 // 2 minutes timeout for the trigger request
        });
        console.log(`[API Service] triggerTranscode SUCCESS - Status: ${response.status}`);
        return response;
    } catch (error) {
        console.error(`[API Service] triggerTranscode ERROR - Message: ${error.message}`);
        if (error.response) {
             console.error(`[API Service] Response Status: ${error.response.status}, Data:`, error.response.data);
        }
        throw error;
    }
}

async function triggerPackaging(putUrl, payload) {
    console.log(`[API Service] triggerPackaging PUT to: ${putUrl}`);
    try {
        const response = await axios.put(putUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });
        console.log(`[API Service] triggerPackaging SUCCESS - Status: ${response.status}`);
        return response;
    } catch (error) {
        console.error(`[API Service] triggerPackaging ERROR - Message: ${error.message}`);
        if (error.response) {
             console.error(`[API Service] Response Status: ${error.response.status}, Data:`, error.response.data);
        }
        throw error;
    }
}

async function fetchContentList(fetchUrl) {
    console.log(`[API Service] fetchContentList GET to: ${fetchUrl}`);
    try {
        const response = await axios.get(fetchUrl, { timeout: 30000 });
        console.log(`[API Service] fetchContentList SUCCESS - Status: ${response.status}`);
        return response;
    } catch (error) {
        console.error(`[API Service] fetchContentList ERROR - Message: ${error.message}`);
        if (error.response) {
             console.error(`[API Service] Response Status: ${error.response.status}, Data:`, error.response.data);
        }
        throw error;
    }
}

async function deleteContent(deleteUrl) {
    console.log(`[API Service] deleteContent DELETE to: ${deleteUrl}`);
    try {
        const response = await axios.delete(deleteUrl, { timeout: 30000 });
        console.log(`[API Service] deleteContent SUCCESS - Status: ${response.status}`);
        return response;
    } catch (error) {
        console.error(`[API Service] deleteContent ERROR - Message: ${error.message}`);
        if (error.response) {
             console.error(`[API Service] Response Status: ${error.response.status}, Data:`, error.response.data);
        }
        throw error;
    }
}

module.exports = {
    triggerTranscode,
    triggerPackaging,
    fetchContentList,
    deleteContent
};
