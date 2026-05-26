import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'http://10.26.192.122:8080',
  realm: 'Central-SSWAuth',
  clientId: 'duty-chart',
});

export default keycloak;
