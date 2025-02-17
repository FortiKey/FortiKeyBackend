
const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.get('/health', (req, res) => {
    res.status(200).send('Server is healthy!');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

