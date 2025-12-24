const mongoose = require("mongoose");

const AssessmentSchema = new mongoose.Schema({
  title: String,
  problems: [{
    title: String,
    description: String,
    sampleInput: String,
    sampleOutput: String,
    difficulty: String,
    marks: Number
  }],
  published: Boolean
});
module.exports = mongoose.model("Assessment", AssessmentSchema);
