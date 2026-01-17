const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "dist", "cli", "index.js");

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, "utf8");
  if (!content.startsWith("#!")) {
    content = "#!/usr/bin/env node\n" + content;
    fs.writeFileSync(file, content, "utf8");
  }
  try {
    fs.chmodSync(file, 0o755);
  } catch {
    // ignore on platforms that don't support chmod
  }
}
