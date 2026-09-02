const bcrypt = require('bcryptjs');

const generar = async () => {
  const password = '123';
  const hash = await bcrypt.hash(password, 10);

  console.log(hash);
};

generar();