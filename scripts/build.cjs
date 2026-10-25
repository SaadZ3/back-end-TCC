const { rmSync } = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const output = path.join(projectRoot, 'dist');
if (path.dirname(output) !== projectRoot || path.basename(output) !== 'dist') {
  throw new Error('Diretório de compilação inválido.');
}
// Impede que módulos removidos do fonte continuem disponíveis na execução compilada.
rmSync(output, { recursive: true, force: true });
execFileSync(process.execPath, [path.join(projectRoot, 'node_modules/typescript/bin/tsc')], {
  cwd: projectRoot, stdio: 'inherit',
});
