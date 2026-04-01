const fs = require("fs");
const path = require("path");

module.exports = (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  try {
    const contentPath = path.join(process.cwd(), "data", "site-content.json");
    const raw = fs.readFileSync(contentPath, "utf8");
    const content = JSON.parse(raw);

    return res.status(200).json(content);
  } catch (error) {
    return res.status(500).json({
      message: "Unable to load portfolio content."
    });
  }
};
