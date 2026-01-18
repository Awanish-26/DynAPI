import { Router } from 'express';
const router = Router();

import { publishModel, getModels, getModel, updateModel, deleteModel } from '../controllers/modelController.js';

// Models management
router.get('/models', getModels);
router.post('/models/publish', publishModel);
router.put('/models/:name', updateModel);
router.get('/models/:name', getModel);
router.delete('/models/:name', deleteModel);

export default router;