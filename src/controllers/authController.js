import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sendOTP } from '../utils/sendEmail.js';

// Generate a random 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export const signup = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        if (!name || !email || !password) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Generate OTP and expiration (10 minutes from now)
        const otpCode = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                otpCode,
                otpExpiresAt,
                isVerified: false
            }
        });

        // Send OTP via email
        try {
            await sendOTP(email, otpCode);
        } catch (emailError) {
            console.error("Email sending failed:", emailError);
            // We still proceed, but log the error
        }

        res.status(201).json({ message: "User registered. Please check your email for the OTP.", userId: user.id });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: "Email already exists" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
};

export const verifyOTP = async (req, res) => {
    const { email, code } = req.body;

    try {
        if (!email || !code) {
            return res.status(400).json({ error: "Email and OTP code are required" });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (user.isVerified) {
            return res.status(400).json({ error: "User is already verified" });
        }

        if (user.otpCode !== code) {
            return res.status(400).json({ error: "Invalid OTP code" });
        }

        if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
            return res.status(400).json({ error: "OTP code has expired. Please request a new one." });
        }

        // Mark as verified and clear OTP fields
        const updatedUser = await prisma.user.update({
            where: { email },
            data: {
                isVerified: true,
                otpCode: null,
                otpExpiresAt: null
            }
        });

        // Generate JWT token on successful verification
        const token = jwt.sign(
            { userId: updatedUser.id, email: updatedUser.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ 
            message: "Email verified successfully", 
            token, 
            user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email } 
        });

    } catch (error) {
        console.error("OTP verification error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const resendOTP = async (req, res) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (user.isVerified) {
            return res.status(400).json({ error: "User is already verified" });
        }

        // Generate new OTP
        const otpCode = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.user.update({
            where: { email },
            data: { otpCode, otpExpiresAt }
        });

        // Send new OTP
        try {
            await sendOTP(email, otpCode);
        } catch (emailError) {
            console.error("Email sending failed:", emailError);
        }

        res.status(200).json({ message: "A new OTP has been sent to your email" });
    } catch (error) {
        console.error("OTP resend error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;
   
    try {
        if (!email || !password) {
            return res.status(400).json({ error: "Missing email or password" });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });
       
        if (!user || !user.password) {
            return res.status(404).json({ error: "Invalid Credentials" });
        }

        // Verify that the user has completed OTP verification
        // Legacy accounts (created before OTP) won't have an otpCode, so we let them pass
        if (!user.isVerified && user.otpCode !== null) {
            return res.status(403).json({ error: "Email not verified. Please verify your email first.", unverifiedEmail: user.email });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        
        if (isMatch) {
            // Auto-verify legacy accounts on their first successful login
            if (!user.isVerified && user.otpCode === null) {
                await prisma.user.update({
                    where: { email },
                    data: { isVerified: true }
                });
            }
            const token = jwt.sign(
                { userId: user.id, email: user.email }, 
                process.env.JWT_SECRET, 
                { expiresIn: '1h' } 
            );
            res.status(200).json({ message: "Login successful", token, user: { id: user.id, name: user.name, email: user.email } });
        } else {
            res.status(401).json({ error: "Invalid password" });
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
