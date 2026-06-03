const express = require('express');
const router = express.Router();

const uploadRoutes = require('./upload.routes');
const transcodeRoutes = require('./transcode.routes');
const contentRoutes = require('./content.routes');
const statusRoutes = require('./status.routes');
const authRoutes = require('./auth.routes');
const transcodeController = require('../controllers/transcode.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.use('/', authRoutes);

// Transcode callback path (UNPROTECTED)
router.post('/callback', transcodeController.handleCallback);

// Protected routes
router.use('/upload', authenticateToken, uploadRoutes);
router.use('/transcode', authenticateToken, transcodeRoutes);
router.post('/batch-transcode', authenticateToken, transcodeController.batchTranscode);
router.use('/status', authenticateToken, statusRoutes);
router.use('/', authenticateToken, contentRoutes);

module.exports = router;
