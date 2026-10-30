import bcrypt from 'bcryptjs';

let input = '';
for await (const chunk of process.stdin) {
  input += chunk.toString('utf8');
  if (input.length > 1026) throw new Error('Senha maior que o limite permitido.');
}
const password = input.replace(/\r?\n$/,'');
if (password.length < 12 || Buffer.byteLength(password,'utf8') > 72) throw new Error('Use pelo menos 12 caracteres e até 72 bytes UTF-8 (limite bcrypt).');
console.log(await bcrypt.hash(password,12));
