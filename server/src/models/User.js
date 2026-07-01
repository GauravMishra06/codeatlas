import mongoose from 'mongoose';

/**
 * User schema — stores GitHub OAuth profile information.
 * `githubId` is the unique GitHub numeric user ID.
 * `accessToken` is the OAuth token used for Octokit calls.
 */
const userSchema = new mongoose.Schema(
  {
    githubId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    accessToken: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
