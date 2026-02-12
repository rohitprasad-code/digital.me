const { spawn } = require('child_process');
const { openSync } = require('fs');
const net = require('net');

const RETRY_MS = 5000;
const TIMEOUT_MS = 30000;

// Check if port 3000 is ready
const waitForPort = (port) => new Promise((resolve, reject) => {
    const start = Date.now();
    const tryConnect = () => {
        if (Date.now() - start > TIMEOUT_MS) return reject('Timeout waiting for port ' + port);
        const socket = net.connect(port, 'localhost')
            .on('connect', () => { socket.destroy(); resolve(); })
            .on('error', () => setTimeout(tryConnect, RETRY_MS));
    };
    tryConnect();
});

(async () => {
    console.log('Starting dev server...');
    
    // Redirect server logs to a file to keep CLI clean
    const out = openSync('.next-dev.log', 'w');
    const err = openSync('.next-dev.log', 'w');
    
    const server = spawn('npm', ['run', 'dev'], { 
        detached: true, 
        stdio: ['ignore', out, err] 
    });

    const cleanup = () => {
        try { process.kill(-server.pid); } catch {}
    };

    // Ensure we kill the server on exit
    process.on('SIGINT', () => { cleanup(); process.exit(); });
    process.on('SIGTERM', () => { cleanup(); process.exit(); });
    process.on('exit', cleanup);

    // Wait for it to be ready
    try {
        await waitForPort(3000);
        console.log('Server Ready. Launching CLI...');
        
        // Start CLI
        const cli = spawn('npm', ['run', 'cli:exec', '--', ...process.argv.slice(2)], { 
            stdio: 'inherit' 
        });
        
        cli.on('close', (code) => { 
            cleanup(); 
            process.exit(code); 
        });
        
    } catch (err) {
        console.error('Failed to start server:', err);
        cleanup();
        process.exit(1);
    }
})();
