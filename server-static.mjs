import fs from "node:fs";
import path from "node:path";

export function compressedAssets(directory) {
  return (req, res, next) => {
    if (
      !["GET", "HEAD"].includes(req.method) ||
      !/^\/[\w.-]+\.(?:js|css)$/.test(req.path)
    )
      return next();
    res.vary("Accept-Encoding");
    const encoding = req.acceptsEncodings("br", "gzip", "identity");
    if (!encoding || encoding === "identity") return next();
    const file = path.join(
      directory,
      req.path.slice(1) + (encoding === "br" ? ".br" : ".gz"),
    );
    if (!fs.existsSync(file)) return next();
    res.type(path.extname(req.path));
    res.set("Content-Encoding", encoding);
    res.sendFile(file, { maxAge: "1y", immutable: true });
  };
}
