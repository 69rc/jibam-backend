import { Router } from 'express';
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from '../controllers/cart.controller.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { addToCartValidator } from '../validators/product.validators.js';

const router = Router();
router.use(protect);
router.get('/', getCart);
router.post('/items', addToCartValidator, validate, addToCart);
router.put('/items/:itemId', updateCartItem);
router.delete('/items/:itemId', removeFromCart);
router.delete('/', clearCart);
export default router;
