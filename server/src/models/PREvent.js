import mongoose from 'mongoose';

/**
 * PREvent schema — stores pull request data and the results of
 * the AI-driven impact analysis pipeline.
 *
 * `impactedModules` contains the list of modules/files affected
 * by the PR as determined by the Cognee graph + Claude analysis.
 */
const prEventSchema = new mongoose.Schema(
  {
    repoId: {
      type: String,
      required: true,
      index: true,
    },
    prNumber: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    author: {
      type: String,
      required: true,
    },
    diff: {
      type: String,
      default: '',
    },
    changedFiles: {
      type: [String],
      default: [],
    },
    impactedModules: {
      type: [
        {
          name: String,
          filePath: String,
          reason: String,
        },
      ],
      default: [],
    },
    review: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'analyzed', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

const PREvent = mongoose.model('PREvent', prEventSchema);

export default PREvent;
