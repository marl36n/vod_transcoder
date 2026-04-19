const express = require('express');
const router = express.Router();
const transcodeController = require('../controllers/transcode.controller');

router.post('/', transcodeController.triggerTranscode);

module.exports = router;
