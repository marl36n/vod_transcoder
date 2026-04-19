// In-memory store for asset statuses
const assetStatuses = {};

module.exports = {
    getStatus: (assetId) => assetStatuses[assetId] || { status: 'UNKNOWN' },
    setStatus: (assetId, data) => {
        assetStatuses[assetId] = Object.assign(assetStatuses[assetId] || {}, data);
    },
    getAll: () => assetStatuses
};
