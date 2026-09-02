const probarLogin = async () => {
  try {
    const respuesta = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        login: 'admin',
        password: '123'
      })
    });

    const datos = await respuesta.json();

    console.log(datos);
  } catch (error) {
    console.error('Error probando login:', error);
  }
};

probarLogin();