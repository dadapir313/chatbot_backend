import nodemailer from 'nodemailer';

export const sendOTP = async (userEmail, otpCode) => {
    // If credentials aren't set in .env, just log the OTP for testing
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log(`\n===========================================`);
        console.log(`✉️ EMAIL SIMULATION FOR: ${userEmail}`);
        console.log(`🔒 Your OTP verification code is: ${otpCode}`);
        console.log(`===========================================\n`);
        return;
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: '"Nura AI" <noreply@nura.ai>',
            to: userEmail,
            subject: "Your OTP Verification Code",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #0f172a; padding: 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0;">Nura AI</h1>
                    </div>
                    <div style="padding: 30px; background-color: #ffffff;">
                        <h2 style="color: #0f172a; margin-top: 0;">Verify your email address</h2>
                        <p style="color: #475569; font-size: 16px; line-height: 1.5;">
                            Thank you for creating an account! Please use the following 6-digit verification code to complete your registration.
                        </p>
                        <div style="background-color: #f1f5f9; padding: 15px; text-align: center; border-radius: 6px; margin: 25px 0;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #0ea5e9;">${otpCode}</span>
                        </div>
                        <p style="color: #64748b; font-size: 14px;">
                            This code will expire in 10 minutes. If you did not request this, please ignore this email.
                        </p>
                    </div>
                    <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0;">
                        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                            &copy; ${new Date().getFullYear()} Nura AI. All rights reserved.
                        </p>
                    </div>
                </div>
            `
        });
        console.log(`OTP Email sent successfully to ${userEmail}`);
    } catch (error) {
        console.error("Failed to send OTP email:", error);
        throw new Error("Could not send verification email");
    }
};
