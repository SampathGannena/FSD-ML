let sgMail;
try {
  sgMail = require('@sendgrid/mail');
} catch (error) {
  console.error('Failed to load @sendgrid/mail package:', error.message);
  console.error('Please run: npm install @sendgrid/mail');
}

const sendEmail = async (to, subject, html) => {
  // Check if SendGrid package is loaded
  if (!sgMail) {
    console.error('SendGrid package not available');
    throw new Error('Email service package not installed. Please contact administrator.');
  }

  // Check if SendGrid API key is configured
  if (!process.env.SENDGRID_API_KEY) {
    console.error('SENDGRID_API_KEY not configured in environment variables');
    throw new Error('Email service not configured. Please contact administrator.');
  }

  // Set SendGrid API key
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = {
    to: to,
    from: process.env.EMAIL_FROM || 'noreply@studyfinder.com', // Use verified sender email
    subject: subject,
    html: html,
  };

  console.log(`Attempting to send email to: ${to}`);
  console.log(`From: ${msg.from}`);

  try {
    await sgMail.send(msg);
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error('SendGrid error:', error);
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    throw new Error('Failed to send email. Please try again later.');
  }
};

module.exports = sendEmail;
