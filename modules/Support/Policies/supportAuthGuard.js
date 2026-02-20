function createSupportAuthGuard({ authRequired }) {
  return async (req, res, next) => {
    await authRequired(req, res, async () => {
      req.context = req.context || {};
      req.context.guard = "support";
      return next();
    });
  };
}

module.exports = {
  createSupportAuthGuard,
};
