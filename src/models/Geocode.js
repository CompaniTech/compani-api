const axios = require('axios');

exports.search = address => axios.get('https://data.geopf.fr/geocodage/search', { params: { q: address } });
