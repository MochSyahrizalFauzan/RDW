// hash.js
const bcrypt = require("bcrypt");

(async () => {
  const password = "12345"; // samakan dengan password login
  const hash = await bcrypt.hash(password, 10);
  console.log(hash);
})();
