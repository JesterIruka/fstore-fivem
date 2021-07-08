import * as db from '../database';
import * as api from '../api';
import config from '../utils/config';

let last: any[] = [];

async function coroutine() {
  const ids = await db.pluck('SELECT id FROM vrp_users', 'id');
  const seq = sequence(ids);

  const len = JSON.stringify(seq).length;
  if (len > 65000) return;

  if (hasChanges(seq, last))
    await api.setMetadata('ids', last = seq);
}

db.onConnect(() => {
  db.queryTables().then((tables) => {
    const prefix = config.snowflake.database_prefix || 'vrp';
    if (tables.includes(prefix + '_users')) {
      setInterval(coroutine, 10000);
      console.log('Monitorando ids disponíveis em ' + prefix + '_users...');
    }
  }).catch(err => console.error(err.message));
});

function hasChanges(a: any[] = [], b: any[] = []) {
  if (a.length != b.length) return true;
  for (let k in a) if (a[k] != b[k]) return true;
  for (let k in b) if (b[k] != a[k]) return true;
  return false;
}

function sequence(ids) {
  let sequences: any[] = [];

  let curSeq: any[] = [];
  for (let v of ids) {
    if (curSeq.length == 0 || curSeq[curSeq.length - 1] == v - 1) {
      curSeq.push(v);
    } else {
      sequences.push(curSeq);
      curSeq = [v];
    }
  }
  if (curSeq.length) sequences.push(curSeq);

  return sequences.map(a => {
    const [first,last] = a;
    if (last && first != last) return first+'-'+last;
    else return first;
  });
}

