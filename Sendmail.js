const nodemailer = require("nodemailer");
require("dotenv").config();


const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


const sendMail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"CodeAssess Admin" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });

    console.log("✅ Email sent to:", to);
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
  }
};

module.exports = sendMail;
