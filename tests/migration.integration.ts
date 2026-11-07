/** Verifica preservação de registros ao aplicar migrations para proteger o comportamento do TCC. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

test('migrations preservam registros anteriores e adotam o método atual como padrão', async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Defina TEST_DATABASE_URL local, terminado em _test.');
  const target = new URL(url);
  assert.ok(['localhost','127.0.0.1'].includes(target.hostname) && target.pathname.endsWith('_test'));
  const client = new Client({ connectionString:url });
  await client.connect();
  try {
    await client.query('BEGIN');
    const schema = 'e4_migration_' + randomUUID().replaceAll('-','');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    for (const name of ['0001_initial','0002_user_session_version','0003_policy_analyses'])
      await client.query(await readFile(path.join(__dirname,'../prisma/migrations',name,'migration.sql'),'utf8'));
    await client.query(`INSERT INTO users (id,name,email,password_hash,updated_at) VALUES ('owner','Test','e4@example.test','fixture',NOW())`);
    await client.query(`INSERT INTO policy_analyses (id,user_id,original_filename,storage_key,file_sha256,byte_size,document_scope,status,result,updated_at)
      VALUES ('old','owner','old.txt','old.txt','hash',4,'full_document','completed','{"untouched":true,"score":45}',NOW())`);
    const before = (await client.query('SELECT * FROM policy_analyses WHERE id = $1',['old'])).rows[0];
    await client.query(await readFile(path.join(__dirname,'../prisma/migrations/20260928000100_analysis_v2/migration.sql'),'utf8'));
    const after = (await client.query('SELECT * FROM policy_analyses WHERE id = $1',['old'])).rows[0];
    assert.equal(after.result_schema_version,1); assert.equal(after.profile_id,null); assert.equal(after.supersedes_analysis_id,null);
    for (const key of Object.keys(before)) assert.deepEqual(after[key],before[key]);
    await client.query(`INSERT INTO policy_analyses (id,user_id,original_filename,storage_key,file_sha256,byte_size,document_scope,updated_at,result_schema_version,profile_id,supersedes_analysis_id)
      VALUES ('new','owner','new.txt','new.txt','hash',4,'full_document',NOW(),2,'core-14-v1','old')`);
    for (const sql of ["UPDATE policy_analyses SET profile_id=NULL WHERE id='new'", "UPDATE policy_analyses SET supersedes_analysis_id='new' WHERE id='new'",
      "UPDATE policy_analyses SET supersedes_analysis_id='missing' WHERE id='new'", "UPDATE policy_analyses SET result_schema_version=3 WHERE id='new'"]) {
      await client.query('SAVEPOINT invalid_case');
      await assert.rejects(client.query(sql));
      await client.query('ROLLBACK TO SAVEPOINT invalid_case');
    }
    await client.query(await readFile(path.join(__dirname, '../prisma/migrations/20261012000100_default_policy_evaluation/migration.sql'), 'utf8'));
    assert.deepEqual((await client.query('SELECT * FROM policy_analyses WHERE id = $1', ['old'])).rows[0], after);
    await client.query(`INSERT INTO policy_analyses (id,user_id,original_filename,storage_key,file_sha256,byte_size,document_scope,updated_at)
      VALUES ('current','owner','current.txt','current.txt','hash',4,'full_document',NOW())`);
    const current = (await client.query('SELECT * FROM policy_analyses WHERE id = $1', ['current'])).rows[0];
    assert.equal(current.result_schema_version, 2);
    assert.equal(current.profile_id, 'core-14-v1');
    await client.query(await readFile(path.join(__dirname, '../prisma/migrations/20261012000200_registration_and_analysis_deletion/migration.sql'), 'utf8'));
    assert.deepEqual((await client.query('SELECT * FROM policy_analyses WHERE id = $1', ['old'])).rows[0], after);
    await client.query('SAVEPOINT duplicate_email');
    await assert.rejects(client.query(`INSERT INTO users (id,name,email,password_hash,updated_at) VALUES ('duplicate','Teste',' E4@EXAMPLE.TEST ','hash',NOW())`));
    await client.query('ROLLBACK TO SAVEPOINT duplicate_email');
    await client.query("DELETE FROM policy_analyses WHERE id = 'old'");
    assert.equal((await client.query("SELECT supersedes_analysis_id FROM policy_analyses WHERE id = 'new'")).rows[0].supersedes_analysis_id, null);
    const historical = (await client.query('SELECT * FROM policy_analyses ORDER BY id')).rows;
    await client.query(await readFile(path.join(__dirname, '../prisma/migrations/20261106000100_documentary_18_profile/migration.sql'), 'utf8'));
    assert.deepEqual((await client.query('SELECT * FROM policy_analyses ORDER BY id')).rows, historical);
    await client.query(`INSERT INTO policy_analyses (id,user_id,original_filename,storage_key,file_sha256,byte_size,document_scope,updated_at)
      VALUES ('r10','owner','r10.txt','r10.txt','hash',4,'full_document',NOW())`);
    assert.equal((await client.query("SELECT profile_id FROM policy_analyses WHERE id='r10'")).rows[0].profile_id, 'documentary-18-v1');
    await client.query('SAVEPOINT unknown_profile');
    await assert.rejects(client.query("UPDATE policy_analyses SET profile_id='unknown' WHERE id='r10'"));
    await client.query('ROLLBACK TO SAVEPOINT unknown_profile');
    const beforeSelection = (await client.query('SELECT * FROM policy_analyses ORDER BY id')).rows;
    const selectionSql = await readFile(path.join(__dirname, '../prisma/migrations/20261106000200_assessment_scope/migration.sql'), 'utf8');
    await client.query(selectionSql.replace(/^BEGIN;|^COMMIT;/gm, ''));
    const afterSelection = (await client.query('SELECT * FROM policy_analyses ORDER BY id')).rows;
    for (let i=0;i<beforeSelection.length;i++) {
      const {assessment_scope,...rest}=afterSelection[i];
      assert.equal(assessment_scope,null);assert.deepEqual(rest,beforeSelection[i]);
    }
    await client.query(`INSERT INTO policy_analyses (id,user_id,original_filename,storage_key,file_sha256,byte_size,document_scope,updated_at,result_schema_version,profile_id,assessment_scope)
      VALUES ('r11','owner','r11.txt','r11.txt','hash',4,'full_document',NOW(),3,'documentary-18-v1','{"mode":"selected_categories","category_ids":["security"]}')`);
    await client.query('SAVEPOINT missing_selection');
    await assert.rejects(client.query("UPDATE policy_analyses SET assessment_scope=NULL WHERE id='r11'"));
    await client.query('ROLLBACK TO SAVEPOINT missing_selection');
  } finally { await client.query('ROLLBACK'); await client.end(); }
});
