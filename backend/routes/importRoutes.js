const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Temp storage
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { uploadFile, getJobStatus, saveMapping, processImport } = require('../controllers/importController');

// All routes protected
router.use(authenticateToken);

router.post('/upload', requirePermission('imports.create'), upload.single('file'), uploadFile);
router.get('/:id', requirePermission('imports.view'), getJobStatus);
router.post('/:id/map', requirePermission('imports.create'), saveMapping);
router.post('/:id/process', requirePermission('imports.create'), processImport);

module.exports = router;
