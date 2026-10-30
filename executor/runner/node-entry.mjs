import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {basename} from 'node:path';

const file=process.env.RESEARCH_TEST_FILE;
if(!/^\/project\/__research_generated__\/ct_[a-f0-9]{32}\.test\.mjs$/.test(file || ''))throw new Error('Invalid generated test entry');
try {await import(pathToFileURL(file));}
catch(error) {
  // Preserve structured loader errors in node:test events instead of parsing stderr.
  test(`Load ${basename(file)}`,()=>{throw error;});
}
