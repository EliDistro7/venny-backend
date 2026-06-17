function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  console.error(err);

  if (err instanceof require("multer").MulterError) {
    return res.status(400).json({ message: err.message });
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    message: err.message || "Something went wrong on the server",
  });
}

module.exports = { notFound, errorHandler };
