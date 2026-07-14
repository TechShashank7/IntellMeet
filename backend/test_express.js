const express = require("express");
const app = express();

app.get("/api/meetings/:id", (req, res) => res.send("id matched: " + req.params.id));
app.get("/api/meetings/:id/export", (req, res) => res.send("export matched: " + req.params.id));

app.listen(5001, () => {
  console.log("Started on 5001");
});
