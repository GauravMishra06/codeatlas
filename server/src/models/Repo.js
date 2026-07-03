import mongoose from 'mongoose';

/**
 * Repo schema — represents a GitHub repository connected by a user.
 * `repoId` is the GitHub-assigned unique repository ID (string).
 * `isIngested` flags whether the initial Cognee ingestion is complete.
 */
const repoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    repoId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    isIngested: {
      type: Boolean,
      default: false,
    },
    nodeCount: {
      type: Number,
      default: 0,
    },
    lastAnalyzed: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Repo = mongoose.model('Repo', repoSchema);

export default Repo;
