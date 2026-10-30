# Requisitos sintéticos do piloto técnico Node

Este documento serve exclusivamente para verificar o funcionamento técnico da plataforma. Não representa documentação original de um projeto acadêmico ou resultado da pesquisa.

Projeto de referência: `https://github.com/jonschlinkert/is-number`.
Commit: `98e8ff1da1a89f93d1397a24d7413ed15421c139`.

## RF-P01 — Número finito

A função exportada de verificação numérica deve retornar o booleano `true` quando receber o número `2`.

## RF-P02 — Valor NaN

A função exportada de verificação numérica deve retornar o booleano `false` quando receber `NaN`.

## Limites do oráculo

Os dois cenários não especificam toda a biblioteca, entradas textuais, outras bases numéricas ou cobertura completa. Não criar regras adicionais para entradas não descritas. O objetivo é conferir rastreabilidade, geração e execução de asserções sobre comportamento conhecido, antes de usar projetos e documentos reais da pesquisa.
