import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import * as otplib from 'otplib';

const { authenticator } = otplib;

export const signup = async (req, res) => {
    console.log("signup");
    const { name, email, password } = req.body;

    try {
        if (!name || !email || !password) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Generate a new TOTP secret for the user
        const totpSecret = authenticator.generateSecret();
        console.log(totpSecret);
        // Create an otpauth URL for QrCode display (Name, Service Name, Secret)
        const otpauthUrl = authenticator.keyuri(email, 'Nura AI', totpSecret);
        console.log(otpauthUrl)
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                totpSecret,
                isVerified: false
            }
        });

        res.status(201).json({ 
            message: "User registered. Please scan the QR code to setup Google Authenticator.", 
            userId: user.id,
            otpauthUrl // Send this to the frontend to render the QR code
        });
    } catch (error) {
        console.log(error); 
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

        if (!user.totpSecret) {
            return res.status(400).json({ error: "No authenticator setup found for this user." });
        }

        // Verify the provided 6-digit code against the user's secret
        const isValid = authenticator.check(code, user.totpSecret);

        if (!isValid) {
            return res.status(400).json({ error: "Invalid authenticator code" });
        }

        // Mark as verified, but DO NOT clear the totpSecret! They need it to log in later.
        const updatedUser = await prisma.user.update({
            where: { email },
            data: {
                isVerified: true
            }
        });

        // Generate JWT token on successful verification
        const token = jwt.sign(
            { userId: updatedUser.id, email: updatedUser.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ 
            message: "Authenticator verified successfully", 
            token, 
            user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email } 
        });

    } catch (error) {
        console.error("TOTP verification error:", error);
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
        // Legacy accounts (created before OTP) won't have a totpSecret, so we let them pass
        if (!user.isVerified && user.totpSecret) {
            const otpauthUrl = authenticator.keyuri(email, 'Nura AI', user.totpSecret);
            return res.status(403).json({ 
                error: "Account not verified. Please scan the QR code first.", 
                unverifiedEmail: user.email,
                otpauthUrl 
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        
        if (isMatch) {
            // Auto-verify legacy accounts on their first successful login
            if (!user.isVerified && !user.totpSecret) {
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
