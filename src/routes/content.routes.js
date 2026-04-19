const express = require('express');
const router = express.Router();
const contentController = require('../controllers/content.controller');

router.get('/contentslist', contentController.getContentsList);
router.delete('/contents/:serviceId/:contentId', contentController.deleteContent);

module.exports = router;
