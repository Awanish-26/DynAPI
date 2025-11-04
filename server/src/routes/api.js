const express = require('express');
const { publishModel, getModels } = require('../controllers/modelController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

const injectApp = (req, res, next) => {
    req.app = req.app || {};
    next();
}

router.post('/models/publish', authenticateToken, injectApp, publishModel);
router.get('/models', authenticateToken, getModels);

module.exports = router;