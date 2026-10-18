import fs from "node:fs";
import path from "node:path";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";

export function compressBuild(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) compressBuild(file);
    else if (/\.(?:js|css)$/.test(entry.name)) {
      const source = fs.readFileSync(file);
      fs.writeFileSync(`${file}.gz`, gzipSync(source, { level: 9 }));
      fs.writeFileSync(
        `${file}.br`,
        brotliCompressSync(source, {
          params: { [constants.BROTLI_PARAM_QUALITY]: 8 },
        }),
      );
    }
  }
}
