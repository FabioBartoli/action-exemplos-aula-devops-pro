# Verificar actions

Action JavaScript que lê os arquivos YAML do repositório, lista todas as actions usadas em `uses:` e aponta as que não seguem as boas práticas de versão.

| Situação | Resultado |
| --- | --- |
| Action local (`./...`) | OK |
| Fixada por SHA do commit | OK |
| Tag de um dono confiável | OK |
| Tag de um dono fora da lista | Aviso |
| Branch ou sem versão | Aviso |

## Uso

```yaml
steps:
  - uses: actions/checkout@v4
  - id: verificar
    uses: FabioBartoli/action-exemplos-aula-devops-pro@v1
    with:
      donos-confiaveis: actions,aws-actions,azure,docker
      falhar: 'false'
  - run: echo "${{ steps.verificar.outputs.avisos }} aviso(s)"
```

O `actions/checkout` é obrigatório antes: a action lê os arquivos do repositório.

## Inputs

| Nome | Padrão | Descrição |
| --- | --- | --- |
| `caminho` | `.github` | Pasta onde procurar os arquivos YAML |
| `donos-confiaveis` | `actions,github` | Donos aceitos com tag de versão |
| `falhar` | `false` | Falhar o job quando houver avisos |

## Outputs

| Nome | Descrição |
| --- | --- |
| `total` | Quantidade de actions encontradas |
| `avisos` | Quantidade de actions com aviso |
