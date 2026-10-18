import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Pass a local sharp module path; raster export does not add a runtime dependency.
const { default: sharp } = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const source = new URL("../src/assets/read-mark.svg", import.meta.url);
const directory = new URL("../public/icons/", import.meta.url);
await fs.mkdir(directory, { recursive: true });
for (const [size, file] of [[180, "apple-touch-icon.png"], [192, "icon-192.png"], [512, "icon-512.png"]]) {
  await sharp(await fs.readFile(source), { density: 1600 })
    .resize(size, size)
    .flatten({ background: "#ed4b5b" })
    .png()
    .toFile(fileURLToPath(new URL(file, directory)));
}
