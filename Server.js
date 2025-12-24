// server/index.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();
const Assessment = require("./AssesmentModel");
const Submission = require("./SubmissionModel");
const User = require("./User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("./Middleware/auth");
const role = require("./Middleware/role");
const sendMail = require("./Sendmail");




const app = express();
app.use(cors());
app.use(express.json());



// Create Assessment (Faculty)
app.post(
  "/api/assessments",
  auth,              // 🔑 must be logged in
  role("teacher"),   // 🎓 must be teacher
  async (req, res) => {
    const assessment = new Assessment(req.body);
    await assessment.save();
    res.status(201).json({ message: "Assessment created" });
  }
);


// Get all published assessments
app.get("/api/assessments", async (req, res) => {
  try {
    const assessments = await Assessment.find({ });
    res.json(assessments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




// Run Code API
app.post("/api/run", async (req, res) => {
  const { code, language, input } = req.body;

  try {
    const response = await axios.post(
      "https://api.jdoodle.com/v1/execute",
      {
        clientId: process.env.JDOODLE_CLIENT_ID,
        clientSecret: process.env.JDOODLE_CLIENT_SECRET,
        script: code,
        language: language,
        stdin: input
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Code execution failed" });
  }
});



// Submit Test & Calculate Score
app.post("/api/submit", async (req, res) => {
  try {
    const { studentId, assessmentId, language, results } = req.body;

    const totalScore = results.reduce(
      (sum, r) => sum + r.score,
      0
    );

    const submission = new Submission({
      studentId,
      assessmentId,
      language,
      results,
      totalScore
    });

    await submission.save();

    // 🔑 THIS IS THE KEY FIX
    res.status(201).json({
      message: "Test submitted successfully",
      submissionId: submission._id,   // ✅ return submissionId
      totalScore
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Result Analytics (for Pie Chart)
app.get("/api/result/:submissionId", async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const correct = submission.results.filter(
      r => r.status === "Pass"
    ).length;

    const wrong = submission.results.filter(
      r => r.status === "Fail"
    ).length;

    const error = submission.results.filter(
      r => r.status === "Error"
    ).length;

    res.json({
      correct,
      wrong,
      error,
      total: submission.results.length,
      totalScore: submission.totalScore
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Get single assessment by ID
app.get("/api/assessments/:id", async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id);

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    res.json(assessment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, wantsTeacher } = req.body;

    // ✅ Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    // ✅ Check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: "student",
      isApproved: false,
      wantsTeacher: wantsTeacher === true
    });

    await user.save();

    // 📧 SEND MAIL (DO NOT BREAK REGISTRATION)
    try {
      await sendMail(
        email,
        "Registration Successful 🎉",
        `<p>Hello ${name}, your registration was successful.</p>`
      );
    } catch (mailError) {
      console.error("Mail error:", mailError.message);
      // ❗ DO NOT FAIL REGISTRATION
    }

    res.status(201).json({
      message: "Registration successful"
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err.message);
    res.status(500).json({
      message: "Server error during registration"
    });
  }
});





// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 🔒 ADD THIS CHECK HERE (IMPORTANT)
    if (user.wantsTeacher && !user.isApproved) {
      return res.status(403).json({
        message: "Teacher account pending admin approval"
      });
    }

    // ✅ Issue token ONLY if approved
  const token = jwt.sign(
  { id: user._id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: "1d" }
);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.get(
  "/api/admin/pending-teachers",
  auth,
  role("admin"),
  async (req, res) => {
    const users = await User.find({
      wantsTeacher: true,
      isApproved: false
    });
    res.json(users);
  }
);




app.put(
  "/api/admin/approve-teacher/:id",
  auth,            // 🔑 must be logged in
  role("admin"),   // 👑 must be admin
  async (req, res) => {
    const user = await User.findById(req.params.id);
    user.role = "teacher";
    user.isApproved = true;
    user.wantsTeacher = false;
    await user.save();
    console.log("📧 APPROVAL MAIL TARGET:", user.email);
    
    res.json({ message: "Teacher approved" });
  }
);





app.put(
  "/api/admin/approve-teacher/:id",
  auth,
  role("admin"),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      user.role = "teacher";
      user.isApproved = true;
      user.wantsTeacher = false;
      await user.save();

      // 📧 SEND EMAIL
      await sendMail(
        user.email,
        `Teacher Access Approved – ${new Date().toLocaleString()}`,
        `
          <h2>Congratulations ${user.name}!</h2>
          <p>Your request for <b>Teacher access</b> has been approved.</p>
          <p>You can now log in and create assessments.</p>
          <br/>
          <p>– CodeAssess Team</p>
        `
      );

      res.json({ message: "Teacher approved and email sent" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);


app.put(
  "/api/admin/deny-teacher/:id",
  auth,
  role("admin"),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      user.wantsTeacher = false;
      user.isApproved = false;
      await user.save();

      // 📧 SEND EMAIL
      await sendMail(
        user.email,
        "Teacher Access Request Update",
        `
          <h2>Hello ${user.name},</h2>
          <p>Your request for <b>Teacher access</b> has been reviewed.</p>
          <p>Unfortunately, it was not approved at this time.</p>
          <p>You may contact the administrator for more details.</p>
          <br/>
          <p>– CodeAssess Team</p>
        `
      );

      res.json({ message: "Teacher request denied and email sent" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);














mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));
app.listen(5000, () => console.log("Server running on port 5000"));