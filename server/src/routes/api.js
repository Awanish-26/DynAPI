const express = require('express');
const router = express.Router();

const {
    publishModel,
    getModels,
    getModel,
    updateModel,
    deleteModel
} = require('../controllers/modelController');

// Models management
router.get('/models', getModels);
router.get('/models/:name', getModel);
router.post('/models/publish', publishModel);
router.put('/models/:name', updateModel);
router.delete('/models/:name', deleteModel);

module.exports = router;