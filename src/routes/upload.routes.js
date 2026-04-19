const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');

router.post('/initiate', uploadController.initiateUpload);
router.post('/presign-part', uploadController.presignPart);
router.post('/complete', uploadController.completeUpload);

module.exports = router;
