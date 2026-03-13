import express from 'express';
import { sendMessage, getConversations, getMessages, deleteConversation, renameConversation, toggleShare, getSharedConversation } from '../controllers/chatController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/shared/:id', getSharedConversation);

// Protected routes
router.use(authMiddleware);

router.post('/', sendMessage);
router.get('/conversations', getConversations);
router.get('/conversations/:id', getMessages);
router.delete('/conversations/:id', deleteConversation);
router.patch('/conversations/:id', renameConversation);
router.patch('/conversations/:id/share', toggleShare);

export default router;