const fs = require('fs');
const path = require('path');
const colors = require('colors');
const axios = require('axios').default;

const atob = data => Buffer.from(data, 'base64').toString('utf-8');

const agent = axios.create({
  baseURL: 'https://five-m.store/api',
  headers: require('./publish.json')
})

const bundlePath = path.resolve(__dirname, '..', 'dist', 'bundle.js');

(async () => {
  if (!fs.existsSync(bundlePath))
    return console.error("Couldn't find [bundle.js] in folder [dist]");

  const buffer = fs.readFileSync(bundlePath);
  const file = buffer.toString('utf-8');
  console.log(colors.green('File loaded >>> '), colors.yellow((buffer.length / 1024).toFixed(2)), 'kB');

  console.log('\n', colors.gray('-'.repeat(100)), '\n')

  agent.post('/v2/bundle', {
    file
  }).then(res => {
    console.log(colors[res.status < 300 ? 'green' : 'red'](res.data.message));
  }).catch(e => console.error("Couldn't upload bundle", colors.red(e.code || e.response.statusText + ' ' + e.response.status)));
})();