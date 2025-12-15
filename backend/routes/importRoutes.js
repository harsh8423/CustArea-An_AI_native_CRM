const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Temp storage
const authenticateToken = require('../middleware/authMiddleware');
const { uploadFile, getJobStatus, saveMapping, processImport } = require('../controllers/importController');

// All routes protected
router.use(authenticateToken);

router.post('/upload', upload.single('file'), uploadFile);
router.get('/:id', getJobStatus);
router.post('/:id/map', saveMapping);
router.post('/:id/process', processImport);

module.exports = router;
