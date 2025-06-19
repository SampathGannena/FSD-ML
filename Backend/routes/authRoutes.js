const express = require('express');
const router = express.Router();
const { signup, signin } = require('../controllers/authController');
const { forgotPassword } = require('../controllers/authController');
const {resetPassword} = require('../controllers/authController')
// const multer = require('multer');
// const upload = multer({ dest: 'uploads/' });

// router.post('/signup', signup);
router.post('/signup',signup);
router.post('/signin', signin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);


module.exports = router;
