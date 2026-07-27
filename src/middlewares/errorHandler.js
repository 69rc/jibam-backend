/**
 * Global error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  // Handle undefined or malformed error objects
  if (!err || typeof err !== 'object') {
    console.error('❌ Invalid error object received:', err);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    });
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle completely undefined error properties
  if (!err.name && !err.message && !err.stack) {
    console.error('❌ Malformed error object:', {
      err,
      body: req.body,
      files: req.files,
      method: req.method,
      url: req.url,
    });
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during processing',
      timestamp: new Date().toISOString(),
    });
  }

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    statusCode = 422;
    message = 'Validation failed';
    const errors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
    });
  }

  // Sequelize unique constraint
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'A record with this value already exists';
    const field = err.errors[0]?.path;
    return res.status(statusCode).json({
      success: false,
      message: field ? `${field} already in use` : message,
      timestamp: new Date().toISOString(),
    });
  }

  // Sequelize foreign key constraint
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    message = 'Referenced record does not exist';
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'File size too large';
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    statusCode = 400;
    message = 'Too many files uploaded';
  }

  // JWT errors (shouldn't reach here normally but catch just in case)
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Log error in development and production for debugging
  console.error('❌ Error:', {
    name: err.name,
    message: err.message,
    statusCode,
    stack: err.stack,
    // Log additional error details if available
    ...(err.errors && { validationErrors: err.errors }),
    ...(err.code && { code: err.code }),
    // Log request context
    method: req.method,
    url: req.url,
    hasFiles: !!req.files,
    hasBody: !!req.body,
  });

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
};

/**
 * Handle 404 not found
 */
export const notFound = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
};
