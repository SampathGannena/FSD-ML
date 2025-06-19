const Mentor = require('../models/Mentor');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

exports.signup = async (req, res) => {
  try {
    const { domainId, fullname, email, password } = req.body;

    const existingMentor = await Mentor.findOne({ email });
    if (existingMentor) return res.status(400).json({ message: 'Email already registered.' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newMentor = new Mentor({
      domainId,
      fullname,
      email,
      password: hashedPassword
    });

    await newMentor.save();

    res.status(201).json({ message: 'Mentor registered successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.mentorSignin = async (req, res) => {
    try {
      const { domainId, email, password } = req.body;
  
      // Check if the mentor exists
      const mentor = await Mentor.findOne({ email });
      if (!mentor) {
        return res.status(400).json({ message: 'Mentor with this email does not exist.' });
      }
  
      // Verify the domainId
      if (mentor.domainId !== domainId) {
        return res.status(400).json({ message: 'Domain ID does not match.' });
      }
  
      // Compare the provided password with the stored password
      const isMatch = await bcrypt.compare(password, mentor.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect password.' });
      }
  
      // Generate a JWT token for the mentor
      const token = jwt.sign(
        { mentorId: mentor._id, email: mentor.email },
        process.env.JWT_SECRET, // Make sure to set this in your .env file
        { expiresIn: '1h' } // Token expiration time
      );
  
      // Send response with the token
      res.status(200).json({ message: 'Sign-in successful!', token });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
  
    try {
      const mentor = await Mentor.findOne({ email });
  
      if (!mentor) {
        return res.status(404).json({ message: "Mentor not found" });
      }
  
      const token = crypto.randomBytes(32).toString("hex");
      mentor.resetToken = token;
      mentor.resetTokenExpiry = Date.now() + 3600000; // 1 hour
      await mentor.save();
  
      const resetLink = `http://localhost:5500/path/to/reset.html?token=${token}`; // update if needed
  
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_FROM, // your Gmail address
          pass: process.env.EMAIL_PASS, // your Gmail app password
        },
      });
  
      const mailOptions = {
        to: mentor.email,
        from: process.env.EMAIL_FROM,
        subject: "Mentor Reset Password",
        html: `
          <h2>Reset Your Password</h2>
          <p>Click the link below to reset your password:</p>
          <a href="${resetLink}">${resetLink}</a>
          <p>This link will expire in 1 hour.</p>
        `,
      };
  
      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: "Reset link sent to your email." });
  
    } catch (err) {
      console.error("❌ Error sending reset email:", err);
      res.status(500).json({ message: "Server error. Try again." });
    }
  };
  
  exports.resetPassword = async (req, res) => { const { token, password } = req.body;

try { const mentor = await Mentor.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
if (!mentor) return res.status(400).json({ message: "Invalid or expired token." });

const hashedPassword = await bcrypt.hash(password, 10);

mentor.password = hashedPassword;
mentor.resetToken = undefined;
mentor.resetTokenExpiry = undefined;

await mentor.save();

res.status(200).json({ message: "Password has been reset successfully!" });
} catch (err) { res.status(500).json({ message: "Server error. Try again." }); } };