const express = require('express');
const router = express.Router();
const mentorAuth = require('../controllers/mentorAuth');

router.post('/signup', mentorAuth.signup);
router.post('/signin', mentorAuth.mentorSignin);
router.post('/forgot-password', mentorAuth.forgotPassword);
router.post("/reset-password", mentorAuth.resetPassword);


module.exports = router;
