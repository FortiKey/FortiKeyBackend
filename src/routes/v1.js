const express = require('express');  // Import express
const router = express.Router();  // Create a router

router.get('/health', (req, res) => {  // Define a route for the health check
    res.status(200).send('Server is healthy!');  // Send a response
});

module.exports = {
    router
};