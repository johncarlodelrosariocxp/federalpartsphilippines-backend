const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    required: true,
    trim: true,
  },
  images: [
    {
      type: String,
    },
  ],
  helpful: {
    type: Number,
    default: 0,
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure one review per user per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
