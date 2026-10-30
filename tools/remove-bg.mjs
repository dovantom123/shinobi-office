import { removeBackground } from '@imgly/background-removal-node';
import fs from 'fs';
const [src, out] = process.argv.slice(2);
for (const id of ['naruto', 'ino', 'jiraiya', 'minato', 'shikamaru', 'sai', 'neji']) {
  const t = Date.now();
  const blob = new Blob([fs.readFileSync(`${src}/${id}.png`)], { type: 'image/png' });
  const res = await removeBackground(blob, { model: 'medium', output: { format: 'image/png' } });
  fs.writeFileSync(`${out}/${id}.png`, Buffer.from(await res.arrayBuffer()));
  console.log(id, Date.now() - t, 'ms');
}
