module.exports = (_req, res) => {
  return res.status(501).json({
    authRequired: true,
    authenticated: false,
    message: "Admin editing is not available on this Vercel deployment. Use Railway or another persistent backend."
  });
};
