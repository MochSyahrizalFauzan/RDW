module.exports = function requireRole(roles = []) {
  return (req, res, next) => {
    const role = req.headers["x-user-role"]; // dikirim dari frontend
    if (!role) {
      return res.status(401).json({ message: "Role tidak ditemukan" });
    }

    if (!roles.includes(role)) {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    next();
  };
};
