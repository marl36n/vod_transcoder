const express = require('express');
const router = express.Router();

const uploadRoutes = require('./upload.routes');
const transcodeRoutes = require('./transcode.routes');
const contentRoutes = require('./content.routes');
const statusRoutes = require('./status.routes');
const transcodeController = require('../controllers/transcode.controller');

router.use('/upload', uploadRoutes);
router.use('/transcode', transcodeRoutes);
// Transcode callback path
router.post('/callback', transcodeController.handleCallback);
router.use('/status', statusRoutes);

// content routes handle /contentslist and /contents/:serviceId/:contentId
router.use('/', contentRoutes);

module.exports = router;
