const axios = require('axios');

async function triggerTranscode(apiUrl, payload) {
    return axios.post(apiUrl, payload, {
        headers: { 'Content-Type': 'application/json' }
    });
}

async function triggerPackaging(putUrl, payload) {
    return axios.put(putUrl, payload, {
        headers: { 'Content-Type': 'application/json' }
    });
}

async function fetchContentList(fetchUrl) {
    return axios.get(fetchUrl);
}

async function deleteContent(deleteUrl) {
    return axios.delete(deleteUrl);
}

module.exports = {
    triggerTranscode,
    triggerPackaging,
    fetchContentList,
    deleteContent
};
