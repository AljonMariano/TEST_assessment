module.exports = {
    apps: [{
        name: "omni-channel-server",
        script: "server.js",
        watch: false,
        autorestart: true,
        max_restarts: 10,
        restart_delay: 1000,
        env: {
            NODE_ENV: "development",
        }
    }]
}; 