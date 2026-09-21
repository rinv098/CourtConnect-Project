const nodemailer = require('nodemailer');

console.log('[MAILER] mailer.js loaded');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

transporter.verify((error) => {
    if (error) {
        console.error('[MAILER] Connection failed:', error.message);
    } else {
        console.log('[MAILER] SMTP connection successful');
    }
});

async function sendResetEmail(to, resetLink) {
    await transporter.sendMail({
        from: `"CourtConnect" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Reset your CourtConnect password',
        html: `<p>Click below to reset your CourtConnect password. This link expires in 30 minutes.</p>
               <a href="${resetLink}">${resetLink}</a>`,
    });
}

async function sendVerificationEmail(to, code) {
    await transporter.sendMail({
        from: `"CourtConnect" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Verify your CourtConnect email',
        html: `<p>Your verification code is:</p>
               <h2>${code}</h2>
               <p>This code expires in 10 minutes.</p>`,
    });
}

async function sendApprovalEmail(to, details) {
    await transporter.sendMail({
        from: `"CourtConnect" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Your reservation was approved!',
        html: `<p>Your booking for ${details.courtName} on ${details.date} at ${details.startTime} has been approved.</p>`,
    });
}

module.exports = {
    sendResetEmail,
    sendVerificationEmail,
    sendApprovalEmail
};