# Coffee Price Monitor

Track and compare coffee prices from Slovak specialty roasteries.

## Quick Start

```bash
# Install dependencies
npm install

# Start the web server
npm start
```

Open http://localhost:3000

## Quick Stop

```bash
# Find the process
lsof -i :3000

# Kill it
kill <PID>
```

Or press `Ctrl+C` in the terminal where the server is running.

## Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start web server on port 3000 |
| `npm run scrape` | Scrape all shops once |
| `npm run monitor` | Scrape + detect price changes |
| `npm test` | Run tests |

### CLI Options

```bash
# Scrape specific shop
node src/cli/index.js scrape --shop triple-five

# Start on custom port
node src/cli/index.js serve --port 8080
```

## Shops Tracked

- Triple Five Coffee
- Black.sk
- Goriffee
- Zlaté Zrnko
