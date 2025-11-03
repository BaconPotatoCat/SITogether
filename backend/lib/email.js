const nodemailer = require('nodemailer');

/**
 * Create Gmail email transporter
 * Uses Gmail service for sending verification emails
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD, // Use App Password for Gmail
    },
  });
};

/**
 * Send verification email to user
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {string} verificationToken - Unique verification token
 * @returns {Promise<object>} - Email send result
 */
const sendVerificationEmail = async (email, name, verificationToken) => {
  const transporter = createTransporter();

  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL;
  const verificationUrl = `${frontendUrl}/verify?token=${verificationToken}`;

  // Calculate expiration time (1 hour from now)
  const expirationDate = new Date(Date.now() + 60 * 60 * 1000);
  const expirationTime = expirationDate.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true,
    timeZone: 'Asia/Singapore',
  });

  const mailOptions = {
    from: `"SITogether" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your SITogether Account',
    html: `
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
    `,
    text: `
      Hi ${name},

      Welcome to SITogether!

      Thank you for registering. To complete your registration and start connecting with fellow students, please verify your email address by clicking the link below:

      ${verificationUrl}

      ⏰ IMPORTANT: This verification link will expire on ${expirationTime} SGT (1 hour from now, Singapore Time) for security reasons.

      If you didn't create an account with SITogether, please ignore this email.

      Happy studying!
      The SITogether Team
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

/**
 * Send password reset email to user
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {string} resetToken - Unique password reset token
 * @returns {Promise<object>} - Email send result
 */
const sendPasswordResetEmail = async (email, name, resetToken) => {
  const transporter = createTransporter();

  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_EXTERNALURL;
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  // Calculate expiration time (1 hour from now)
  const expirationDate = new Date(Date.now() + 60 * 60 * 1000);
  const expirationTime = expirationDate.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true,
    timeZone: 'Asia/Singapore',
  });

  const mailOptions = {
    from: `"SITogether" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset Your SITogether Password',
    html: `
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
            .warning {
              background: #fff3cd;
              padding: 12px;
              border-radius: 5px;
              border-left: 4px solid #ffc107;
              color: #856404;
              margin: 15px 0;
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
              <h1>🔒 Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>We received a request to reset the password for your SITogether account.</p>
              <p>To reset your password, please click the button below:</p>
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
              <p><strong>Security Note:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
              <p>Stay safe!<br>The SITogether Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} SITogether. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${name},

      Password Reset Request

      We received a request to reset the password for your SITogether account.

      To reset your password, please click the link below:

      ${resetUrl}

      ⏰ IMPORTANT: This password reset link will expire on ${expirationTime} SGT (1 hour from now, Singapore Time) for security reasons.

      Security Note: If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

      Stay safe!
      The SITogether Team
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

/**
 * Send two-factor authentication code email to user
 * @param {string} email
 * @param {string} name
 * @param {string} code
 * @returns {Promise<object>} - Email send result
 */
const sendTwoFactorEmail = async (email, name, code) => {
  const transporter = createTransporter();

  // Calculate expiration time (10 minutes from now)
  const expirationDate = new Date(Date.now() + 10 * 60 * 1000);
  const expirationTime = expirationDate.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true,
    timeZone: 'Asia/Singapore',
  });

  const mailOptions = {
    from: `"SITogether" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your SITogether Login Code',
    html: `
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
            .code {
              background: white;
              border: 2px dashed #667eea;
              padding: 20px;
              text-align: center;
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #667eea;
              margin: 20px 0;
              border-radius: 10px;
            }
            .warning {
              background: #fff3cd;
              padding: 12px;
              border-radius: 5px;
              border-left: 4px solid #ffc107;
              color: #856404;
              margin: 15px 0;
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
              <h1>🔐 Login Verification Code</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>We received a login request for your SITogether account. Use the following verification code to complete your login:</p>
              <div class="code">${code}</div>
              <div class="warning">
                <strong>⏰ Important:</strong> This code will expire on <strong>${expirationTime} SGT</strong> (10 minutes from now) for security reasons.
              </div>
              <p><strong>Security Note:</strong> If you didn't attempt to log in, please ignore this email and consider changing your password.</p>
              <p>Stay safe!<br>The SITogether Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} SITogether. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${name},

      Login Verification Code

      We received a login request for your SITogether account. Use the following verification code to complete your login:

      ${code}

      ⏰ IMPORTANT: This code will expire on ${expirationTime} SGT (10 minutes from now) for security reasons.

      Security Note: If you didn't attempt to log in, please ignore this email and consider changing your password.

      Stay safe!
      The SITogether Team
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending two-factor authentication email:', error);
    throw new Error('Failed to send two-factor authentication email');
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendTwoFactorEmail,
};
