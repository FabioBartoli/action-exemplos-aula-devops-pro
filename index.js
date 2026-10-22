const fs = require('node:fs');
const path = require('node:path');

function input(nome, padrao) {
  const valor = process.env[`INPUT_${nome.replace(/ /g, '_').toUpperCase()}`];
  return valor && valor.trim() !== '' ? valor.trim() : padrao;
}

function saida(nome, valor) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${nome}=${valor}\n`);
  }
}

function resumo(texto) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${texto}\n`);
  }
}

function listarYaml(pasta) {
  const arquivos = [];
  for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) {
      arquivos.push(...listarYaml(caminho));
    } else if (/\.ya?ml$/.test(item.name)) {
      arquivos.push(caminho);
    }
  }
  return arquivos;
}

function classificar(ref, donos) {
  if (ref.startsWith('./')) {
    return { ok: true, motivo: 'action do próprio repositório' };
  }

  if (ref.startsWith('docker://')) {
    return ref.includes('@sha256:')
      ? { ok: true, motivo: 'imagem fixada por digest' }
      : { ok: false, motivo: 'imagem sem digest: a tag pode mudar' };
  }

  const [nome, versao] = ref.split('@');
  if (!versao) {
    return { ok: false, motivo: 'sem versão' };
  }

  const dono = nome.split('/')[0].toLowerCase();

  if (/^[0-9a-f]{40}$/.test(versao)) {
    return { ok: true, motivo: 'fixada por SHA' };
  }

  if (/^v?\d+(\.\d+){0,2}$/.test(versao)) {
    return donos.includes(dono)
      ? { ok: true, motivo: 'tag de um dono confiável' }
      : { ok: false, motivo: 'tag de terceiro: prefira o SHA do commit' };
  }

  return { ok: false, motivo: 'branch: o código pode mudar a qualquer momento' };
}

function main() {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const pasta = path.resolve(workspace, input('caminho', '.github'));
  const donos = input('donos-confiaveis', 'actions,github')
    .split(',')
    .map((dono) => dono.trim().toLowerCase())
    .filter(Boolean);
  const falhar = input('falhar', 'false') === 'true';

  if (!fs.existsSync(pasta)) {
    console.log(`::error::Pasta ${path.relative(workspace, pasta) || pasta} não encontrada. Faltou o actions/checkout antes desta action?`);
    process.exit(1);
  }

  const encontradas = [];

  for (const arquivo of listarYaml(pasta)) {
    const relativo = path.relative(workspace, arquivo);
    const linhas = fs.readFileSync(arquivo, 'utf8').split('\n');

    linhas.forEach((linha, indice) => {
      const achou = linha.match(/^\s*(?:-\s*)?uses:\s*['"]?([^\s'"#]+)/);
      if (!achou) return;

      const ref = achou[1];
      const { ok, motivo } = classificar(ref, donos);
      encontradas.push({ arquivo: relativo, linha: indice + 1, ref, ok, motivo });

      if (ok) {
        console.log(`OK     ${relativo}:${indice + 1}  ${ref}  (${motivo})`);
      } else {
        console.log(`::warning file=${relativo},line=${indice + 1}::${ref}: ${motivo}`);
      }
    });
  }

  const avisos = encontradas.filter((item) => !item.ok).length;

  resumo('## Actions encontradas');
  resumo('');
  resumo('| Arquivo | Linha | Action | Situação |');
  resumo('| --- | --- | --- | --- |');
  for (const item of encontradas) {
    resumo(`| ${item.arquivo} | ${item.linha} | \`${item.ref}\` | ${item.ok ? '✅' : '⚠️'} ${item.motivo} |`);
  }
  resumo('');
  resumo(`**Total:** ${encontradas.length} · **Avisos:** ${avisos}`);

  saida('total', encontradas.length);
  saida('avisos', avisos);

  console.log(`Total: ${encontradas.length} | Avisos: ${avisos}`);

  if (falhar && avisos > 0) {
    console.log(`::error::${avisos} action(s) fora das boas práticas de versão`);
    process.exitCode = 1;
  }
}

try {
  main();
} catch (erro) {
  console.log(`::error::${erro.message}`);
  process.exit(1);
}
