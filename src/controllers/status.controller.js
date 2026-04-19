const assetModel = require('../models/assetModel');

const getStatus = (req, res) => {
    const status = assetModel.getStatus(req.params.assetId);
    res.json(status);
};

module.exports = { getStatus };
