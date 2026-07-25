import { Router } from 'express';
import { getAddresses, createAddress, updateAddress, deleteAddress } from '../controllers/address.controller.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createAddressValidator } from '../validators/product.validators.js';

const router = Router();
router.use(protect);
router.get('/', getAddresses);
router.post('/', createAddressValidator, validate, createAddress);
router.put('/:id', updateAddress);
router.delete('/:id', deleteAddress);
export default router;
