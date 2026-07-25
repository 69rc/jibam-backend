import { Address } from '../models/index.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import sequelize from '../config/database.js';

// GET /addresses
export const getAddresses = async (req, res, next) => {
  try {
    const addresses = await Address.findAll({
      where: { userId: req.user.id },
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']],
    });
    return successResponse(res, addresses);
  } catch (error) {
    next(error);
  }
};

// POST /addresses
export const createAddress = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { label, fullname, phone, street, city, state, country, postalCode, isDefault } = req.body;

    if (isDefault) {
      await Address.update({ isDefault: false }, { where: { userId: req.user.id }, transaction: t });
    }

    // If first address, make it default
    const count = await Address.count({ where: { userId: req.user.id } });
    const makeDefault = isDefault || count === 0;

    const address = await Address.create(
      { userId: req.user.id, label, fullname, phone, street, city, state, country, postalCode, isDefault: makeDefault },
      { transaction: t }
    );

    await t.commit();
    return successResponse(res, address, 'Address created', 201);
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// PUT /addresses/:id
export const updateAddress = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const address = await Address.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!address) return errorResponse(res, 'Address not found', 404);

    if (req.body.isDefault) {
      await Address.update({ isDefault: false }, { where: { userId: req.user.id }, transaction: t });
    }

    await address.update(req.body, { transaction: t });
    await t.commit();
    return successResponse(res, address, 'Address updated');
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

// DELETE /addresses/:id
export const deleteAddress = async (req, res, next) => {
  try {
    const address = await Address.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!address) return errorResponse(res, 'Address not found', 404);
    await address.destroy();
    return successResponse(res, null, 'Address deleted');
  } catch (error) {
    next(error);
  }
};
