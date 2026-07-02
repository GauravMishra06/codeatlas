import mongoose from 'mongoose';

/**
 * GraphCache schema — short-lived cache of the D3-ready graph
 * for a given repository.
 *
 * A TTL index on `updatedAt` automatically deletes documents
 * 300 seconds (5 minutes) after their last update, forcing a
 * fresh fetch from Cognee on the next request.
 */
const graphCacheSchema = new mongoose.Schema(
  {
    repoId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    nodes: {
      type: Array,
      default: [],
      // Node: { id, name, type, filePath, startLine?, endLine?, codeSnippet?, signature?, source, description }
    },
    edges: {
      type: Array,
      default: [],
      // Edge: { source, target, type, label, confidence?, importStatement? }
    },
    contextDebt: {
      type: Object,
      default: null,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// Auto-expire cached graphs after 5 minutes
graphCacheSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 300 });

const GraphCache = mongoose.model('GraphCache', graphCacheSchema);

export default GraphCache;
