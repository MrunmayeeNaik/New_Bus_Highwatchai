const { spawn } = require('child_process');
const path = require('path');

console.log('Starting NeoBus Backend and Frontend concurrently...');

const rootDir = __dirname;
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

const isWindows = process.platform === 'win32';
const pythonPath = isWindows 
  ? path.join(rootDir, 'venv', 'Scripts', 'python.exe')
  : path.join(rootDir, 'venv', 'bin', 'python');

// Spawn Backend
console.log(`Spawning Backend from: ${backendDir}`);
const backendProcess = spawn(pythonPath, ['-m', 'uvicorn', 'app.main:app', '--reload'], {
  cwd: backendDir,
  shell: true
});

// Spawn Frontend
console.log(`Spawning Frontend from: ${frontendDir}`);
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const frontendProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: frontendDir,
  shell: true
});

// Prefix console logs
function prefixLogs(processName, stream, colorCode) {
  stream.on('data', (data) => {
    const output = data.toString();
    const lines = output.split('\n');
    lines.forEach(line => {
      // Remove trailing \r characters on Windows
      const cleaned = line.replace(/\r$/, '');
      if (cleaned) {
        console.log(`\x1b[${colorCode}m[${processName}]\x1b[0m ${cleaned}`);
      }
    });
  });
}

prefixLogs('Backend', backendProcess.stdout, '36'); // Cyan
prefixLogs('Backend', backendProcess.stderr, '36'); // Cyan (warnings often go to stderr)
prefixLogs('Frontend', frontendProcess.stdout, '35'); // Magenta
prefixLogs('Frontend', frontendProcess.stderr, '35'); // Magenta

// Handle exits
backendProcess.on('close', (code) => {
  console.log(`Backend process closed with code ${code}`);
  frontendProcess.kill();
  process.exit(code);
});

frontendProcess.on('close', (code) => {
  console.log(`Frontend process closed with code ${code}`);
  backendProcess.kill();
  process.exit(code);
});

// Handle termination signals
const cleanup = () => {
  console.log('Shutting down processes...');
  backendProcess.kill();
  frontendProcess.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
