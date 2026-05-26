const axios = require('axios');
const api = axios.create({ baseURL: 'http://localhost:8000/api/v1/' });
console.log(api.getUri({ url: '/auth/me/' }));
console.log(api.getUri({ url: 'auth/me/' }));
