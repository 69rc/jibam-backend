import { Cart, CartItem, Product } from '../models/index.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

// Get or create cart for user
const getOrCreateCart = async (userId) => {
  const [cart] = await Cart.findOrCreate({
    where: { userId },
    defaults: { userId },
  });
  return cart;
};

// GET /cart
export const getCart = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user.id);

    const cartWithItems = await Cart.findByPk(cart.id, {
      include: [
        {
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'price', 'image', 'stock', 'prescriptionRequired', 'isActive'],
            },
          ],
        },
      ],
    });

    // Calculate totals
    const items = cartWithItems.items || [];
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return successResponse(res, {
      id: cart.id,
      items,
      subtotal: parseFloat(subtotal.toFixed(2)),
      itemCount,
    });
  } catch (error) {
    next(error);
  }
};

// POST /cart/items — add item to cart
export const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;

    const product = await Product.findOne({
      where: { id: productId, isActive: true },
    });
    if (!product) return errorResponse(res, 'Product not found', 404);

    if (product.stock < quantity) {
      return errorResponse(res, `Only ${product.stock} units available`, 400);
    }

    const cart = await getOrCreateCart(req.user.id);

    // Check if item already in cart
    const existingItem = await CartItem.findOne({
      where: { cartId: cart.id, productId },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + parseInt(quantity);
      if (newQty > product.stock) {
        return errorResponse(res, `Cannot add more. Only ${product.stock} units in stock.`, 400);
      }
      await existingItem.update({ quantity: newQty, price: product.price });
    } else {
      await CartItem.create({
        cartId: cart.id,
        productId,
        quantity: parseInt(quantity),
        price: product.price,
      });
    }

    return successResponse(res, null, 'Item added to cart', 201);
  } catch (error) {
    next(error);
  }
};

// PUT /cart/items/:itemId — update item quantity
export const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return errorResponse(res, 'Quantity must be at least 1', 400);
    }

    const cart = await Cart.findOne({ where: { userId: req.user.id } });
    if (!cart) return errorResponse(res, 'Cart not found', 404);

    const item = await CartItem.findOne({
      where: { id: req.params.itemId, cartId: cart.id },
      include: [{ model: Product, as: 'product' }],
    });

    if (!item) return errorResponse(res, 'Cart item not found', 404);

    if (parseInt(quantity) > item.product.stock) {
      return errorResponse(res, `Only ${item.product.stock} units available`, 400);
    }

    await item.update({ quantity: parseInt(quantity) });

    return successResponse(res, item, 'Cart item updated');
  } catch (error) {
    next(error);
  }
};

// DELETE /cart/items/:itemId — remove item
export const removeFromCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ where: { userId: req.user.id } });
    if (!cart) return errorResponse(res, 'Cart not found', 404);

    const item = await CartItem.findOne({
      where: { id: req.params.itemId, cartId: cart.id },
    });
    if (!item) return errorResponse(res, 'Cart item not found', 404);

    await item.destroy();

    return successResponse(res, null, 'Item removed from cart');
  } catch (error) {
    next(error);
  }
};

// DELETE /cart — clear cart
export const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ where: { userId: req.user.id } });
    if (cart) {
      await CartItem.destroy({ where: { cartId: cart.id } });
    }
    return successResponse(res, null, 'Cart cleared');
  } catch (error) {
    next(error);
  }
};
