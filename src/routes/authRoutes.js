import express from 'express';
import { signup, login, verifyOTP, googleLogin } from '../controllers/authController.js';

const router = express.Router();
router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-otp', verifyOTP);
router.post('/google', googleLogin);

export default router;
