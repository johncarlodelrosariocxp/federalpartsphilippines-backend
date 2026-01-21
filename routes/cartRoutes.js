const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

// Get user cart
router.get("/", auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.userId }).populate(
      "items.product",
      "name price images"
    );

    if (!cart) {
      cart = { items: [], totalPrice: 0 };
    }

    res.json({
      success: true,
      cart,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Add to cart
router.post("/add", auth, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: req.user.userId });

    if (!cart) {
      cart = new Cart({
        user: req.user.userId,
        items: [
          {
            product: productId,
            quantity,
            price: product.price,
          },
        ],
      });
    } else {
      const itemIndex = cart.items.findIndex(
        (item) => item.product.toString() === productId
      );

      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += quantity;
      } else {
        cart.items.push({
          product: productId,
          quantity,
          price: product.price,
        });
      }
    }

    await cart.save();

    res.json({
      success: true,
      message: "Added to cart",
      cart,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Update cart item
router.put("/item/:itemId", auth, async (req, res) => {
  try {
    const { quantity } = req.body;
    const cart = await Cart.findOne({ user: req.user.userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    item.quantity = quantity;
    await cart.save();

    res.json({
      success: true,
      message: "Cart updated",
      cart,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Remove from cart
router.delete("/item/:itemId", auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    cart.items = cart.items.filter(
      (item) => item._id.toString() !== req.params.itemId
    );
    await cart.save();

    res.json({
      success: true,
      message: "Item removed",
      cart,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;
