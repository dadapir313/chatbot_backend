import express from 'express';
import { sendMessage, getConversations, getMessages, deleteConversation } from '../controllers/chatController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// All chat routes deserve protection
router.use(authMiddleware);

router.post('/', sendMessage);
router.get('/conversations', getConversations);
router.get('/conversations/:id', getMessages);
router.delete('/conversations/:id', deleteConversation);

export default router;