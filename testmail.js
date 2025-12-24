require("dotenv").config();
const sendMail = require("./Sendmail");

sendMail(
  "your_email@gmail.com",
  "Test Mail",
  "<h2>Nodemailer is working 🎉</h2>"
);
