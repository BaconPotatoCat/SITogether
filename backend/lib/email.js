const nodemailer = require('nodemailer');

/**
 * Create Gmail email transporter
 * Uses Gmail service for sending emails
 */
const createTransporter = () => {
  // Validate email credentials
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error('Email credentials (EMAIL_USER and EMAIL_PASSWORD) are required');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD, // Use App Password for Gmail
    },
  });
};

/**
 * Generic email sending function
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML content for the email
 * @param {string} textContent - Plain text content for the email (optional)
 * @returns {Promise<object>} - Email send result
 */
const sendEmail = async (to, subject, htmlContent, textContent = '') => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"SITogether" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, ''), // Fallback to HTML stripped if no text provided
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Provide more specific error messages
    if (error.message.includes('Missing credentials')) {
      throw new Error('Email service is not configured. Please check EMAIL_USER and EMAIL_PASSWORD environment variables.');
    }
    if (error.code === 'EAUTH') {
      throw new Error('Invalid email credentials. Please check your Gmail App Password.');
    }
    
    throw new Error('Failed to send email');
  }
};

/**
 * Send verification email to user
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {string} verificationToken - Unique verification token
 * @returns {Promise<object>} - Email send result
 */
const sendVerificationEmail = async (email, name, verificationToken) => {
  // Select frontend URL based on environment
  const frontendUrl =
    process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL ||
    process.env.NEXT_PUBLIC_FRONTEND_INTERNALURL ||
    'http://localhost:3000';

  const verificationUrl = `${frontendUrl}/verify?token=${verificationToken}`;

  // Calculate expiration time (1 hour from now)
  const expirationDate = new Date(Date.now() + 60 * 60 * 1000);
  const expirationTime = expirationDate.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true,
    timeZone: 'Asia/Singapore',
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: 600;
            font-size: 16px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to SITogether!</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Thank you for registering with SITogether! We're excited to help you find study buddies at SIT.</p>
            <p>To complete your registration and start connecting with fellow students, please verify your email address by clicking the button below:</p>
            <center>
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </center>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: white; padding: 10px; border-radius: 5px;">
              ${verificationUrl}
            </p>
            <p style="background: #fff3cd; padding: 12px; border-radius: 5px; border-left: 4px solid #ffc107; color: #856404;">
              <strong>⏰ Important:</strong> This verification link will expire on <strong>${expirationTime} SGT</strong> (1 hour from now, Singapore Time) for security reasons.
            </p>
            <p>If you didn't create an account with SITogether, please ignore this email.</p>
            <p>Happy studying!<br>The SITogether Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} SITogether. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
    Hi ${name},

    Welcome to SITogether!

    Thank you for registering. To complete your registration and start connecting with fellow students, please verify your email address by clicking the link below:

    ${verificationUrl}

    ⏰ IMPORTANT: This verification link will expire on ${expirationTime} SGT (1 hour from now, Singapore Time) for security reasons.

    If you didn't create an account with SITogether, please ignore this email.

    Happy studying!
    The SITogether Team
  `;

  return await sendEmail(
    email,
    'Verify Your SITogether Account',
    htmlContent,
    textContent
  );
};

/**
 * Send password reset email to user
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {string} resetToken - Unique reset token
 * @returns {Promise<object>} - Email send result
 */
const sendResetPasswordEmail = async (email, name, resetToken) => {
  // Select frontend URL based on environment
  const frontendUrl =
    process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL ||
    process.env.NEXT_PUBLIC_FRONTEND_INTERNALURL ||
    'http://localhost:3000';

  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  // Calculate expiration time (1 hour from now)
  const expirationDate = new Date(Date.now() + 60 * 60 * 1000);
  const expirationTime = expirationDate.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true,
    timeZone: 'Asia/Singapore',
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: 600;
            font-size: 16px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }
          .warning {
            background: #fff3cd;
            padding: 12px;
            border-radius: 5px;
            border-left: 4px solid #ffc107;
            color: #856404;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>We received a request to reset your password for your SITogether account.</p>
            <p>Click the button below to reset your password:</p>
            <center>
              <a href="${resetUrl}" class="button">Reset Password</a>
            </center>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: white; padding: 10px; border-radius: 5px;">
              ${resetUrl}
            </p>
            <div class="warning">
              <strong>⏰ Important:</strong> This password reset link will expire on <strong>${expirationTime} SGT</strong> (1 hour from now, Singapore Time) for security reasons.
            </div>
            <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
            <p>For security reasons, this link can only be used once.</p>
            <p>Best regards,<br>The SITogether Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} SITogether. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
    Hi ${name},

    We received a request to reset your password for your SITogether account.

    Click the link below to reset your password:

    ${resetUrl}

    ⏰ IMPORTANT: This password reset link will expire on ${expirationTime} SGT (1 hour from now, Singapore Time) for security reasons.

    If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

    For security reasons, this link can only be used once.

    Best regards,
    The SITogether Team
  `;

  return await sendEmail(
    email,
    'Reset Your SITogether Password',
    htmlContent,
    textContent
  );
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendResetPasswordEmail,
};
