import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

const db = new Database(':memory:');
sqliteVec.load(db);

const sqlite = db.prepare('select sqlite_version() as v').get().v;
const vec = db.prepare('select vec_version() as v').get().v;

db.exec('create virtual table vec_test using vec0(id text primary key, embedding float[4])');
const insert = db.prepare('insert into vec_test(id, embedding) values (?, ?)');
insert.run('a', JSON.stringify([1, 2, 3, 4]));
insert.run('b', JSON.stringify([4, 3, 2, 1]));

const rows = db
  .prepare('select id, distance from vec_test where embedding match ? and k = 2 order by distance')
  .all(JSON.stringify([1, 2, 3, 4]));

console.log(`SQLite ${sqlite} + sqlite-vec ${vec}`);
console.log(rows);
db.close();
