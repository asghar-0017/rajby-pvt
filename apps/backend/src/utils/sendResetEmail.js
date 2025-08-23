import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Creates a nodemailer transporter for sending emails
 */
const createTransporter = () => {
  // Check if required environment variables are set
  if (!process.env.EMAIL || !process.env.EMAIL_PASS) {
    throw new Error('Email configuration missing: EMAIL and EMAIL_PASS environment variables are required');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS,
    },
    // Add timeout and connection settings
    connectionTimeout: 60000, // 60 seconds
    greetingTimeout: 30000,   // 30 seconds
    socketTimeout: 60000,     // 60 seconds
  });
};

/**
 * Sends a password reset email with the provided code
 * @param {string} email - Recipient email address
 * @param {string} code - 6-digit reset code
 * @returns {Promise} Email sending result
 */
const sendResetEmail = async (email, code) => {
  try {
    console.log('Attempting to send reset email to:', email);
    console.log('Email configuration check:', {
      hasEmail: !!process.env.EMAIL,
      hasPassword: !!process.env.EMAIL_PASS,
      emailUser: process.env.EMAIL
    });

    const transporter = createTransporter();
    
    const mailOptions = {
      from: `FBR Integration System <${process.env.EMAIL}>`,
      to: email,
      subject: 'Password Reset Request - FBR Integration',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0;">FBR Integration System</h2>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h3 style="color: #333;">Password Reset Request</h3>
            <p style="color: #666; line-height: 1.6;">
              You have requested to reset your password. Please use the following code to complete the reset process:
            </p>
            <div style="background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <h2 style="color: #667eea; font-size: 32px; letter-spacing: 5px; margin: 0;">${code}</h2>
            </div>
            <p style="color: #666; font-size: 14px;">
              This code will expire in 10 minutes. If you didn't request this reset, please ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              This is an automated message from the FBR Integration System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `,
      text: `Password Reset Code: ${code}\n\nThis code will expire in 10 minutes. If you didn't request this reset, please ignore this email.`
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully to:', email);
    return result;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    
    // Provide more specific error information
    if (error.code === 'EAUTH') {
      console.error('Authentication failed - check EMAIL and EMAIL_PASS environment variables');
      throw new Error('Email authentication failed - configuration error');
    } else if (error.code === 'ECONNECTION') {
      console.error('Connection failed - check network and Gmail service availability');
      throw new Error('Email connection failed - service unavailable');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('Connection timeout - Gmail service may be slow');
      throw new Error('Email service timeout - please try again');
    } else {
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }
  }
};

export default sendResetEmail; 