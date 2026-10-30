import {existsSync,lstatSync,chmodSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {readBundle} from './protocol.mjs';

// Fixed trusted preparation step only. Project code is never imported or executed here.
if(process.getuid?.()!==0 || !existsSync('/opt/research/container-only'))throw new Error('Container initializer required');
const bundle=await readBundle();
const root='/project',stat=lstatSync(root);
if(!stat.isDirectory() || stat.isSymbolicLink() || stat.uid!==0)throw new Error('Invalid project tmpfs');
const directories=new Set([root]);
chmodSync(root,0o700);
try {
  for(const file of [...bundle.source_files,...bundle.generated_tests.flatMap(test=>test.files)]) {
    const path=`${root}/${file.path}`;
    const parents=[];let parent=dirname(path);
    while(parent!==root){parents.unshift(parent);parent=dirname(parent);}
    for(const directory of parents)if(!directories.has(directory)) {
      mkdirSync(directory,{mode:0o700});directories.add(directory);
    }
    writeFileSync(path,file.content ?? file.code,{encoding:'utf8',flag:'wx',mode:0o444});
    chmodSync(path,0o444);
  }
} finally {
  for(const directory of [...directories].sort((a,b)=>b.length-a.length))chmodSync(directory,0o555);
}
