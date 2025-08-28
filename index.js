const express = require('express');
const app = express();
const port = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.send('<h1>Project 1 is running!</h1>');
});

app.listen(port, () => {
  console.log(`Project 1 listening on port ${port}`);
});
