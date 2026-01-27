// Conversations Module Entry Point
const conversationRoutes = require('./routes/conversationRoutes');
const conversationEmailRoutes = require('./routes/conversationEmailRoutes');
const messageRoutes = require('./routes/messageRoutes');

module.exports = {
    conversationRoutes,
    conversationEmailRoutes,
    messageRoutes
};
