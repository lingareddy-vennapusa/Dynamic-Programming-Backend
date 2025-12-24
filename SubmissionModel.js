const mongoose = require("mongoose");
const SubmissionSchema = new mongoose.Schema({
  studentId: String,
  assessmentId: String,
  language: String,
  results: [{
    problemId: String,
    status: String, // Pass | Fail | Error
    score: Number
  }],
  totalScore: Number
});
module.exports = mongoose.model("Submission", SubmissionSchema);
